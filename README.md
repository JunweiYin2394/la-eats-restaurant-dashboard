# LA Eats — Food Safety & Accessibility Dashboard

> **DSCI 554 · USC Viterbi · Spring 2026**  
> An interactive visualization dashboard exploring food safety inequity and restaurant accessibility across LA County.

---

## Overview

LA Eats investigates **food safety deserts** — census tracts where residents face both lower restaurant hygiene scores and limited access to quality dining. We combine LA County Department of Public Health inspection records with pre-computed road-network travel times to reveal spatial disparities in food safety and accessibility.

**Five views:**

| View | Description |
|---|---|
| **Food Safety Overview** | Choropleth map of 2,438 census tracts colored by Non-A Rate, avg score, or density. Click any tract to see trend and distribution charts. |
| **Accessibility** | Reachability heatmap showing travel time to nearest quality restaurant by walk / bike / drive, with live OSRM routing on click. |
| **Restaurants** | Filterable, searchable full inspection record table linked to a mini Leaflet map. |
| **About Data** | Data sources, methodology, and team. |

---

## Tech Stack

| Layer | Library | Version | How loaded |
|---|---|---|---|
| Framework | Vue 3 | ^3.4 | npm |
| Build tool | Vite | ^5.2 | npm (dev) |
| Router | Vue Router | ^4.3 | npm |
| State | Pinia | ^2.1 | npm |
| Map engine | Mapbox GL JS | 3.3.0 | CDN (runtime) |
| Charts | D3.js | ^7.9 | npm |
| CSV parsing | PapaParse | ^5.4 | npm |
| Mini map | Leaflet | ^1.9 | npm |
| UI | Bootstrap 5 + Bootstrap Icons | ^5.3 / ^1.11 | npm |
| Deploy | gh-pages | ^6.1 | npm (dev) |

> **Note:** Mapbox GL JS is **not** in `package.json`. It is loaded at runtime from the Mapbox CDN by `MapView.vue` and `OverviewView.vue` — no manual install needed, just stay online.

---

## Requirements

- **Node.js ≥ 18** (developed on v22)
- **npm** (bundled with Node.js)
- **Python 3** — only needed if you want to re-run `build_routes.py` (uses stdlib only, no pip installs required)

---

## Getting Started

### 1. Clone or download

```bash
git clone https://github.com/JunweiYin2394/la-eats-restaurant-dashboard.git
cd la-eats
```

Or unzip the downloaded archive and `cd` into the folder.

### 2. Install dependencies

```bash
npm install
```

### 3. Start dev server

```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Troubleshooting

### ❌ `Cannot find module @rollup/rollup-darwin-arm64`

This is a known npm bug with optional dependencies on Apple Silicon Macs. Fix:

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npm run dev
```

Full error message looks like:
```
Error: Cannot find module @rollup/rollup-darwin-arm64. npm has a bug related to
optional dependencies. Please try `npm i` again after removing both
package-lock.json and node_modules directory.
```

### ❌ `The CJS build of Vite's Node API is deprecated`

This is just a **warning**, not an error — the dev server still starts normally. You can ignore it. It will be resolved in a future Vite update.

### ❌ Map is blank / tiles not loading

Mapbox GL JS loads from CDN at runtime. Make sure you are **connected to the internet** when running the app. The Mapbox token is embedded in the source for demo purposes.

### ❌ `la_county_mask.geojson` not found (404 in console)

Make sure the file exists at `public/data/la_county_mask.geojson`. It is used by the Overview map to mask ocean areas. Download it from the repo and place it there if missing.

---

## Build & Deploy

```bash
# Production build (outputs to dist/)
npm run build

# Preview production build locally
npm run preview

# Deploy to GitHub Pages (pushes dist/ to gh-pages branch)
npm run deploy
```

---

## Project Structure

```
la-eats/
├── src/
│   ├── main.js                    # Entry point — mounts Pinia + Router
│   ├── App.vue                    # Root layout + sidebar nav
│   ├── router/index.js            # Route definitions
│   ├── stores/data.js             # Pinia store — CSV loading, filtering, stats
│   ├── components/
│   │   ├── LeafletMap.vue         # Leaflet mini-map (used in RestaurantsView)
│   │   └── ...
│   └── views/
│       ├── OverviewView.vue       # Census tract choropleth + D3 charts
│       ├── MapView.vue            # Mapbox map (markers / reachability / isochrone)
│       ├── AccessibilityView.vue  # Accessibility view (wraps MapView)
│       ├── RestaurantsView.vue    # Restaurant table + Leaflet map
│       └── AboutView.vue          # Data sources
├── public/
│   └── data/
│       ├── restaurants_with_coords.csv          # LA County inspection records (~26k rows)
│       ├── la_tracts_merged.geojson             # 2,498 census tracts + OSM travel times
│       ├── la_county_mask.geojson               # Ocean/boundary mask for Overview map
│       ├── la_county.geojson                    # City polygons
│       ├── la_cities.geojson                    # City boundaries
│       ├── city_centroids.json                  # City-level aggregated stats
│       └── routes_{walking,cycling,driving}.geojson  # Road network route overlays
├── build_routes.py                # Data preprocessing script (Python 3, stdlib only)
├── vite.config.js
└── package.json
```

---

## Data Sources

| Dataset | Source |
|---|---|
| Restaurant inspection records | LA County Environmental Health (EHIS open data) |
| Restaurant coordinates | Geocoded from inspection addresses |
| Census tract boundaries | US Census Bureau TIGER files |
| Road-network travel times | OpenStreetMap + OSRM (pre-computed) |
| Live routing (on demand) | OSRM public API |

---

## Data Notes

- `la_tracts_merged.geojson` contains pre-computed road-network travel time (`walkMin` / `bikeMin` / `driveMin`) from each tract centroid to the nearest quality restaurant (score ≥ 98, low risk)
- Census tracts with `walkMin ≥ 35` (remote mountain/desert areas) and water-body tracts are excluded from the accessibility view
- Tracts with no matched inspection records display **estimated** scores derived from the 5 nearest quality restaurants (`avg5Score`); hover tooltips are labelled "Estimated from nearby restaurants"
- City names shown per tract are derived from the most frequent `facility_city` value among restaurants matched to that tract

---

## Project Portfolio

**Portfolio maintained by:** Junwei Yin  
**GitHub:** https://github.com/JunweiYin2394

This project was originally developed as a group project for DSCI 554 at the University of Southern California. This repository presents the project as part of my data analytics and visualization portfolio.

---

USC · DSCI 554 · Spring 2026 · LA County Open Health Data
