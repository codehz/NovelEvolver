import Foundation
import NitroModules

class HybridNativeStreamFetch: HybridNativeStreamFetchSpec {
  private static let session: URLSession = {
    let configuration = URLSessionConfiguration.default
    configuration.timeoutIntervalForRequest = 600
    configuration.timeoutIntervalForResource = 86_400
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    configuration.urlCache = nil
    return URLSession(configuration: configuration)
  }()

  func newBuilder(url: String) throws -> any HybridStreamFetchBuilderSpec {
    return HybridStreamFetchBuilder(url: url, session: HybridNativeStreamFetch.session)
  }
}
