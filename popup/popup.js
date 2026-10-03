/**
 * VJam FX — Popup Controller
 * Multi-layer presets, CSS filters, blend modes
 * Syncs state with Service Worker for navigation persistence
 */

const PRESET_CATEGORIES = [
  { label: 'Immersive', presets: [
    { id: 'neon-tunnel', name: 'Neon Tunnel' },
    { id: 'laser-tunnel', name: 'Laser Tunnel' },
    { id: 'infinite-zoom', name: 'Infinite Zoom' },
    { id: 'hypnotic', name: 'Hypnotic' },
    { id: 'wormhole', name: 'Wormhole' },
    { id: 'warp-speed', name: 'Warp Speed' },
    { id: 'tunnel-zoom', name: 'Tunnel Zoom' },
    { id: 'root-tunnel', name: 'Root Tunnel' },
    { id: 'helix-tunnel', name: 'Helix Tunnel' },
    { id: 'deep-dive', name: 'Deep Dive' },
    { id: 'deep-ocean', name: 'Deep Ocean' },
    { id: 'portal-ring', name: 'Portal Ring' },
    { id: 'cyber-corridor', name: 'Cyber Corridor' },
    { id: 'time-warp', name: 'Time Warp' },
    { id: 'gravity-well', name: 'Gravity Well' },
    { id: 'plasma-wave', name: 'Plasma Wave' },
    { id: 'aurora', name: 'Aurora' },
    { id: 'northern-lights', name: 'Northern Lights' },
    { id: 'crystal-cave', name: 'Crystal Cave' },
    { id: 'chrome-wave', name: 'Chrome Wave' },
    { id: 'sunset-drive', name: 'Sunset Drive' },
    { id: 'neon-highway', name: 'Neon Highway' },
    { id: 'neon-horizon', name: 'Neon Horizon' },
    { id: 'dna-aurora', name: 'DNA Aurora' },
    { id: 'plasma-ball', name: 'Plasma Ball' },
    { id: 'hologram', name: 'Hologram' },
    { id: '3d-plasma', name: '3D Plasma', webgl: true },
    { id: '3d-terrain', name: '3D Terrain', webgl: true },
    { id: '3d-tunnel', name: '3D Tunnel', webgl: true },
    { id: 'apollonian-caves', name: 'Apollonian Caves', webgl: true },
    { id: 'aurora-shader', name: 'Aurora Shader', webgl: true },
    { id: 'fractal-zoom', name: 'Fractal Zoom', webgl: true },
    { id: 'gyroid-flux', name: 'Gyroid Flux', webgl: true },
    { id: 'hypnotic-spiral', name: 'Hypnotic Spiral', webgl: true },
    { id: 'kathmandu-alley', name: 'Kathmandu Alley', webgl: true },
    { id: 'mandelbrot-zoom', name: 'Mandelbrot Zoom', webgl: true },
    { id: 'neon-tunnel-gpu', name: 'Neon Tunnel GPU', webgl: true },
    { id: 'plasma-warp', name: 'Plasma Warp', webgl: true },
    { id: 'quantum-tunnel', name: 'Quantum Tunnel', webgl: true },
    { id: 'spiral-vortex', name: 'Spiral Vortex', webgl: true },
    { id: 'terrain-flyover', name: 'Terrain Flyover', webgl: true },
    { id: 'torii-gates', name: 'Torii Gates', webgl: true },
    { id: 'tunnel-shader', name: 'Tunnel Shader', webgl: true },
    { id: 'warp-helix', name: 'Warp Helix', webgl: true },
  ]},
  { label: 'Frames & Film', presets: [
    { id: 'neon-frame', name: 'Neon Frame' },
    { id: 'light-leak', name: 'Light Leak' },
    { id: 'film-burn', name: 'Film Burn' },
    { id: 'film-scratch', name: 'Film Scratch' },
    { id: 'scan-line', name: 'Scan Line' },
    { id: 'vhs-noise', name: 'VHS Noise' },
    { id: 'vhs-tracking', name: 'VHS Tracking' },
    { id: 'film-grain', name: 'Film Grain' },
    { id: 'film-countdown', name: 'Film Countdown' },
    { id: 'film-reel', name: 'Film Reel' },
    { id: 'vhs-rewind', name: 'VHS Rewind' },
    { id: 'polaroid-flash', name: 'Polaroid Flash' },
    { id: 'tape-distort', name: 'Tape Distort' },
    { id: 'tape-warp', name: 'Tape Warp' },
    { id: 'flame-frame-gpu', name: 'Flame Frame GPU', webgl: true },
    { id: 'frost-frame', name: 'Frost Frame', webgl: true },
    { id: 'glitch-border', name: 'Glitch Border', webgl: true },
    { id: 'laser-frame-gpu', name: 'Laser Frame GPU', webgl: true },
    { id: 'plasma-border', name: 'Plasma Border', webgl: true },
  ]},
  { label: 'Patterns', presets: [
    { id: 'kaleidoscope', name: 'Kaleidoscope' },
    { id: 'mandala', name: 'Mandala' },
    { id: 'sacred-geometry', name: 'Sacred Geometry' },
    { id: 'moire', name: 'Moire' },
    { id: 'prism', name: 'Prism' },
    { id: 'barcode', name: 'Barcode' },
    { id: 'spirograph', name: 'Spirograph' },
    { id: 'cyber-mandala', name: 'Cyber Mandala' },
    { id: 'penrose-tile', name: 'Penrose Tile' },
    { id: 'checker-wave', name: 'Checker Wave' },
    { id: 'hermann-grid', name: 'Hermann Grid' },
    { id: 'op-art', name: 'Op Art' },
    { id: 'stained-glass', name: 'Stained Glass' },
    { id: 'dot-halftone', name: 'Dot Halftone' },
    { id: 'wave-rings', name: 'Wave Rings' },
    { id: 'pendulum-wave', name: 'Pendulum Wave' },
    { id: 'compass-rose', name: 'Compass Rose' },
    { id: 'square-hymn', name: 'Square Hymn' },
    { id: 'abstract-topology', name: 'Abstract Topology', webgl: true },
    { id: 'bismuth', name: 'Bismuth', webgl: true },
    { id: 'butterfly-effect', name: 'Butterfly Effect', webgl: true },
    { id: 'cross-stitch', name: 'Cross Stitch', webgl: true },
    { id: 'diffraction-grating', name: 'Diffraction Grating', webgl: true },
    { id: 'fibonacci-spiral-gpu', name: 'Fibonacci Spiral GPU', webgl: true },
    { id: 'fractal-flame', name: 'Fractal Flame', webgl: true },
    { id: 'geode', name: 'Geode', webgl: true },
    { id: 'geometric-tile', name: 'Geometric Tile', webgl: true },
    { id: 'hilma-circles', name: 'Hilma Circles', webgl: true },
    { id: 'hilma-spiral', name: 'Hilma Spiral', webgl: true },
    { id: 'interference-pattern', name: 'Interference Pattern', webgl: true },
    { id: 'interference-rings', name: 'Interference Rings', webgl: true },
    { id: 'kaleidoscope-gpu', name: 'Kaleidoscope GPU', webgl: true },
    { id: 'magnetic-pendulum', name: 'Magnetic Pendulum', webgl: true },
    { id: 'mandelbulb', name: 'Mandelbulb', webgl: true },
    { id: 'menger-temple', name: 'Menger Temple', webgl: true },
    { id: 'moire-gpu', name: 'Moire GPU', webgl: true },
    { id: 'pendulum-chaos', name: 'Pendulum Chaos', webgl: true },
    { id: 'petroglyph', name: 'Petroglyph', webgl: true },
    { id: 'quaternion-julia', name: 'Quaternion Julia', webgl: true },
    { id: 'sdf-chrome', name: 'SDF Chrome', webgl: true },
    { id: 'sdf-shapes', name: 'SDF Shapes', webgl: true },
    { id: 'stained-glass-cathedral', name: 'Stained Glass Cathedral', webgl: true },
    { id: 'stained-glass-dark', name: 'Stained Glass Dark', webgl: true },
    { id: 'stained-glass-gpu', name: 'Stained Glass GPU', webgl: true },
    { id: 'stained-glass-neon', name: 'Stained Glass Neon', webgl: true },
    { id: 'stained-glass-rose', name: 'Stained Glass Rose', webgl: true },
    { id: 'tessellation', name: 'Tessellation', webgl: true },
    { id: 'wave-interference-3d', name: 'Wave Interference 3D', webgl: true },
    { id: 'woodcut', name: 'Woodcut', webgl: true },
  ]},
  { label: 'Organic', presets: [
    { id: 'cellular', name: 'Cellular' },
    { id: 'liquid', name: 'Liquid' },
    { id: 'voronoi', name: 'Voronoi' },
    { id: 'voronoi-rk', name: 'Voronoi RK' },
    { id: 'smoke', name: 'Smoke' },
    { id: 'oil-spill', name: 'Oil Spill' },
    { id: 'coral-reef', name: 'Coral Reef' },
    { id: 'flow-field', name: 'Flow Field' },
    { id: 'silk-flow', name: 'Silk Flow' },
    { id: 'ant-colony', name: 'Ant Colony' },
    { id: 'bioluminescence', name: 'Bioluminescence' },
    { id: 'ink-blot', name: 'Ink Blot' },
    { id: 'ink-wash', name: 'Ink Wash' },
    { id: 'ink-calligraphy', name: 'Ink Calligraphy' },
    { id: 'lava-lamp', name: 'Lava Lamp' },
    { id: 'lava-rise', name: 'Lava Rise' },
    { id: 'bubble-float', name: 'Bubble Float' },
    { id: 'growth-spiral', name: 'Growth Spiral' },
    { id: 'mycelium', name: 'Mycelium' },
    { id: 'fungal-web', name: 'Fungal Web' },
    { id: '3d-bubble', name: '3D Bubble', webgl: true },
    { id: '3d-worm', name: '3D Worm', webgl: true },
    { id: 'blood-cell-flow', name: 'Blood Cell Flow', webgl: true },
    { id: 'coral-polyp-gpu', name: 'Coral Polyp GPU', webgl: true },
    { id: 'crystal-growth', name: 'Crystal Growth', webgl: true },
    { id: 'ferrofluid', name: 'Ferrofluid', webgl: true },
    { id: 'fluid-dynamics', name: 'Fluid Dynamics', webgl: true },
    { id: 'fluid-smoke', name: 'Fluid Smoke', webgl: true },
    { id: 'ink-vortex-gpu', name: 'Ink Vortex GPU', webgl: true },
    { id: 'lava-flow', name: 'Lava Flow', webgl: true },
    { id: 'liquid-chrome', name: 'Liquid Chrome', webgl: true },
    { id: 'liquid-gold', name: 'Liquid Gold', webgl: true },
    { id: 'liquid-nitrogen', name: 'Liquid Nitrogen', webgl: true },
    { id: 'marble-flow', name: 'Marble Flow', webgl: true },
    { id: 'metaball-pulse', name: 'Metaball Pulse', webgl: true },
    { id: 'oil-painting', name: 'Oil Painting', webgl: true },
    { id: 'petri-culture', name: 'Petri Culture', webgl: true },
    { id: 'psychedelic-flow', name: 'Psychedelic Flow', webgl: true },
    { id: 'reaction-diffusion', name: 'Reaction Diffusion', webgl: true },
    { id: 'sdf-organic', name: 'SDF Organic', webgl: true },
    { id: 'smoke-rings', name: 'Smoke Rings', webgl: true },
    { id: 'smoke-rings-gpu', name: 'Smoke Rings GPU', webgl: true },
    { id: 'soap-film', name: 'Soap Film', webgl: true },
    { id: 'suminagashi', name: 'Suminagashi', webgl: true },
    { id: 'synapse-fire', name: 'Synapse Fire', webgl: true },
    { id: 'voronoi-electric', name: 'Voronoi Electric', webgl: true },
    { id: 'voronoi-gpu', name: 'Voronoi GPU', webgl: true },
  ]},
  { label: 'Nature', presets: [
    { id: 'fractal-tree', name: 'Fractal Tree' },
    { id: 'flower-bloom', name: 'Flower Bloom' },
    { id: 'autumn-fall', name: 'Autumn Fall' },
    { id: 'dandelion-seeds', name: 'Dandelion Seeds' },
    { id: 'petal-storm', name: 'Petal Storm' },
    { id: 'meadow-breeze', name: 'Meadow Breeze' },
    { id: 'leaf-vein', name: 'Leaf Vein' },
    { id: 'vine-growth', name: 'Vine Growth' },
    { id: 'neon-vines', name: 'Neon Vines' },
    { id: 'forest-canopy', name: 'Forest Canopy' },
    { id: 'northern-forest', name: 'Northern Forest' },
    { id: 'seed-burst', name: 'Seed Burst' },
    { id: 'pollen-cloud', name: 'Pollen Cloud' },
    { id: 'tree-ring', name: 'Tree Ring' },
    { id: 'moss-carpet', name: 'Moss Carpet' },
    { id: 'lichen-spread', name: 'Lichen Spread' },
    { id: 'spore-drift', name: 'Spore Drift' },
    { id: 'erosion-landscape', name: 'Erosion Landscape', webgl: true },
    { id: 'japanese-garden', name: 'Japanese Garden', webgl: true },
    { id: 'ridge-silhouette', name: 'Ridge Silhouette', webgl: true },
    { id: 'tectonic', name: 'Tectonic', webgl: true },
    { id: 'topographic', name: 'Topographic', webgl: true },
  ]},
  { label: 'Water', presets: [
    { id: 'water-surface', name: 'Water Surface' },
    { id: 'river-stream', name: 'River Stream' },
    { id: 'waterfall-mist', name: 'Waterfall Mist' },
    { id: 'tide-wave', name: 'Tide Wave' },
    { id: 'tide-pool', name: 'Tide Pool' },
    { id: 'rain-puddles', name: 'Rain Puddles' },
    { id: 'pond-life', name: 'Pond Life' },
    { id: 'kelp-forest', name: 'Kelp Forest' },
    { id: 'ice-formation', name: 'Ice Formation' },
    { id: 'erosion-line', name: 'Erosion Line' },
    { id: 'deep-caustics', name: 'Deep Caustics', webgl: true },
    { id: 'deep-sea-vent', name: 'Deep Sea Vent', webgl: true },
    { id: 'ice-crystal', name: 'Ice Crystal', webgl: true },
    { id: 'ocean-caustics-gpu', name: 'Ocean Caustics GPU', webgl: true },
    { id: 'ocean-deep', name: 'Ocean Deep', webgl: true },
    { id: 'ocean-storm', name: 'Ocean Storm', webgl: true },
    { id: 'ocean-wave', name: 'Ocean Wave', webgl: true },
    { id: 'polar-ice', name: 'Polar Ice', webgl: true },
    { id: 'ripple-interference', name: 'Ripple Interference', webgl: true },
    { id: 'tide-pattern', name: 'Tide Pattern', webgl: true },
    { id: 'tide-pool-life', name: 'Tide Pool Life', webgl: true },
    { id: 'water-caustics', name: 'Water Caustics', webgl: true },
  ]},
  { label: 'Grid & Tech', presets: [
    { id: 'glitch-grid', name: 'Glitch Grid' },
    { id: 'hexgrid-pulse', name: 'Hexgrid Pulse' },
    { id: 'grid-warp', name: 'Grid Warp' },
    { id: 'gravity-cloth', name: 'Gravity Cloth' },
    { id: 'circuit-board', name: 'Circuit Board' },
    { id: 'crt-monitor', name: 'CRT Monitor' },
    { id: 'retro-terminal', name: 'Retro Terminal' },
    { id: 'circuit-trace', name: 'Circuit Trace' },
    { id: 'cyber-grid', name: 'Cyber Grid' },
    { id: 'hex-network', name: 'Hex Network' },
    { id: 'led-matrix', name: 'LED Matrix' },
    { id: 'dot-matrix', name: 'Dot Matrix' },
    { id: 'neural-net', name: 'Neural Net' },
    { id: 'isometric-city', name: 'Isometric City' },
    { id: 'wireframe-city', name: 'Wireframe City' },
    { id: 'floating-ui', name: 'Floating UI' },
    { id: 'data-stream', name: 'Data Stream' },
    { id: 'data-cascade', name: 'Data Cascade' },
    { id: 'data-sprites', name: 'Data Sprites' },
    { id: 'matrix-code', name: 'Matrix Code' },
    { id: 'matrix-rain', name: 'Matrix Rain' },
    { id: 'brain-scan', name: 'Brain Scan', webgl: true },
    { id: 'circuit-gpu', name: 'Circuit GPU', webgl: true },
    { id: 'circuit-matrix', name: 'Circuit Matrix', webgl: true },
    { id: 'circuit-schematic', name: 'Circuit Schematic', webgl: true },
    { id: 'data-rain', name: 'Data Rain', webgl: true },
    { id: 'digital-rain-gpu', name: 'Digital Rain GPU', webgl: true },
    { id: 'dna-sequence', name: 'DNA Sequence', webgl: true },
    { id: 'holo-display', name: 'Holo Display', webgl: true },
    { id: 'microchip-die', name: 'Microchip Die', webgl: true },
    { id: 'neon-grid-city', name: 'Neon Grid City', webgl: true },
    { id: 'neon-grid-shader', name: 'Neon Grid Shader', webgl: true },
  ]},
  { label: 'Space', presets: [
    { id: 'starfield', name: 'Starfield' },
    { id: 'constellation', name: 'Constellation' },
    { id: 'deep-nebula', name: 'Deep Nebula' },
    { id: 'bokeh', name: 'Bokeh' },
    { id: 'terrain', name: 'Terrain' },
    { id: 'meteor-shower', name: 'Meteor Shower' },
    { id: 'orbits', name: 'Orbits' },
    { id: 'cyber-sun', name: 'Cyber Sun' },
    { id: 'dna-helix', name: 'DNA Helix' },
    { id: 'crystal-lattice', name: 'Crystal Lattice' },
    { id: 'radar', name: 'Radar' },
    { id: 'sonar-ping', name: 'Sonar Ping' },
    { id: 'sand-dunes', name: 'Sand Dunes' },
    { id: 'solar-flare', name: 'Solar Flare' },
    { id: 'asteroid-belt', name: 'Asteroid Belt', webgl: true },
    { id: 'black-hole-psyche', name: 'Black Hole Psyche', webgl: true },
    { id: 'galaxy-spiral', name: 'Galaxy Spiral', webgl: true },
    { id: 'gravitational-lens', name: 'Gravitational Lens', webgl: true },
    { id: 'magnetic-storm-gpu', name: 'Magnetic Storm GPU', webgl: true },
    { id: 'nebula-cloud', name: 'Nebula Cloud', webgl: true },
    { id: 'nebula-gpu', name: 'Nebula GPU', webgl: true },
    { id: 'radio-telescope', name: 'Radio Telescope', webgl: true },
    { id: 'solar-corona', name: 'Solar Corona', webgl: true },
    { id: 'sun-surface', name: 'Sun Surface', webgl: true },
    { id: 'supernova', name: 'Supernova', webgl: true },
  ]},
  { label: 'Neon & Glow', presets: [
    { id: 'neon-80s', name: 'Neon 80s' },
    { id: 'neon-bars', name: 'Neon Bars' },
    { id: 'neon-dust', name: 'Neon Dust' },
    { id: 'neon-jellyfish', name: 'Neon Jellyfish' },
    { id: 'neon-smoke', name: 'Neon Smoke' },
    { id: 'electric-arc', name: 'Electric Arc' },
    { id: 'electric-city', name: 'Electric City' },
    { id: 'electric-fence', name: 'Electric Fence' },
    { id: 'lightning', name: 'Lightning' },
    { id: 'light-swarm', name: 'Light Swarm' },
    { id: 'fireflies', name: 'Fireflies' },
    { id: 'ember-drift', name: 'Ember Drift' },
    { id: 'cathode-glow', name: 'Cathode Glow' },
    { id: 'fire-wall', name: 'Fire Wall' },
    { id: 'paper-lantern', name: 'Paper Lantern' },
    { id: 'neon-type', name: 'Neon Type' },
    { id: 'electric-storm', name: 'Electric Storm', webgl: true },
    { id: 'energy-field', name: 'Energy Field', webgl: true },
    { id: 'fire-shader', name: 'Fire Shader', webgl: true },
    { id: 'holographic-foil', name: 'Holographic Foil', webgl: true },
    { id: 'neon-pulse-rings', name: 'Neon Pulse Rings', webgl: true },
    { id: 'neon-sign-flicker', name: 'Neon Sign Flicker', webgl: true },
    { id: 'plasma-globe', name: 'Plasma Globe', webgl: true },
    { id: 'plasma-globe-gpu', name: 'Plasma Globe GPU', webgl: true },
    { id: 'thermite-reaction', name: 'Thermite Reaction', webgl: true },
  ]},
  { label: 'Glitch & Retro', presets: [
    { id: 'glitch-8bit', name: 'Glitch 8bit' },
    { id: 'glitch-wave', name: 'Glitch Wave' },
    { id: 'cyber-glitch', name: 'Cyber Glitch' },
    { id: 'digital-noise', name: 'Digital Noise' },
    { id: 'corrupted-archive', name: 'Corrupted Archive' },
    { id: 'desktop-meltdown', name: 'Desktop Meltdown' },
    { id: 'static-burst', name: 'Static Burst' },
    { id: 'static-snow', name: 'Static Snow' },
    { id: 'radio-static', name: 'Radio Static' },
    { id: 'scramble-channel', name: 'Scramble Channel' },
    { id: 'flicker-strobe', name: 'Flicker Strobe' },
    { id: 'old-tv', name: 'Old TV' },
    { id: 'tv-testcard', name: 'TV Testcard' },
    { id: 'tv-weather', name: 'TV Weather' },
    { id: 'test-pattern', name: 'Test Pattern' },
    { id: 'crt-scan', name: 'CRT Scan' },
    { id: 'retro-arcade', name: 'Retro Arcade' },
    { id: 'retro-wave', name: 'Retro Wave' },
    { id: 'arcade-blocks', name: 'Arcade Blocks' },
    { id: 'pixel-cascade', name: 'Pixel Cascade' },
    { id: 'pixel-mosaic', name: 'Pixel Mosaic' },
    { id: 'pixel-rain', name: 'Pixel Rain' },
    { id: 'pixel-sort-b', name: 'Pixel Sort' },
    { id: 'ascii-art', name: 'ASCII Art' },
    { id: 'circuit-bend', name: 'Circuit Bend', webgl: true },
    { id: 'glitch-corruption', name: 'Glitch Corruption', webgl: true },
    { id: 'glitch-rain', name: 'Glitch Rain', webgl: true },
    { id: 'glitch-shader', name: 'Glitch Shader', webgl: true },
    { id: 'heat-distortion', name: 'Heat Distortion', webgl: true },
    { id: 'pixel-grid', name: 'Pixel Grid', webgl: true },
    { id: 'retro-sun', name: 'Retro Sun', webgl: true },
  ]},
  { label: 'Audio Reactive', presets: [
    { id: 'frequency-rings', name: 'Frequency Rings' },
    { id: 'equalizer', name: 'Equalizer' },
    { id: 'sine-waves', name: 'Sine Waves' },
    { id: 'ridge-lines', name: 'Ridge Lines' },
    { id: 'gradient-sweep', name: 'Gradient Sweep' },
    { id: 'wireframe-sphere', name: 'Wireframe Sphere' },
    { id: 'analog-wave', name: 'Analog Wave' },
    { id: 'audio-mesh', name: 'Audio Mesh' },
    { id: 'boombox-meter', name: 'Boombox Meter' },
    { id: 'dial-tone', name: 'Dial Tone' },
    { id: 'oscilloscope', name: 'Oscilloscope' },
    { id: 'oscilloscope-xy', name: 'Oscilloscope XY' },
    { id: 'pulse-ring', name: 'Pulse Ring' },
    { id: 'shockwave', name: 'Shockwave' },
    { id: 'radial-burst', name: 'Radial Burst' },
    { id: 'synth-wave', name: 'Synth Wave' },
    { id: 'vinyl-groove', name: 'Vinyl Groove' },
    { id: 'cassette-reel', name: 'Cassette Reel' },
    { id: 'honeycomb-pulse', name: 'Honeycomb Pulse' },
    { id: '3d-wave', name: '3D Wave', webgl: true },
    { id: 'color-organ', name: 'Color Organ', webgl: true },
    { id: 'cymatics', name: 'Cymatics', webgl: true },
    { id: 'doppler-shift', name: 'Doppler Shift', webgl: true },
    { id: 'electromagnetic-wave', name: 'Electromagnetic Wave', webgl: true },
    { id: 'sound-sculpture', name: 'Sound Sculpture', webgl: true },
    { id: 'sound-wave-propagation', name: 'Sound Wave Propagation', webgl: true },
    { id: 'spectral-analysis', name: 'Spectral Analysis', webgl: true },
    { id: 'thermal-cam', name: 'Thermal Cam', webgl: true },
    { id: 'vinyl-groove-gpu', name: 'Vinyl Groove GPU', webgl: true },
    { id: 'vinyl-waveform', name: 'Vinyl Waveform', webgl: true },
    { id: 'waveform-mesh', name: 'Waveform Mesh', webgl: true },
    { id: 'waveform-terrain', name: 'Waveform Terrain', webgl: true },
  ]},
  { label: 'Particles', presets: [
    { id: 'snowfall', name: 'Snowfall' },
    { id: 'confetti-burst', name: 'Confetti Burst' },
    { id: 'hanabi-dusk', name: 'Hanabi Dusk' },
    { id: 'particle-storm', name: 'Particle Storm' },
    { id: 'dust-motes', name: 'Dust Motes' },
    { id: 'bird-murmuration', name: 'Bird Murmuration' },
    { id: 'smoke-stack', name: 'Smoke Stack' },
    { id: 'fog-bank', name: 'Fog Bank' },
    { id: 'wind-ripple', name: 'Wind Ripple' },
    { id: '3d-particles', name: '3D Particles', webgl: true },
    { id: 'cloud-chamber', name: 'Cloud Chamber', webgl: true },
    { id: 'electron-cloud', name: 'Electron Cloud', webgl: true },
    { id: 'particle-accelerator', name: 'Particle Accelerator', webgl: true },
    { id: 'sand-timer', name: 'Sand Timer', webgl: true },
  ]},
  { label: 'Weather', presets: [
    { id: 'rain', name: 'Rain' },
    { id: 'neon-rain', name: 'Neon Rain' },
    { id: 'cyber-rain-heavy', name: 'Cyber Rain' },
    { id: 'ceiling-drip', name: 'Ceiling Drip' },
    { id: 'rain-window', name: 'Rain Window', webgl: true },
    { id: 'sandstorm', name: 'Sandstorm', webgl: true },
    { id: 'storm-cell', name: 'Storm Cell', webgl: true },
    { id: 'weather-radar', name: 'Weather Radar', webgl: true },
  ]},
];

// Flat list for compatibility
const ALL_PRESETS = PRESET_CATEGORIES.flatMap(c => c.presets);

// WebGL のプリセット(webgl: true。VJam 本体から #44 で取り込んだもの)。エンジンは WebGL のレイヤーを同時に 1 枚までにするので、
// Next / Auto の抽選では 1 回に 1 本まで(2 本引くと 1 本がすぐ消えて、その回のレイヤーが減る)
const WEBGL_PRESETS = ALL_PRESETS.filter(p => p.webgl).map(p => p.id);

// プリセット → カタログのカテゴリ。Auto が足すものを、今出ているものと見た目がかぶりにくくする(同じカテゴリを避ける。#59)
const PRESET_CATEGORY = Object.fromEntries(PRESET_CATEGORIES.flatMap(c => c.presets.map(p => [p.id, c.label])));

const FILTER_NAMES = ['invert', 'hue-rotate', 'grayscale', 'saturate', 'brightness', 'contrast', 'sepia', 'blur'];
const VALID_BLEND_MODES = ['screen', 'lighten', 'difference', 'exclusion', 'color-dodge'];

const DEFAULT_SETTINGS = {
  autoOnStart: true, // トグル ON で Auto / Rnd を始める
  allTabs: false, // 全タブで ON(切り替えたタブ・開いたタブにも SW が入れる)
  fadeDuration: 5, // 秒。エンジンに送るのは Cycle の半分まで(_fadeSeconds)
  cycleSeconds: 15, // Auto / Rnd が切り替える秒数(たったら次の拍で切り替える)
  sensitivity: 'mid',
  version: 2, // 2 = フェード・Cycle を秒にしたあと(#58)。無ければその前の保存(migrateSettings)
};
const FADE_OPTIONS = [0, 3, 5, 8, 12];
const CYCLE_OPTIONS = [8, 15, 30, 60];

// 保存された設定を今の形に読む。#58 より前の保存(version が無い)は、前の既定のフェード 1.5 秒のままなら新しい既定に。
// 選択肢に無いフェード(昔の 0.5 / 1.5)は 3 秒、Cycle は既定に(昔の拍数 barsPerCycle は捨てる)
function migrateSettings(saved) {
  const settings = { ...DEFAULT_SETTINGS, ...saved };
  if (!(saved.version >= 2) && saved.fadeDuration === 1.5) settings.fadeDuration = DEFAULT_SETTINGS.fadeDuration;
  if (!FADE_OPTIONS.includes(settings.fadeDuration)) {
    settings.fadeDuration = settings.fadeDuration === 0.5 || settings.fadeDuration === 1.5 ? 3 : DEFAULT_SETTINGS.fadeDuration;
  }
  if (!CYCLE_OPTIONS.includes(settings.cycleSeconds)) settings.cycleSeconds = DEFAULT_SETTINGS.cycleSeconds;
  delete settings.barsPerCycle;
  return settings;
}

const SENSITIVITY_MAP = { lo: 0.5, mid: 1.0, hi: 2.0 };

const PRESET_NAMES = new Map(ALL_PRESETS.map(p => [p.id, p.name]));
const STAGE_MAX_LAYERS = 5; // ステージに出すレイヤー名の数(エンジンの上限と同じ)
const LIVE_POLL_MS = 1000; // popup が開いている間、レイヤー名と BPM をエンジンから読み直す間隔
const BPM_MISSES_TO_HIDE = 3; // tabCapture の音はフレームごとに使い切られて読めない回があるので、続けて読めなかったときだけ BPM を消す
const MANUAL_OPEN_KEY = 'vjamfx_manual_open'; // 手動を開いているか(次に開いたときも同じ)
const BLOCKED_MESSAGE = "This page can't be overlaid";

class PopupController {
  constructor() {
    this.presets = ALL_PRESETS; // 手動の一覧(全部)
    // デフォルトプール(Next / Auto / Rnd の抽選対象)。読めるまで・読めないときは全プリセット + エンジン既定の filter / blend
    this.poolPresets = ALL_PRESETS;
    this.pool = null; // { filters, blends } — エンジンに引数で渡す(エンジンは MAIN world なので fetch しない)
    this.heavyPresets = {}; // この端末で重いと分かったもの(SW が storage.local に保存)。Next / Auto のプールから除く
    this.activeLayers = new Set();  // preset IDs currently active
    this.activeFilters = new Set();
    this.selectedBlendMode = 'screen';
    this.opacity = 0.8;
    this.isActive = false;
    this.audioEnabled = true;
    this.autoCycleActive = false;
    this.autoBlend = false;
    this.autoFilters = false;
    this._tabId = null;
    this._injectedPresets = new Set(); // track which preset files have been injected
    this._coreInjected = false;
    this._busy = false; // concurrency guard for async operations
    this._autoPicked = false; // 次の _startAll のレイヤーは Auto がプールから選んだもの(_prepareAutoStart)
    this.settings = { ...DEFAULT_SETTINGS };
    this.locks = { effect: false, blend: false, filter: false };
    this.scenes = new Array(12).fill(null); // 12 scene slots
    this.textState = null; // { text, autoText }
    this.sceneSaveMode = false;
    this._live = null; // エンジンから読んだ { layers, bpm }(ステージの表示用。popup の状態には入れない)
    this._bpm = 0;
    this._bpmMisses = 0;
    this._livePollTimer = null;
  }

  async init() {
    const [tabs] = await Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
      this._loadManualOpen(),
    ]);
    if (tabs.length > 0) {
      this._tabId = tabs[0].id;
      this._tabUrl = tabs[0].url || '';
    }

    if (this._isRestrictedPage()) {
      this._showError(BLOCKED_MESSAGE);
      return;
    }

    await this._loadSettings();
    await this._loadScenes();
    await this._loadPool();
    await this._loadHeavyPresets();
    this._buildPresetList();
    await this._syncState();
    this._bindEvents();
    this._updateOpacityUI(); // OFF のときも今の値(既定 80%)を出す
    this._renderStage();
    this._startLivePoll();
  }

  _isRestrictedPage() {
    const url = this._tabUrl;
    return !url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')
      || url.startsWith('edge://') || url.startsWith('about:') || url.startsWith('devtools://');
  }

  // 重ねられないページ: ロゴ・マーク・ひとことだけ出す(ほかの操作は CSS で隠す)
  _showError(msg) {
    const popup = document.querySelector('.popup');
    if (popup) popup.classList.add('is-blocked');
    const msgEl = document.getElementById('blocked-msg');
    if (msgEl) msgEl.textContent = msg;
    const blocked = document.getElementById('blocked');
    if (blocked) blocked.hidden = false;
  }

  // 手動の開け閉め。開いているかは storage に覚えて、次に開いたときも同じにする
  async _loadManualOpen() {
    let open = false;
    try {
      const result = await chrome.storage.local.get(MANUAL_OPEN_KEY);
      open = !!(result && result[MANUAL_OPEN_KEY]);
    } catch (e) { /* storage not available */ }
    this._setManualOpen(open);
  }

  _setManualOpen(open) {
    const section = document.getElementById('manual-section');
    if (section) section.hidden = !open;
    const btn = document.getElementById('btn-manual');
    if (btn) btn.setAttribute('aria-expanded', String(open));
  }

  async _toggleManual() {
    const section = document.getElementById('manual-section');
    const open = !!(section && section.hidden);
    this._setManualOpen(open);
    try {
      await chrome.storage.local.set({ [MANUAL_OPEN_KEY]: open });
    } catch (e) { /* storage not available */ }
  }

  _buildPresetList() {
    const list = document.getElementById('preset-list');
    if (!list) return;
    list.innerHTML = '';
    for (const cat of PRESET_CATEGORIES) {
      const header = document.createElement('div');
      header.className = 'category-header';
      header.textContent = cat.label;
      list.appendChild(header);
      for (const p of cat.presets) {
        const label = document.createElement('label');
        label.className = 'preset-item';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = 'preset';
        input.value = p.id;
        const span = document.createElement('span');
        span.textContent = p.name;
        label.appendChild(input);
        label.appendChild(span);
        list.appendChild(label);
      }
    }
  }

  async _syncState() {
    if (!this._tabId) return;

    let liveState = null;
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        func: () => {
          if (!window._vjamFxEngine) return null;
          const e = window._vjamFxEngine;
          // Rnd は Auto の中(_autoBlend など)か単独(_autoFXBlend など)。止めても値は残るので、タイマーが動いている方だけ見る
          const cycling = !!e._autoCycleTimer;
          const fx = !!e._autoFXTimer;
          return {
            active: e.active,
            layers: e.getActiveLayerNames(),
            blendMode: e.blendMode,
            filters: [...e.activeFilters],
            autoCycle: cycling,
            autoBlend: (cycling && !!e._autoBlend) || (fx && !!e._autoFXBlend),
            autoFilters: (cycling && !!e._autoFilters) || (fx && !!e._autoFXFilters),
            isLightPage: e.isLightPage,
          };
        },
      });
      liveState = result;
    } catch (e) { /* scripting failed */ }

    let savedState = null;
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'getState',
        tabId: this._tabId,
      });
      if (response && response.state && response.state.active) {
        savedState = response.state;
      }
    } catch (e) { /* SW not available */ }

    // エンジンが動いていれば、それに SW の状態(不透明度・ロック・テキストなど、エンジンから読まないもの)を足す。
    // SW が入れたタブ(ページ遷移・全タブで ON)でも、popup を触ったときに不透明度などが落ちないように。
    // Auto / Rnd はエンジンの状態を優先(SW の状態は拡張の更新・再読み込みで消える。エンジンはページに残って回り続ける)
    const live = !!(liveState && liveState.active);
    const state = live ? { ...savedState, ...liveState } : savedState;

    if (!state) return;

    this.isActive = true;
    this.selectedBlendMode = state.blendMode || 'screen';
    if (state.opacity !== undefined) this.opacity = state.opacity;
    if (state.audioEnabled !== undefined) this.audioEnabled = state.audioEnabled;
    if (state.layers) {
      for (const id of state.layers) this.activeLayers.add(id);
    } else if (state.preset) {
      this.activeLayers.add(state.preset);
    }
    if (state.filters) {
      for (const f of state.filters) this.activeFilters.add(f);
    }
    if (live ? state.autoCycle : (state.autoCyclePresets && state.autoCyclePresets.length > 0)) {
      this.autoCycleActive = true;
    }
    if (state.autoBlend) this.autoBlend = true;
    if (state.autoFilters) this.autoFilters = true;
    if (state.locks) this.locks = { ...this.locks, ...state.locks };
    if (state.textState) this.textState = state.textState;
    this._updateUI();
  }

  _updateUI() {
    const toggle = document.getElementById('toggle');
    if (toggle) toggle.checked = this.isActive;

    document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => {
      cb.checked = this.activeLayers.has(cb.value);
    });

    document.querySelectorAll('.blend-btn').forEach(btn => {
      btn.classList.toggle('active', this.selectedBlendMode !== 'screen' && btn.dataset.blend === this.selectedBlendMode);
    });

    this._updateOpacityUI();

    const audioBtn = document.getElementById('audio-toggle');
    if (audioBtn) {
      audioBtn.textContent = this.audioEnabled ? 'ON' : 'OFF';
      audioBtn.classList.toggle('on', this.audioEnabled);
    }

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', this.activeFilters.has(btn.dataset.filter));
    });

    this._updateAutoUI();

    // Lock buttons
    for (const key of ['effect', 'blend', 'filter']) {
      const lockBtn = document.getElementById('lock-' + key);
      if (lockBtn) {
        lockBtn.classList.toggle('locked', this.locks[key]);
        lockBtn.textContent = this.locks[key] ? 'Locked' : 'Lock';
      }
    }

    // Text state
    if (this.textState) {
      const textInput = document.getElementById('text-input');
      if (textInput && this.textState.text) textInput.value = this.textState.text;
      const btnTextToggle = document.getElementById('btn-text-toggle');
      if (btnTextToggle && this.textState.autoText) {
        btnTextToggle.classList.add('active');
        btnTextToggle.textContent = 'OFF';
      }
    }

    this._renderStage();
  }

  // Auto / Rnd のボタン(Rnd はチップと手動の中の両方)とステージ
  _updateAutoUI() {
    const autoBtn = document.getElementById('btn-auto-cycle');
    if (autoBtn) {
      autoBtn.classList.toggle('active', this.autoCycleActive);
      const label = autoBtn.querySelector('.label');
      if (label) label.textContent = this.autoCycleActive ? 'Stop Auto' : 'Auto';
    }
    document.querySelectorAll('#auto-blend, [data-rnd="blend"]').forEach(b => b.classList.toggle('active', this.autoBlend));
    document.querySelectorAll('#auto-filters, [data-rnd="filters"]').forEach(b => b.classList.toggle('active', this.autoFilters));
    this._renderStage();
  }

  _updateOpacityUI() {
    const pct = Math.round(this.opacity * 100);
    const slider = document.getElementById('opacity-slider');
    if (slider) {
      slider.value = pct;
      slider.style.setProperty('--v', `${pct}%`);
    }
    const value = document.getElementById('opacity-value');
    if (value) value.textContent = `${pct}%`;
  }

  // いま流れているもの: AUTO / MANUAL / OFF、BPM と拍の点、出ているレイヤーの名前(最大 5)。
  // 名前と BPM はエンジンから読めた分(_pollLive)、読む前は popup のレイヤー
  _renderStage() {
    const mode = !this.isActive ? 'off' : this.autoCycleActive ? 'auto' : 'manual';
    const stage = document.getElementById('stage');
    if (stage) stage.dataset.mode = mode;
    const modeEl = document.getElementById('stage-mode');
    if (modeEl) modeEl.textContent = mode.toUpperCase();

    const hint = document.getElementById('off-hint');
    if (hint) {
      hint.hidden = this.isActive;
      hint.textContent = this.settings.autoOnStart
        ? 'Switch on to start Auto with the music.'
        : 'Switch on to start the effects.';
    }

    const bpm = this.isActive ? this._bpm : 0;
    const bpmEl = document.getElementById('stage-bpm');
    if (bpmEl) {
      bpmEl.hidden = !(bpm > 0);
      bpmEl.textContent = bpm > 0 ? `${bpm} BPM` : '';
    }
    for (const id of ['stage-beat', 'stage-meter']) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.classList.toggle('pulse', bpm > 0);
      el.style.animationDuration = bpm > 0 ? `${60 / bpm}s` : '';
    }

    const list = document.getElementById('layer-names');
    if (list) {
      const ids = !this.isActive ? [] : this._live ? this._live.layers : [...this.activeLayers];
      list.textContent = '';
      ids.slice(0, STAGE_MAX_LAYERS).forEach((id, i) => {
        const li = document.createElement('li');
        const name = document.createElement('span');
        name.className = 'nm';
        name.textContent = PRESET_NAMES.get(id) || id;
        const num = document.createElement('span');
        num.className = 'ly';
        num.textContent = String(i + 1);
        li.append(name, num);
        list.appendChild(li);
      });
    }
  }

  _startLivePoll() {
    if (this._livePollTimer) return;
    this._pollLive();
    this._livePollTimer = setInterval(() => this._pollLive(), LIVE_POLL_MS);
  }

  // 出ているレイヤーと BPM を、今ある executeScript の経路でエンジンから読む。Auto / Rnd の ON / OFF は popup のフラグのまま
  async _pollLive() {
    if (!this._tabId || this._polling) return;
    if (!this.isActive) {
      this._live = null;
      this._bpm = 0;
      this._renderStage();
      return;
    }
    this._polling = true;
    let live = null;
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        func: () => {
          const e = window._vjamFxEngine;
          if (!e || !e.active) return null;
          let bpm = e.audioEnabled !== false && typeof e._tempoBpm === 'function' ? e._tempoBpm() : 0;
          // <video> / <audio> の analyser は拍を拾う前から初期値(120)を返すので、しばらく拍が来ていなければ出さない
          if (!(e._mseBpm > 0) && e._videoAudioAnalyser && performance.now() / 1000 - e._videoAudioLastBeatTime > 4) bpm = 0;
          return { layers: e.getActiveLayerNames(), bpm: Math.round(bpm) || 0 };
        },
      });
      if (result && Array.isArray(result.layers)) live = result;
    } catch (e) { /* タブが閉じた・読めないページ */ }
    this._polling = false;
    this._live = this.isActive ? live : null;
    if (live && live.bpm > 0) {
      this._bpm = live.bpm;
      this._bpmMisses = 0;
    } else if (++this._bpmMisses >= BPM_MISSES_TO_HIDE) {
      this._bpm = 0;
    }
    this._renderStage();
  }

  async _loadSettings() {
    try {
      const result = await chrome.storage.local.get('vjamfx_settings');
      if (result.vjamfx_settings) {
        this.settings = migrateSettings(result.vjamfx_settings);
      }
    } catch (e) { /* storage not available */ }
    this._updateSettingsUI();
  }

  async _saveSettings() {
    try {
      await chrome.storage.local.set({ vjamfx_settings: this.settings });
    } catch (e) { /* storage not available */ }
  }

  // デフォルトプールを読む(popup は拡張のページなので fetch できる)。知らないプリセットは無視
  async _loadPool() {
    try {
      const res = await fetch('/content/default-pool.json');
      const pool = await res.json();
      const ids = new Set(Array.isArray(pool.presets) ? pool.presets : []);
      const presets = ALL_PRESETS.filter(p => ids.has(p.id));
      if (presets.length > 0) this.poolPresets = presets;
      // webgl: Auto の抽選で 1 回に 1 本までにするため、categories: Auto が足すものを今出ているものとかぶりにくくするため、
      // エンジンへプールごと渡す(SW もページ遷移後にプールごと渡す)
      this.pool = { filters: pool.filters, blends: pool.blends, webgl: WEBGL_PRESETS, categories: PRESET_CATEGORY };
    } catch (e) { /* 読めない: 今の全プリセットで動く */ }
  }

  // この端末で重いもの(エンジンが見つけて SW が保存)を読み、エンジンが見つけたらその場で追う
  async _loadHeavyPresets() {
    try {
      const result = await chrome.storage.local.get('heavyPresets');
      this.heavyPresets = (result && result.heavyPresets) || {};
    } catch (e) { /* storage not available */ }
    this._updateHeavyUI();
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.heavyPresets) return;
        this.heavyPresets = changes.heavyPresets.newValue || {};
        this._updateHeavyUI();
      });
    }
  }

  // Next / Auto の抽選対象: プールから重いものを除く(全部重ければプールのまま)
  _usablePool() {
    const light = this.poolPresets.filter(p => !this.heavyPresets[p.id]);
    return light.length ? light : this.poolPresets;
  }

  _updateHeavyUI() {
    const names = Object.keys(this.heavyPresets);
    const countEl = document.getElementById('heavy-count');
    if (countEl) {
      countEl.textContent = String(names.length);
      countEl.title = names.join(', ');
    }
    const resetBtn = document.getElementById('btn-heavy-reset');
    if (resetBtn) resetBtn.disabled = names.length === 0;
    // フッター: 0 のときは出さない(戻すのは設定の Restore)
    const skipped = document.getElementById('heavy-skipped');
    if (skipped) {
      skipped.hidden = names.length === 0;
      skipped.textContent = `${names.length} skipped`;
      skipped.title = names.join(', ');
    }
  }

  // 戻す: 覚えた重いものを全部消して、エンジンにも忘れさせる。Auto 中なら戻したものも回す
  async _resetHeavyPresets() {
    this.heavyPresets = {};
    this._updateHeavyUI();
    try {
      await chrome.storage.local.remove('heavyPresets');
    } catch (e) { /* storage not available */ }
    await this._sendCommand({ action: 'clearHeavyPresets' });
    if (!this.isActive) return;
    if (this.autoCycleActive) {
      await this._injectAllPresets();
      await this._sendCommand({ action: 'updateAutoCycleOptions', presets: this._usablePool().map(p => p.id) });
    }
    await this._saveState();
  }

  // Auto / Rnd の開始コマンド(抽選対象はプール。interval は Cycle の秒数)
  _autoCycleCommand(extra) {
    return { action: 'startAutoCycle', presets: this._usablePool().map(p => p.id), interval: this.settings.cycleSeconds * 1000, autoBlend: this.autoBlend, autoFilters: this.autoFilters, locks: this.locks, pool: this.pool, ...extra };
  }

  _autoFXCommand() {
    return { action: 'startAutoFX', autoBlend: this.autoBlend, autoFilters: this.autoFilters, pool: this.pool, interval: this.settings.cycleSeconds * 1000 };
  }

  // エンジンに送るフェード秒数: 設定のフェード、ただし Cycle の半分まで(出ている時間がフェードだけにならないように)
  _fadeSeconds() {
    return Math.min(this.settings.fadeDuration, this.settings.cycleSeconds / 2);
  }

  // Next の選び方: プールからランダムに 1〜3 本(count を渡せばその本数)。WebGL は 1 本まで
  _randomPoolPresets(count) {
    const pool = this._usablePool();
    if (!count) count = 1 + Math.floor(Math.random() * Math.min(3, pool.length));
    const shuffled = pool.slice();
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t; }
    const chosen = [];
    let hasWebgl = false;
    for (const p of shuffled) {
      if (chosen.length >= count) break;
      if (p.webgl) {
        if (hasWebgl) continue;
        hasWebgl = true;
      }
      chosen.push(p);
    }
    return chosen;
  }

  async _loadScenes() {
    try {
      const result = await chrome.storage.local.get('vjamfx_scenes');
      if (result.vjamfx_scenes && Array.isArray(result.vjamfx_scenes)) {
        this.scenes = result.vjamfx_scenes;
      }
    } catch (e) { /* storage not available */ }
    this._updateSceneButtons();
  }

  async _saveScenes() {
    try {
      await chrome.storage.local.set({ vjamfx_scenes: this.scenes });
    } catch (e) { /* storage not available */ }
    this._updateSceneButtons();
  }

  _updateSceneButtons() {
    document.querySelectorAll('.scene-btn').forEach(btn => {
      const slot = parseInt(btn.dataset.slot, 10);
      const saved = this.scenes[slot] != null;
      btn.classList.toggle('saved', saved);
      const slotDiv = btn.closest('.scene-slot');
      if (slotDiv) slotDiv.classList.toggle('saved', saved);
    });
  }

  _saveScene(slot) {
    this.scenes[slot] = {
      layers: [...this.activeLayers],
      blendMode: this.selectedBlendMode,
      filters: [...this.activeFilters],
      opacity: this.opacity,
      locks: { ...this.locks },
    };
    this._saveScenes();
  }

  async _loadScene(slot) {
    const scene = this.scenes[slot];
    if (!scene || this._busy) return;
    // Validate scene has layers array
    if (!Array.isArray(scene.layers)) return;
    this._busy = true;

    try {
      // Ensure engine is running
      if (!this.isActive) {
        this.isActive = true;
        const toggle = document.getElementById('toggle');
        if (toggle) toggle.checked = true;
        await this._injectCore();
      }

      // Kill current state
      await this._sendCommand({ action: 'kill' });

      // Restore layers
      this.activeLayers.clear();
      for (const id of scene.layers) {
        this.activeLayers.add(id);
        await this._injectPreset(id);
      }
      const layers = [...this.activeLayers];
      if (layers.length > 0) {
        await this._sendCommand({ action: 'start', preset: layers[0], blendMode: scene.blendMode || 'screen' });
        for (let i = 1; i < layers.length; i++) {
          await this._sendAddLayer(layers[i]);
        }
      } else {
        // Empty scene — deactivate
        this.isActive = false;
        const toggle = document.getElementById('toggle');
        if (toggle) toggle.checked = false;
      }

      // Restore blend, filters, opacity
      this.selectedBlendMode = scene.blendMode || 'screen';
      this.activeFilters.clear();
      if (scene.filters) {
        for (const f of scene.filters) {
          this.activeFilters.add(f);
          await this._sendCommand({ action: 'setFilter', filter: f, enabled: true });
        }
      }
      this.opacity = scene.opacity != null ? scene.opacity : 1.0;
      await this._sendCommand({ action: 'setOpacity', opacity: this.opacity });

      // Restore locks
      if (scene.locks) this.locks = { ...this.locks, ...scene.locks };

      // Re-apply current Auto/Rnd state (don't restore from scene — keep current popup state)
      if (this.autoCycleActive) {
        await this._injectAllPresets();
        await this._sendCommand(this._autoCycleCommand({ skipFirstTick: true }));
      } else if (this.autoBlend || this.autoFilters) {
        await this._sendCommand(this._autoFXCommand());
      }

      // Start audio if enabled
      if (this.audioEnabled) {
        await this._sendCommand({ action: 'startVideoAudio' });
        await chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId }).catch(e => console.debug('VJam FX: startTabAudio', e));
      }

      this._updateUI();
      await this._saveState();
    } finally {
      this._busy = false;
    }
  }

  _clearScene(slot) {
    this.scenes[slot] = null;
    this._saveScenes();
  }

  _updateSettingsUI() {
    const autoStartEl = document.getElementById('setting-auto-start');
    if (autoStartEl) autoStartEl.value = this.settings.autoOnStart ? 'on' : 'off';
    const allTabsBtn = document.getElementById('setting-all-tabs');
    if (allTabsBtn) {
      allTabsBtn.textContent = this.settings.allTabs ? 'ON' : 'OFF';
      allTabsBtn.classList.toggle('on', !!this.settings.allTabs);
    }
    const allTabsChip = document.getElementById('chip-all-tabs');
    if (allTabsChip) allTabsChip.classList.toggle('active', !!this.settings.allTabs);
    const fadeEl = document.getElementById('setting-fade');
    if (fadeEl) fadeEl.value = String(this.settings.fadeDuration);
    const cycleEl = document.getElementById('setting-cycle');
    if (cycleEl) cycleEl.value = String(this.settings.cycleSeconds);
    const sensEl = document.getElementById('setting-sensitivity');
    if (sensEl) sensEl.value = this.settings.sensitivity;
    this._renderStage(); // OFF のひとことは Auto start の設定で変わる
  }

  async _saveState() {
    if (!this._tabId) return;
    try {
      await chrome.runtime.sendMessage({
        type: this.isActive ? 'setState' : 'clearState',
        tabId: this._tabId,
        state: {
          active: this.isActive,
          layers: [...this.activeLayers],
          blendMode: this.selectedBlendMode,
          opacity: this.opacity,
          audioEnabled: this.audioEnabled,
          filters: [...this.activeFilters],
          autoCyclePresets: this.autoCycleActive ? this._usablePool().map(p => p.id) : null,
          autoBlend: this.autoBlend,
          autoFilters: this.autoFilters,
          pool: this.pool, // SW がページ遷移後に Auto / Rnd を再開するときにエンジンへ渡す
          cycleSeconds: this.settings.cycleSeconds, // 同上(遷移後も設定した秒数で切り替える)
          fadeDuration: this._fadeSeconds(), // SW が遷移後にエンジンへ送る(フェード時間。Cycle の半分まで)
          audioSensitivity: SENSITIVITY_MAP[this.settings.sensitivity] || 1.0, // 同上(音の感度。エンジンに渡す倍率で)
          locks: this.locks,
          textState: this.textState,
        },
      });
    } catch (e) { /* SW not available */ }
  }

  _bindEvents() {
    // Preset search
    const searchInput = document.getElementById('preset-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const items = document.querySelectorAll('#preset-list .preset-item');
        const headers = document.querySelectorAll('#preset-list .category-header');

        if (!query) {
          items.forEach(el => { el.style.display = ''; });
          headers.forEach(el => { el.style.display = ''; });
          return;
        }

        items.forEach(el => {
          const name = el.textContent.toLowerCase();
          el.style.display = name.includes(query) ? '' : 'none';
        });

        headers.forEach(header => {
          let next = header.nextElementSibling;
          let hasVisible = false;
          while (next && !next.classList.contains('category-header')) {
            if (next.style.display !== 'none') hasVisible = true;
            next = next.nextElementSibling;
          }
          header.style.display = hasVisible ? '' : 'none';
        });
      });
    }

    // Settings gear button
    const settingsBtn = document.getElementById('btn-settings');
    const settingsSection = document.getElementById('settings-section');
    if (settingsBtn && settingsSection) {
      settingsBtn.addEventListener('click', () => {
        const isOpen = settingsSection.style.display !== 'none';
        settingsSection.style.display = isOpen ? 'none' : '';
        settingsBtn.classList.toggle('active', !isOpen);
      });
    }

    // Settings: トグル ON で Auto を始める(次の ON から効く)
    const autoStartEl = document.getElementById('setting-auto-start');
    if (autoStartEl) {
      autoStartEl.addEventListener('change', () => {
        this.settings.autoOnStart = autoStartEl.value !== 'off';
        this._saveSettings();
        this._renderStage();
      });
    }

    // 全タブで ON(設定のボタンと、いつもの画面のチップ)。ほかのタブに入るにはホスト権限が要るので、ON にするクリックの中で 1 回だけ求める(断られたら OFF のまま)
    document.querySelectorAll('#setting-all-tabs, #chip-all-tabs').forEach(allTabsBtn => {
      allTabsBtn.addEventListener('click', async () => {
        if (!this.settings.allTabs) {
          let granted = false;
          try {
            granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
          } catch (e) { /* 許可を求められない(ユーザー操作の外・API が無い) */ }
          if (!granted) {
            this._updateSettingsUI();
            return;
          }
        }
        this.settings.allTabs = !this.settings.allTabs;
        this._updateSettingsUI();
        await this._saveSettings();
        // 今のタブが ON なら、その状態をほかのタブへ持っていくものとして SW に渡す
        if (this.settings.allTabs && this.isActive) this._saveState();
      });
    });

    // 手動を開く・畳む
    const manualBtn = document.getElementById('btn-manual');
    if (manualBtn) manualBtn.addEventListener('click', () => this._toggleManual());

    // Settings: この端末で重いので外したもの → 戻す
    const heavyResetBtn = document.getElementById('btn-heavy-reset');
    if (heavyResetBtn) {
      heavyResetBtn.addEventListener('click', () => this._resetHeavyPresets());
    }

    // Settings: Fade duration
    const fadeEl = document.getElementById('setting-fade');
    if (fadeEl) {
      fadeEl.addEventListener('change', () => {
        const val = parseFloat(fadeEl.value);
        this.settings.fadeDuration = isNaN(val) ? DEFAULT_SETTINGS.fadeDuration : Math.max(0, val);
        this._saveSettings();
        if (this.isActive) {
          this._sendCommand({ action: 'setFadeDuration', duration: this._fadeSeconds() });
          this._saveState(); // SW の状態にも入れる(ページ遷移後もこのフェード時間で)
        }
      });
    }

    // Settings: Cycle(秒)
    const cycleEl = document.getElementById('setting-cycle');
    if (cycleEl) {
      cycleEl.addEventListener('change', async () => {
        const val = parseInt(cycleEl.value, 10);
        this.settings.cycleSeconds = isNaN(val) || val < 1 ? DEFAULT_SETTINGS.cycleSeconds : val;
        this._saveSettings();
        // フェードは Cycle の半分までなので送り直す。Auto / Rnd は新しい秒数で回し直す
        if (this.isActive) await this._sendCommand({ action: 'setFadeDuration', duration: this._fadeSeconds() });
        if (this.autoCycleActive) {
          await this._sendCommand(this._autoCycleCommand());
        } else if (this.autoBlend || this.autoFilters) {
          await this._sendCommand(this._autoFXCommand());
        }
        // SW の状態にも入れる(ページ遷移後もこの秒数で回す)
        if (this.isActive) this._saveState();
      });
    }

    // Settings: Sensitivity
    const sensEl = document.getElementById('setting-sensitivity');
    if (sensEl) {
      sensEl.addEventListener('change', () => {
        this.settings.sensitivity = sensEl.value;
        this._saveSettings();
        if (this.isActive) {
          this._sendCommand({ action: 'setAudioSensitivity', sensitivity: SENSITIVITY_MAP[this.settings.sensitivity] || 1.0 });
          this._saveState(); // SW の状態にも入れる(ページ遷移後もこの感度で)
        }
      });
    }

    // Lock buttons
    for (const key of ['effect', 'blend', 'filter']) {
      const lockBtn = document.getElementById('lock-' + key);
      if (lockBtn) {
        lockBtn.addEventListener('click', () => {
          this.locks[key] = !this.locks[key];
          lockBtn.classList.toggle('locked', this.locks[key]);
          lockBtn.textContent = this.locks[key] ? 'Locked' : 'Lock';
          this._saveState();
        });
      }
    }

    // Scenes toggle
    const scenesToggleBtn = document.getElementById('btn-scenes-toggle');
    const scenesSection = document.getElementById('scenes-section');
    if (scenesToggleBtn && scenesSection) {
      scenesToggleBtn.addEventListener('click', () => {
        const isOpen = scenesSection.style.display !== 'none';
        scenesSection.style.display = isOpen ? 'none' : '';
        scenesToggleBtn.setAttribute('aria-expanded', String(!isOpen));
      });
    }

    // Scene Save button
    const sceneSaveBtn = document.getElementById('btn-scene-save');
    const sceneGrid = document.getElementById('scene-grid');
    if (sceneSaveBtn) {
      sceneSaveBtn.addEventListener('click', () => {
        this.sceneSaveMode = !this.sceneSaveMode;
        sceneSaveBtn.classList.toggle('active', this.sceneSaveMode);
        if (sceneGrid) sceneGrid.classList.toggle('save-mode', this.sceneSaveMode);
      });
    }

    // Scene buttons: save mode click = save, normal click = load, right-click = clear
    const sceneBtns = document.querySelectorAll('.scene-btn');
    for (const btn of sceneBtns) {
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const slot = parseInt(btn.dataset.slot, 10);
        if (this.scenes[slot] != null) {
          this._clearScene(slot);
  
        }
      });
      btn.addEventListener('click', () => {
        const slot = parseInt(btn.dataset.slot, 10);
        if (this.sceneSaveMode) {
          // Save mode: save to this slot
          this._saveScene(slot);
          this.sceneSaveMode = false;
          if (sceneSaveBtn) sceneSaveBtn.classList.remove('active');
          if (sceneGrid) sceneGrid.classList.remove('save-mode');

        } else if (this.scenes[slot] != null) {
          // Normal mode: load saved scene
          this._loadScene(slot);

        }
      });
    }

    // Scene delete buttons
    const sceneDelBtns = document.querySelectorAll('.scene-del');
    for (const btn of sceneDelBtns) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slot = parseInt(btn.dataset.slot, 10);
        this._clearScene(slot);
      });
    }

    // Text toggle
    const btnTextToggle = document.getElementById('btn-text-toggle');
    const textInput = document.getElementById('text-input');
    const textToggleOn = async () => {
      const text = textInput ? textInput.value.trim() : '';
      if (!text) return;
      if (!this.isActive) {
        this.isActive = true;
        const toggle = document.getElementById('toggle');
        if (toggle) toggle.checked = true;
        this._renderStage();
        await this._injectCore();
      }
      await this._sendCommand({ action: 'textAutoStart', text: text });
      if (btnTextToggle) { btnTextToggle.classList.add('active'); btnTextToggle.textContent = 'OFF'; }
      this.textState = { text, autoText: true };
      this._saveState();
    };
    const textToggleOff = async () => {
      await this._sendCommand({ action: 'textClear' });
      await this._sendCommand({ action: 'textAutoStop' });
      if (btnTextToggle) { btnTextToggle.classList.remove('active'); btnTextToggle.textContent = 'GO'; }
      this.textState = null;
      this._saveState();
    };
    if (btnTextToggle) {
      btnTextToggle.addEventListener('click', () => {
        if (this.textState && this.textState.autoText) {
          textToggleOff();
        } else {
          textToggleOn();
        }
      });
    }
    if (textInput) {
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') textToggleOn();
      });
    }

    // Master toggle
    const toggle = document.getElementById('toggle');
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          if (this.settings.autoOnStart) {
            this._prepareAutoStart();
            this._startAll({ skipFirstAutoTick: true });
          } else {
            this._startAll();
          }
        } else {
          this._stopAll();
        }
      });
    }

    // Preset checkboxes
    const list = document.getElementById('preset-list');
    if (list) {
      list.addEventListener('change', (e) => {
        if (e.target.type !== 'checkbox') return;
        const presetId = e.target.value;
        if (e.target.checked) {
          this.activeLayers.add(presetId);
          if (!this.isActive) {
            const toggle = document.getElementById('toggle');
            if (toggle) toggle.checked = true;
            this._startAll();
          } else {
            this._addLayer(presetId);
          }
        } else {
          this.activeLayers.delete(presetId);
          if (this.isActive) this._removeLayer(presetId);
        }
        if (this.autoCycleActive) {
          this.autoCycleActive = false;
          this._sendCommand({ action: 'stopAutoCycle' });
        }
        this._updateAutoUI();
        this._saveState();
      });
    }

    // Blend mode buttons (toggle on/off, default is screen)
    const blendBtns = document.querySelectorAll('.blend-btn');
    for (const btn of blendBtns) {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.blend;
        if (this.selectedBlendMode === mode) {
          // Toggle off → back to default
          this.selectedBlendMode = 'screen';
          btn.classList.remove('active');
        } else {
          this.selectedBlendMode = mode;
          blendBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
        if (this.isActive) {
          this._sendCommand({ action: 'setBlendMode', blendMode: this.selectedBlendMode });
        }
        this._saveState();
      });
    }

    // Opacity slider (throttled to avoid flooding executeScript)
    const opacitySlider = document.getElementById('opacity-slider');
    if (opacitySlider) {
      let opacityThrottleTimer = null;
      opacitySlider.addEventListener('input', (e) => {
        this.opacity = parseInt(e.target.value, 10) / 100;
        this._updateOpacityUI();
        if (opacityThrottleTimer) return;
        opacityThrottleTimer = setTimeout(() => {
          opacityThrottleTimer = null;
          if (this.isActive) {
            this._sendCommand({ action: 'setOpacity', opacity: this.opacity });
          }
          this._saveState();
        }, 50);
      });
    }

    // Audio toggle (tab audio capture ON/OFF)
    const audioBtn = document.getElementById('audio-toggle');
    if (audioBtn) {
      audioBtn.addEventListener('click', async () => {
        this.audioEnabled = !this.audioEnabled;
        audioBtn.textContent = this.audioEnabled ? 'ON' : 'OFF';
        audioBtn.classList.toggle('on', this.audioEnabled);

        if (this.audioEnabled) {
          await this._sendCommand({ action: 'startVideoAudio' });
          await chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId }).catch(e => console.debug('VJam FX: startTabAudio', e));
          if (this.isActive) {
            await this._sendCommand({ action: 'setAudioEnabled', enabled: true });
          }
        } else {
          await this._sendCommand({ action: 'stopVideoAudio' });
          chrome.runtime.sendMessage({ type: 'stopTabAudio', tabId: this._tabId }).catch(e => console.debug('VJam FX: stopTabAudio', e));
          if (this.isActive) {
            await this._sendCommand({ action: 'setAudioEnabled', enabled: false });
          }
        }
        this._saveState();
      });
    }

    // Reset
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', async () => {
        if (this._busy) return;
        await this._sendCommand({ action: 'stopVideoAudio' });
        chrome.runtime.sendMessage({ type: 'stopTabAudio', tabId: this._tabId }).catch(e => console.debug('VJam FX: stopTabAudio', e));
        // Full reset (no lock respect — reset everything except scenes)
        await this._sendCommand({ action: 'kill' });

        // Stop text
        await this._sendCommand({ action: 'textAutoStop' });
        await this._sendCommand({ action: 'textClear' });
        this.textState = null;

        // Reset all state
        this.activeLayers.clear();
        this.activeFilters.clear();
        this.autoCycleActive = false;
        this.autoBlend = false;
        this.autoFilters = false;
        this.selectedBlendMode = 'screen';
        this.opacity = 0.8;
        this.audioEnabled = true;
        this.isActive = false;
        this._coreInjected = false;
        this._injectedPresets.clear();
        this.locks = { effect: false, blend: false, filter: false };

        // Reset settings to defaults
        this.settings = { ...DEFAULT_SETTINGS };
        await this._saveSettings();
        await this._sendCommand({ action: 'setFadeDuration', duration: this._fadeSeconds() });
        await this._sendCommand({ action: 'setAudioSensitivity', sensitivity: 1.0 });

        // Reset all UI
        const toggle = document.getElementById('toggle');
        if (toggle) toggle.checked = false;
        document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.blend-btn').forEach(btn => btn.classList.remove('active'));
        this._updateOpacityUI();
        const audioBtn = document.getElementById('audio-toggle');
        if (audioBtn) { audioBtn.textContent = 'ON'; audioBtn.classList.add('on'); }
        this._updateAutoUI();
        // Reset lock UI
        for (const key of ['effect', 'blend', 'filter']) {
          const lockBtn = document.getElementById('lock-' + key);
          if (lockBtn) { lockBtn.classList.remove('locked'); lockBtn.textContent = 'Lock'; }
        }
        // Reset text UI
        const textInput = document.getElementById('text-input');
        if (textInput) textInput.value = '';
        const btnTextToggle = document.getElementById('btn-text-toggle');
        if (btnTextToggle) { btnTextToggle.classList.remove('active'); btnTextToggle.textContent = 'GO'; }
        // Reset settings UI
        this._updateSettingsUI();
        this._saveState();

      });
    }

    // Next
    const btnNext = document.getElementById('btn-next');
    if (btnNext) {
      btnNext.addEventListener('click', async () => {
        if (this._busy) return;
        this._busy = true;
        try {
        if (!this.isActive) {
          this.isActive = true;
          const toggle = document.getElementById('toggle');
          if (toggle) toggle.checked = true;
          this._renderStage();
          await this._injectCore();
        }
        // 今のレイヤーをフェードアウトして、選んだ 1〜3 本をフェードイン(ロックしたものはエンジンが残す)
        const chosen = this.locks.effect ? [] : this._randomPoolPresets();
        // Only inject chosen presets (not all 204)
        for (const p of chosen) {
          await this._injectPreset(p.id);
        }
        // poolPresets: 選んだものが重かったときの入れ替え先(エンジンが選ぶ。webgl で WebGL を 2 枚にしない)
        await this._sendCommand({ action: 'crossfade', presets: chosen.map(p => p.id), blendMode: this.selectedBlendMode, locks: this.locks, poolPresets: this._usablePool().map(p => p.id), webgl: WEBGL_PRESETS });
        if (!this.locks.effect) {
          this.activeLayers.clear();
          for (const p of chosen) this.activeLayers.add(p.id);
        }
        if (!this.locks.filter) {
          for (const f of this.activeFilters) {
            await this._sendCommand({ action: 'setFilter', filter: f, enabled: true });
          }
        }
        document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => {
          cb.checked = this.activeLayers.has(cb.value);
        });
        // crossfade でエンジンの Auto / Rnd は止まるので送り直す。Auto が ON なら、出したセットから 1 手ずつ続ける(#59)
        if (this.autoCycleActive) {
          await this._injectAllPresets();
          await this._sendCommand(this._autoCycleCommand({ skipFirstTick: true }));
        } else if (this.autoBlend || this.autoFilters) {
          await this._sendCommand(this._autoFXCommand());
        }
        // Start video audio if needed
        if (this.audioEnabled) {
          await this._sendCommand({ action: 'startVideoAudio' });
          await chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId }).catch(e => console.debug('VJam FX: startTabAudio', e));
        }
        this._saveState();

        } finally { this._busy = false; }
      });
    }

    // Auto-cycle
    const btnAutoCycle = document.getElementById('btn-auto-cycle');
    if (btnAutoCycle) {
      btnAutoCycle.addEventListener('click', async () => {
        if (this._busy) return;
        this.autoCycleActive = !this.autoCycleActive;
        if (this.autoCycleActive) {
          // Auto ON → also enable Auto Blend + Auto Filter
          this.autoBlend = true;
          this.autoFilters = true;
        }
        this._updateAutoUI();
        if (this.autoCycleActive) {
          // Rnd ON → ブレンド/フィルターボタンのactive解除（ランダムに委ねる）
          document.querySelectorAll('.blend-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          // Stop standalone autoFX (auto-cycle handles blend/filter)
          await this._sendCommand({ action: 'stopAutoFX' });
          if (!this.isActive) {
            const toggle = document.getElementById('toggle');
            if (toggle) toggle.checked = true;
            await this._startAll();
          }
          await this._injectAllPresets();
          await this._sendCommand(this._autoCycleCommand());
          // Clear preset checkboxes — auto-cycle manages presets automatically
          document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        } else {
          await this._sendCommand({ action: 'stopAutoCycle' });
          // Blend Random / Filter Random が残っていれば独立動作を継続
          if (this.autoBlend || this.autoFilters) {
            await this._sendCommand(this._autoFXCommand());
          }
        }
        this._saveState();
      });
    }

    // Filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    for (const btn of filterBtns) {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        if (this.activeFilters.has(filter)) {
          this.activeFilters.delete(filter);
        } else {
          this.activeFilters.add(filter);
        }
        btn.classList.toggle('active', this.activeFilters.has(filter));
        if (this.isActive) {
          this._sendCommand({ action: 'toggleFilter', filter: filter });
        }
        this._saveState();
      });
    }

    // Blend Rnd / Filter Rnd(いつもの画面のチップと、手動の Blend / Filters の Rnd は同じもの)
    const bindRnd = (selector, flag, manualButtons) => {
      document.querySelectorAll(selector).forEach(btn => {
        btn.addEventListener('click', async () => {
          this[flag] = !this[flag];
          // Rnd ON → 手で選んだボタンの active 解除(ランダムに委ねる)
          if (this[flag]) {
            document.querySelectorAll(manualButtons).forEach(b => b.classList.remove('active'));
          }
          this._updateAutoUI();
          if (this.autoCycleActive) {
            await this._sendCommand({ action: 'updateAutoCycleOptions', autoBlend: this.autoBlend, autoFilters: this.autoFilters, locks: this.locks });
          } else if (this.autoBlend || this.autoFilters) {
            await this._sendCommand(this._autoFXCommand());
          } else {
            await this._sendCommand({ action: 'stopAutoFX' });
          }
          this._saveState();
        });
      });
    };
    bindRnd('#auto-blend, [data-rnd="blend"]', 'autoBlend', '.blend-btn');
    bindRnd('#auto-filters, [data-rnd="filters"]', 'autoFilters', '.filter-btn');
  }

  /**
   * Inject core scripts (p5, base-preset, engine)
   */
  async _injectCore() {
    if (this._coreInjected) return;

    // Inject p5.js first
    await chrome.scripting.executeScript({
      target: { tabId: this._tabId },
      world: 'MAIN',
      files: ['lib/p5.min.js'],
    });

    // Verify p5 loaded (retry once if not)
    let [{ result: p5Ready }] = await chrome.scripting.executeScript({
      target: { tabId: this._tabId },
      world: 'MAIN',
      func: () => typeof window.p5 === 'function',
    });

    if (!p5Ready) {
      await new Promise(r => setTimeout(r, 200));
      await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        files: ['lib/p5.min.js'],
      });
    }

    // Inject base-preset and engine
    for (const file of ['content/base-preset.js', 'content/text-overlay.js', 'content/content.js']) {
      await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        files: [file],
      });
    }
    this._coreInjected = true;
  }

  async _injectPreset(presetId) {
    if (this._injectedPresets.has(presetId)) return;
    await chrome.scripting.executeScript({
      target: { tabId: this._tabId },
      world: 'MAIN',
      files: [`content/presets/${presetId}.js`],
    });
    this._injectedPresets.add(presetId);
  }

  // Auto 用: プールのプリセットを全部 inject(重いものは除く)
  async _injectAllPresets() {
    const toInject = this._usablePool().filter(p => !this._injectedPresets.has(p.id));
    if (toInject.length === 0) return;
    const BATCH = 20;
    for (let i = 0; i < toInject.length; i += BATCH) {
      await Promise.all(toInject.slice(i, i + BATCH).map(p =>
        this._injectPreset(p.id).catch(e => console.warn('VJam FX: inject failed:', p.id, e))
      ));
    }
  }

  // トグル ON で Auto を始める(設定 ON のとき)。Auto・Blend Rnd・Filter Rnd を ON にし、見た目は Auto ボタンを押したときと同じ。
  // レイヤーが無ければプールから 1 本(Auto は 1 枚から積み上げる。#59)。トグル ON のときだけ呼ぶので、動いている間に手で切ったものは戻さない
  _prepareAutoStart() {
    if (this.activeLayers.size === 0) {
      for (const p of this._randomPoolPresets(1)) this.activeLayers.add(p.id);
      this._autoPicked = true; // エンジンには Auto が選んだものとして渡す(重いときに入れ替えてよい)
    }
    this.autoCycleActive = true;
    this.autoBlend = true;
    this.autoFilters = true;
    document.querySelectorAll('.blend-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    this._updateAutoUI();
  }

  // skipFirstAutoTick: 始めたレイヤーを最初の場面として見せ、Auto の切り替えは次のサイクルから
  async _startAll({ skipFirstAutoTick = false } = {}) {
    if (!this._tabId) return;
    if (this._busy) { this._pendingStart = true; this._pendingStop = false; return; }
    this._busy = true;
    const autoPicked = !!this._autoPicked;
    this._autoPicked = false;

    if (this.activeLayers.size === 0) {
      this.activeLayers.add('neon-tunnel');
      const cb = document.querySelector('input[value="neon-tunnel"]');
      if (cb) cb.checked = true;
    }

    try {
      this.isActive = true;
      this._renderStage();

      await this._injectCore();

      const layers = [...this.activeLayers];
      for (const presetId of layers) {
        await this._injectPreset(presetId);
      }

      const first = layers[0];
      await this._sendCommand({
        action: 'start',
        preset: first,
        blendMode: this.selectedBlendMode,
        auto: autoPicked,
      });

      for (let i = 1; i < layers.length; i++) {
        await this._sendAddLayer(layers[i], autoPicked);
      }

      for (const f of this.activeFilters) {
        await this._sendCommand({ action: 'setFilter', filter: f, enabled: true });
      }

      // Start video audio capture + tabCapture fallback
      if (this.audioEnabled) {
        await this._sendCommand({ action: 'startVideoAudio' });
        await chrome.runtime.sendMessage({ type: 'startTabAudio', tabId: this._tabId }).catch(e => console.debug('VJam FX: startTabAudio', e));
      }

      // Apply settings to engine
      await this._sendCommand({ action: 'setFadeDuration', duration: this._fadeSeconds() });
      await this._sendCommand({ action: 'setAudioSensitivity', sensitivity: SENSITIVITY_MAP[this.settings.sensitivity] || 1.0 });
      await this._sendCommand({ action: 'setOpacity', opacity: this.opacity });

      // Re-start Auto/Rnd if active
      if (this.autoCycleActive) {
        await this._injectAllPresets();
        await this._sendCommand(this._autoCycleCommand(skipFirstAutoTick ? { skipFirstTick: true } : undefined));
      } else if (this.autoBlend || this.autoFilters) {
        await this._sendCommand(this._autoFXCommand());
      }

      await this._saveState();
    } catch (e) {
      this.isActive = false;
      this._coreInjected = false;
      const toggle = document.getElementById('toggle');
      if (toggle) toggle.checked = false;
      this._renderStage();
      console.warn('VJam FX: Failed to inject', e);
    } finally {
      this._busy = false;
      if (this._pendingStop) {
        this._pendingStop = false;
        this._pendingStart = false;
        this._stopAll();
      }
    }
  }

  async _stopAll() {
    if (this._busy) { this._pendingStop = true; this._pendingStart = false; return; }
    this._busy = true;
    try {
      await this._sendCommand({ action: 'stopVideoAudio' });
      chrome.runtime.sendMessage({ type: 'stopTabAudio', tabId: this._tabId }).catch(e => console.debug('VJam FX: stopTabAudio', e));
      await this._sendCommand({ action: 'stop' });
      this.isActive = false;
      this._coreInjected = false;
      this._injectedPresets.clear();
      this._live = null;
      this._bpm = 0;
      this._renderStage();
      await this._saveState();
    } finally {
      this._busy = false;
      if (this._pendingStart) {
        this._pendingStart = false;
        this._pendingStop = false;
        this._startAll();
      }
    }
  }

  async _addLayer(presetId) {
    try {
      await this._injectCore();
      await this._injectPreset(presetId);
      await this._sendAddLayer(presetId);
      await this._saveState();
    } catch (e) {
      console.warn('VJam FX: Failed to add layer', e);
    }
  }

  // addLayer を送り、エンジンのレイヤー上限(iPad / iPhone は 3、それ以外は 5)で外れたものを popup のチェックからも外す。
  // auto: Auto が選んだもの(トグル ON で Auto を始めるとき)
  async _sendAddLayer(presetId, auto) {
    if (!this._tabId) return;
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        func: (preset, isAuto) => {
          const e = window._vjamFxEngine;
          if (!e) return [];
          const before = e.getActiveLayerNames();
          e.handleMessage({ action: 'addLayer', preset: preset, auto: isAuto });
          const after = e.getActiveLayerNames();
          return before.filter(n => !after.includes(n));
        },
        args: [presetId, !!auto],
      });
      if (!Array.isArray(result) || result.length === 0) return;
      for (const id of result) this.activeLayers.delete(id);
      document.querySelectorAll('#preset-list input[type="checkbox"]').forEach(cb => {
        cb.checked = this.activeLayers.has(cb.value);
      });
      this._renderStage();
    } catch (e) {
      console.warn('VJam FX: Failed to send command', e);
    }
  }

  async _removeLayer(presetId) {
    await this._sendCommand({ action: 'removeLayer', preset: presetId });
    await this._saveState();
  }

  async _sendCommand(msg) {
    if (!this._tabId) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: this._tabId },
        world: 'MAIN',
        func: (message) => {
          if (window._vjamFxEngine) {
            window._vjamFxEngine.handleMessage(message);
          }
        },
        args: [msg],
      });
    } catch (e) {
      console.warn('VJam FX: Failed to send command', e);
    }
  }
}

export { PopupController };

// CTA rotation — show a different value prop each time popup opens
const _ctaMessages = [
  'Take it to a party → VJam Full (HDMI output)',
  'Beat detection from mic → VJam Full',
  'Works offline on any device → VJam Full',
];

// Auto-init in popup context
if (typeof document !== 'undefined' && document.getElementById) {
  document.addEventListener('DOMContentLoaded', () => {
    const controller = new PopupController();
    controller.init();
    const ctaEl = document.getElementById('cta-text');
    if (ctaEl) ctaEl.textContent = _ctaMessages[Math.floor(Math.random() * _ctaMessages.length)];
  });
}
