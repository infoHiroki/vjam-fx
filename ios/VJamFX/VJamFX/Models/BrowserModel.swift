import Foundation
import Combine

class BrowserModel: ObservableObject {
    @Published var urlString: String = "https://www.youtube.com"
    @Published var pageTitle: String = ""
    @Published var canGoBack: Bool = false
    @Published var canGoForward: Bool = false
    @Published var isLoading: Bool = false

    func navigateTo(_ input: String) {
        var urlStr = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if urlStr.isEmpty { return }
        // If it looks like a URL, add scheme; otherwise treat as search
        if urlStr.contains(".") && !urlStr.contains(" ") {
            if !urlStr.hasPrefix("http://") && !urlStr.hasPrefix("https://") {
                urlStr = "https://" + urlStr
            }
        } else {
            let query = urlStr.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? urlStr
            urlStr = "https://www.google.com/search?q=\(query)"
        }
        urlString = urlStr
    }
}
