import Foundation
import NitroModules

class HybridNativeFs : HybridNativeFsSpec {
  private let relativeDirectory = "novelevolver/projects"
  private let npkSuffix = ".npk"

  func listNpkFiles() throws -> [String] {
    let directory = try projectsDirectory()
    let contents = (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []
    return contents.filter { $0.lowercased().hasSuffix(self.npkSuffix) }.sorted()
  }

  func fileExists(fileName: String) throws -> Bool {
    return FileManager.default.fileExists(atPath: try resolve(fileName: fileName).path)
  }

  func deleteFile(fileName: String) throws {
    let file = try resolve(fileName: fileName)
    let manager = FileManager.default
    for suffix in ["-journal", "-wal", "-shm"] {
      let sidecar = file.path + suffix
      if manager.fileExists(atPath: sidecar) {
        try manager.removeItem(atPath: sidecar)
      }
    }
    if manager.fileExists(atPath: file.path) {
      try manager.removeItem(at: file)
    }
  }

  func renameFile(fromFileName: String, toFileName: String) throws {
    let from = try resolve(fileName: fromFileName)
    let to = try resolve(fileName: toFileName)
    if FileManager.default.fileExists(atPath: to.path) {
      throw RuntimeError.error(withMessage: "目标文件已存在")
    }
    try FileManager.default.moveItem(at: from, to: to)
    for suffix in ["-journal", "-wal", "-shm"] {
      let sidecar = from.path + suffix
      if FileManager.default.fileExists(atPath: sidecar) {
        try FileManager.default.moveItem(atPath: sidecar, toPath: to.path + suffix)
      }
    }
  }

  func importNpkFile() throws -> Promise<String> {
    return Promise.async {
      throw RuntimeError.error(withMessage: "iOS 文件导入尚未实现")
    }
  }

  func shareFile(fileName: String) throws {
    _ = fileName
    throw RuntimeError.error(withMessage: "iOS 分享尚未实现")
  }

  func notifyChanged() throws {}

  func pickUtf8File() throws -> Promise<String> {
    return Promise.async {
      throw RuntimeError.error(withMessage: "iOS 文件导入尚未实现")
    }
  }

  func shareUtf8File(fileName: String, content: String) throws {
    _ = fileName
    _ = content
    throw RuntimeError.error(withMessage: "iOS 分享尚未实现")
  }

  private func documentsDirectory() throws -> URL {
    let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
    guard let documentsPath = paths.first else {
      throw RuntimeError.error(withMessage: "Cannot find Documents directory")
    }
    return documentsPath
  }

  private func projectsDirectory() throws -> URL {
    let directory = try documentsDirectory().appendingPathComponent(relativeDirectory, isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory
  }

  private func resolve(fileName: String) throws -> URL {
    if fileName.isEmpty || fileName == "." || fileName == ".." || fileName.contains("/") || fileName.contains("\\") {
      throw RuntimeError.error(withMessage: "Invalid project file name")
    }
    if !fileName.lowercased().hasSuffix(npkSuffix) {
      throw RuntimeError.error(withMessage: "Not an npk file")
    }
    let directory = try projectsDirectory().standardizedFileURL
    let file = directory.appendingPathComponent(fileName).standardizedFileURL
    if file.deletingLastPathComponent().path != directory.path {
      throw RuntimeError.error(withMessage: "Invalid project file name")
    }
    return file
  }
}
