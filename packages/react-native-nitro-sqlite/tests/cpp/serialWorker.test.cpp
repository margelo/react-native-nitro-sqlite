#include "NitroSQLiteDatabaseConnections.hpp"
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <future>
#include <iostream>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

using margelo::nitro::rnnitrosqlite::SerialWorker;

namespace {

void expect(bool condition, const std::string& message) {
  if (!condition) {
    throw std::runtime_error(message);
  }
}

// Holds the worker from inside its own operation and signals once that reference is gone.
struct LastReference {
  std::shared_ptr<SerialWorker> worker;
  std::promise<void> released;

  ~LastReference() {
    worker.reset();
    released.set_value();
  }
};

} // namespace

int main() {
  try {
    {
      SerialWorker worker("fifo");
      std::mutex mutex;
      std::vector<int> order;
      std::thread::id workerThread;
      std::promise<void> done;
      for (int i = 0; i < 100; i++) {
        worker.enqueue([&, i] {
          std::lock_guard lock(mutex);
          order.push_back(i);
          workerThread = std::this_thread::get_id();
        });
      }
      worker.enqueue([] { throw std::runtime_error("expected failure"); });
      worker.enqueue([&] { done.set_value(); });
      expect(done.get_future().wait_for(std::chrono::seconds(5)) == std::future_status::ready,
             "operations after a throwing operation must still run");
      std::lock_guard lock(mutex);
      expect(order.size() == 100, "every operation must run");
      for (int i = 0; i < 100; i++) {
        expect(order[i] == i, "operations must run in submission order");
      }
      expect(workerThread != std::this_thread::get_id(), "operations must run off the submitting thread");
    }

    {
      // Destroying the worker must run the operations it still holds before the thread stops.
      std::atomic<int> completed = 0;
      {
        SerialWorker worker("drain");
        for (int i = 0; i < 50; i++) {
          worker.enqueue([&] {
            std::this_thread::sleep_for(std::chrono::microseconds(100));
            completed++;
          });
        }
      }
      expect(completed == 50, "destruction must drain queued operations");
    }

    {
      // The last reference to a worker may be dropped by one of its own operations.
      std::mutex gateMutex;
      std::condition_variable gate;
      bool open = false;
      auto worker = std::make_shared<SerialWorker>("self-release");
      auto reference = std::make_shared<LastReference>();
      reference->worker = worker;
      auto releasedFuture = reference->released.get_future();
      worker->enqueue([reference = std::move(reference), &gateMutex, &gate, &open] {
        std::unique_lock lock(gateMutex);
        gate.wait(lock, [&] { return open; });
      });
      worker.reset();
      {
        std::lock_guard lock(gateMutex);
        open = true;
      }
      gate.notify_one();
      expect(releasedFuture.wait_for(std::chrono::seconds(5)) == std::future_status::ready,
             "a worker released by its own operation must not deadlock");
    }

    std::cout << "[PASS] serial worker order, failures, draining and self-release\n";
    return 0;
  } catch (const std::exception& error) {
    std::cerr << "[FAIL] " << error.what() << '\n';
    return 1;
  }
}
