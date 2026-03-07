import SwiftUI
import WebKit

struct BrowserView: View {
    @StateObject private var browserModel = BrowserModel()
    @StateObject private var vjState = VJState()
    @State private var showVJPanel = false
    @State private var urlInput = "https://www.youtube.com"
    @State private var webView: WKWebView?

    var body: some View {
        VStack(spacing: 0) {
            // Navigation bar
            HStack(spacing: 8) {
                Button(action: { webView?.goBack() }) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .medium))
                }
                .disabled(!browserModel.canGoBack)

                Button(action: { webView?.goForward() }) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 16, weight: .medium))
                }
                .disabled(!browserModel.canGoForward)

                Button(action: {
                    if browserModel.isLoading {
                        webView?.stopLoading()
                    } else {
                        webView?.reload()
                    }
                }) {
                    Image(systemName: browserModel.isLoading ? "xmark" : "arrow.clockwise")
                        .font(.system(size: 14, weight: .medium))
                }

                TextField("URL", text: $urlInput)
                    .textFieldStyle(.plain)
                    .font(.system(size: 14))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .onSubmit {
                        browserModel.navigateTo(urlInput)
                    }

                Button(action: { showVJPanel.toggle() }) {
                    Image(systemName: "wand.and.stars")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(vjState.isActive ? .cyan : .gray)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(.systemBackground))

            // WebView
            WebViewRepresentable(browserModel: browserModel) { wv in
                self.webView = wv
            }
            .ignoresSafeArea(edges: .bottom)
        }
        .onChange(of: browserModel.urlString) { _, newValue in
            urlInput = newValue
        }
        .sheet(isPresented: $showVJPanel) {
            VJControlPanel(vjState: vjState) { command in
                if let coordinator = webView?.navigationDelegate as? WebViewRepresentable.Coordinator {
                    coordinator.sendCommand(command)
                }
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .presentationBackgroundInteraction(.enabled(upThrough: .medium))
        }
    }
}
