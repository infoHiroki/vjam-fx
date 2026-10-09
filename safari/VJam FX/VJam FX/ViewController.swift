//
//  ViewController.swift
//  VJam FX
//
//  Created by hiroki takamura on 2026/10/01.
//

import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self
        self.webView.scrollView.isScrollEnabled = false

        // 起動画面・Main.html と同じ黒(#030303)。WKWebView の既定の白が読み込みまでの一瞬見えないように
        let black = UIColor(red: 3 / 255, green: 3 / 255, blue: 3 / 255, alpha: 1)
        self.view.backgroundColor = black
        self.webView.isOpaque = false
        self.webView.backgroundColor = black
        self.webView.scrollView.backgroundColor = black

        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Override point for customization.
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Override point for customization.
    }

}
