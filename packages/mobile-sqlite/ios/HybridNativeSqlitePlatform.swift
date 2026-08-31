import Foundation
import NitroModules

class HybridNativeSqlitePlatform : HybridNativeSqlitePlatformSpec {
  func getBaseDirectory() throws -> String {
    let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
    guard let documentsPath = paths.first else {
      throw RuntimeError.error(withMessage: "Cannot find Documents directory for SQLite files")
    }
    return documentsPath.path
  }
}
