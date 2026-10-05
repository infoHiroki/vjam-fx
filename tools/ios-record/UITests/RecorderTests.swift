import XCTest

// App Review 用の実機録画:アプリを開く → Safari の撮影ページ → VJam FX を ON → Auto → Next → Manual → OFF
final class RecorderTests: XCTestCase {
    let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
    let vjam = XCUIApplication(bundleIdentifier: "com.vjam.fx")
    let demo = "https://infohiroki.github.io/vjam-fx/demo/#en"

    override func setUp() { continueAfterFailure = false }

    func log(_ s: String) { print("STEP \(Date().timeIntervalSince1970) \(s)") }

    func dismissPopover() {
        let region = safari.otherElements["PopoverDismissRegion"]
        if region.exists { region.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.95)).tap(); sleep(1) }
    }
    func extButton() -> XCUIElement { safari.buttons["VJam FX — VJ Effects for Any Website"] }
    func popover() -> XCUIElement { safari.popovers.firstMatch }
    func openPanel() {
        dismissPopover()
        extButton().coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertTrue(popover().waitForExistence(timeout: 8))
        sleep(2)
    }
    func tapCenter(_ e: XCUIElement) { e.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() }
    func onOff() -> XCUIElement { popover().switches["ON / OFF"] }
    func manualOpen() -> Bool { popover().staticTexts["EFFECT"].exists }

    // 録画の前に:撮影ページを開いて、VJam FX を OFF・Manual を畳んだ状態にしてホームへ
    func testPrep() throws {
        safari.activate()
        _ = safari.wait(for: .runningForeground, timeout: 15)
        sleep(2)
        dismissPopover()
        let address = safari.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'SearchFieldItemView'")).firstMatch
        XCTAssertTrue(address.waitForExistence(timeout: 10))
        address.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        sleep(1)
        safari.typeText(demo + "\n")
        sleep(6)
        openPanel()
        if (onOff().value as? String) == "1" { onOff().tap(); sleep(2) }
        if manualOpen() { popover().buttons["Manual"].tap(); sleep(1) }
        dismissPopover()
        let reload = safari.buttons["ReloadButton"]
        if reload.exists { reload.tap() }
        sleep(4)
        safari.swipeDown() // ページの先頭へ
        XCUIDevice.shared.press(.home)
        sleep(2)
    }

    // 録画する流れ
    func testRecord() throws {
        log("start")
        sleep(2)
        vjam.launch()
        log("app launched")
        sleep(7)
        safari.activate()
        _ = safari.wait(for: .runningForeground, timeout: 15)
        log("safari")
        sleep(3)
        let play = safari.webViews.firstMatch.buttons["Play"]
        XCTAssertTrue(play.waitForExistence(timeout: 10))
        play.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        log("play")
        sleep(3)
        openPanel()
        log("panel opened")
        sleep(2)
        tapCenter(onOff())
        log("switched on")
        sleep(4)
        dismissPopover()
        log("watching auto")
        sleep(16)
        openPanel()
        tapCenter(popover().buttons["Next"])
        log("next")
        sleep(3)
        dismissPopover()
        sleep(9)
        openPanel()
        tapCenter(popover().buttons["Manual"])
        sleep(2)
        let preset = popover().switches["Neon Tunnel"]
        if preset.waitForExistence(timeout: 5) { tapCenter(preset) }
        log("manual preset")
        sleep(3)
        dismissPopover()
        sleep(9)
        openPanel()
        tapCenter(onOff())
        log("switched off")
        sleep(3)
        dismissPopover()
        sleep(3)
        log("end")
    }
}
