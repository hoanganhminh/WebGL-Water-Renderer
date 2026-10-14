# Aqua Dynamics — Interactive WebGL Fluid & Caustics Renderer

A modern, high-performance real-time 3D fluid simulation and landing page built in WebGL, recreating and enhancing the iconic 2011 graphics demo by **Evan Wallace** (co-founder of **Figma**, author of **esbuild**).

## 🌐 Live Demo
👉 **[https://hoanganhminh.github.io/WebGL-Water-Renderer/](https://hoanganhminh.github.io/WebGL-Water-Renderer/)**

## ✨ Key Features

- **2D Heightfield Wave Simulation (FBO Ping-Pong)**: Solves the discrete 2D wave equation in fragment shaders on dual 32-bit floating-point textures (`OES_texture_float`).
- **Real-Time Caustics via Mesh Projection**: Refracts surface triangles along light rays and dynamically computes caustic intensity using screen-space derivatives (`dFdx`/`dFdy` via `OES_standard_derivatives`).
- **Raytraced Scene & Analytic Ambient Occlusion**: Raytraced reflections & refractions with Snell's law and Fresnel equations on pool walls and floating sphere.
- **Submerged Buoyancy & Rigid Body Dynamics**: Realistic ball physics with gravity toggle, buoyancy, viscous drag, wall bouncing, and throw inertia.
- **Procedural Water Audio Synthesizer**: Uses Web Audio API to procedurally generate droplet pops ("bloop") and heavy plunge splashes ("splash") without any external audio files.
- **Interactive Rain Simulator**: Continuously seeds randomized droplets across the surface with synchronized audio.
- **Glassmorphic Studio Controls**:
  - **Water Presets**: *Tropical Lagoon*, *Deep Ocean*, *Emerald Oasis*, *Sunset Coral*, *Cyberpunk Neon*.
  - **Sphere Materials**: *Classic Ceramic*, *Chrome Mirror*, *24K Gold*, *Dark Obsidian*, *Ruby Red*.
  - **Lighting Controls**: Dynamic azimuth and elevation sliders, with a quick shortcut to align sunlight with the camera.
  - **Zen Mode**: Press `Z` to hide all UI elements for distraction-free pure water interaction.

## 🚀 Getting Started

No heavy build tools or dependencies required. Simply serve the files with any static file server:

### Using Node.js (Built-in Server)
```bash
node server.js
```
Then open [http://localhost:3456](http://localhost:3456) in your browser.

### Using Python
```bash
python -m http.server 3456
```

### Using npx serve
```bash
npx serve .
```

## 🎮 Controls & Shortcuts

| Action | Control |
| :--- | :--- |
| **Draw on water** | Left-click and drag across the water surface |
| **Move / Throw ball** | Left-click and drag the sphere (quick release throws the ball) |
| **Rotate view** | Right-click or drag outside the pool |
| **Zoom in / out** | Mouse wheel scroll |
| <kbd>Space</kbd> | Pause / Resume simulation |
| <kbd>G</kbd> | Toggle sphere gravity |
| <kbd>R</kbd> | Toggle Rain Mode |
| <kbd>C</kbd> | Calm water surface instantly |
| <kbd>L</kbd> | Align sunlight with camera angle |
| <kbd>Z</kbd> | Toggle Zen Mode (hide/show HUD) |

## 📜 Credits & License

- Based on the landmark [WebGL Water demo](http://madebyevan.com/webgl-water/) (2011) by **Evan Wallace**.
- Tile textures originally from zooboing on Flickr.
- Released under the [MIT License](LICENSE).
