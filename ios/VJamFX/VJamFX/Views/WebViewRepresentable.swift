import SwiftUI
import WebKit

struct WebViewRepresentable: UIViewRepresentable {
    @ObservedObject var browserModel: BrowserModel
    let onWebViewReady: (WKWebView) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(browserModel: browserModel)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()

        // User content controller for JS bridge
        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: "vjamBridge")

        // Inject MSE audio interceptor at document start
        if let interceptorURL = Bundle.main.url(forResource: "mse-audio-interceptor", withExtension: "js"),
           let interceptorSource = try? String(contentsOf: interceptorURL, encoding: .utf8) {
            let interceptorScript = WKUserScript(
                source: interceptorSource,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
            contentController.addUserScript(interceptorScript)
        }

        // Inject VJam FX bundle at document end
        if let bundleURL = Bundle.main.url(forResource: "vjam-fx-bundle", withExtension: "js"),
           let bundleSource = try? String(contentsOf: bundleURL, encoding: .utf8) {
            let bundleScript = WKUserScript(
                source: bundleSource,
                injectionTime: .atDocumentEnd,
                forMainFrameOnly: true
            )
            contentController.addUserScript(bundleScript)
        }

        config.userContentController = contentController
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = .black

        context.coordinator.webView = webView
        onWebViewReady(webView)

        // Load initial URL
        if let url = URL(string: browserModel.urlString) {
            webView.load(URLRequest(url: url))
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // Navigate when urlString changes (user-initiated navigation)
        guard let url = URL(string: browserModel.urlString) else { return }
        if webView.url?.absoluteString != browserModel.urlString {
            webView.load(URLRequest(url: url))
        }
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var browserModel: BrowserModel
        weak var webView: WKWebView?

        init(browserModel: BrowserModel) {
            self.browserModel = browserModel
        }

        // MARK: - Send command to JS engine

        func sendCommand(_ command: [String: Any]) {
            guard let webView = webView,
                  let data = try? JSONSerialization.data(withJSONObject: command),
                  let jsonStr = String(data: data, encoding: .utf8) else { return }
            let js = "window._vjamFxEngine && window._vjamFxEngine.handleMessage(\(jsonStr))"
            DispatchQueue.main.async {
                webView.evaluateJavaScript(js) { _, error in
                    if let error = error {
                        print("VJam FX: JS error: \(error.localizedDescription)")
                    }
                }
            }
        }

        // MARK: - WKScriptMessageHandler

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "vjamBridge" else { return }
            // Handle messages from JS if needed
            if let body = message.body as? [String: Any] {
                print("VJam FX bridge message: \(body)")
            }
        }

        // MARK: - WKNavigationDelegate

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.browserModel.isLoading = true
                self.browserModel.canGoBack = webView.canGoBack
                self.browserModel.canGoForward = webView.canGoForward
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.browserModel.isLoading = false
                self.browserModel.pageTitle = webView.title ?? ""
                self.browserModel.canGoBack = webView.canGoBack
                self.browserModel.canGoForward = webView.canGoForward
                if let url = webView.url?.absoluteString {
                    self.browserModel.urlString = url
                }
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async {
                self.browserModel.isLoading = false
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async {
                self.browserModel.isLoading = false
            }
        }

        // MARK: - WKUIDelegate (media permissions)

        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.grant)
        }
    }
}
