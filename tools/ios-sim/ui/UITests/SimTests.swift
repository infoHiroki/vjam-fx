import XCTest

// シミュレータの Safari に入れた VJam FX(拡張そのもの)を UI テストで動かす。iPhone と iPad の両方で使える
// ラベルはシミュレータの言語が日本語の前提(英語のものも少し足してある)。スクショはテスト結果(.xcresult)に入る
final class SimTests: XCTestCase {
    let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
    let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
    let demo = "https://infohiroki.github.io/vjam-fx/demo/#ja"
    let videoPage = "http://localhost:8823/native.html"

    override func setUp() { continueAfterFailure = false }

    func log(_ s: String) { print("STEP \(s)") }
    func dump(_ app: XCUIApplication, _ tag: String) { print("DUMP-BEGIN \(tag)\n\(app.debugDescription)\nDUMP-END \(tag)") }
    func shot(_ name: String) {
        let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        a.name = name; a.lifetime = .keepAlways; add(a)
        log("shot \(name)")
    }
    // Safari の中のボタンは .tap() だと効かないことがある(再生・ページメニュー)。真ん中の座標を押す
    func tapC(_ e: XCUIElement) { e.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() }

    func find(_ app: XCUIApplication, _ labels: [String]) -> XCUIElement? {
        let types = [XCUIElement.ElementType.cell, .button, .staticText].map { $0.rawValue }
        for l in labels {
            let e = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@ AND elementType IN %@", l, types)).firstMatch
            if e.exists && e.isHittable { return e }
        }
        return nil
    }
    // 見つかるまで下へスクロールして押す
    func tapScrolling(_ app: XCUIApplication, _ labels: [String]) {
        for _ in 0..<8 {
            if let e = find(app, labels) { e.tap(); sleep(2); log("tapped \(labels[0])"); return }
            app.swipeUp(); sleep(1)
        }
        dump(app, "not-found")
        XCTFail("not found: \(labels)")
    }

    func openURL(_ url: String) {
        let later = safari.buttons["deferButton-SetDefaultSearchEngine"] // 初回の「検索エンジンを選択」
        if later.exists { tapC(later); sleep(1) }
        let address = safari.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'SearchFieldItemView' OR identifier == 'TabBarItemTitle'")).firstMatch
        XCTAssertTrue(address.waitForExistence(timeout: 10))
        tapC(address); sleep(1)
        safari.typeText(url + "\n")
        sleep(6)
    }
    // パネルを開く。iPhone はページメニュー(ぁあ)の中、iPad はツールバーにボタンがあることもある
    func vjamItem() -> XCUIElement {
        let types = [XCUIElement.ElementType.button, .cell, .menuItem].map { $0.rawValue }
        return safari.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH 'VJam FX' AND elementType IN %@", types)).firstMatch
    }
    func openPanel() {
        var item = vjamItem()
        if !item.exists { tapC(safari.buttons["PageFormatMenuButton"]); sleep(2); item = vjamItem() }
        XCTAssertTrue(item.waitForExistence(timeout: 5))
        tapC(item); sleep(3)
    }
    func closePanel() {
        let done = safari.buttons.matching(NSPredicate(format: "label == '完了' OR label == 'Done'")).firstMatch
        if done.exists { tapC(done); sleep(2) } // iPhone のシート。iPad の吹き出しは外を押すと閉じる
        let region = safari.otherElements["PopoverDismissRegion"]
        if region.exists { region.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.95)).tap(); sleep(1) }
    }
    func turnOn() {
        let sw = safari.switches["ON / OFF"]
        XCTAssertTrue(sw.waitForExistence(timeout: 5))
        if (sw.value as? String) != "1" { tapC(sw); log("on") }
        sleep(6)
    }

    // 1. 設定 → アプリ → Safari → 機能拡張 → VJam FX をオン・すべての Web サイトを許可
    func testEnable() throws {
        settings.terminate(); settings.launch(); sleep(3)
        tapScrolling(settings, ["アプリ", "Apps"])
        tapScrolling(settings, ["Safari"])
        tapScrolling(settings, ["機能拡張", "Extensions"])
        let cell = settings.cells["com.vjam.fx.Extension"]
        XCTAssertTrue(cell.waitForExistence(timeout: 5))
        cell.tap(); sleep(2)
        let sw = settings.switches.firstMatch
        XCTAssertTrue(sw.waitForExistence(timeout: 5))
        if (sw.value as? String) != "1" { sw.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap(); sleep(2) }
        XCTAssertEqual(sw.value as? String, "1")
        let all = settings.cells.matching(NSPredicate(format: "identifier == 'すべてのWebサイト' OR identifier == 'All Websites'")).firstMatch
        XCTAssertTrue(all.waitForExistence(timeout: 5))
        all.tap(); sleep(2)
        tapScrolling(settings, ["許可", "Allow"])
        settings.terminate()
    }

    // 2. 撮影ページで再生 → パネルで ON → Auto・BPM → Next → Manual → 設定(歯車)
    func testPanel() throws {
        safari.terminate(); safari.launch(); sleep(3)
        openURL(demo)
        let play = safari.webViews.firstMatch.buttons.matching(NSPredicate(format: "label == '再生' OR label == 'Play'")).firstMatch
        XCTAssertTrue(play.waitForExistence(timeout: 10))
        tapC(play); sleep(3)
        openPanel()
        turnOn()
        shot("panel-on")
        XCTAssertTrue(safari.staticTexts["AUTO"].exists)
        log("bpm=\(safari.staticTexts.matching(NSPredicate(format: "label ENDSWITH ' BPM'")).firstMatch.label)")
        closePanel(); sleep(4)
        shot("effects")
        openPanel()
        tapC(safari.buttons["Next"]); sleep(3)
        shot("after-next")
        tapC(safari.buttons["Manual"]); sleep(2)
        safari.swipeUp(); sleep(1) // iPhone はシートが上まで広がる
        shot("manual")
        tapC(safari.buttons["Settings"]); sleep(2)
        shot("settings")
        tapC(safari.buttons["Settings"]); sleep(1)
        tapC(safari.buttons["Manual"]); sleep(1) // 次に開いたときのために畳む
        closePanel()
    }

    // 3. iPhone:動画の全画面ボタン → 画面いっぱい + エフェクト → × で戻る
    //    先に tools/ios-sim/www を 8823 番で配る。全画面ボタンの位置は iPhone 17 の縦向きのもの
    func testFill() throws {
        safari.activate(); sleep(1)
        closePanel()
        openURL(videoPage)
        let web = safari.webViews.firstMatch
        let origin = web.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
        origin.withOffset(CGVector(dx: 200, dy: 175)).tap(); sleep(1) // 動画をタップして標準のコントロールを出す
        let playB = safari.buttons.matching(NSPredicate(format: "label == '再生' OR label == 'Play'")).firstMatch
        if playB.exists { tapC(playB); sleep(3) }
        openPanel(); turnOn(); closePanel()
        sleep(4) // コントロールが消えるのを待つ
        origin.withOffset(CGVector(dx: 200, dy: 175)).tap()
        usleep(500_000)
        origin.withOffset(CGVector(dx: 16, dy: 77)).tap() // 動画の左上の全画面ボタン
        sleep(5)
        shot("fill")
        let x = safari.buttons["Exit full view"]
        XCTAssertTrue(x.waitForExistence(timeout: 5))
        tapC(x); sleep(3)
        shot("fill-closed")
    }
}
