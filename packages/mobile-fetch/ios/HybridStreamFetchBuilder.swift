import Foundation
import NitroModules

class HybridStreamFetchBuilder: HybridStreamFetchBuilderSpec {
  private let url: String
  private let session: URLSession
  private var request: URLRequest
  private var onResponseCallback: ((_ info: StreamFetchResponseInfo) -> Void)?
  private var onChunkCallback: ((_ bytes: ArrayBuffer) -> Void)?
  private var onCompleteCallback: (() -> Void)?
  private var onErrorCallback: ((_ message: String) -> Void)?

  init(url: String, session: URLSession) {
    self.url = url
    self.session = session
    self.request = URLRequest(url: URL(string: url) ?? URL(fileURLWithPath: "/"))
    self.request.cachePolicy = .reloadIgnoringLocalCacheData
    super.init()
  }

  func setMethod(httpMethod: String) throws {
    request.httpMethod = httpMethod
  }

  func addHeader(name: String, value: String) throws {
    request.addValue(value, forHTTPHeaderField: name)
  }

  func setBodyString(body: String) throws {
    request.httpBody = body.data(using: .utf8)
  }

  func setBodyBytes(body: ArrayBuffer) throws {
    request.httpBody = body.toData(copyIfNeeded: true)
  }

  func onResponse(callback: @escaping (_ info: StreamFetchResponseInfo) -> Void) throws {
    onResponseCallback = callback
  }

  func onChunk(callback: @escaping (_ bytes: ArrayBuffer) -> Void) throws {
    onChunkCallback = callback
  }

  func onComplete(callback: @escaping () -> Void) throws {
    onCompleteCallback = callback
  }

  func onError(callback: @escaping (_ message: String) -> Void) throws {
    onErrorCallback = callback
  }

  func build() throws -> any HybridStreamFetchRequestSpec {
    guard URL(string: url) != nil else {
      throw RuntimeError.error(withMessage: "Invalid URL")
    }
    let delegate = StreamFetchDelegate(
      onResponse: onResponseCallback,
      onChunk: onChunkCallback,
      onComplete: onCompleteCallback,
      onError: onErrorCallback
    )
    let task = session.dataTask(with: request)
    task.delegate = delegate
    return HybridStreamFetchRequest(task: task, delegate: delegate)
  }
}

private final class StreamFetchDelegate: NSObject, URLSessionDataDelegate {
  private let onResponse: ((_ info: StreamFetchResponseInfo) -> Void)?
  private let onChunk: ((_ bytes: ArrayBuffer) -> Void)?
  private let onComplete: (() -> Void)?
  private let onError: ((_ message: String) -> Void)?
  private var httpResponse: HTTPURLResponse?
  private var finished = false

  init(
    onResponse: ((_ info: StreamFetchResponseInfo) -> Void)?,
    onChunk: ((_ bytes: ArrayBuffer) -> Void)?,
    onComplete: (() -> Void)?,
    onError: ((_ message: String) -> Void)?
  ) {
    self.onResponse = onResponse
    self.onChunk = onChunk
    self.onComplete = onComplete
    self.onError = onError
  }

  func urlSession(
    _ session: URLSession,
    dataTask: URLSessionDataTask,
    didReceive response: URLResponse,
    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
  ) {
    guard let httpResponse = response as? HTTPURLResponse else {
      completionHandler(.cancel)
      return
    }
    self.httpResponse = httpResponse
    let headers = httpResponse.allHeaderFields.compactMap { key, value -> StreamFetchHeader? in
      guard let name = key as? String else { return nil }
      return StreamFetchHeader(key: name, value: String(describing: value))
    }
    onResponse?(
      StreamFetchResponseInfo(
        url: httpResponse.url?.absoluteString ?? "",
        status: Double(httpResponse.statusCode),
        statusText: HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode),
        headers: headers
      )
    )
    completionHandler(.allow)
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    guard !data.isEmpty else { return }
    do {
      let buffer = try ArrayBuffer.copy(data: data)
      onChunk?(buffer)
    } catch {
      finishError(error.localizedDescription)
    }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    if let error {
      finishError(error.localizedDescription)
      return
    }
    finishComplete()
  }

  private func finishComplete() {
    guard !finished else { return }
    finished = true
    onComplete?()
  }

  private func finishError(_ message: String) {
    guard !finished else { return }
    finished = true
    onError?(message)
  }
}
