import Foundation
import NitroModules

class HybridStreamFetchRequest: HybridStreamFetchRequestSpec {
  private let task: URLSessionDataTask
  private let delegate: URLSessionDataDelegate

  init(task: URLSessionDataTask, delegate: URLSessionDataDelegate) {
    self.task = task
    self.delegate = delegate
    super.init()
  }

  func start() throws {
    task.resume()
  }

  func cancel() throws {
    task.cancel()
  }
}
