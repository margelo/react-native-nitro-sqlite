import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    if let loadFileFixturePath = Bundle.main.path(
      forResource: "load-file-with-error",
      ofType: "sql"
    ) {
      UserDefaults.standard.set(loadFileFixturePath, forKey: "loadFileFixturePath")
    }

    return true
  }
}
