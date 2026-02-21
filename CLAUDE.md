# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Physique Interactive** is a bilingual (French/Arabic) Progressive Web App for teaching physics to Moroccan middle school students (Collège: 1AC, 2AC, 3AC). It implements the **SSPOE pedagogical cycle** (Supposition → Simulation → Observation → Explanation) with embedded interactive simulations.

## Architecture

**No build system or package manager.** This is a vanilla JS/HTML/CSS project served as static files. No `npm`, no bundler, no transpiler.

### Core Files

- `index.html` — Single HTML entry point (loads script.js, data.js, style.css)
- `script.js` — App engine: state management, SPA router, view rendering (~1,100 lines)
- `data.js` — All educational content: courses, activities, predictions, quizzes (~660 lines). Exports `APP_DATA` global
- `style.css` — Full styling with dark theme, RTL support, responsive mobile-first design
- `service-worker.js` — Cache-first PWA offline support. Cache version: `CACHE_VERSION = 'sspoe-v9'`
- `manifest.json` — PWA manifest (standalone display, `"orientation": "any"` for device rotation)

### State-Driven Rendering

`script.js` uses a global `state` object and a `render()` function that routes to view renderers:

```
state.currentView → render() →
  'home'    → renderHome()      → Level selection (1AC/2AC/3AC)
  'courses' → renderCourses()   → Course & activity list for a level
  'player'  → renderPlayer()    → SSPOE cycle (4 steps)
```

SSPOE steps: `state.sspoeStep` 0=Prediction, 1=Observation, 2=Explanation, 3=Quiz

### Bilingual System

All user-facing text uses `{ fr: "...", ar: "..." }` objects. The helper `t(obj)` returns text for `state.lang`. Language preference persists in `localStorage` key `'sspoe-lang'`. Switching language toggles `dir="ltr"/"rtl"` on the HTML element.

Simulations handle bilingual text independently using their own `data-fr`/`data-ar` attributes and internal `toggleLanguage()` functions.

### Simulations

Standalone HTML files in `simulations/`. Loaded via iframe (`aspect-ratio: 16/10`) in the observation step. Each simulation is self-contained and can be opened independently.

**Fixed Design Size (mandatory):** All simulations use a **1024x640** fixed design resolution with CSS `transform: scale()` to fit any viewport (PhET-style). This ensures identical layout on all devices (mobile, tablet, desktop).

```html
<!-- Required wrapper structure -->
<div id="sim-wrapper">
    <!-- All simulation content goes here -->
</div>

<style>
html, body { margin: 0; overflow: hidden; background: #000; width: 100%; height: 100%; }
#sim-wrapper {
    width: 1024px;
    height: 640px;
    position: absolute;
    transform-origin: top left;
    overflow: hidden;
}
</style>

<script>
const DESIGN_W = 1024, DESIGN_H = 640;
const wrapper = document.getElementById('sim-wrapper');
let userZoom = 1, panX = 0, panY = 0;

function scaleToFit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const baseScale = Math.min(vw / DESIGN_W, vh / DESIGN_H);
    const totalScale = baseScale * userZoom;
    wrapper.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + totalScale + ')';
    wrapper.style.left = ((vw - DESIGN_W * baseScale) / 2) + 'px';
    wrapper.style.top = ((vh - DESIGN_H * baseScale) / 2) + 'px';
}
scaleToFit();
window.addEventListener('resize', function() { userZoom = 1; panX = 0; panY = 0; scaleToFit(); });

// ---- Pinch-to-zoom (mandatory in all simulations) ----
(function() {
    var pinching = false, lastDist = 0, lastMidX = 0, lastMidY = 0, lastTap = 0;
    document.addEventListener('touchstart', function(e) {
        if (e.touches.length === 2) {
            e.preventDefault(); pinching = true;
            var t1 = e.touches[0], t2 = e.touches[1];
            lastDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            lastMidX = (t1.clientX + t2.clientX) / 2;
            lastMidY = (t1.clientY + t2.clientY) / 2;
        }
    }, { passive: false });
    document.addEventListener('touchmove', function(e) {
        if (!pinching || e.touches.length !== 2) return;
        e.preventDefault();
        var t1 = e.touches[0], t2 = e.touches[1];
        var dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        var midX = (t1.clientX + t2.clientX) / 2, midY = (t1.clientY + t2.clientY) / 2;
        var oldZoom = userZoom;
        userZoom = Math.max(1, Math.min(5, userZoom * (dist / lastDist)));
        var vw = window.innerWidth, vh = window.innerHeight;
        var baseScale = Math.min(vw / DESIGN_W, vh / DESIGN_H);
        var cx = (vw - DESIGN_W * baseScale) / 2, cy = (vh - DESIGN_H * baseScale) / 2;
        var ratio = userZoom / oldZoom;
        panX = panX * ratio + (1 - ratio) * (midX - cx);
        panY = panY * ratio + (1 - ratio) * (midY - cy);
        panX += midX - lastMidX; panY += midY - lastMidY;
        lastDist = dist; lastMidX = midX; lastMidY = midY;
        scaleToFit();
    }, { passive: false });
    document.addEventListener('touchend', function(e) {
        if (e.touches.length < 2) pinching = false;
        if (userZoom <= 1.05) { userZoom = 1; panX = 0; panY = 0; scaleToFit(); }
        if (e.touches.length === 0) {
            var now = Date.now();
            if (now - lastTap < 300 && userZoom > 1) { userZoom = 1; panX = 0; panY = 0; scaleToFit(); }
            lastTap = now;
        }
    });
})();
</script>
```

**Key rules:**
- Design at exactly 1024x640 — use fixed pixel positions, never `%` or `vw/vh`
- Never use responsive breakpoints (`@media`) — scaling handles all sizes
- Canvas elements use fixed dimensions (e.g., `canvas.width = 1024`)
- The iframe in `style.css` uses `aspect-ratio: 16/10` to match this ratio

Libraries are local in `libs/` (not CDN): reference via `../libs/three.min.js` etc.
- **Three.js r134** — 3D (alternator simulation)
- **p5.js 1.11.11** — Canvas 2D drawing
- **Matter.js 0.20.0** — 2D physics engine
- **Tailwind CSS 3.4.17** — Utility classes (runtime)

### Content Data Structure (data.js)

```
APP_DATA.levels[].courses[].activities[] → {
  predictions: [{question, choices, correctAnswer, type, image?}],
  simulation: {file, instructions},
  explanation: {summary, feedback, image?/images?},
  quiz: {questions: [{question, choices, correctAnswer, type}]}
}
```

Prediction types: `'mcq'`, `'truefalse'`, `'open'`. Quiz types: same.

## Development

**To run locally:** Serve the project root with any static HTTP server (e.g., `python -m http.server 8000`, VS Code Live Server, etc.). Service worker requires HTTPS or localhost.

**To add a new simulation:**
1. Create an HTML file in `simulations/`
2. Use `../libs/` for library paths
3. Add the file path to the activity's `simulation.file` in `data.js`
4. Add the path to `PRECACHE_ASSETS` in `service-worker.js`
5. Increment `CACHE_VERSION` in `service-worker.js`

**To add a new course/activity:** Edit `data.js` following the existing structure under `APP_DATA.levels[].courses[]`.

**Images:** Place in `images/`. Use in data.js via `image: { src: "images/file.png", caption: { fr: "...", ar: "..." } }`. Max width 800px recommended. PNG/JPG/SVG supported.

## Key Conventions

- All text must be bilingual `{ fr, ar }` — never hardcode a single language
- Simulations must work offline (local libs only, no CDN)
- Simulations must include a language switcher with RTL support for Arabic
- Fonts: Inter (French), Noto Sans Arabic (Arabic) — loaded from Google Fonts
- Dark theme: primary bg `#0f0f23`, card bg `#1a1a2e`, text `#e8e8f0`, accent `#7c3aed`
- Level colors: 1AC green `#4CAF50`, 2AC blue `#2196F3`, 3AC orange `#FF9800`
- After modifying cached assets, always bump `CACHE_VERSION` in `service-worker.js`

### Viewport & Mobile Touch Rules

- **Viewport meta tag** — Never use `maximum-scale=1.0` or `user-scalable=no`. Use: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
- **PWA orientation** — `manifest.json` uses `"orientation": "any"` to allow device rotation (portrait + landscape)
- **Pinch-to-zoom** — Every simulation must include the pinch-to-zoom touch handler (see scaleToFit code block above). This is required because simulations run inside iframes with `overflow: hidden`, which blocks native browser zoom
- **Double-tap reset** — The pinch-to-zoom handler includes double-tap to reset zoom to 1x
- **Zoom range** — Min 1x (no zoom-out past original), max 5x
