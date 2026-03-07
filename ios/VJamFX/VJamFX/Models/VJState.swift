import Foundation
import Combine

struct PresetItem: Identifiable, Hashable {
    let id: String
    let name: String
}

struct PresetCategory: Identifiable {
    let id = UUID()
    let label: String
    let presets: [PresetItem]
}

struct SceneData: Codable, Equatable {
    var layers: [String]
    var blendMode: String
    var filters: [String]
    var opacity: Double
    var locks: LockState

    struct LockState: Codable, Equatable {
        var effect: Bool
        var blend: Bool
        var filter: Bool
    }
}

class VJState: ObservableObject {
    // MARK: - Constants

    static let FILTER_NAMES = ["invert", "hue-rotate", "grayscale", "saturate", "brightness", "contrast", "sepia", "blur"]
    static let VALID_BLEND_MODES = ["screen", "lighten", "difference", "exclusion", "color-dodge"]
    static let SENSITIVITY_MAP: [String: Double] = ["lo": 0.5, "mid": 1.0, "hi": 2.0]
    static let FADE_OPTIONS: [Double] = [0, 0.5, 1.0, 1.5, 2.0, 3.0]
    static let BARS_OPTIONS: [Int] = [4, 8, 16]

    static let PRESET_CATEGORIES: [PresetCategory] = [
        PresetCategory(label: "Immersive", presets: [
            PresetItem(id: "neon-tunnel", name: "Neon Tunnel"),
            PresetItem(id: "laser-tunnel", name: "Laser Tunnel"),
            PresetItem(id: "infinite-zoom", name: "Infinite Zoom"),
            PresetItem(id: "hypnotic", name: "Hypnotic"),
            PresetItem(id: "wormhole", name: "Wormhole"),
            PresetItem(id: "warp-speed", name: "Warp Speed"),
            PresetItem(id: "tunnel-zoom", name: "Tunnel Zoom"),
            PresetItem(id: "root-tunnel", name: "Root Tunnel"),
            PresetItem(id: "helix-tunnel", name: "Helix Tunnel"),
            PresetItem(id: "deep-dive", name: "Deep Dive"),
            PresetItem(id: "deep-ocean", name: "Deep Ocean"),
            PresetItem(id: "portal-ring", name: "Portal Ring"),
            PresetItem(id: "cyber-corridor", name: "Cyber Corridor"),
            PresetItem(id: "time-warp", name: "Time Warp"),
            PresetItem(id: "gravity-well", name: "Gravity Well"),
            PresetItem(id: "plasma-wave", name: "Plasma Wave"),
            PresetItem(id: "aurora", name: "Aurora"),
            PresetItem(id: "northern-lights", name: "Northern Lights"),
            PresetItem(id: "crystal-cave", name: "Crystal Cave"),
            PresetItem(id: "chrome-wave", name: "Chrome Wave"),
            PresetItem(id: "sunset-drive", name: "Sunset Drive"),
            PresetItem(id: "neon-highway", name: "Neon Highway"),
            PresetItem(id: "dna-aurora", name: "DNA Aurora"),
            PresetItem(id: "plasma-ball", name: "Plasma Ball"),
            PresetItem(id: "hologram", name: "Hologram"),
        ]),
        PresetCategory(label: "Frames & Film", presets: [
            PresetItem(id: "neon-frame", name: "Neon Frame"),
            PresetItem(id: "light-leak", name: "Light Leak"),
            PresetItem(id: "film-burn", name: "Film Burn"),
            PresetItem(id: "film-scratch", name: "Film Scratch"),
            PresetItem(id: "scan-line", name: "Scan Line"),
            PresetItem(id: "vhs-noise", name: "VHS Noise"),
            PresetItem(id: "vhs-tracking", name: "VHS Tracking"),
            PresetItem(id: "film-grain", name: "Film Grain"),
            PresetItem(id: "film-countdown", name: "Film Countdown"),
            PresetItem(id: "film-reel", name: "Film Reel"),
            PresetItem(id: "vhs-rewind", name: "VHS Rewind"),
            PresetItem(id: "polaroid-flash", name: "Polaroid Flash"),
            PresetItem(id: "tape-distort", name: "Tape Distort"),
        ]),
        PresetCategory(label: "Patterns", presets: [
            PresetItem(id: "kaleidoscope", name: "Kaleidoscope"),
            PresetItem(id: "mandala", name: "Mandala"),
            PresetItem(id: "sacred-geometry", name: "Sacred Geometry"),
            PresetItem(id: "moire", name: "Moire"),
            PresetItem(id: "prism", name: "Prism"),
            PresetItem(id: "barcode", name: "Barcode"),
            PresetItem(id: "spirograph", name: "Spirograph"),
            PresetItem(id: "cyber-mandala", name: "Cyber Mandala"),
            PresetItem(id: "penrose-tile", name: "Penrose Tile"),
            PresetItem(id: "checker-wave", name: "Checker Wave"),
            PresetItem(id: "hermann-grid", name: "Hermann Grid"),
            PresetItem(id: "op-art", name: "Op Art"),
            PresetItem(id: "stained-glass", name: "Stained Glass"),
            PresetItem(id: "dot-halftone", name: "Dot Halftone"),
            PresetItem(id: "wave-rings", name: "Wave Rings"),
            PresetItem(id: "pendulum-wave", name: "Pendulum Wave"),
        ]),
        PresetCategory(label: "Organic", presets: [
            PresetItem(id: "cellular", name: "Cellular"),
            PresetItem(id: "liquid", name: "Liquid"),
            PresetItem(id: "voronoi", name: "Voronoi"),
            PresetItem(id: "smoke", name: "Smoke"),
            PresetItem(id: "oil-spill", name: "Oil Spill"),
            PresetItem(id: "coral-reef", name: "Coral Reef"),
            PresetItem(id: "flow-field", name: "Flow Field"),
            PresetItem(id: "ant-colony", name: "Ant Colony"),
            PresetItem(id: "bioluminescence", name: "Bioluminescence"),
            PresetItem(id: "ink-blot", name: "Ink Blot"),
            PresetItem(id: "ink-wash", name: "Ink Wash"),
            PresetItem(id: "lava-lamp", name: "Lava Lamp"),
            PresetItem(id: "lava-rise", name: "Lava Rise"),
            PresetItem(id: "bubble-float", name: "Bubble Float"),
            PresetItem(id: "growth-spiral", name: "Growth Spiral"),
            PresetItem(id: "mycelium", name: "Mycelium"),
            PresetItem(id: "fungal-web", name: "Fungal Web"),
        ]),
        PresetCategory(label: "Nature", presets: [
            PresetItem(id: "fractal-tree", name: "Fractal Tree"),
            PresetItem(id: "flower-bloom", name: "Flower Bloom"),
            PresetItem(id: "autumn-fall", name: "Autumn Fall"),
            PresetItem(id: "dandelion-seeds", name: "Dandelion Seeds"),
            PresetItem(id: "petal-storm", name: "Petal Storm"),
            PresetItem(id: "meadow-breeze", name: "Meadow Breeze"),
            PresetItem(id: "leaf-vein", name: "Leaf Vein"),
            PresetItem(id: "vine-growth", name: "Vine Growth"),
            PresetItem(id: "neon-vines", name: "Neon Vines"),
            PresetItem(id: "forest-canopy", name: "Forest Canopy"),
            PresetItem(id: "northern-forest", name: "Northern Forest"),
            PresetItem(id: "seed-burst", name: "Seed Burst"),
            PresetItem(id: "pollen-cloud", name: "Pollen Cloud"),
            PresetItem(id: "tree-ring", name: "Tree Ring"),
            PresetItem(id: "moss-carpet", name: "Moss Carpet"),
            PresetItem(id: "lichen-spread", name: "Lichen Spread"),
            PresetItem(id: "spore-drift", name: "Spore Drift"),
        ]),
        PresetCategory(label: "Water", presets: [
            PresetItem(id: "water-surface", name: "Water Surface"),
            PresetItem(id: "river-stream", name: "River Stream"),
            PresetItem(id: "waterfall-mist", name: "Waterfall Mist"),
            PresetItem(id: "tide-wave", name: "Tide Wave"),
            PresetItem(id: "tide-pool", name: "Tide Pool"),
            PresetItem(id: "rain-puddles", name: "Rain Puddles"),
            PresetItem(id: "pond-life", name: "Pond Life"),
            PresetItem(id: "kelp-forest", name: "Kelp Forest"),
            PresetItem(id: "ice-formation", name: "Ice Formation"),
            PresetItem(id: "erosion-line", name: "Erosion Line"),
        ]),
        PresetCategory(label: "Grid & Tech", presets: [
            PresetItem(id: "glitch-grid", name: "Glitch Grid"),
            PresetItem(id: "hexgrid-pulse", name: "Hexgrid Pulse"),
            PresetItem(id: "grid-warp", name: "Grid Warp"),
            PresetItem(id: "circuit-board", name: "Circuit Board"),
            PresetItem(id: "crt-monitor", name: "CRT Monitor"),
            PresetItem(id: "retro-terminal", name: "Retro Terminal"),
            PresetItem(id: "circuit-trace", name: "Circuit Trace"),
            PresetItem(id: "cyber-grid", name: "Cyber Grid"),
            PresetItem(id: "hex-network", name: "Hex Network"),
            PresetItem(id: "led-matrix", name: "LED Matrix"),
            PresetItem(id: "dot-matrix", name: "Dot Matrix"),
            PresetItem(id: "neural-net", name: "Neural Net"),
            PresetItem(id: "isometric-city", name: "Isometric City"),
            PresetItem(id: "wireframe-city", name: "Wireframe City"),
            PresetItem(id: "floating-ui", name: "Floating UI"),
            PresetItem(id: "data-stream", name: "Data Stream"),
            PresetItem(id: "data-cascade", name: "Data Cascade"),
            PresetItem(id: "data-sprites", name: "Data Sprites"),
            PresetItem(id: "matrix-code", name: "Matrix Code"),
            PresetItem(id: "matrix-rain", name: "Matrix Rain"),
        ]),
        PresetCategory(label: "Space", presets: [
            PresetItem(id: "starfield", name: "Starfield"),
            PresetItem(id: "constellation", name: "Constellation"),
            PresetItem(id: "bokeh", name: "Bokeh"),
            PresetItem(id: "terrain", name: "Terrain"),
            PresetItem(id: "meteor-shower", name: "Meteor Shower"),
            PresetItem(id: "orbits", name: "Orbits"),
            PresetItem(id: "cyber-sun", name: "Cyber Sun"),
            PresetItem(id: "dna-helix", name: "DNA Helix"),
            PresetItem(id: "crystal-lattice", name: "Crystal Lattice"),
            PresetItem(id: "radar", name: "Radar"),
            PresetItem(id: "sand-dunes", name: "Sand Dunes"),
        ]),
        PresetCategory(label: "Neon & Glow", presets: [
            PresetItem(id: "neon-80s", name: "Neon 80s"),
            PresetItem(id: "neon-bars", name: "Neon Bars"),
            PresetItem(id: "neon-dust", name: "Neon Dust"),
            PresetItem(id: "neon-jellyfish", name: "Neon Jellyfish"),
            PresetItem(id: "neon-smoke", name: "Neon Smoke"),
            PresetItem(id: "electric-arc", name: "Electric Arc"),
            PresetItem(id: "electric-city", name: "Electric City"),
            PresetItem(id: "electric-fence", name: "Electric Fence"),
            PresetItem(id: "lightning", name: "Lightning"),
            PresetItem(id: "light-swarm", name: "Light Swarm"),
            PresetItem(id: "fireflies", name: "Fireflies"),
            PresetItem(id: "ember-drift", name: "Ember Drift"),
            PresetItem(id: "cathode-glow", name: "Cathode Glow"),
            PresetItem(id: "fire-wall", name: "Fire Wall"),
            PresetItem(id: "paper-lantern", name: "Paper Lantern"),
        ]),
        PresetCategory(label: "Glitch & Retro", presets: [
            PresetItem(id: "glitch-8bit", name: "Glitch 8bit"),
            PresetItem(id: "glitch-wave", name: "Glitch Wave"),
            PresetItem(id: "cyber-glitch", name: "Cyber Glitch"),
            PresetItem(id: "digital-noise", name: "Digital Noise"),
            PresetItem(id: "static-burst", name: "Static Burst"),
            PresetItem(id: "static-snow", name: "Static Snow"),
            PresetItem(id: "radio-static", name: "Radio Static"),
            PresetItem(id: "scramble-channel", name: "Scramble Channel"),
            PresetItem(id: "flicker-strobe", name: "Flicker Strobe"),
            PresetItem(id: "old-tv", name: "Old TV"),
            PresetItem(id: "crt-scan", name: "CRT Scan"),
            PresetItem(id: "retro-arcade", name: "Retro Arcade"),
            PresetItem(id: "retro-wave", name: "Retro Wave"),
            PresetItem(id: "arcade-blocks", name: "Arcade Blocks"),
            PresetItem(id: "pixel-cascade", name: "Pixel Cascade"),
            PresetItem(id: "pixel-mosaic", name: "Pixel Mosaic"),
            PresetItem(id: "pixel-rain", name: "Pixel Rain"),
            PresetItem(id: "pixel-sort-b", name: "Pixel Sort"),
            PresetItem(id: "ascii-art", name: "ASCII Art"),
        ]),
        PresetCategory(label: "Audio Reactive", presets: [
            PresetItem(id: "frequency-rings", name: "Frequency Rings"),
            PresetItem(id: "equalizer", name: "Equalizer"),
            PresetItem(id: "sine-waves", name: "Sine Waves"),
            PresetItem(id: "gradient-sweep", name: "Gradient Sweep"),
            PresetItem(id: "wireframe-sphere", name: "Wireframe Sphere"),
            PresetItem(id: "analog-wave", name: "Analog Wave"),
            PresetItem(id: "audio-mesh", name: "Audio Mesh"),
            PresetItem(id: "boombox-meter", name: "Boombox Meter"),
            PresetItem(id: "dial-tone", name: "Dial Tone"),
            PresetItem(id: "oscilloscope", name: "Oscilloscope"),
            PresetItem(id: "pulse-ring", name: "Pulse Ring"),
            PresetItem(id: "radial-burst", name: "Radial Burst"),
            PresetItem(id: "synth-wave", name: "Synth Wave"),
            PresetItem(id: "vinyl-groove", name: "Vinyl Groove"),
            PresetItem(id: "cassette-reel", name: "Cassette Reel"),
            PresetItem(id: "honeycomb-pulse", name: "Honeycomb Pulse"),
        ]),
        PresetCategory(label: "Particles", presets: [
            PresetItem(id: "snowfall", name: "Snowfall"),
            PresetItem(id: "confetti-burst", name: "Confetti Burst"),
            PresetItem(id: "particle-storm", name: "Particle Storm"),
            PresetItem(id: "dust-motes", name: "Dust Motes"),
            PresetItem(id: "bird-murmuration", name: "Bird Murmuration"),
            PresetItem(id: "smoke-stack", name: "Smoke Stack"),
            PresetItem(id: "fog-bank", name: "Fog Bank"),
            PresetItem(id: "wind-ripple", name: "Wind Ripple"),
        ]),
        PresetCategory(label: "Weather", presets: [
            PresetItem(id: "rain", name: "Rain"),
            PresetItem(id: "neon-rain", name: "Neon Rain"),
            PresetItem(id: "cyber-rain-heavy", name: "Cyber Rain"),
            PresetItem(id: "ceiling-drip", name: "Ceiling Drip"),
        ]),
    ]

    static var allPresets: [PresetItem] {
        PRESET_CATEGORIES.flatMap { $0.presets }
    }

    // MARK: - Published State

    @Published var activeLayers: Set<String> = []
    @Published var activeFilters: Set<String> = []
    @Published var selectedBlendMode: String = "screen"
    @Published var opacity: Double = 0.8
    @Published var isActive: Bool = false
    @Published var audioEnabled: Bool = true
    @Published var autoCycleActive: Bool = false
    @Published var autoBlend: Bool = false
    @Published var autoFilters: Bool = false
    @Published var lockEffect: Bool = false
    @Published var lockBlend: Bool = false
    @Published var lockFilter: Bool = false
    @Published var scenes: [SceneData?] = Array(repeating: nil, count: 12)
    @Published var textInput: String = ""
    @Published var textActive: Bool = false
    @Published var sceneSaveMode: Bool = false

    // Settings
    @Published var fadeDuration: Double = 1.5
    @Published var barsPerCycle: Int = 8
    @Published var sensitivity: String = "mid"

    // MARK: - Scene Persistence

    private let scenesKey = "vjamfx_scenes"
    private let settingsKey = "vjamfx_settings"

    init() {
        loadScenes()
        loadSettings()
    }

    func saveScene(slot: Int) {
        guard slot >= 0 && slot < 12 else { return }
        scenes[slot] = SceneData(
            layers: Array(activeLayers),
            blendMode: selectedBlendMode,
            filters: Array(activeFilters),
            opacity: opacity,
            locks: SceneData.LockState(effect: lockEffect, blend: lockBlend, filter: lockFilter)
        )
        persistScenes()
    }

    func clearScene(slot: Int) {
        guard slot >= 0 && slot < 12 else { return }
        scenes[slot] = nil
        persistScenes()
    }

    func loadScenes() {
        guard let data = UserDefaults.standard.data(forKey: scenesKey),
              let decoded = try? JSONDecoder().decode([SceneData?].self, from: data),
              decoded.count == 12 else { return }
        scenes = decoded
    }

    private func persistScenes() {
        if let data = try? JSONEncoder().encode(scenes) {
            UserDefaults.standard.set(data, forKey: scenesKey)
        }
    }

    func loadSettings() {
        let defaults = UserDefaults.standard
        if defaults.object(forKey: settingsKey + "_fade") != nil {
            fadeDuration = defaults.double(forKey: settingsKey + "_fade")
        }
        if defaults.object(forKey: settingsKey + "_bars") != nil {
            barsPerCycle = defaults.integer(forKey: settingsKey + "_bars")
        }
        if let sens = defaults.string(forKey: settingsKey + "_sens") {
            sensitivity = sens
        }
    }

    func saveSettings() {
        let defaults = UserDefaults.standard
        defaults.set(fadeDuration, forKey: settingsKey + "_fade")
        defaults.set(barsPerCycle, forKey: settingsKey + "_bars")
        defaults.set(sensitivity, forKey: settingsKey + "_sens")
    }

    func resetAll() {
        activeLayers.removeAll()
        activeFilters.removeAll()
        selectedBlendMode = "screen"
        opacity = 0.8
        isActive = false
        audioEnabled = true
        autoCycleActive = false
        autoBlend = false
        autoFilters = false
        lockEffect = false
        lockBlend = false
        lockFilter = false
        textInput = ""
        textActive = false
        sceneSaveMode = false
        fadeDuration = 1.5
        barsPerCycle = 8
        sensitivity = "mid"
        saveSettings()
    }
}
