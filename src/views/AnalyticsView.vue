<template>
  <div class="page-body">

    <!-- ══ RANK — Bar + Trend + Table ══ -->
    <template v-if="section === 'rank'">
      <div class="viz-section">
        <div class="viz-section-title">City Average Score Ranking</div>
        <div class="viz-controls">
          <div class="radio-group">
            <label><input type="radio" v-model="chorMode" value="avgScore"> Avg Score</label>
            <label><input type="radio" v-model="chorMode" value="nonARate"> Non-A Rate %</label>
          </div>
          <span style="font-size:.75rem;color:var(--text-light);margin-left:auto;">
            {{ store.cityStats.length }} cities ·
            <span v-if="store.selectedCity" style="color:var(--accent);font-weight:600;">
              {{ store.selectedCity }} selected ·
              <span style="cursor:pointer;text-decoration:underline;" @click="store.selectedCity = null">clear</span>
            </span>
            <span v-else>click a bar to filter all views</span>
          </span>
        </div>

        <!-- Three-col: bar + trend line + description -->
        <div class="tri-layout">
          <div class="tri-chart" ref="chorWrap">
            <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-light);margin-bottom:8px;">
              Ranking — {{ chorMode === 'avgScore' ? 'Average Score' : 'Non-A Rate' }}
            </div>
            <div style="position:relative;">
              <svg ref="chorRef" style="display:block;"></svg>
              <div class="viz-tooltip" v-show="tooltip.visible" :style="{ left: tooltip.x+'px', top: tooltip.y+'px' }">
                <strong>{{ tooltip.city }}</strong>
                Avg Score: {{ tooltip.avgScore }}<br>
                Non-A Rate: {{ tooltip.nonARate }}%<br>
                Inspections: {{ tooltip.total }}
              </div>
            </div>
          </div>

          <div class="tri-trend" ref="trendWrap">
            <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-light);margin-bottom:8px;">
              Monthly Trend — {{ store.selectedCity || 'All Cities' }}
            </div>
            <svg ref="trendRef" style="display:block;"></svg>
          </div>

          <div class="viz-description" style="padding-top:0;">
            <p>
              The bar chart ranks all LA County cities by their average
              restaurant inspection score. Click any bar to
              <strong>cross-filter</strong> the trend chart and the record
              table below — showing only data from that city.
              This linked view lets planners compare a city's overall
              standing with its month-by-month compliance history.
            </p>
            <div style="margin-top:14px;font-size:.76rem;color:var(--text-mid);">
              <div style="display:flex;align-items:center;gap:8px;">
                <svg width="80" height="10"><defs><linearGradient id="rleg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#c0392b"/><stop offset="50%" stop-color="#f39c12"/><stop offset="100%" stop-color="#27ae60"/></linearGradient></defs><rect x="0" y="0" width="80" height="10" rx="2" fill="url(#rleg)"/></svg>
                Red = low · Green = high
              </div>
            </div>
          </div>
        </div>

        <!-- Cross-filtered table -->
        <div style="margin-top:28px;">
          <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-light);margin-bottom:10px;">
            Inspection Records — {{ store.selectedCity || 'All Cities' }}
            <span style="font-weight:400;margin-left:8px;">({{ tableRows.length.toLocaleString() }} total)</span>
          </div>
          <div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Restaurant</th><th>City</th><th>Grade</th><th>Score</th><th>Date</th><th>Risk</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in tableRows.slice(0, 12)" :key="r['RECORD ID']">
                  <td style="font-weight:600;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ r['FACILITY NAME'] }}</td>
                  <td>{{ r['FACILITY CITY'] }}</td>
                  <td><span :class="'badge-' + (r['GRADE']||'').toLowerCase()">{{ r['GRADE'] }}</span></td>
                  <td style="font-weight:700;" :style="{ color: r['GRADE']==='A'?'#27ae60':r['GRADE']==='B'?'#f39c12':'#c0392b' }">{{ r['SCORE'] }}</td>
                  <td style="color:var(--text-mid);">{{ r['ACTIVITY DATE'] }}</td>
                  <td style="font-size:.72rem;color:var(--text-mid);">{{ store.riskShort(r['PE DESCRIPTION']) }}</td>
                </tr>
                <tr v-if="tableRows.length === 0">
                  <td colspan="6" style="text-align:center;padding:24px;color:var(--text-light);">No records</td>
                </tr>
              </tbody>
            </table>
            <div v-if="tableRows.length > 12" style="padding:8px 14px;border-top:1px solid var(--border);font-size:.74rem;color:var(--text-light);">
              Showing first 12 of {{ tableRows.length.toLocaleString() }} records.
              <RouterLink to="/restaurants" style="color:var(--accent);margin-left:4px;">View all →</RouterLink>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ══ VORONOI ══ -->
    <template v-if="section === 'voronoi'">
      <div class="viz-section">
        <div class="viz-section-title">D3 Voronoi Choropleth</div>
        <div class="viz-controls">
          <div class="radio-group">
            <label><input type="radio" v-model="voroMode" value="avgScore"> Avg Score</label>
            <label><input type="radio" v-model="voroMode" value="nonARate"> Non-A Rate</label>
          </div>
        </div>
        <div class="viz-row wide">
          <div class="viz-chart-area" ref="voroWrap" style="position:relative;">
            <svg ref="voroRef" style="display:block;"></svg>
            <div class="viz-tooltip" v-show="voroTooltip.visible" :style="{ left: voroTooltip.x+'px', top: voroTooltip.y+'px' }">
              <strong>{{ voroTooltip.city }}</strong>
              Avg Score: {{ voroTooltip.avgScore }}<br>
              Non-A Rate: {{ voroTooltip.nonARate }}%<br>
              Inspections: {{ voroTooltip.total }}
            </div>
          </div>
          <div class="viz-description">
            <p>
              A Voronoi tessellation partitions the map so that each city's
              territory extends to the midpoint between neighboring city centroids.
              This reveals spatial clustering and proximity relationships that
              exact administrative boundaries often obscure. Each cell is colored
              by the city's average score or non-A rate.
              Click any cell to cross-filter all dashboard views.
            </p>
          </div>
        </div>
      </div>
    </template>

    <!-- ══ SYMBOL MAP with year slider ══ -->
    <template v-if="section === 'symbol'">
      <div class="viz-section">
        <div class="viz-section-title">Proportional Symbol Map by Year</div>
        <div class="year-slider-wrap">
          <div class="year-slider-label">Year: <strong>{{ symYear }}</strong></div>
          <input type="range" class="year-slider" :min="2023" :max="2025" v-model.number="symYear" step="1" />
          <div style="display:flex;justify-content:space-between;width:300px;font-size:.72rem;color:var(--text-light);">
            <span>2023</span><span>2024</span><span>2025</span>
          </div>
        </div>
        <div class="viz-row wide">
          <div class="viz-chart-area" ref="symWrap" style="position:relative;">
            <svg ref="symRef" style="display:block;"></svg>
            <div class="viz-tooltip" v-show="symTooltip.visible" :style="{ left: symTooltip.x+'px', top: symTooltip.y+'px' }">
              <strong>{{ symTooltip.city }}</strong>
              Inspections ({{ symYear }}): {{ symTooltip.total }}<br>
              Avg Score: {{ symTooltip.avgScore }}<br>
              Non-A Rate: {{ symTooltip.nonARate }}%
            </div>
          </div>
          <div class="viz-description">
            <p>
              Each circle is positioned at the city centroid.
              <strong>Circle size</strong> represents the number of inspections
              in that city for the selected year — drag the slider above to see
              how inspection activity shifts over time.
              <strong>Circle color</strong> encodes average score on a
              red-to-green scale. Click any circle to filter all views.
            </p>
            <div style="margin-top:16px;font-size:.76rem;color:var(--text-mid);">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <svg width="60" height="20"><circle cx="8" cy="10" r="4" fill="#888" opacity=".6"/><circle cx="28" cy="10" r="7" fill="#888" opacity=".6"/><circle cx="50" cy="10" r="10" fill="#888" opacity=".6"/></svg>
                Size = inspection count
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <svg width="80" height="12"><defs><linearGradient id="sleg2" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#c0392b"/><stop offset="50%" stop-color="#f39c12"/><stop offset="100%" stop-color="#27ae60"/></linearGradient></defs><rect x="0" y="2" width="80" height="8" rx="3" fill="url(#sleg2)"/></svg>
                Color = avg score
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, nextTick } from 'vue'
import { RouterLink } from 'vue-router'
import * as d3 from 'd3'
import { useDataStore } from '@/stores/data'

const props = defineProps({ section: { type: String, default: 'rank' } })
const store = useDataStore()

const chorRef = ref(null); const chorWrap  = ref(null)
const trendRef = ref(null); const trendWrap = ref(null)
const voroRef  = ref(null); const voroWrap  = ref(null)
const symRef   = ref(null); const symWrap   = ref(null)

const chorMode    = ref('avgScore')
const voroMode    = ref('avgScore')
const symYear     = ref(2024)
const tooltip     = ref({ visible: false, x: 0, y: 0, city: '', avgScore: 0, nonARate: 0, total: 0 })
const voroTooltip = ref({ visible: false, x: 0, y: 0, city: '', avgScore: 0, nonARate: 0, total: 0 })
const symTooltip  = ref({ visible: false, x: 0, y: 0, city: '', total: 0, avgScore: 0, nonARate: 0 })

const cityGeoData = ref([])

function getW(wrap, fallback = 700) {
  if (!wrap) return fallback
  // Try multiple methods for maximum compatibility with CSS Grid layouts
  const bcr = wrap.getBoundingClientRect().width
  if (bcr > 10) return bcr
  const cw = wrap.clientWidth
  if (cw > 10) return cw
  const ow = wrap.offsetWidth
  if (ow > 10) return ow
  // Walk up to find a sized ancestor
  let el = wrap.parentElement
  while (el) {
    const w = el.getBoundingClientRect().width
    if (w > 10) return Math.min(w, 900)
    el = el.parentElement
  }
  return fallback
}

// ── Cross-filtered table ──────────────────────────
const tableRows = computed(() =>
  store.filteredData.filter(r => r['GRADE'] !== undefined).sort((a, b) => b._score - a._score)
)

// ── Year-filtered data for symbol map (use byYear from city_centroids) ─
const symYearData = computed(() => {
  const yearStr = String(symYear.value)
  return cityGeoData.value
    .filter(c => c.byYear && c.byYear[yearStr])
    .map(c => ({
      city: c.city,
      lat: c.lat,
      lon: c.lon,
      total: c.byYear[yearStr].total,
      avgScore: c.byYear[yearStr].avgScore,
      nonARate: c.byYear[yearStr].nonARate,
    }))
})

// ── City Rankings bar chart ───────────────────────
function drawChoropleth() {
  const data = store.cityStats
  if (!chorRef.value || !data.length) return
  const W = Math.max(getW(chorWrap.value), 300)
  const barH = 20, gap = 2, labelW = 120, barMaxW = W - labelW - 70
  const H = data.length * (barH + gap) + 50

  d3.select(chorRef.value).selectAll('*').remove()
  const svg = d3.select(chorRef.value).attr('width', W).attr('height', H)
  const key = chorMode.value
  const vals = data.map(d => d[key])
  const vMin = d3.min(vals), vMax = d3.max(vals)
  const colorScale = key === 'avgScore'
    ? d3.scaleSequential(d3.interpolateRdYlGn).domain([vMin, vMax])
    : d3.scaleSequential(d3.interpolateRdYlGn).domain([vMax, vMin])
  const sorted = [...data].sort((a, b) => key === 'avgScore' ? b[key] - a[key] : a[key] - b[key])
  const xScale = d3.scaleLinear().domain([vMin, vMax]).range([0, barMaxW])
  const g = svg.append('g').attr('transform', `translate(${labelW},28)`)

  svg.append('text').attr('x', labelW).attr('y', 16).attr('font-size', '10px').attr('fill', '#ccc')
    .text(key === 'avgScore' ? '← Lower    Higher →' : '← Better    Worse →')

  sorted.forEach((d, i) => {
    const y = i * (barH + gap)
    const barW = Math.max(xScale(d[key]), 2)
    const isSelected = store.selectedCity === d.city
    const row = g.append('g').attr('cursor', 'pointer')
      .on('click', () => { store.selectedCity = store.selectedCity === d.city ? null : d.city })
      .on('mouseenter', (event) => {
        tooltip.value = { visible: true, x: event.clientX + 12, y: event.clientY - 10, city: d.city, avgScore: d.avgScore, nonARate: d.nonARate, total: d.total }
      })
      .on('mouseleave', () => { tooltip.value.visible = false })

    if (isSelected) row.append('rect').attr('x', -labelW).attr('y', y - 2).attr('width', W).attr('height', barH + 4).attr('fill', '#fef9f8').attr('rx', 2)
    row.append('text').attr('x', -6).attr('y', y + barH / 2).attr('text-anchor', 'end').attr('dominant-baseline', 'central')
      .attr('font-size', '10px').attr('font-weight', isSelected ? '700' : '400')
      .attr('fill', isSelected ? 'var(--accent)' : '#666')
      .text(d.city.length > 13 ? d.city.slice(0, 12) + '…' : d.city)
    row.append('rect').attr('x', 0).attr('y', y).attr('width', barW).attr('height', barH).attr('rx', 2)
      .attr('fill', colorScale(d[key])).attr('opacity', isSelected ? 1 : 0.82)
      .attr('stroke', isSelected ? '#333' : 'none').attr('stroke-width', 1.5)
    row.append('text').attr('x', barW + 5).attr('y', y + barH / 2).attr('dominant-baseline', 'central')
      .attr('font-size', '9px').attr('fill', '#bbb').text(key === 'avgScore' ? d.avgScore : d.nonARate + '%')
  })
}

// ── Cross-filter trend line ───────────────────────
function drawTrendLine() {
  if (!trendRef.value) return
  const data = store.monthlyTrend
  const W = Math.max(getW(trendWrap.value, 300), 200)
  const H = 180
  const margin = { top: 12, right: 14, bottom: 36, left: 38 }
  const iW = W - margin.left - margin.right
  const iH = H - margin.top - margin.bottom

  d3.select(trendRef.value).selectAll('*').remove()
  d3.select(trendRef.value).attr('width', W).attr('height', H)

  if (!data.length) {
    d3.select(trendRef.value).append('text').attr('x', W/2).attr('y', H/2).attr('text-anchor', 'middle')
      .attr('font-size', '11px').attr('fill', '#ddd').text('No data')
    return
  }

  const svg = d3.select(trendRef.value)
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  const xScale = d3.scalePoint().domain(data.map(d => d.month)).range([0, iW]).padding(0.1)
  const yVals  = data.map(d => +d.avgScore)
  const yScale = d3.scaleLinear().domain([d3.min(yVals)*0.998, d3.max(yVals)*1.002]).range([iH, 0]).nice()
  const color  = '#2980b9'

  g.append('g').call(d3.axisLeft(yScale).ticks(4).tickSize(-iW).tickFormat(''))
    .call(e => e.select('.domain').remove()).call(e => e.selectAll('line').attr('stroke', '#f5f5f5'))
  g.append('g').attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(xScale).tickValues(data.filter((_, i) => i % 4 === 0).map(d => d.month)).tickFormat(d => d.slice(2, 7)))
    .call(e => e.select('.domain').remove())
    .call(e => e.selectAll('text').attr('font-size', '9px').attr('fill', '#bbb').attr('transform', 'rotate(-30)').attr('text-anchor', 'end'))
  g.append('g').call(d3.axisLeft(yScale).ticks(4))
    .call(e => e.select('.domain').remove()).call(e => e.selectAll('text').attr('font-size', '9px').attr('fill', '#bbb'))

  const area = d3.area().x(d => xScale(d.month)).y0(iH).y1(d => yScale(+d.avgScore)).curve(d3.curveCatmullRom)
  g.append('path').datum(data).attr('fill', color).attr('fill-opacity', 0.07).attr('d', area)

  const line = d3.line().x(d => xScale(d.month)).y(d => yScale(+d.avgScore)).curve(d3.curveCatmullRom)
  const path = g.append('path').datum(data).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2).attr('d', line)
  const len = path.node().getTotalLength()
  path.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
    .transition().duration(700).ease(d3.easeQuadInOut).attr('stroke-dashoffset', 0)

  g.selectAll('circle').data(data).join('circle')
    .attr('cx', d => xScale(d.month)).attr('cy', d => yScale(+d.avgScore))
    .attr('r', 2.5).attr('fill', color).attr('opacity', 0.7)
    .append('title').text(d => `${d.month}: ${d.avgScore}`)
}

// ── Voronoi ───────────────────────────────────────
function drawVoronoi() {
  if (!voroRef.value || !cityGeoData.value.length) return
  const statsMap = {}; store.cityStats.forEach(c => { statsMap[c.city] = c })
  const data = cityGeoData.value.filter(d => statsMap[d.city]).map(d => ({ ...d, ...statsMap[d.city] }))
  if (!data.length) return
  const W = Math.max(getW(voroWrap.value), 300), H = 400

  d3.select(voroRef.value).selectAll('*').remove()
  const svg = d3.select(voroRef.value).attr('width', W).attr('height', H)
  const xScale = d3.scaleLinear().domain([-119.0, -117.6]).range([20, W - 20])
  const yScale = d3.scaleLinear().domain([33.7, 34.85]).range([H - 20, 20])
  const key = voroMode.value
  const vals = data.map(d => d[key])
  const colorScale = key === 'avgScore'
    ? d3.scaleSequential(d3.interpolateRdYlGn).domain([d3.min(vals), d3.max(vals)])
    : d3.scaleSequential(d3.interpolateRdYlGn).domain([d3.max(vals), d3.min(vals)])
  const points = data.map(d => [xScale(d.lon), yScale(d.lat)])
  const delaunay = d3.Delaunay.from(points)
  const voronoi  = delaunay.voronoi([0, 0, W, H])

  svg.append('rect').attr('width', W).attr('height', H).attr('fill', '#fafafa').attr('rx', 6)
  data.forEach((d, i) => {
    const isSelected = store.selectedCity === d.city
    svg.append('path').attr('d', voronoi.renderCell(i))
      .attr('fill', colorScale(d[key])).attr('opacity', isSelected ? 1 : 0.82)
      .attr('stroke', isSelected ? '#333' : 'white').attr('stroke-width', isSelected ? 2 : 0.8)
      .attr('cursor', 'pointer')
      .on('mouseenter', (event) => {
        voroTooltip.value = { visible: true, x: event.clientX + 12, y: event.clientY - 10, city: d.city, avgScore: d.avgScore, nonARate: d.nonARate, total: d.total }
      })
      .on('mouseleave', () => { voroTooltip.value.visible = false })
      .on('click', () => { store.selectedCity = store.selectedCity === d.city ? null : d.city })
  })
  data.forEach(d => {
    svg.append('circle').attr('cx', xScale(d.lon)).attr('cy', yScale(d.lat))
      .attr('r', store.selectedCity === d.city ? 4 : 2.5)
      .attr('fill', store.selectedCity === d.city ? '#c0392b' : '#333').attr('opacity', 0.7).attr('pointer-events', 'none')
  })
  data.filter(d => d.total > 300).forEach(d => {
    svg.append('text').attr('x', xScale(d.lon)).attr('y', yScale(d.lat) - 5)
      .attr('text-anchor', 'middle').attr('font-size', '8px').attr('fill', '#333').attr('pointer-events', 'none').text(d.city)
  })
}

// ── Symbol Map ────────────────────────────────────
function drawSymbolMap() {
  if (!symRef.value || !cityGeoData.value.length) return
  const data = symYearData.value
  if (!data.length) return
  const W = Math.max(getW(symWrap.value), 300), H = 400

  d3.select(symRef.value).selectAll('*').remove()
  const svg = d3.select(symRef.value).attr('width', W).attr('height', H)
  const xScale = d3.scaleLinear().domain([-119.0, -117.6]).range([20, W - 20])
  const yScale = d3.scaleLinear().domain([33.7, 34.85]).range([H - 20, 20])
  const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
    .domain([d3.min(data, d => d.avgScore), d3.max(data, d => d.avgScore)])
  const rScale = d3.scaleSqrt().domain([0, d3.max(data, d => d.total)]).range([3, 28])

  svg.append('rect').attr('width', W).attr('height', H).attr('fill', '#fafafa').attr('rx', 6)
  svg.append('g').selectAll('line').data(d3.range(-119.0, -117.5, 0.3)).join('line')
    .attr('x1', d => xScale(d)).attr('x2', d => xScale(d)).attr('y1', 0).attr('y2', H)
    .attr('stroke', '#ebebeb').attr('stroke-width', 0.5)
  svg.append('g').selectAll('line').data(d3.range(33.7, 34.9, 0.2)).join('line')
    .attr('x1', 0).attr('x2', W).attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
    .attr('stroke', '#ebebeb').attr('stroke-width', 0.5)

  // Year watermark
  svg.append('text').attr('x', W - 10).attr('y', H - 8).attr('text-anchor', 'end')
    .attr('font-size', '36px').attr('font-weight', '800').attr('fill', 'rgba(0,0,0,0.05)').text(symYear.value)

  svg.selectAll('g.city-sym').data([...data].sort((a, b) => b.total - a.total)).join('g')
    .attr('class', 'city-sym')
    .attr('transform', d => `translate(${xScale(d.lon)},${yScale(d.lat)})`)
    .attr('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).select('circle').attr('stroke-width', 2.5).attr('stroke', '#333')
      symTooltip.value = { visible: true, x: event.clientX + 12, y: event.clientY - 10, city: d.city, total: d.total, avgScore: d.avgScore, nonARate: d.nonARate }
    })
    .on('mouseleave', function() {
      d3.select(this).select('circle').attr('stroke-width', 1).attr('stroke', 'rgba(255,255,255,0.8)')
      symTooltip.value.visible = false
    })
    .on('click', (_, d) => { store.selectedCity = store.selectedCity === d.city ? null : d.city })
    .call(g => {
      g.append('circle').attr('r', 0).attr('fill', d => colorScale(d.avgScore))
        .attr('opacity', 0.82).attr('stroke', 'rgba(255,255,255,0.8)').attr('stroke-width', 1)
        .transition().duration(500).attr('r', d => rScale(d.total))
    })
    .call(g => {
      g.filter(d => d.total > 200).append('text').attr('text-anchor', 'middle')
        .attr('dy', d => -rScale(d.total) - 3).attr('font-size', '8px').attr('fill', '#444').text(d => d.city)
    })
}

// ── Wait for real layout width then draw ──────────
function waitAndDraw(wrapRef, drawFn, maxTries = 20) {
  let tries = 0
  const tryDraw = () => {
    tries++
    if (tries > maxTries) return
    const el = wrapRef.value
    if (!el) { requestAnimationFrame(tryDraw); return }
    const w = el.getBoundingClientRect().width
    if (w > 10) {
      drawFn()
    } else {
      requestAnimationFrame(() => requestAnimationFrame(tryDraw))
    }
  }
  requestAnimationFrame(() => requestAnimationFrame(tryDraw))
}

async function loadCityGeo() {
  if (cityGeoData.value.length) return
  try {
    const res = await fetch('./data/city_centroids.json')
    cityGeoData.value = await res.json()
  } catch(e) { console.error(e) }
}

onMounted(async () => {
  await loadCityGeo()

  if (props.section === 'rank') {
    waitAndDraw(chorWrap, drawChoropleth)
    waitAndDraw(trendWrap, drawTrendLine)
    watch([() => store.cityStats, chorMode, () => store.selectedCity], () => nextTick(drawChoropleth))
    watch([() => store.monthlyTrend, () => store.selectedCity], () => nextTick(drawTrendLine))
  } else if (props.section === 'voronoi') {
    waitAndDraw(voroWrap, drawVoronoi)
    watch([() => store.cityStats, voroMode, cityGeoData, () => store.selectedCity], () => nextTick(drawVoronoi))
  } else if (props.section === 'symbol') {
    waitAndDraw(symWrap, drawSymbolMap)
    watch([symYearData, cityGeoData, () => store.selectedCity], () => nextTick(drawSymbolMap))
  }
})
</script>

<style scoped>
.tri-layout {
  display: grid;
  grid-template-columns: 1fr 280px 220px;
  gap: 24px;
  align-items: start;
}
.tri-chart { min-height: 300px; }
.tri-trend { }
@media (max-width: 900px) {
  .tri-layout { grid-template-columns: 1fr; }
}
</style>
