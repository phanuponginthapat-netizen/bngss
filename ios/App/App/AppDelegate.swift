import UIKit
import Capacitor
#if canImport(FirebaseCore) && canImport(FirebaseMessaging)
import FirebaseCore
import FirebaseMessaging
#endif

// การแจ้งเตือนบน iPhone (IPA):
// ถ้าเพิ่มแพ็กเกจ Firebase (FirebaseCore + FirebaseMessaging) และไฟล์ GoogleService-Info.plist
// ใน Xcode แล้ว แอปจะแปลง APNs token เป็น FCM token ส่งให้หน้าเว็บ → ระบบส่งแจ้งเตือนผ่าน FCM
// แบบเดียวกับ Android ได้ทันที แม้ปิดแอปหรือล็อกจออยู่
@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        #if canImport(FirebaseCore) && canImport(FirebaseMessaging)
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
        }
        #endif
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        #if canImport(FirebaseCore) && canImport(FirebaseMessaging)
        if FirebaseApp.app() != nil {
            Messaging.messaging().apnsToken = deviceToken
            Messaging.messaging().token { token, error in
                if let error = error {
                    NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
                } else if let token = token {
                    NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
                }
            }
            return
        }
        #endif
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
