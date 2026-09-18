#!/usr/bin/env ruby

require "json"
require "open3"
require "tmpdir"

ROOT = File.expand_path("..", __dir__)
ANDROID_FLAGS = File.join(ROOT, "packages", "react-native-nitro-sqlite", "android", "sqlite-flags.gradle")
PODSPEC = File.join(ROOT, "packages", "react-native-nitro-sqlite", "RNNitroSQLite.podspec")
CMAKE = File.join(ROOT, "packages", "react-native-nitro-sqlite", "android", "CMakeLists.txt")

def main
  Dir.mktmpdir("nitro-sqlite-android") do |directory|
    prepare_gradle_project(directory)

    default_flags = flags_for(directory, {})
    assert_equal(default_flags, ["-DSQLITE_THREADSAFE=1", *ios_performance_flags])
    assert_cmake_definitions(directory, default_flags, "1", true)
    assert_equal(flags_for(directory, nil), default_flags)
    unoptimized_flags = flags_for(directory, {"nitroSQLite" => {"performanceMode" => false}})
    assert_equal(unoptimized_flags, ["-DSQLITE_THREADSAFE=1"])
    assert_cmake_definitions(directory, unoptimized_flags, "1", false)
    assert_equal(flags_for(directory, {"nitroSQLite" => {"threadSafe" => false}}), ["-DSQLITE_THREADSAFE=0", *ios_performance_flags])
    assert_equal(flags_for(directory, {"nitroSQLite" => {"threadSafe" => false, "performanceMode" => false}}), ["-DSQLITE_THREADSAFE=0"])

    custom_flags = flags_for(directory, {}, "-DSQLITE_THREADSAFE=0 -DSQLITE_DQS=3 -DSQLITE_ENABLE_FTS5=1")
    assert_equal(custom_flags, default_flags.reject { |flag| flag.start_with?("-DSQLITE_THREADSAFE=", "-DSQLITE_DQS=") })
    assert_cmake_definitions(directory, custom_flags, "0", true, ["-DSQLITE_THREADSAFE=0", "-DSQLITE_DQS=3"])
    legacy_flags = flags_for(directory, {}, "-DTHREADSAFE=0")
    assert_equal(legacy_flags, default_flags.reject { |flag| flag.start_with?("-DSQLITE_THREADSAFE=") })

    assert_invalid_config(directory, {"nitroSQLite" => true}, "nitroSQLite in package.json must be an object")
    assert_invalid_config(directory, {"nitroSQLite" => {"threadSafe" => 1}}, "nitroSQLite.threadSafe in package.json must be true or false")
    assert_invalid_config(directory, {"nitroSQLite" => {"performanceMode" => "false"}}, "nitroSQLite.performanceMode in package.json must be true or false")
  end

  puts "Android SQLite flag configuration tests passed"
end

def prepare_gradle_project(directory)
  android_directory = File.join(directory, "android")
  Dir.mkdir(android_directory)
  File.write(File.join(android_directory, "build.gradle"), <<~GRADLE)
    apply from: #{ANDROID_FLAGS.inspect}

    tasks.register("showSqliteFlags") {
      doLast {
        println("SQLITE_FLAGS_RESULT=" + project.ext.nitroSqliteDefaultFlags.join("|"))
      }
    }
  GRADLE
end

def flags_for(directory, package_contents, custom_flags = nil)
  output, status = run_gradle(directory, package_contents, custom_flags)
  fail output unless status.success?

  result = output.lines.find { |line| line.start_with?("SQLITE_FLAGS_RESULT=") }
  fail "Missing SQLite flags in Gradle output: #{output}" unless result

  result.delete_prefix("SQLITE_FLAGS_RESULT=").strip.split("|")
end

def assert_invalid_config(directory, package_contents, expected_message)
  output, status = run_gradle(directory, package_contents)
  fail "Expected Gradle configuration to fail" if status.success?
  fail "Unexpected Gradle error: #{output}" unless output.include?(expected_message)
end

def run_gradle(directory, package_contents, custom_flags = nil)
  package_file = File.join(directory, "package.json")
  if package_contents.nil?
    File.delete(package_file) if File.exist?(package_file)
  else
    File.write(package_file, JSON.generate(package_contents))
  end

  command = ["gradle", "-q", "--offline", "--no-daemon", "--project-dir", File.join(directory, "android"), "showSqliteFlags"]
  command << "-PnitroSqliteFlags=#{custom_flags}" if custom_flags
  stdout, stderr, status = Open3.capture3({"GRADLE_USER_HOME" => File.join(directory, "gradle-home")}, *command)
  [stdout + stderr, status]
end

def ios_performance_flags
  match = File.read(PODSPEC).match(/optimized_cflags = '([^']+)'/)
  fail "Missing iOS performance flags" unless match

  match[1].split
end

def assert_cmake_definitions(directory, default_flags, thread_safe, performance_mode, custom_flags = [])
  cmake_source = File.read(CMAKE)
  fail "CMake does not pass default SQLite flags" unless cmake_source.include?("\${SQLITE_DEFAULT_FLAGS}")

  source_directory = File.join(directory, "cmake-probe")
  Dir.mkdir(source_directory) unless Dir.exist?(source_directory)
  File.write(File.join(source_directory, "CMakeLists.txt"), <<~CMAKE_FILE)
    cmake_minimum_required(VERSION 3.13)
    project(NitroSQLiteFlagsProbe C)
    add_definitions(${SQLITE_DEFAULT_FLAGS} ${SQLITE_FLAGS})
    add_executable(probe probe.c)
  CMAKE_FILE
  File.write(File.join(source_directory, "probe.c"), <<~C_FILE)
    #if SQLITE_THREADSAFE != #{thread_safe}
    #error Incorrect SQLITE_THREADSAFE value
    #endif
    #{performance_mode ? "#if !defined(SQLITE_DQS)\n#error Missing performance flags\n#endif" : "#ifdef SQLITE_DQS\n#error Unexpected performance flags\n#endif"}
    int main(void) { return 0; }
  C_FILE

  build_directory = File.join(directory, "cmake-build-#{thread_safe}-#{performance_mode}-#{custom_flags.length}")
  configure_command = ["cmake", "-S", source_directory, "-B", build_directory,
                       "-DSQLITE_DEFAULT_FLAGS=#{default_flags.join(';')}", "-DSQLITE_FLAGS=#{custom_flags.join(';')}"]
  configure_output, configure_status = Open3.capture2e(*configure_command)
  fail configure_output unless configure_status.success?

  build_output, build_status = Open3.capture2e("cmake", "--build", build_directory)
  fail build_output unless build_status.success?
end

def assert_equal(actual, expected)
  fail "Expected #{expected.inspect}, got #{actual.inspect}" unless actual == expected
end

main
