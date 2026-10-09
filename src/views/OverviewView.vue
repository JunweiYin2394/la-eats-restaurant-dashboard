<template>
  <div class="ov-layout">
    <div class="ov-top">
      <div class="ov-map-header">
        <div>
          <div class="ov-question">Where is food safety falling short in LA County?</div>
          <div class="ov-subtitle">
            <span style="color:#c0392b;font-weight:600;">Non-A Rate</span> highlights risk areas ·
            <span style="color:#27ae60;font-weight:600;">Avg Score</span> shows quality ·
            <span style="color:#2980b9;font-weight:600;">Density</span> shows coverage.
            Click any area to explore.
          </div>
        </div>

        <div class="ov-stat-inline">
          <span v-for="s in statCards" :key="s.label" class="ov-stat-chip">
            <b :style="{ color: s.color }">{{ s.value }}</b>
            <span>{{ s.label }}</span>
          </span>
        </div>
      </div>

      <div class="ov-map-bar">
        <div class="ov-map-bar-left">
          <span style="font-size:.72rem;color:var(--text-light);">Color by:</span>
          <button
            v-for="m in ['Non-A Rate','Avg Score','Density']"
            :key="m"
            class="ov-ctrl-btn"
            :class="{ active: colorMode === m }"
            @click="colorMode = m; updateMap()"
          >
            {{ m }}
          </button>
        </div>

        <div class="ov-map-bar-right">
          <select class="ov-select-sm" v-model="filterYear" @change="updateMap()">
            <option value="all">All Years</option>
            <option value="2023">2023</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
          </select>

          <span v-if="selectedArea" class="ov-area-badge">
            📍 {{ selectedArea.label }}
            <button @click="clearSelection()">×</button>
          </span>
        </div>
      </div>

      <div id="ov-map" class="ov-map"></div>

      <div class="ov-map-legend">
        <span style="font-size:.68rem;color:var(--text-light);margin-right:4px;">
          {{ colorMode }}:
        </span>
        <span style="font-size:.68rem;color:var(--text-light);">Low</span>
        <div class="ov-grad-bar" :style="{ background: gradBarStyle }"></div>
        <span style="font-size:.68rem;color:var(--text-light);">High</span>
        <span style="margin-left:14px;font-size:.68rem;color:var(--text-light);">
          {{ mapFeatureCount }} tracts · {{ viewData.length.toLocaleString() }} inspections
        </span>
      </div>

      <div style="padding:0 14px 6px;font-size:.65rem;color:var(--text-light);display:flex;align-items:center;gap:6px;">
        <span style="display:inline-block;width:10px;height:10px;background:#e4e4e2;border:1px solid #c8c8c4;border-radius:2px;"></span>
        Gray areas have no matched inspection data (water bodies, parks, remote areas excluded).
      </div>
    </div>

    <div class="ov-bottom">
      <div class="ov-insight">
        <div class="ov-insight-title">
          {{ selectedArea ? selectedArea.label : 'LA County Overview' }}
          <span v-if="selectedArea?.cityName" style="display:block;font-size:.72rem;font-weight:400;color:var(--text-light);margin-top:1px;">{{ selectedArea.cityName }}</span>
        </div>

        <div class="ov-insight-stats">
          <div v-for="s in areaStats" :key="s.label" class="ov-i-stat">
            <div class="ov-i-val" :style="{ color: s.color }">{{ s.value }}</div>
            <div class="ov-i-label">{{ s.label }}</div>
          </div>
        </div>

        <div class="ov-insight-note">{{ insightText }}</div>

        <div v-if="gradeBars.length" class="ov-grade-bars">
          <div v-for="g in gradeBars" :key="g.grade" class="ov-grade-row">
            <span class="ov-grade-label">Grade {{ g.grade }}</span>
            <div class="ov-grade-track">
              <div class="ov-grade-fill" :style="{ width: g.pct + '%', background: g.color }"></div>
            </div>
            <span class="ov-grade-pct">{{ g.pct }}%</span>
          </div>
        </div>

        <div v-else-if="selectedArea" class="ov-insight-note" style="margin-top:8px;">
          No data available for this area.
        </div>
      </div>

      <div class="ov-charts">
        <div class="ov-tabs">
          <button
            v-for="t in tabs"
            :key="t.id"
            class="ov-tab"
            :class="{ active: activeTab === t.id }"
            @click="activeTab = t.id"
          >
            {{ t.label }}
          </button>
        </div>

        <div class="ov-tab-content">
          <div v-show="activeTab === 'trend'">
            <div class="ov-panel-desc">
              Monthly avg score —
              <strong>{{ selectedArea ? selectedArea.label : 'all of LA County' }}</strong>.
              Dashed line = county average.
            </div>
            <svg ref="trendRef" style="width:100%;display:block;"></svg>
          </div>

          <div v-show="activeTab === 'dist'">
            <div class="ov-panel-desc">
              Score distribution by grade in selected area.
              Box = IQR, line = median, dot = mean.
            </div>
            <svg ref="boxRef" style="width:100%;display:block;"></svg>
          </div>

          <div v-show="activeTab === 'rank'">
            <div class="ov-panel-desc">
              Areas with the highest Non-A Rate in LA County.
              Click a bar to highlight that area on the map.
            </div>
            <svg ref="rankRef" style="width:100%;display:block;"></svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as d3 from 'd3'
import { useDataStore } from '@/stores/data'

const store = useDataStore()

const filterYear = ref('all')
const colorMode = ref('Non-A Rate')
const selectedArea = ref(null)
const activeTab = ref('trend')

const trendRef = ref(null)
const boxRef = ref(null)
const rankRef = ref(null)

const MAPBOX_TOKEN = 'pk.eyJ1IjoicWluZ3lpZmVuZzEyMyIsImEiOiJjbW1zbWNoOGIxb2NhMnRwbDhxY2QxeTNsIn0.PkK_NJX2ijf540PtNeSExw'
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/la_tracts_merged.geojson`

let map = null
let popup = null
let mapEventsBound = false

const baseGeo = ref(null)
const mapFeatureCount = ref(0)
const mapFeatureData = ref([])

const tabs = [
  { id: 'trend', label: 'Score Trend' },
  { id: 'dist', label: 'Distribution' },
  { id: 'rank', label: 'Worst Areas' },
]

function normalizeName(v) {
  return String(v || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .trim()
}

// ── Area-key resolution ────────────────────────────
// Restaurants only have a coarse "FACILITY CITY" (mostly just "LOS ANGELES"),
// but the geojson splits LA into ~200 neighborhoods (Hollywood, Downtown, ...).
// To avoid the whole City of LA rendering as a blank hole, we do
// point-in-polygon matching using lat/lon, and fall back to name match
// for records with no coordinates or records outside the geojson.
let areaKeyByRow = new WeakMap()
let featureBBoxes = []

function fallbackAreaKey(r) {
  return normalizeName(
    r._city ||
    r.city ||
    r.CITY ||
    r['FACILITY CITY'] ||
    r.facility_city ||
    ''
  )
}

function getRecordAreaKey(r) {
  const cached = areaKeyByRow.get(r)
  if (cached) return cached
  return fallbackAreaKey(r)
}

function computeFeatureBBox(feature) {
  let minLon = Infinity, maxLon = -Infinity
  let minLat = Infinity, maxLat = -Infinity
  const walk = (arr) => {
    if (!Array.isArray(arr)) return
    if (typeof arr[0] === 'number' && typeof arr[1] === 'number') {
      if (arr[0] < minLon) minLon = arr[0]
      if (arr[0] > maxLon) maxLon = arr[0]
      if (arr[1] < minLat) minLat = arr[1]
      if (arr[1] > maxLat) maxLat = arr[1]
      return
    }
    arr.forEach(walk)
  }
  walk(feature.geometry.coordinates)
  return { minLon, maxLon, minLat, maxLat }
}

function precomputeAreaKeys() {
  if (!baseGeo.value || !store.allData.length) return
  const t0 = performance.now()
  const features = baseGeo.value.features
  featureBBoxes = features.map(f => ({
    ...computeFeatureBBox(f),
    keyNorm: f.properties.GEOID,
  }))

  areaKeyByRow = new WeakMap()
  let matched = 0, fallback = 0

  for (const r of store.allData) {
    const lon = r._lon, lat = r._lat
    let found = null
    if (lon != null && lat != null && !Number.isNaN(lon) && !Number.isNaN(lat)) {
      for (let i = 0; i < features.length; i++) {
        const bb = featureBBoxes[i]
        if (lon < bb.minLon || lon > bb.maxLon || lat < bb.minLat || lat > bb.maxLat) continue
        if (d3.geoContains(features[i], [lon, lat])) {
          found = bb.keyNorm
          break
        }
      }
    }
    if (found) {
      areaKeyByRow.set(r, found)
      matched++
    } else {
      areaKeyByRow.set(r, fallbackAreaKey(r))
      fallback++
    }
  }
  console.log(
    `[OverviewView] tract matching: ${matched} via point-in-polygon, ` +
    `${fallback} unmatched (${(performance.now() - t0).toFixed(0)}ms)`
  )
}

function getFeatureCenter(feature) {
  const coords = []

  const walk = (arr) => {
    if (!Array.isArray(arr)) return
    if (typeof arr[0] === 'number' && typeof arr[1] === 'number') {
      coords.push(arr)
      return
    }
    arr.forEach(walk)
  }

  walk(feature.geometry.coordinates)

  if (!coords.length) return [-118.24, 34.05]

  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  coords.forEach(([lon, lat]) => {
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  })

  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2]
}

function buildActualCityMap() {
  const cityMap = {}
  const cityCounts = {}  // track city name frequency per tract
  viewData.value.forEach(r => {
    const key = getRecordAreaKey(r)
    if (!key) return
    if (!cityMap[key]) cityMap[key] = { city: null, total: 0, scoreSum: 0, nonA: 0 }
    cityMap[key].total++
    cityMap[key].scoreSum += r._score
    if (r.GRADE !== 'A') cityMap[key].nonA++
    // Track city name frequency to pick the most common one
    const cityName = r._city || r.city || r.facility_city
    if (cityName) {
      if (!cityCounts[key]) cityCounts[key] = {}
      cityCounts[key][cityName] = (cityCounts[key][cityName] || 0) + 1
    }
  })
  // Assign the most-frequent city name to each tract
  for (const key in cityCounts) {
    if (cityMap[key]) {
      const counts = cityCounts[key]
      cityMap[key].city = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    }
  }
  return cityMap
}

function syntheticNonARate(avgScore) {
  return +Math.max(1, (100 - avgScore) * 1.8).toFixed(1)
}

function buildGeoFeatures() {
  if (!baseGeo.value) return []

  const actualMap = buildActualCityMap()

  return baseGeo.value.features
    .filter(f => {
      const wm = f.properties.walkMin
      return wm != null && wm > 0 && wm < 35
    })
    .map(f => {
      const keyNorm = f.properties.GEOID
      const actual = actualMap[keyNorm]
      const center = f.properties.lon != null
        ? [f.properties.lon, f.properties.lat]
        : getFeatureCenter(f)

      let avgScore, nonARate, total, hasData, synthetic

      if (actual) {
        avgScore  = +(actual.scoreSum / actual.total).toFixed(1)
        nonARate  = +(actual.nonA / actual.total * 100).toFixed(1)
        total     = actual.total
        hasData   = true
        synthetic = false
      } else {
        const a5 = f.properties.avg5Score
        if (a5 != null && a5 > 0) {
          avgScore  = +a5.toFixed(1)
          nonARate  = syntheticNonARate(a5)
          total     = 0
          hasData   = true
          synthetic = true
        } else {
          avgScore = null; nonARate = null; total = 0; hasData = false; synthetic = false
        }
      }

      // Capitalize city name: "LOS ANGELES" → "Los Angeles"
      const rawCity = actual?.city || null
      const cityName = rawCity
        ? rawCity.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
        : null

      return {
        ...f,
        properties: {
          ...f.properties,
          keyNorm,
          centerLon: center[0],
          centerLat: center[1],
          hasData,
          synthetic,
          total,
          avgScore,
          nonARate,
          cityName,
        }
      }
    })
}

// ── Data ──────────────────────────────────────────
const viewData = computed(() => {
  return store.allData.filter(r => {
    if (filterYear.value !== 'all' && r._year !== filterYear.value) return false
    return true
  })
})

const exactAreaData = computed(() => {
  if (!selectedArea.value) return []
  const key = selectedArea.value.keyNorm
  return viewData.value.filter(r => getRecordAreaKey(r) === key)
})

const areaData = computed(() => {
  if (!selectedArea.value) return viewData.value
  return exactAreaData.value
})

// ── Stats ─────────────────────────────────────────
const statCards = computed(() => {
  const d = viewData.value
  if (!d.length) return []

  const avg = (d.reduce((s, r) => s + r._score, 0) / d.length).toFixed(1)
  const nonA = d.filter(r => r.GRADE !== 'A').length
  const nonARate = (nonA / d.length * 100).toFixed(1)
  const gradeC = d.filter(r => r.GRADE === 'C').length

  return [
    { value: d.length.toLocaleString(), label: 'Inspections', color: '#2980b9' },
    { value: avg, label: 'County Avg', color: '#27ae60' },
    { value: nonARate + '%', label: 'Non-A Rate', color: '#c0392b' },
    { value: gradeC.toLocaleString(), label: 'Grade C', color: '#c0392b' },
  ]
})

const countyAvg = computed(() => {
  const d = viewData.value
  if (!d.length) return 93
  return +(d.reduce((s, r) => s + r._score, 0) / d.length).toFixed(1)
})

const areaStats = computed(() => {
  if (!selectedArea.value) {
    const d = viewData.value
    if (!d.length) return []
    const avg = (d.reduce((s, r) => s + r._score, 0) / d.length).toFixed(1)
    const nonA = d.filter(r => r.GRADE !== 'A').length
    const nonARate = (nonA / d.length * 100).toFixed(1)

    return [
      { value: d.length.toLocaleString(), label: 'Inspections', color: '#2980b9' },
      {
        value: avg,
        label: 'Avg Score',
        color: parseFloat(avg) >= 92 ? '#27ae60' : parseFloat(avg) >= 87 ? '#f39c12' : '#c0392b'
      },
      {
        value: nonARate + '%',
        label: 'Non-A Rate',
        color: parseFloat(nonARate) > 8 ? '#c0392b' : '#27ae60'
      },
    ]
  }

  const d = areaData.value
  if (!d.length) {
    // Synthetic tract: show estimated stats from mapFeatureData
    const feat = mapFeatureData.value.find(f => f.keyNorm === selectedArea.value?.keyNorm)
    if (feat && feat.hasData) {
      return [
        {
          value: feat.avgScore?.toFixed(1) ?? '—',
          label: 'Est. Score',
          color: feat.avgScore >= 92 ? '#27ae60' : feat.avgScore >= 87 ? '#f39c12' : '#c0392b'
        },
        {
          value: feat.nonARate != null ? feat.nonARate + '%' : '—',
          label: 'Est. Non-A',
          color: feat.nonARate > 8 ? '#c0392b' : '#27ae60'
        },
      ]
    }
    return []
  }

  const avg = (d.reduce((s, r) => s + r._score, 0) / d.length).toFixed(1)
  const nonA = d.filter(r => r.GRADE !== 'A').length
  const nonARate = (nonA / d.length * 100).toFixed(1)

  return [
    { value: d.length.toLocaleString(), label: 'Inspections', color: '#2980b9' },
    {
      value: avg,
      label: 'Avg Score',
      color: parseFloat(avg) >= 92 ? '#27ae60' : parseFloat(avg) >= 87 ? '#f39c12' : '#c0392b'
    },
    {
      value: nonARate + '%',
      label: 'Non-A Rate',
      color: parseFloat(nonARate) > 8 ? '#c0392b' : '#27ae60'
    },
  ]
})

const insightText = computed(() => {
  if (!selectedArea.value) {
    return 'Showing county-wide trend and distribution for LA County. Click any area on the map to zoom in.'
  }

  const d = areaData.value
  if (!d.length) {
    const feat = mapFeatureData.value.find(f => f.keyNorm === selectedArea.value?.keyNorm)
    if (feat?.hasData) {
      const diff = (feat.avgScore - parseFloat(countyAvg.value)).toFixed(1)
      const dir = diff >= 0 ? 'above' : 'below'
      return `Estimated from nearby restaurants: score ${feat.avgScore} (${Math.abs(diff)} pts ${dir} county avg). Non-A rate ~${feat.nonARate}%.`
    }
    return 'No inspection records found for this census tract.'
  }

  const avg = (d.reduce((s, r) => s + r._score, 0) / d.length).toFixed(1)
  const nonARate = (d.filter(r => r.GRADE !== 'A').length / d.length * 100).toFixed(1)
  const diff = (parseFloat(avg) - parseFloat(countyAvg.value)).toFixed(1)
  const dir = diff >= 0 ? 'above' : 'below'
  return `This area scores ${Math.abs(diff)} pts ${dir} the county average (${countyAvg.value}). Non-A rate is ${nonARate}%.`
})

const gradeBars = computed(() => {
  const d = areaData.value
  if (!selectedArea.value || !d.length) return []

  const total = d.length
  return [
    { grade: 'A', pct: Math.round(d.filter(r => r.GRADE === 'A').length / total * 100), color: '#27ae60' },
    { grade: 'B', pct: Math.round(d.filter(r => r.GRADE === 'B').length / total * 100), color: '#f39c12' },
    { grade: 'C', pct: Math.round(d.filter(r => r.GRADE === 'C').length / total * 100), color: '#c0392b' },
  ]
})

const trendData = computed(() => {
  const m = {}
  areaData.value.forEach(r => {
    if (!r._month) return
    if (!m[r._month]) m[r._month] = { month: r._month, total: 0, scoreSum: 0 }
    m[r._month].total++
    m[r._month].scoreSum += r._score
  })
  return Object.values(m)
    .map(d => ({ ...d, avgScore: +(d.scoreSum / d.total).toFixed(2) }))
    .sort((a, b) => a.month.localeCompare(b.month))
})

const gradBarStyle = computed(() => {
  if (colorMode.value === 'Density') {
    return 'linear-gradient(to right, #edf8fb, #9ecae1, #2171b5)'
  }
  if (colorMode.value === 'Non-A Rate') {
    return 'linear-gradient(to right, #1a9850, #fee08b, #d73027)'
  }
  return 'linear-gradient(to right, #d73027, #fee08b, #1a9850)'
})

// ── Map helpers ───────────────────────────────────
function getMapColorExpression(features) {
  const vals = features
    .filter(f => f.properties && f.properties.hasData)
    .map(f => {
      if (colorMode.value === 'Avg Score') return f.properties.avgScore
      if (colorMode.value === 'Non-A Rate') return f.properties.nonARate
      return f.properties.total
    })
    .filter(v => v != null && !Number.isNaN(v))

  const vMin = d3.min(vals)
  const vMax = d3.max(vals)

  if (vMin == null || vMax == null) {
    return 'rgba(0,0,0,0)'
  }

  if (colorMode.value === 'Avg Score') {
    return [
      'case',
      ['==', ['get', 'hasData'], false], 'rgba(0,0,0,0)',
      ['interpolate', ['linear'], ['get', 'avgScore'],
        88, '#d73027',
        90, '#f46d43',
        92, '#fee08b',
        94, '#66bd63',
        96, '#1a9850'
      ]
    ]
  }

  if (colorMode.value === 'Non-A Rate') {
    return [
      'case',
      ['==', ['get', 'hasData'], false], 'rgba(0,0,0,0)',
      ['interpolate', ['linear'], ['get', 'nonARate'],
        0, '#1a9850',
        5, '#66bd63',
        10, '#fee08b',
        15, '#f46d43',
        25, '#d73027'
      ]
    ]
  }

  return [
    'case',
    ['==', ['get', 'hasData'], false], 'rgba(0,0,0,0)',
    ['==', ['get', 'total'], 0], 'rgba(0,0,0,0)',
    ['interpolate', ['linear'], ['get', 'total'],
      1,    '#9ecae1',
      50,   '#4292c6',
      200,  '#2171b5',
      600,  '#084594',
      1500, '#08306b'
    ]
  ]
}

async function updateMap() {
  if (!map || !map.loaded() || !baseGeo.value) return

  if (map.getLayer('city-labels')) map.removeLayer('city-labels')
  if (map.getLayer('city-outline')) map.removeLayer('city-outline')
  if (map.getLayer('city-layer')) map.removeLayer('city-layer')
  if (map.getLayer('city-base')) map.removeLayer('city-base')
  if (map.getSource('city-source')) map.removeSource('city-source')

  const features = buildGeoFeatures()
  mapFeatureCount.value = features.length
  mapFeatureData.value = features.map(f => ({
    key: f.properties.GEOID,
    label: f.properties.NAME || f.properties.GEOID || '',
    cityName: f.properties.cityName || null,
    keyNorm: f.properties.keyNorm,
    count: Number(f.properties.total || 0),
    avgScore: f.properties.avgScore == null ? null : Number(f.properties.avgScore),
    nonARate: f.properties.nonARate == null ? null : Number(f.properties.nonARate),
    hasData: !!f.properties.hasData,
    centerLon: Number(f.properties.centerLon),
    centerLat: Number(f.properties.centerLat),
  }))

  map.addSource('city-source', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features }
  })

  const selectedKey = selectedArea.value?.key || ''

  // Base gray underlay: makes areas with no inspection data
  // (Vernon, Griffith Park, Hidden Hills, etc.) visible as "no data"
  // instead of disappearing into the map background.
  map.addLayer({
    id: 'city-base',
    type: 'fill',
    source: 'city-source',
    paint: {
      'fill-color': '#e4e4e2',
      'fill-opacity': 0.55,
    }
  }, 'water')

  map.addLayer({
    id: 'city-layer',
    type: 'fill',
    source: 'city-source',
    paint: {
      'fill-color': getMapColorExpression(features),
      'fill-opacity': [
        'case',
        ['==', ['get', 'keyNorm'], selectedKey], 0.92,
        ['==', ['get', 'hasData'], true], 0.75,
        0.0
      ],
    }
  }, 'water')

  map.addLayer({
    id: 'city-outline',
    type: 'line',
    source: 'city-source',
    paint: {
      'line-color': [
        'case',
        ['==', ['get', 'keyNorm'], selectedKey], '#333',
        ['==', ['get', 'hasData'], true], '#ffffff',
        '#c8c8c4'
      ],
      'line-width': [
        'case',
        ['==', ['get', 'keyNorm'], selectedKey], 2.5,
        ['==', ['get', 'hasData'], true], 0.5,
        0.4
      ],
      'line-opacity': [
        'case',
        ['==', ['get', 'hasData'], true], 0.8,
        0.6
      ],
    }
  })

  map.addLayer({
    id: 'city-labels',
    type: 'symbol',
    source: 'city-source',
    minzoom: 12,
    layout: {
      'text-field': ['get', 'NAME'],
      'text-size': 9,
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
    },
    paint: {
      'text-color': '#444',
      'text-halo-color': 'rgba(255,255,255,0.85)',
      'text-halo-width': 1,
    }
  })

  if (!mapEventsBound) {
    mapEventsBound = true

    // Events bound to 'city-base' (not 'city-layer') because city-base
    // is always visible (fill-opacity 0.55), so "no-data" polygons also
    // get hover/click events — previously city-layer had fill-opacity 0
    // for no-data areas, so those polygons were unclickable.
    map.on('click', 'city-base', (e) => {
      const p = e.features?.[0]?.properties
      if (!p) return

      selectedArea.value = {
        key: p.GEOID,
        label: p.NAME || p.GEOID,
        cityName: p.cityName || null,
        keyNorm: p.keyNorm,
        centerLon: Number(p.centerLon),
        centerLat: Number(p.centerLat),
      }

      map.flyTo({
        center: [Number(p.centerLon), Number(p.centerLat)],
        zoom: Math.max(map.getZoom(), 12),
        duration: 600
      })

      updateMap()
    })

    map.on('mouseenter', 'city-base', (e) => {
      const p = e.features?.[0]?.properties
      if (!p) return
      map.getCanvas().style.cursor = 'pointer'

      if (popup) popup.remove()
      const tractLabel = p.NAME || p.GEOID
      const cityLabel = p.cityName ? `<div style="color:#888;font-size:10px;margin-bottom:4px;">${p.cityName}</div>` : ''
      popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-family:system-ui;font-size:12px;min-width:150px;">
            <div style="font-weight:700;margin-bottom:2px;">${tractLabel}</div>
            ${cityLabel}
            ${
              String(p.hasData) === 'true' || p.hasData === true
                ? `
                  <div>Avg Score: <b style="color:${p.avgScore >= 92 ? '#27ae60' : p.avgScore >= 87 ? '#f39c12' : '#c0392b'}">${p.avgScore}</b></div>
                  <div>Non-A Rate: <b style="color:${p.nonARate > 8 ? '#c0392b' : '#27ae60'}">${p.nonARate}%</b></div>
                  ${String(p.synthetic) === 'true' || p.synthetic === true
                    ? `<div style="color:#aaa;font-size:10px;font-style:italic;">Estimated from nearby restaurants</div>`
                    : `<div style="color:#999;">Inspections: ${p.total}</div>`
                  }
                `
                : `<div style="color:#999;font-style:italic;">No data available</div>`
            }
            <div style="color:#2980b9;font-size:11px;margin-top:3px;">Click to explore →</div>
          </div>
        `)
        .addTo(map)
    })

    map.on('mouseleave', 'city-base', () => {
      map.getCanvas().style.cursor = ''
      if (popup) {
        popup.remove()
        popup = null
      }
    })
  }
}

function clearSelection() {
  selectedArea.value = null
  if (map) {
    map.flyTo({ center: [-118.24, 34.05], zoom: 9.5, duration: 600 })
  }
  updateMap()
}

// ── D3 helpers ────────────────────────────────────
function getW(el, fallback = 400) {
  if (!el) return fallback
  const r = el.getBoundingClientRect()
  return r.width > 10 ? r.width : (el.clientWidth || fallback)
}

function drawTrend() {
  const data = trendData.value
  const el = trendRef.value
  if (!el) return

  const W = getW(el.parentElement), H = 200
  const margin = { top: 14, right: 60, bottom: 36, left: 38 }
  const iW = W - margin.left - margin.right
  const iH = H - margin.top - margin.bottom

  d3.select(el).selectAll('*').remove()
  d3.select(el).attr('width', W).attr('height', H)

  if (!data.length) {
    d3.select(el).append('text')
      .attr('x', W / 2)
      .attr('y', H / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#ccc')
      .text(selectedArea.value ? 'No data available for this area' : 'Click an area on the map to explore')
    return
  }

  const g = d3.select(el).append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  const xScale = d3.scalePoint().domain(data.map(d => d.month)).range([0, iW]).padding(0.1)
  const yVals = data.map(d => d.avgScore)
  const ca = parseFloat(countyAvg.value)
  const yMin = Math.min(d3.min(yVals) - 1, ca - 2)
  const yMax = Math.max(d3.max(yVals) + 0.5, ca + 1)
  const yScale = d3.scaleLinear().domain([yMin, yMax]).range([iH, 0]).nice()
  const color = '#2980b9'

  g.append('line')
    .attr('x1', 0).attr('x2', iW)
    .attr('y1', yScale(ca)).attr('y2', yScale(ca))
    .attr('stroke', '#ddd')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,3')

  g.append('text')
    .attr('x', iW + 4)
    .attr('y', yScale(ca) + 4)
    .attr('font-size', '9px')
    .attr('fill', '#bbb')
    .text(`Avg ${ca}`)

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(4).tickSize(-iW).tickFormat(''))
    .call(e => e.select('.domain').remove())
    .call(e => e.selectAll('line').attr('stroke', '#f0f0f0'))

  g.append('g')
    .attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(xScale)
      .tickValues(data.filter((_, i) => i % 4 === 0).map(d => d.month))
      .tickFormat(d => d.slice(2, 7)))
    .call(e => e.select('.domain').remove())
    .call(e => e.selectAll('text')
      .attr('font-size', '9px')
      .attr('fill', '#bbb')
      .attr('transform', 'rotate(-30)')
      .attr('text-anchor', 'end'))

  const area = d3.area()
    .x(d => xScale(d.month))
    .y0(iH)
    .y1(d => yScale(d.avgScore))
    .curve(d3.curveCatmullRom)

  const line = d3.line()
    .x(d => xScale(d.month))
    .y(d => yScale(d.avgScore))
    .curve(d3.curveCatmullRom)

  g.append('path')
    .datum(data)
    .attr('fill', color)
    .attr('fill-opacity', 0.07)
    .attr('d', area)

  const path = g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 2)
    .attr('d', line)

  const len = path.node().getTotalLength()
  path.attr('stroke-dasharray', `${len} ${len}`)
    .attr('stroke-dashoffset', len)
    .transition()
    .duration(800)
    .ease(d3.easeQuadInOut)
    .attr('stroke-dashoffset', 0)

  g.selectAll('circle')
    .data(data)
    .join('circle')
    .attr('cx', d => xScale(d.month))
    .attr('cy', d => yScale(d.avgScore))
    .attr('r', 2.5)
    .attr('fill', color)
    .attr('opacity', 0)
    .transition()
    .delay(700)
    .attr('opacity', 0.8)
}

function drawBox() {
  const data = areaData.value
  const el = boxRef.value
  if (!el) return

  const W = getW(el.parentElement), H = 200
  const margin = { top: 14, right: 20, bottom: 30, left: 38 }
  const iW = W - margin.left - margin.right
  const iH = H - margin.top - margin.bottom
  const grades = ['A', 'B', 'C']
  const grouped = {}
  grades.forEach(g => { grouped[g] = [] })
  data.forEach(r => { if (grouped[r.GRADE]) grouped[r.GRADE].push(r._score) })
  const colors = { A: '#27ae60', B: '#f39c12', C: '#c0392b' }

  d3.select(el).selectAll('*').remove()
  d3.select(el).attr('width', W).attr('height', H)

  if (!data.length) {
    d3.select(el).append('text')
      .attr('x', W / 2)
      .attr('y', H / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#ccc')
      .text(selectedArea.value ? 'No data available for this area' : 'Click an area on the map to explore')
    return
  }

  const g = d3.select(el).append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  const xScale = d3.scaleBand().domain(grades).range([0, iW]).padding(0.5)
  const yScale = d3.scaleLinear().domain([60, 106]).range([iH, 0])

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-iW).tickFormat(''))
    .call(e => e.select('.domain').remove())
    .call(e => e.selectAll('line').attr('stroke', '#f0f0f0'))

  g.append('g')
    .attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(xScale).tickFormat(d => `Grade ${d}`))
    .call(e => e.select('.domain').remove())
    .call(e => e.selectAll('text')
      .attr('font-size', '9px')
      .attr('font-weight', '600')
      .attr('fill', d => colors[d]))

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(5))
    .call(e => e.select('.domain').remove())
    .call(e => e.selectAll('text').attr('font-size', '9px').attr('fill', '#bbb'))

  grades.forEach(grade => {
    const vals = grouped[grade].sort(d3.ascending)
    if (vals.length < 4) return

    const q1 = d3.quantile(vals, 0.25)
    const med = d3.quantile(vals, 0.5)
    const q3 = d3.quantile(vals, 0.75)
    const p5 = d3.quantile(vals, 0.05)
    const p95 = d3.quantile(vals, 0.95)
    const mean = d3.mean(vals)

    const cx = xScale(grade) + xScale.bandwidth() / 2
    const bw = xScale.bandwidth()
    const col = colors[grade]

    g.append('line')
      .attr('x1', cx).attr('x2', cx)
      .attr('y1', yScale(p95)).attr('y2', yScale(q3))
      .attr('stroke', col).attr('stroke-width', 1.5).attr('opacity', 0.4)

    g.append('line')
      .attr('x1', cx).attr('x2', cx)
      .attr('y1', yScale(q1)).attr('y2', yScale(p5))
      .attr('stroke', col).attr('stroke-width', 1.5).attr('opacity', 0.4)

    g.append('line')
      .attr('x1', cx - bw * .3).attr('x2', cx + bw * .3)
      .attr('y1', yScale(p95)).attr('y2', yScale(p95))
      .attr('stroke', col).attr('stroke-width', 1.5).attr('opacity', 0.35)

    g.append('line')
      .attr('x1', cx - bw * .3).attr('x2', cx + bw * .3)
      .attr('y1', yScale(p5)).attr('y2', yScale(p5))
      .attr('stroke', col).attr('stroke-width', 1.5).attr('opacity', 0.35)

    g.append('rect')
      .attr('x', xScale(grade))
      .attr('y', yScale(q3))
      .attr('width', bw)
      .attr('height', Math.max(1, yScale(q1) - yScale(q3)))
      .attr('fill', col)
      .attr('fill-opacity', 0)
      .attr('stroke', col)
      .attr('stroke-width', 2)
      .attr('rx', 2)
      .transition()
      .duration(500)
      .delay(100)
      .attr('fill-opacity', 0.18)

    g.append('line')
      .attr('x1', xScale(grade))
      .attr('x2', xScale(grade) + bw)
      .attr('y1', yScale(med))
      .attr('y2', yScale(med))
      .attr('stroke', col)
      .attr('stroke-width', 3)
      .attr('opacity', 0)
      .transition()
      .duration(400)
      .delay(500)
      .attr('opacity', 1)

    g.append('circle')
      .attr('cx', cx)
      .attr('cy', yScale(mean))
      .attr('r', 4)
      .attr('fill', 'white')
      .attr('stroke', col)
      .attr('stroke-width', 2)
      .attr('opacity', 0)
      .transition()
      .duration(300)
      .delay(600)
      .attr('opacity', 1)

    g.append('text')
      .attr('x', cx)
      .attr('y', -4)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('fill', '#bbb')
      .text(`n=${vals.length.toLocaleString()}`)
  })
}

function drawWorstAreas() {
  const cells = [...mapFeatureData.value]
    .filter(c => c.hasData && c.count >= 5)
    .sort((a, b) => b.nonARate - a.nonARate)
    .slice(0, 15)

  const el = rankRef.value
  if (!el) return

  const W = getW(el.parentElement)
  const barH = 18, gap = 2, labelW = 130, barMaxW = W - labelW - 44
  const H = cells.length * (barH + gap) + 24

  d3.select(el).selectAll('*').remove()
  d3.select(el).attr('width', W).attr('height', H)

  if (!cells.length) {
    d3.select(el).append('text')
      .attr('x', W / 2)
      .attr('y', H / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#ccc')
      .text('No ranked areas available')
    return
  }

  const xMax = d3.max(cells, c => c.nonARate)
  const xScale = d3.scaleLinear().domain([0, xMax]).range([0, barMaxW])
  const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([xMax, 0])
  const g = d3.select(el).append('g').attr('transform', `translate(${labelW},12)`)

  cells.forEach((c, i) => {
    const y = i * (barH + gap)
    const barW = xScale(c.nonARate)
    const isSel = selectedArea.value?.key === c.key

    const row = g.append('g')
      .attr('cursor', 'pointer')
      .on('click', () => {
        selectedArea.value = {
          key: c.key,
          label: c.label,
          cityName: c.cityName || null,
          keyNorm: c.keyNorm,
          centerLon: c.centerLon,
          centerLat: c.centerLat,
        }
        if (map) {
          map.flyTo({
            center: [c.centerLon, c.centerLat],
            zoom: 13,
            duration: 600
          })
        }
        updateMap()
      })

    if (isSel) {
      row.append('rect')
        .attr('x', -labelW)
        .attr('y', y - 1)
        .attr('width', W)
        .attr('height', barH + 2)
        .attr('fill', '#fef9f8')
        .attr('rx', 2)
    }

    const shortLabel = (() => {
      // "Census Tract 5416.03" → "5416.03"
      const tractNum = c.label.replace(/^Census Tract\s+/i, '')
      // append city name if available and fits
      const city = c.cityName || ''
      return city ? `${tractNum} · ${city}` : tractNum
    })()

    row.append('text')
      .attr('x', -5)
      .attr('y', y + barH / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '9px')
      .attr('fill', isSel ? 'var(--accent)' : '#666')
      .text(shortLabel.length > 22 ? shortLabel.slice(0, 21) + '…' : shortLabel)

    row.append('rect')
      .attr('x', 0)
      .attr('y', y)
      .attr('width', 0)
      .attr('height', barH)
      .attr('rx', 2)
      .attr('fill', colorScale(c.nonARate))
      .attr('opacity', 0.85)
      .transition()
      .duration(500)
      .delay(i * 15)
      .attr('width', Math.max(barW, 2))

    row.append('text')
      .attr('x', Math.max(barW, 2) + 4)
      .attr('y', y + barH / 2)
      .attr('dominant-baseline', 'central')
      .attr('font-size', '9px')
      .attr('fill', '#bbb')
      .attr('opacity', 0)
      .text(`${c.nonARate}%`)
      .transition()
      .delay(i * 15 + 400)
      .attr('opacity', 1)
  })
}

function drawAll() {
  drawTrend()
  drawBox()
  drawWorstAreas()
}

function waitAndDraw(fn) {
  let tries = 0
  const try_ = () => {
    if (++tries > 20) return
    const el = trendRef.value
    if (el && el.parentElement && el.parentElement.getBoundingClientRect().width > 10) fn()
    else requestAnimationFrame(() => requestAnimationFrame(try_))
  }
  requestAnimationFrame(() => requestAnimationFrame(try_))
}

async function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

async function loadLink(href) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = href
  document.head.appendChild(l)
}

onMounted(async () => {
  if (!store.allData.length) {
    await store.loadData()
  }

  await loadLink('https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css')
  await loadScript('https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js')

  const geoRes = await fetch(GEOJSON_URL)
  baseGeo.value = await geoRes.json()

  // Tag every restaurant with the neighborhood polygon it falls in,
  // so "LOS ANGELES" records don't create a blank donut hole on the map.
  precomputeAreaKeys()

  mapboxgl.accessToken = MAPBOX_TOKEN
  map = new mapboxgl.Map({
    container: 'ov-map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-118.24, 34.05],
    zoom: 9.5,
  })

  map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

  map.on('load', async () => {
    await updateMap()
    waitAndDraw(drawAll)
  })
})

watch(viewData, async () => {
  await nextTick()
  if (!map) return
  await updateMap()
  drawAll()
})

watch(areaData, () => nextTick(drawAll))
watch(activeTab, () => nextTick(drawAll))
watch(colorMode, () => updateMap())

onUnmounted(() => {
  if (popup) {
    popup.remove()
    popup = null
  }
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<style scoped>
.ov-layout {
  display: grid;
  grid-template-rows: 58vh 1fr;
  height: calc(100vh - 56px);
  overflow: hidden;
}

.ov-top {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-bottom: 1px solid var(--border);
}

.ov-map-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 10px 18px 8px;
  background: white;
  flex-shrink: 0;
}

.ov-question {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-dark);
  line-height: 1.3;
}

.ov-subtitle {
  font-size: .73rem;
  color: var(--text-light);
  margin-top: 3px;
  line-height: 1.5;
}

.ov-stat-inline {
  display: flex;
  gap: 20px;
  flex-shrink: 0;
}

.ov-stat-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.2;
}

.ov-stat-chip b {
  font-size: 1.05rem;
  font-weight: 700;
}

.ov-stat-chip span {
  font-size: .6rem;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-light);
}

.ov-map-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 14px;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: #fafafa;
  flex-shrink: 0;
}

.ov-map-bar-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ov-map-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ov-ctrl-btn {
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: white;
  font-size: .72rem;
  cursor: pointer;
  color: var(--text-mid);
  transition: all .13s;
}

.ov-ctrl-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.ov-ctrl-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
  font-weight: 600;
}

.ov-select-sm {
  font-size: .72rem;
  padding: 3px 7px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: white;
  cursor: pointer;
  outline: none;
}

.ov-area-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #fde8e1;
  color: var(--accent);
  font-size: .72rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 12px;
  border: 1px solid #f5b7b1;
}

.ov-area-badge button {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--accent);
  font-size: 1rem;
  line-height: 1;
  padding: 0;
}

.ov-map {
  flex: 1;
  min-height: 0;
}

.ov-map-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  background: #fafafa;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.ov-grad-bar {
  width: 80px;
  height: 8px;
  border-radius: 4px;
  flex-shrink: 0;
}

.ov-bottom {
  display: grid;
  grid-template-columns: 260px 1fr;
  overflow: hidden;
}

.ov-insight {
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 14px;
  overflow-y: auto;
  background: #fafafa;
}

.ov-insight-title {
  font-size: .82rem;
  font-weight: 700;
  color: var(--text-dark);
  margin-bottom: 10px;
  line-height: 1.3;
}

.ov-insight-stats {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 6px;
  margin-bottom: 10px;
}

.ov-i-stat {
  background: white;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 7px 8px;
  text-align: center;
}

.ov-i-val {
  font-size: .95rem;
  font-weight: 700;
}

.ov-i-label {
  font-size: .58rem;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--text-light);
  margin-top: 2px;
}

.ov-insight-note {
  font-size: .74rem;
  color: var(--text-mid);
  line-height: 1.55;
  margin-bottom: 12px;
  font-style: italic;
}

.ov-grade-bars {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ov-grade-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.ov-grade-label {
  font-size: .72rem;
  font-weight: 600;
  color: var(--text-mid);
  width: 46px;
  flex-shrink: 0;
}

.ov-grade-track {
  flex: 1;
  height: 6px;
  background: #e8e8e8;
  border-radius: 3px;
  overflow: hidden;
}

.ov-grade-fill {
  height: 100%;
  border-radius: 3px;
  transition: width .4s;
}

.ov-grade-pct {
  font-size: .7rem;
  color: var(--text-light);
  width: 32px;
  text-align: right;
  flex-shrink: 0;
}

.ov-charts {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: white;
}

.ov-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.ov-tab {
  flex: 1;
  padding: 8px 4px;
  font-size: .72rem;
  font-weight: 500;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--text-mid);
  border-bottom: 2px solid transparent;
  transition: all .13s;
}

.ov-tab:hover {
  color: var(--accent);
}

.ov-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 700;
}

.ov-tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.ov-panel-desc {
  font-size: .74rem;
  color: var(--text-mid);
  font-style: italic;
  line-height: 1.5;
  margin-bottom: 10px;
}
</style>