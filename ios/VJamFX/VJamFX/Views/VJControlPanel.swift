import SwiftUI

struct VJControlPanel: View {
    @ObservedObject var vjState: VJState
    let sendCommand: ([String: Any]) -> Void
    @Environment(\.horizontalSizeClass) private var hSizeClass

    private var columns: [GridItem] {
        let count = hSizeClass == .regular ? 5 : 3
        return Array(repeating: GridItem(.flexible(), spacing: 6), count: count)
    }
    private var filterColumns: [GridItem] {
        let count = hSizeClass == .regular ? 8 : 4
        return Array(repeating: GridItem(.flexible(), spacing: 6), count: count)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    mainControlsSection
                    subControlsSection
                    opacitySection
                    lockSection
                    presetGridSection
                    blendSection
                    filterSection
                    scenesSection
                    textSection
                    audioSection
                    settingsSection
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .background(Color.black)
            .navigationTitle("VJam FX")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    // MARK: - Main Controls (Reset / Next / Auto)

    private var mainControlsSection: some View {
        HStack(spacing: 12) {
            Button("Reset") { handleReset() }
                .buttonStyle(VJButtonStyle(isActive: false, color: .red))

            Button("Next") { handleNext() }
                .buttonStyle(VJButtonStyle(isActive: false, color: .cyan))

            Button("Auto") { handleAutoToggle() }
                .buttonStyle(VJButtonStyle(isActive: vjState.autoCycleActive, color: .cyan))
        }
    }

    // MARK: - Sub Controls (Blend Rnd / Filter Rnd)

    private var subControlsSection: some View {
        HStack(spacing: 12) {
            Button("Blend Rnd") { handleAutoBlendToggle() }
                .buttonStyle(VJButtonStyle(isActive: vjState.autoBlend, color: .cyan))

            Button("Filter Rnd") { handleAutoFiltersToggle() }
                .buttonStyle(VJButtonStyle(isActive: vjState.autoFilters, color: .cyan))
        }
    }

    // MARK: - Opacity

    private var opacitySection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Opacity: \(Int(vjState.opacity * 100))%")
                .font(.caption)
                .foregroundColor(.gray)
            Slider(value: $vjState.opacity, in: 0...1, step: 0.01)
                .tint(.cyan)
                .onChange(of: vjState.opacity) { _, newValue in
                    if vjState.isActive {
                        sendCommand(["action": "setOpacity", "opacity": newValue])
                    }
                }
        }
    }

    // MARK: - Lock

    private var lockSection: some View {
        HStack(spacing: 12) {
            Button(vjState.lockEffect ? "Locked" : "Lock") {
                vjState.lockEffect.toggle()
            }
            .buttonStyle(VJButtonStyle(isActive: vjState.lockEffect, color: .orange))

            Button(vjState.lockBlend ? "Locked" : "Lock") {
                vjState.lockBlend.toggle()
            }
            .buttonStyle(VJButtonStyle(isActive: vjState.lockBlend, color: .orange))

            Button(vjState.lockFilter ? "Locked" : "Lock") {
                vjState.lockFilter.toggle()
            }
            .buttonStyle(VJButtonStyle(isActive: vjState.lockFilter, color: .orange))
        }
        .overlay(alignment: .top) {
            HStack(spacing: 0) {
                ForEach(["Effect", "Blend", "Filter"], id: \.self) { label in
                    Text(label)
                        .font(.system(size: 9))
                        .foregroundColor(.gray)
                        .frame(maxWidth: .infinity)
                }
            }
            .offset(y: -12)
        }
    }

    // MARK: - Preset Grid

    private var presetGridSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Presets")
                .font(.headline)
                .foregroundColor(.white)

            ForEach(VJState.PRESET_CATEGORIES) { category in
                VStack(alignment: .leading, spacing: 4) {
                    Text(category.label)
                        .font(.caption)
                        .foregroundColor(.gray)
                        .padding(.top, 4)

                    LazyVGrid(columns: columns, spacing: 6) {
                        ForEach(category.presets) { preset in
                            Button(action: { handlePresetToggle(preset.id) }) {
                                Text(preset.name)
                                    .font(.system(size: 11))
                                    .lineLimit(1)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 6)
                                    .background(vjState.activeLayers.contains(preset.id) ? Color.cyan.opacity(0.3) : Color(.systemGray5))
                                    .foregroundColor(vjState.activeLayers.contains(preset.id) ? .cyan : .white)
                                    .cornerRadius(6)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Blend Mode

    private var blendSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Blend Mode")
                .font(.headline)
                .foregroundColor(.white)

            HStack(spacing: 6) {
                ForEach(VJState.VALID_BLEND_MODES, id: \.self) { mode in
                    Button(action: { handleBlendToggle(mode) }) {
                        Text(blendLabel(mode))
                            .font(.system(size: 11))
                            .lineLimit(1)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(vjState.selectedBlendMode == mode && mode != "screen" ? Color.cyan.opacity(0.3) : Color(.systemGray5))
                            .foregroundColor(vjState.selectedBlendMode == mode && mode != "screen" ? .cyan : .white)
                            .cornerRadius(6)
                    }
                }
            }
        }
    }

    // MARK: - Filters

    private var filterSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Filters")
                .font(.headline)
                .foregroundColor(.white)

            LazyVGrid(columns: filterColumns, spacing: 6) {
                ForEach(VJState.FILTER_NAMES, id: \.self) { filter in
                    Button(action: { handleFilterToggle(filter) }) {
                        Text(filterLabel(filter))
                            .font(.system(size: 11))
                            .lineLimit(1)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(vjState.activeFilters.contains(filter) ? Color.cyan.opacity(0.3) : Color(.systemGray5))
                            .foregroundColor(vjState.activeFilters.contains(filter) ? .cyan : .white)
                            .cornerRadius(6)
                    }
                }
            }
        }
    }

    // MARK: - Scenes

    private var scenesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Scenes")
                    .font(.headline)
                    .foregroundColor(.white)

                Spacer()

                Button(vjState.sceneSaveMode ? "Cancel" : "Save") {
                    vjState.sceneSaveMode.toggle()
                }
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(vjState.sceneSaveMode ? .orange : .cyan)
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: hSizeClass == .regular ? 12 : 6), spacing: 6) {
                ForEach(0..<12, id: \.self) { slot in
                    Button(action: { handleSceneTap(slot) }) {
                        Text("\(slot + 1)")
                            .font(.system(size: 12, weight: .medium))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(sceneBackground(slot))
                            .foregroundColor(.white)
                            .cornerRadius(6)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(sceneBorderColor(slot), lineWidth: vjState.scenes[slot] != nil ? 2 : 1)
                            )
                    }
                    .contextMenu {
                        if vjState.scenes[slot] != nil {
                            Button(role: .destructive) {
                                vjState.clearScene(slot: slot)
                            } label: {
                                Label("Clear", systemImage: "trash")
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Text

    private var textSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Text Overlay")
                .font(.headline)
                .foregroundColor(.white)

            HStack(spacing: 8) {
                TextField("Enter text...", text: $vjState.textInput)
                    .textFieldStyle(.plain)
                    .font(.system(size: 14))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Color(.systemGray5))
                    .cornerRadius(6)
                    .foregroundColor(.white)
                    .onSubmit { handleTextToggle() }

                Button(vjState.textActive ? "OFF" : "GO") {
                    handleTextToggle()
                }
                .buttonStyle(VJButtonStyle(isActive: vjState.textActive, color: .cyan))
                .frame(width: 50)
            }
        }
    }

    // MARK: - Audio

    private var audioSection: some View {
        HStack {
            Text("Audio Reactive")
                .font(.headline)
                .foregroundColor(.white)

            Spacer()

            Button(vjState.audioEnabled ? "ON" : "OFF") {
                handleAudioToggle()
            }
            .buttonStyle(VJButtonStyle(isActive: vjState.audioEnabled, color: .cyan))
            .frame(width: 60)
        }
    }

    // MARK: - Settings

    private var settingsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Settings")
                .font(.headline)
                .foregroundColor(.white)

            HStack {
                Text("Fade")
                    .font(.caption)
                    .foregroundColor(.gray)
                    .frame(width: 60, alignment: .leading)

                Picker("", selection: $vjState.fadeDuration) {
                    ForEach(VJState.FADE_OPTIONS, id: \.self) { val in
                        Text(val == 0 ? "0s" : "\(String(format: "%.1f", val))s").tag(val)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: vjState.fadeDuration) { _, newValue in
                    vjState.saveSettings()
                    sendCommand(["action": "setFadeDuration", "duration": newValue])
                }
            }

            HStack {
                Text("Bars")
                    .font(.caption)
                    .foregroundColor(.gray)
                    .frame(width: 60, alignment: .leading)

                Picker("", selection: $vjState.barsPerCycle) {
                    ForEach(VJState.BARS_OPTIONS, id: \.self) { val in
                        Text("\(val)").tag(val)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: vjState.barsPerCycle) { _, newValue in
                    vjState.saveSettings()
                    if vjState.autoCycleActive {
                        let allIds = VJState.allPresets.map { $0.id }
                        sendCommand([
                            "action": "startAutoCycle",
                            "presets": allIds,
                            "interval": 8000,
                            "autoBlend": vjState.autoBlend,
                            "autoFilters": vjState.autoFilters,
                            "barsPerCycle": newValue,
                            "locks": locksDict()
                        ])
                    }
                }
            }

            HStack {
                Text("Sensitivity")
                    .font(.caption)
                    .foregroundColor(.gray)
                    .frame(width: 60, alignment: .leading)

                Picker("", selection: $vjState.sensitivity) {
                    Text("Lo").tag("lo")
                    Text("Mid").tag("mid")
                    Text("Hi").tag("hi")
                }
                .pickerStyle(.segmented)
                .onChange(of: vjState.sensitivity) { _, newValue in
                    vjState.saveSettings()
                    let sens = VJState.SENSITIVITY_MAP[newValue] ?? 1.0
                    sendCommand(["action": "setAudioSensitivity", "sensitivity": sens])
                }
            }
        }
    }

    // MARK: - Handlers

    private func handleReset() {
        sendCommand(["action": "stopVideoAudio"])
        sendCommand(["action": "kill"])
        sendCommand(["action": "textAutoStop"])
        sendCommand(["action": "textClear"])
        sendCommand(["action": "setFadeDuration", "duration": 1.5])
        sendCommand(["action": "setAudioSensitivity", "sensitivity": 1.0])
        vjState.resetAll()
    }

    private func handleNext() {
        if !vjState.isActive {
            vjState.isActive = true
        }
        sendCommand(["action": "kill", "locks": locksDict()])

        if !vjState.lockEffect {
            let allPresets = VJState.allPresets
            let count = 1 + Int.random(in: 0..<min(3, allPresets.count))
            let chosen = allPresets.shuffled().prefix(count)

            vjState.activeLayers.removeAll()
            if let first = chosen.first {
                sendCommand(["action": "start", "preset": first.id, "blendMode": vjState.selectedBlendMode])
                vjState.activeLayers.insert(first.id)
            }
            for preset in chosen.dropFirst() {
                sendCommand(["action": "addLayer", "preset": preset.id])
                vjState.activeLayers.insert(preset.id)
            }
        }

        if !vjState.lockFilter {
            for f in vjState.activeFilters {
                sendCommand(["action": "setFilter", "filter": f, "enabled": true])
            }
        }

        if vjState.autoCycleActive {
            vjState.autoCycleActive = false
        }

        if vjState.autoBlend || vjState.autoFilters {
            sendCommand(["action": "startAutoFX", "autoBlend": vjState.autoBlend, "autoFilters": vjState.autoFilters])
        }

        if vjState.audioEnabled {
            sendCommand(["action": "startVideoAudio"])
        }
    }

    private func handleAutoToggle() {
        vjState.autoCycleActive.toggle()
        if vjState.autoCycleActive {
            vjState.autoBlend = true
            vjState.autoFilters = true
            vjState.isActive = true

            sendCommand(["action": "stopAutoFX"])
            let allIds = VJState.allPresets.map { $0.id }
            sendCommand([
                "action": "startAutoCycle",
                "presets": allIds,
                "interval": 8000,
                "autoBlend": true,
                "autoFilters": true,
                "barsPerCycle": vjState.barsPerCycle,
                "locks": locksDict()
            ])
        } else {
            sendCommand(["action": "stopAutoCycle"])
            if vjState.autoBlend || vjState.autoFilters {
                sendCommand(["action": "startAutoFX", "autoBlend": vjState.autoBlend, "autoFilters": vjState.autoFilters])
            }
        }
    }

    private func handleAutoBlendToggle() {
        vjState.autoBlend.toggle()
        if vjState.autoCycleActive {
            sendCommand(["action": "updateAutoCycleOptions", "autoBlend": vjState.autoBlend, "autoFilters": vjState.autoFilters, "locks": locksDict()])
        } else if vjState.autoBlend || vjState.autoFilters {
            sendCommand(["action": "startAutoFX", "autoBlend": vjState.autoBlend, "autoFilters": vjState.autoFilters])
        } else {
            sendCommand(["action": "stopAutoFX"])
        }
    }

    private func handleAutoFiltersToggle() {
        vjState.autoFilters.toggle()
        if vjState.autoCycleActive {
            sendCommand(["action": "updateAutoCycleOptions", "autoBlend": vjState.autoBlend, "autoFilters": vjState.autoFilters, "locks": locksDict()])
        } else if vjState.autoBlend || vjState.autoFilters {
            sendCommand(["action": "startAutoFX", "autoBlend": vjState.autoBlend, "autoFilters": vjState.autoFilters])
        } else {
            sendCommand(["action": "stopAutoFX"])
        }
    }

    private func handlePresetToggle(_ presetId: String) {
        if vjState.activeLayers.contains(presetId) {
            vjState.activeLayers.remove(presetId)
            if vjState.isActive {
                sendCommand(["action": "removeLayer", "preset": presetId])
            }
        } else {
            vjState.activeLayers.insert(presetId)
            if !vjState.isActive {
                vjState.isActive = true
                sendCommand(["action": "start", "preset": presetId, "blendMode": vjState.selectedBlendMode])
            } else {
                sendCommand(["action": "addLayer", "preset": presetId])
            }
        }

        if vjState.autoCycleActive {
            vjState.autoCycleActive = false
            sendCommand(["action": "stopAutoCycle"])
        }
    }

    private func handleBlendToggle(_ mode: String) {
        if vjState.selectedBlendMode == mode {
            vjState.selectedBlendMode = "screen"
        } else {
            vjState.selectedBlendMode = mode
        }
        if vjState.isActive {
            sendCommand(["action": "setBlendMode", "blendMode": vjState.selectedBlendMode])
        }
    }

    private func handleFilterToggle(_ filter: String) {
        if vjState.activeFilters.contains(filter) {
            vjState.activeFilters.remove(filter)
        } else {
            vjState.activeFilters.insert(filter)
        }
        if vjState.isActive {
            sendCommand(["action": "toggleFilter", "filter": filter])
        }
    }

    private func handleSceneTap(_ slot: Int) {
        if vjState.sceneSaveMode {
            vjState.saveScene(slot: slot)
            vjState.sceneSaveMode = false
        } else if let scene = vjState.scenes[slot] {
            loadScene(scene, slot: slot)
        }
    }

    private func loadScene(_ scene: SceneData, slot: Int) {
        sendCommand(["action": "kill"])

        vjState.activeLayers.removeAll()
        for (index, layerId) in scene.layers.enumerated() {
            vjState.activeLayers.insert(layerId)
            if index == 0 {
                sendCommand(["action": "start", "preset": layerId, "blendMode": scene.blendMode])
            } else {
                sendCommand(["action": "addLayer", "preset": layerId])
            }
        }

        if scene.layers.isEmpty {
            vjState.isActive = false
        } else {
            vjState.isActive = true
        }

        vjState.selectedBlendMode = scene.blendMode
        vjState.activeFilters.removeAll()
        for f in scene.filters {
            vjState.activeFilters.insert(f)
            sendCommand(["action": "setFilter", "filter": f, "enabled": true])
        }

        vjState.opacity = scene.opacity
        sendCommand(["action": "setOpacity", "opacity": scene.opacity])

        vjState.lockEffect = scene.locks.effect
        vjState.lockBlend = scene.locks.blend
        vjState.lockFilter = scene.locks.filter

        if vjState.autoCycleActive {
            let allIds = VJState.allPresets.map { $0.id }
            sendCommand([
                "action": "startAutoCycle",
                "presets": allIds,
                "interval": 8000,
                "autoBlend": vjState.autoBlend,
                "autoFilters": vjState.autoFilters,
                "barsPerCycle": vjState.barsPerCycle,
                "locks": locksDict(),
                "skipFirstTick": true
            ])
        } else if vjState.autoBlend || vjState.autoFilters {
            sendCommand(["action": "startAutoFX", "autoBlend": vjState.autoBlend, "autoFilters": vjState.autoFilters])
        }

        if vjState.audioEnabled {
            sendCommand(["action": "startVideoAudio"])
        }
    }

    private func handleTextToggle() {
        if vjState.textActive {
            sendCommand(["action": "textClear"])
            sendCommand(["action": "textAutoStop"])
            vjState.textActive = false
        } else {
            let text = vjState.textInput.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return }
            if !vjState.isActive {
                vjState.isActive = true
            }
            sendCommand(["action": "textAutoStart", "text": text])
            vjState.textActive = true
        }
    }

    private func handleAudioToggle() {
        vjState.audioEnabled.toggle()
        if vjState.audioEnabled {
            sendCommand(["action": "startVideoAudio"])
            if vjState.isActive {
                sendCommand(["action": "setAudioEnabled", "enabled": true])
            }
        } else {
            sendCommand(["action": "stopVideoAudio"])
            if vjState.isActive {
                sendCommand(["action": "setAudioEnabled", "enabled": false])
            }
        }
    }

    // MARK: - Helpers

    private func locksDict() -> [String: Bool] {
        ["effect": vjState.lockEffect, "blend": vjState.lockBlend, "filter": vjState.lockFilter]
    }

    private func blendLabel(_ mode: String) -> String {
        switch mode {
        case "screen": return "Screen"
        case "lighten": return "Lighten"
        case "difference": return "Diff"
        case "exclusion": return "Excl"
        case "color-dodge": return "Dodge"
        default: return mode
        }
    }

    private func filterLabel(_ filter: String) -> String {
        switch filter {
        case "hue-rotate": return "Hue"
        case "grayscale": return "Gray"
        case "brightness": return "Bright"
        case "contrast": return "Contrast"
        default: return filter.capitalized
        }
    }

    private func sceneBackground(_ slot: Int) -> Color {
        if vjState.sceneSaveMode {
            return Color.orange.opacity(0.2)
        }
        return vjState.scenes[slot] != nil ? Color(.systemGray4) : Color(.systemGray6)
    }

    private func sceneBorderColor(_ slot: Int) -> Color {
        if vjState.sceneSaveMode {
            return .orange
        }
        return vjState.scenes[slot] != nil ? .green : Color(.systemGray4)
    }
}

// MARK: - Button Style

struct VJButtonStyle: ButtonStyle {
    let isActive: Bool
    let color: Color

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(isActive ? color.opacity(0.3) : Color(.systemGray5))
            .foregroundColor(isActive ? color : .white)
            .cornerRadius(8)
            .opacity(configuration.isPressed ? 0.7 : 1.0)
    }
}
