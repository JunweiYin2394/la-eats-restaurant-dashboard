<template>
  <div class="choro-wrap">
    <!-- Left: map -->
    <div class="choro-map-col">
      <div class="choro-controls">
        <select class="f-select" v-model="selectedYear">
          <option value="all">All years</option>
          <option value="2023">2023</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
        </select>
        <select class="f-select" v-model="colorBy">
          <option value="avgScore">Avg Score</option>
          <option value="nonARate">Non-A Rate %</option>
          <option value="total">Inspection Count</option>
        </select>
      </div>
      <div style="position:relative;">
        <svg ref="mapRef" style="width:100%;display:block;"></svg>
        <div class="choro-tooltip" v-show="tooltip.visible"
          :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
          <div class="ct-name">{{ tooltip.name }}</div>
          <div class="ct-val">Avg Score: <strong>{{ tooltip.avgScore }}</strong></div>
          <div class="ct-val">Non-A Rate: <strong>{{ tooltip.nonARate }}%</strong></div>
          <div class="ct-val">Inspections: <strong>{{ tooltip.total }}</strong></div>
        </div>
      </div>
      <div class="choro-legend-row">
        <svg ref="legendRef" height="28" style="display:block;"></svg>
      </div>
    </div>

    <!-- Right: table -->
    <div class="choro-table-col">
      <div class="choro-table-header">
        <span>City</span>
        <span @click="sortBy='avgScore'" :class="{active: sortBy==='avgScore'}" class="sort-col">Score</span>
        <span @click="sortBy='nonARate'" :class="{active: sortBy==='nonARate'}" class="sort-col">Non-A%</span>
        <span @click="sortBy='total'" :class="{active: sortBy==='total'}" class="sort-col">Count</span>
      </div>
      <div class="choro-table-body">
        <div
          v-for="d in sortedData"
          :key="d.city"
          class="choro-table-row"
          :class="{ highlighted: hoveredCity === d.city, selected: store.selectedCity === d.city }"
          @mouseenter="hoveredCity = d.city"
          @mouseleave="hoveredCity = null"
          @click="store.selectedCity = store.selectedCity === d.city ? null : d.city"
        >
          <span class="city-name-cell">
            <span class="color-dot" :style="{ background: getColor(d) }"></span>
            {{ d.city }}
          </span>
          <span>{{ d.avgScore }}</span>
          <span>{{ d.nonARate }}%</span>
          <span>{{ d.total.toLocaleString() }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import * as d3 from 'd3'
import { useDataStore } from '@/stores/data'

const store = useDataStore()
const mapRef    = ref(null)
const legendRef = ref(null)

const selectedYear = ref('all')
const colorBy      = ref('avgScore')
const sortBy       = ref('avgScore')
const hoveredCity  = ref(null)
const tooltip      = ref({ visible: false, x: 0, y: 0, name: '', avgScore: 0, nonARate: 0, total: 0 })

let geoData = null

const yearFilteredStats = computed(() => {
  const rows = selectedYear.value === 'all'
    ? store.allData
    : store.allData.filter(r => r._year === selectedYear.value)

  const map = {}
  rows.forEach(r => {
    const c = r._city
    if (!c) return
    if (!map[c]) map[c] = { city: c, total: 0, scoreSum: 0, nonA: 0 }
    map[c].total++
    map[c].scoreSum += r._score
    if (r['GRADE'] !== 'A') map[c].nonA++
  })
  return Object.values(map).map(c => ({
    city: c.city,
    total: c.total,
    avgScore: +(c.scoreSum / c.total).toFixed(2),
    nonARate: +(c.nonA / c.total * 100).toFixed(1),
  }))
})

const sortedData = computed(() => {
  return [...yearFilteredStats.value].sort((a, b) =>
    sortBy.value === 'avgScore' ? b.avgScore - a.avgScore :
    sortBy.value === 'nonARate' ? b.nonARate - a.nonARate :
    b.total - a.total
  )
})

const colorScale = computed(() => {
  const vals = yearFilteredStats.value.map(d => d[colorBy.value])
  const vMin = d3.min(vals) || 0
  const vMax = d3.max(vals) || 100
  return colorBy.value === 'nonARate'
    ? d3.scaleSequential(d3.interpolateBlues).domain([vMin, vMax])
    : d3.scaleSequential(d3.interpolateBlues).domain([vMax, vMin])
})

function getColor(d) {
  if (!d) return '#e8e5de'
  return colorScale.value(d[colorBy.value])
}

async function loadGeo() {
  if (geoData) return
  try {
    const res = await fetch('./data/la_cities.geojson')
    geoData = await res.json()
  } catch (e) { console.error('Failed to load geojson', e) }
}

function drawMap() {
  if (!mapRef.value || !geoData) return

  const statsMap = {}
  yearFilteredStats.value.forEach(d => { statsMap[d.city] = d })

  const el = mapRef.value
  const W = el.parentElement.clientWidth || 420
  const H = 380

  d3.select(el).selectAll('*').remove()

  const svg = d3.select(el).attr('width', W).attr('height', H)
  const projection = d3.geoMercator().fitSize([W, H], geoData)
  const path = d3.geoPath().projection(projection)

  svg.selectAll('path')
    .data(geoData.features)
    .join('path')
    .attr('d', path)
    .attr('fill', f => {
      const name = f.properties.name?.toUpperCase()
      const d = statsMap[name]
      return d ? colorScale.value(d[colorBy.value]) : '#e8e5de'
    })
    .attr('stroke', f => {
      const name = f.properties.name?.toUpperCase()
      return (hoveredCity.value === name || store.selectedCity === name) ? '#eb5428' : 'white'
    })
    .attr('stroke-width', f => {
      const name = f.properties.name?.toUpperCase()
      return (hoveredCity.value === name || store.selectedCity === name) ? 2 : 0.5
    })
    .attr('cursor', 'pointer')
    .on('mouseenter', function(event, f) {
      const name = f.properties.name?.toUpperCase()
      hoveredCity.value = name
      const d = statsMap[name]
      tooltip.value = {
        visible: true,
        x: event.offsetX + 12,
        y: event.offsetY - 12,
        name: f.properties.name,
        avgScore: d ? d.avgScore : 'N/A',
        nonARate: d ? d.nonARate : 'N/A',
        total: d ? d.total : 0,
      }
      d3.select(this).raise()
    })
    .on('mouseleave', function() {
      hoveredCity.value = null
      tooltip.value.visible = false
    })
    .on('click', (event, f) => {
      const name = f.properties.name?.toUpperCase()
      store.selectedCity = store.selectedCity === name ? null : name
    })

  // Legend
  const lEl = legendRef.value
  const lW = lEl.parentElement.clientWidth - 20 || 300
  d3.select(lEl).attr('width', lW).selectAll('*').remove()

  const lSvg = d3.select(lEl)
  const defs = lSvg.append('defs')
  const grad = defs.append('linearGradient').attr('id', 'choro-map-grad')

  const vals = yearFilteredStats.value.map(d => d[colorBy.value])
  const vMin = d3.min(vals) || 0
  const vMax = d3.max(vals) || 100

  const stops = colorBy.value === 'nonARate'
    ? [[0, vMin], [1, vMax]]
    : [[0, vMax], [1, vMin]]

  stops.forEach(([offset, val]) => {
    grad.append('stop').attr('offset', offset).attr('stop-color', colorScale.value(val))
  })

  lSvg.append('rect').attr('x', 40).attr('y', 4)
    .attr('width', lW - 80).attr('height', 10).attr('rx', 3)
    .attr('fill', 'url(#choro-map-grad)')

  lSvg.append('text').attr('x', 40).attr('y', 25)
    .attr('font-size', '10px').attr('fill', '#a0a09c')
    .text(colorBy.value === 'nonARate' ? vMin.toFixed(1) + '%' : vMin.toFixed(1))

  lSvg.append('text').attr('x', lW - 40).attr('y', 25)
    .attr('text-anchor', 'end').attr('font-size', '10px').attr('fill', '#a0a09c')
    .text(colorBy.value === 'nonARate' ? vMax.toFixed(1) + '%' : vMax.toFixed(1))
}

onMounted(async () => {
  await nextTick()
  await loadGeo()
  watch(
    [yearFilteredStats, colorBy, hoveredCity, () => store.selectedCity],
    () => nextTick(drawMap),
    { immediate: true }
  )
})
</script>

<style scoped>
.choro-wrap { display: flex; gap: 16px; align-items: flex-start; }
.choro-map-col { flex: 1; min-width: 0; }
.choro-table-col { width: 260px; flex-shrink: 0; max-height: 420px; display: flex; flex-direction: column; }
.choro-controls { display: flex; gap: 8px; margin-bottom: 8px; }
.f-select {
  font-size: 0.78rem; padding: 4px 8px;
  border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg); color: var(--text-dark); cursor: pointer;
}
.choro-tooltip {
  position: absolute; background: #fff; border: 1px solid var(--border);
  border-radius: 8px; padding: 8px 12px; pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1); font-size: .78rem; min-width: 160px; z-index: 10;
}
.ct-name { font-weight: 700; font-size: .82rem; margin-bottom: 4px; color: var(--text-dark); }
.ct-val { color: var(--text-mid); line-height: 1.6; }
.choro-legend-row { margin-top: 8px; }
.choro-table-header {
  display: grid; grid-template-columns: 1fr 52px 52px 52px;
  padding: 6px 8px; font-size: .72rem; font-weight: 700;
  color: var(--text-mid); text-transform: uppercase; letter-spacing: .04em;
  border-bottom: 1px solid var(--border); background: var(--bg);
  border-radius: 8px 8px 0 0;
}
.sort-col { cursor: pointer; text-align: right; }
.sort-col.active { color: var(--orange); }
.choro-table-body {
  overflow-y: auto; flex: 1;
  border: 1px solid var(--border); border-top: none; border-radius: 0 0 8px 8px;
}
.choro-table-row {
  display: grid; grid-template-columns: 1fr 52px 52px 52px;
  padding: 5px 8px; font-size: .75rem;
  border-bottom: 1px solid var(--border); cursor: pointer;
  transition: background .1s; color: var(--text-dark);
}
.choro-table-row:last-child { border-bottom: none; }
.choro-table-row:hover, .choro-table-row.highlighted { background: #fff8f5; }
.choro-table-row.selected { background: #fde8e1; font-weight: 600; }
.choro-table-row span:not(.city-name-cell) { text-align: right; }
.city-name-cell {
  display: flex; align-items: center; gap: 6px;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.color-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
</style>