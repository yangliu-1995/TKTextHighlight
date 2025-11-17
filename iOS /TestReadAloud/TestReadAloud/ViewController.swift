//
//  ViewController.swift
//  TestReadAloud
//
//  Created by XuanyuanXiao on 2025/11/17.
//

import AVFoundation
import SwiftUI
import UIKit
import WebKit

struct TextFragment {
    let text: String
    let index: Int
}

class ViewController: UIViewController {

    let webView: WKWebView = {
        let jsURL = Bundle.main.url(forResource: "tk-text-highlight", withExtension: "js")!
        let config = WKWebViewConfiguration()
        let script = WKUserScript(source: (try! String(contentsOf: jsURL, encoding: .utf8)), injectionTime: .atDocumentEnd, forMainFrameOnly: true, in: .defaultClient)
        config.userContentController.addUserScript(script)
        return WKWebView(frame: .zero, configuration: config)
    }()

    override func viewDidLoad() {
        super.viewDidLoad()
        let toolbar = Toolbar {
            self.startRead()
        }
        let toolbarVC = UIHostingController(rootView: toolbar)
        synthesizer.delegate = self
        addChild(toolbarVC)
        let toolbarView = toolbarVC.view!

        view.addSubview(toolbarView)
        toolbarView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.isInspectable = true

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: toolbarView.topAnchor),

            toolbarView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            toolbarView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            toolbarView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
        ])

        let url = Bundle.main.url(forResource: "ra", withExtension: "html")!
        webView.load(URLRequest(url: url))
    }

    private func startRead() {
        webView._getContentsAsString { string, err in
            self.startWithString(string)
        }
    }

    var texts: [TextFragment] = []
    var currentIndex = 0
    private let synthesizer = AVSpeechSynthesizer()
    private func startWithString(_ string: String) {
        var counters: [String: Int] = [:]
        let strings = string.components(separatedBy: "\n")
        texts = strings.filter({ !$0.isEmpty }).map { string in
            let index = counters[string, default: 0]
            counters[string] = index + 1
            return TextFragment(text: string, index: index)
        }
        startSpeech()
    }

    private func startSpeech() {
        let textFragment = texts[currentIndex]
        let utterance = AVSpeechUtterance(string: textFragment.text)
        utterance.voice =  AVSpeechSynthesisVoice(language: "zh-CN")
        utterance.postUtteranceDelay = 0.1

        webView.evaluateJavaScript("tkHighlighter.highlight('\(textFragment.text)', \(textFragment.index))", in: nil, in: .defaultClient) { _ in

        }
        synthesizer.speak(utterance)
    }

}

extension ViewController: AVSpeechSynthesizerDelegate {
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, willSpeakRangeOfSpeechString characterRange: NSRange, utterance: AVSpeechUtterance) {
        webView.evaluateJavaScript("tkHighlighter.mark({ start: \(characterRange.location), length: \(characterRange.length) });", in: nil, in: .defaultClient) { _ in

        }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        currentIndex += 1
        startSpeech()
    }
}
