<template>
  <div class="page-body">

    <!-- ══ TREND ══ -->
    <template v-if="section === 'trend'">
      <div class="viz-section">
        <div class="viz-section-title">
          Monthly Compliance Trend
          <span v-if="store.selectedCity" style="font-size:.78rem;font-weight:400;color:var(--accent);margin-left:10px;">
            — {{ store.selectedCity }}
            <span style="cursor:pointer;font-size:.72rem;margin-left:4px;" @click="store.selectedCity = null">[clear]</span>
          </span>
        </div>
        <div class="viz-controls">
          <div class="radio-group">
            <label><input type="radio" v-model="trendMode" value="score"> Avg Score</label>
            <label><input type="radio" v-model="trendMode" value="nonA"> Non-A Rate %</label>
          </div>
          <button class="toggle-pill" style="margin-left:auto;" @click="replayChart">
            <i class="bi bi-play-fill"></i> Replay
          </button>
        </div>
        <div class="viz-row wide">
          <div class="viz-chart-area" ref="chartWrap">
            <svg ref="chartRef" style="display:block;"></svg>
            <div v-if="!store.monthlyTrend.length" style="padding:40px;text-align:center;color:var(--text-light);font-size:.85rem;">No data for current filters</div>
          </div>
          <div class="viz-description">
            <p>
              This line chart tracks the monthly average health inspection score
              (or non-A rate) across LA County restaurants over time.
              An animated draw-on effect reveals the trend left to right —
              click <em>Replay</em> to re-animate.
              If a city is selected via the Analytics page, the chart
              automatically filters to show only that city's compliance history.
              Hover over the chart to see exact monthly values.
            </p>
          </div>
        </div>
      </div>
    </template>

    <!-- ══ DISTRIBUTION ══ -->
    <template v-if="section === 'dist'">
      <div class="viz-section">
        <div class="viz-section-title">Score Distribution by Grade</div>
        <div class="viz-row wide">
          <div class="viz-chart-area" ref="boxWrap">
            <svg ref="boxRef" style="display:block;"></svg>
          </div>
          <div class="viz-description">
            <p>
              This box plot compares the statistical spread of inspection
              scores across Grade A, B, and C restaurants.
              The <strong>box</strong> spans the 25th–75th percentile (IQR),
              the <strong>horizontal line</strong> marks the median,
              the <strong>open circle</strong> marks the mean, and
              <strong>whiskers</strong> extend to the 5th and 95th percentiles.
              Even within Grade A there is meaningful variance — some restaurants
              pass with a perfect 100, while others barely clear the threshold.
            </p>
          </div>
        </div>
      </div>
    </template>

    <!-- ══ TREEMAP ══ -->
    <template v-if="section === 'cities'">
      <div class="viz-section">
        <div class="viz-section-title">Cities by Inspection Volume &amp; Score</div>
        <div class="year-slider-wrap">
          <div class="year-slider-label">Year: <strong>{{ treeYear }}</strong></div>
          <input type="range" class="year-slider" :min="2023" :max="2025" v-model.number="treeYear" step="1" />
          <div style="display:flex;justify-content:space-between;width:300px;font-size:.72rem;color:var(--text-light);">
            <span>2023</span><span>2024</span><span>2025</span>
          </div>
        </div>
        <div class="viz-controls">
          <div class="radio-group">
            <label><input type="radio" v-model="treeColorBy" value="avgScore"> Color by Avg Score</label>
            <label><input type="radio" v-model="treeColorBy" value="nonARate"> Color by Non-A Rate</label>
          </div>
          <span style="font-size:.74rem;color:var(--text-light);margin-left:auto;">Click a city to filter all views</span>
        </div>
        <div class="viz-row wide">
          <div class="viz-chart-area" ref="treeWrap" style="position:relative;">
            <svg ref="treeRef" style="display:block;"></svg>
            <div class="viz-tooltip" v-show="treeTooltip.visible"
              :style="{ left: treeTooltip.x + 'px', top: treeTooltip.y + 'px' }">
              <strong>{{ treeTooltip.city }}</strong>
              {{ treeYear }} Inspections: {{ treeTooltip.total }}<br>
              Avg Score: {{ treeTooltip.avgScore }}<br>
              Non-A Rate: {{ treeTooltip.nonARate }}%
            </div>
          </div>
          <div class="viz-description">
            <p>
              The treemap shows all LA County cities with inspection data
              for the <strong>selected year</strong> — drag the slider above
              to see how city-level patterns shift over time.
              Rectangle <strong>size</strong> is proportional to the total
              number of inspections. Rectangle <strong>color</strong> encodes
              either average score (green = high) or non-A rate (green = low).
              Click any city to cross-filter all other views.
            </p>
            <div style="margin-top:16px;font-size:.76rem;color:var(--text-mid);">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                <svg width="80" height="10"><defs><linearGradient id="tleg2" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#c0392b"/><stop offset="50%" stop-color="#f39c12"/><stop offset="100%" stop-color="#27ae60"/></linearGradient></defs><rect x="0" y="0" width="80" height="10" rx="2" fill="url(#tleg2)"/></svg>
                Red → Yellow → Green
              </div>
              <div>Box size = inspection count</div>
            </div>
          </div>
        </div>
      </div>
    </template>

  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import * as d3 from 'd3'
import { useDataStore } from '@/stores/data'

const props = defineProps({ section: { type: String, default: 'trend' } })
const store = useDataStore()

const chartRef = ref(null); const chartWrap = ref(null)
const boxRef   = ref(null); const boxWrap   = ref(null)
const treeRef  = ref(null); const treeWrap  = ref(null)
const trendMode   = ref('score')
const treeColorBy = ref('avgScore')
const treeYear    = ref(2024)
const treeTooltip = ref({ visible: false, x: 0, y: 0, city: '', total: 0, avgScore: 0, nonARate: 0 })

let ro = null  // ResizeObserver

// ── Reliable width getter ──────────────────────────
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

// ── Year-filtered treemap data ─────────────────────
// Computed from all data (no cityGeoData dependency for treemap)
const treeYearStats = computed(() => {
  const yearStr = String(treeYear.value)
  const map = {}
  store.allData.filter(r => r._year === yearStr).forEach(r => {
    if (!map[r._city]) map[r._city] = { city: r._city, total: 0, scoreSum: 0, nonA: 0 }
    map[r._city].total++
    map[r._city].scoreSum += r._score
    if (r['GRADE'] !== 'A') map[r._city].nonA++
  })
  return Object.values(map)
    .filter(c => c.total >= 3)
    .map(c => ({
      ...c,
      avgScore: +(c.scoreSum / c.total).toFixed(2),
      nonARate: +(c.nonA / c.total * 100).toFixed(1),
    }))
})

// ── Line Chart ─────────────────────────────────────
function drawChart(animate = true) {
  const data = store.monthlyTrend
  if (!chartRef.value) return
  const W = Math.max(getW(chartWrap.value), 300)
  const H = 280
  const margin = { top: 20, right: 24, bottom: 44, left: 52 }
  const iW = W - margin.left - margin.right
  const iH = H - margin.top - margin.bottom

  d3.select(chartRef.value).selectAll('*').remove()
  d3.select(chartRef.value).attr('width', W).attr('height', H)

  if (!data.length) return

  const svg = d3.select(chartRef.value)
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  const xScale = d3.scalePoint().domain(data.map(d => d.month)).range([0, iW]).padding(0.1)
  const yKey = trendMode.value === 'score' ? 'avgScore' : 'nonARate'
  const yVals = data.map(d => +d[yKey])
  const yScale = d3.scaleLinear().domain([d3.min(yVals)*0.995, d3.max(yVals)*1.005]).range([iH, 0]).nice()
  const color = trendMode.value === 'score' ? '#2980b9' : '#c0392b'

  g.append('g').call(d3.axisLeft(yScale).ticks(5).tickSize(-iW).tickFormat(''))
    .call(e => e.select('.domain').remove())
    .call(e => e.selectAll('line').attr('stroke', '#f0f0f0'))
  g.append('g').attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(xScale).tickValues(data.filter((_, i) => i % 3 === 0).map(d => d.month)).tickFormat(d => d.slice(0, 7)))
    .call(e => e.select('.domain').remove())
    .call(e => e.selectAll('text').attr('font-size', '10px').attr('fill', '#bbb').attr('transform', 'rotate(-30)').attr('text-anchor', 'end'))
  g.append('g').call(d3.axisLeft(yScale).ticks(5))
    .call(e => e.select('.domain').remove())
    .call(e => e.selectAll('text').attr('font-size', '10px').attr('fill', '#bbb'))

  const area = d3.area().x(d => xScale(d.month)).y0(iH).y1(d => yScale(+d[yKey])).curve(d3.curveCatmullRom)
  g.append('path').datum(data).attr('fill', color).attr('fill-opacity', 0.07).attr('d', area)

  const line = d3.line().x(d => xScale(d.month)).y(d => yScale(+d[yKey])).curve(d3.curveCatmullRom)
  const path = g.append('path').datum(data).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2.5).attr('d', line)

  if (animate) {
    const len = path.node().getTotalLength()
    path.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
      .transition().duration(1400).ease(d3.easeQuadInOut).attr('stroke-dashoffset', 0)
  }

  const dots = g.selectAll('circle').data(data).join('circle')
    .attr('cx', d => xScale(d.month)).attr('cy', d => yScale(+d[yKey]))
    .attr('r', 3.5).attr('fill', color).attr('opacity', animate ? 0 : 0.8)
  if (animate) dots.transition().delay(1300).duration(300).attr('opacity', 0.8)
  dots.append('title').text(d => `${d.month}: ${d[yKey]}`)

  const hoverLine = g.append('line').attr('stroke', '#ccc').attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,2').attr('y1', 0).attr('y2', iH).attr('opacity', 0)
  g.append('rect').attr('width', iW).attr('height', iH).attr('fill', 'transparent')
    .on('mousemove', (event) => {
      const [mx] = d3.pointer(event)
      const idx = Math.round(mx / (iW / Math.max(data.length - 1, 1)))
      const d = data[Math.max(0, Math.min(idx, data.length - 1))]
      if (d) hoverLine.attr('x1', xScale(d.month)).attr('x2', xScale(d.month)).attr('opacity', 0.5)
    })
    .on('mouseleave', () => hoverLine.attr('opacity', 0))
}
function replayChart() { drawChart(true) }

// ── Box Plot ───────────────────────────────────────
function drawBoxPlot() {
  const data = store.filteredData
  if (!boxRef.value) return
  const W = Math.max(getW(boxWrap.value), 300)
  const H = 260
  const margin = { top: 24, right: 40, bottom: 40, left: 52 }
  const iW = W - margin.left - margin.right
  const iH = H - margin.top - margin.bottom
  const grades = ['A', 'B', 'C']
  const grouped = {}; grades.forEach(g => { grouped[g] = [] })
  data.forEach(r => { if (grouped[r['GRADE']] !== undefined) grouped[r['GRADE']].push(r._score) })

  d3.select(boxRef.value).selectAll('*').remove()
  d3.select(boxRef.value).attr('width', W).attr('height', H)

  if (!data.length) return

  const svg = d3.select(boxRef.value)
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  const xScale = d3.scaleBand().domain(grades).range([0, iW]).padding(0.5)
  const yScale = d3.scaleLinear().domain([60, 106]).range([iH, 0])
  const colors = { A: '#27ae60', B: '#f39c12', C: '#c0392b' }
  const labels = { A: 'Grade A', B: 'Grade B', C: 'Grade C' }

  g.append('g').call(d3.axisLeft(yScale).ticks(6).tickSize(-iW).tickFormat(''))
    .call(e => e.select('.domain').remove())
    .call(e => e.selectAll('line').attr('stroke', '#f0f0f0'))
  g.append('g').attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(xScale).tickFormat(d => labels[d]))
    .call(e => e.select('.domain').remove())
    .call(e => e.selectAll('text').attr('font-size', '13px').attr('font-weight', '600').attr('fill', d => colors[d]))
  g.append('g').call(d3.axisLeft(yScale).ticks(6))
    .call(e => e.select('.domain').remove())
    .call(e => e.selectAll('text').attr('font-size', '10px').attr('fill', '#bbb'))

  grades.forEach(grade => {
    const vals = grouped[grade].sort(d3.ascending)
    if (vals.length < 4) return
    const q1=d3.quantile(vals,0.25), med=d3.quantile(vals,0.5), q3=d3.quantile(vals,0.75)
    const p5=d3.quantile(vals,0.05), p95=d3.quantile(vals,0.95), mean=d3.mean(vals)
    const cx=xScale(grade)+xScale.bandwidth()/2, bw=xScale.bandwidth(), color=colors[grade]

    // Whiskers
    g.append('line').attr('x1',cx).attr('x2',cx).attr('y1',yScale(p95)).attr('y2',yScale(q3)).attr('stroke',color).attr('stroke-width',1.5).attr('opacity',0.5)
    g.append('line').attr('x1',cx).attr('x2',cx).attr('y1',yScale(q1)).attr('y2',yScale(p5)).attr('stroke',color).attr('stroke-width',1.5).attr('opacity',0.5)
    ;[[p95],[p5]].forEach(([v]) => g.append('line').attr('x1',cx-bw*.3).attr('x2',cx+bw*.3).attr('y1',yScale(v)).attr('y2',yScale(v)).attr('stroke',color).attr('stroke-width',1.5).attr('opacity',0.4))
    // Box
    g.append('rect').attr('x',xScale(grade)).attr('y',yScale(q3)).attr('width',bw).attr('height',yScale(q1)-yScale(q3))
      .attr('fill',color).attr('fill-opacity',0).attr('stroke',color).attr('stroke-width',2).attr('rx',3)
      .transition().duration(600).delay(200).attr('fill-opacity',0.18)
    // Median
    g.append('line').attr('x1',xScale(grade)).attr('x2',xScale(grade)+bw).attr('y1',yScale(med)).attr('y2',yScale(med))
      .attr('stroke',color).attr('stroke-width',3).attr('opacity',0)
      .transition().duration(400).delay(600).attr('opacity',1)
    // Mean dot
    g.append('circle').attr('cx',cx).attr('cy',yScale(mean)).attr('r',5)
      .attr('fill','white').attr('stroke',color).attr('stroke-width',2).attr('opacity',0)
      .transition().duration(300).delay(700).attr('opacity',1)
    // Labels
    g.append('text').attr('x',cx+bw*.55).attr('y',yScale(med)+4).attr('font-size','10px').attr('fill',color).attr('font-weight','700').text(`Med: ${med?.toFixed(1)}`)
    g.append('text').attr('x',cx+bw*.55).attr('y',yScale(mean)+4).attr('font-size','9px').attr('fill','#bbb').text(`Avg: ${mean?.toFixed(1)}`)
    g.append('text').attr('x',cx).attr('y',-6).attr('text-anchor','middle').attr('font-size','9px').attr('fill','#bbb').text(`n=${vals.length.toLocaleString()}`)
  })
}

// ── Treemap ────────────────────────────────────────
function drawTreemap() {
  const data = treeYearStats.value
  if (!treeRef.value) return
  const W = Math.max(getW(treeWrap.value), 300)
  const H = 480

  d3.select(treeRef.value).selectAll('*').remove()
  d3.select(treeRef.value).attr('width', W).attr('height', H)

  if (!data.length) return

  const svg = d3.select(treeRef.value)
  const key = treeColorBy.value
  const vals = data.map(d => d[key])
  const vMin = d3.min(vals), vMax = d3.max(vals)
  const colorScale = key === 'avgScore'
    ? d3.scaleSequential(d3.interpolateRdYlGn).domain([vMin, vMax])
    : d3.scaleSequential(d3.interpolateRdYlGn).domain([vMax, vMin])
  const root = d3.hierarchy({ children: data }).sum(d => d.total).sort((a, b) => b.value - a.value)
  d3.treemap().size([W, H]).padding(2).round(true)(root)

  svg.append('text').attr('x', W - 12).attr('y', H - 10).attr('text-anchor', 'end')
    .attr('font-size', '60px').attr('font-weight', '800').attr('fill', 'rgba(0,0,0,0.04)').text(treeYear.value)

  const leaf = svg.selectAll('g').data(root.leaves()).join('g')
    .attr('transform', d => `translate(${d.x0},${d.y0})`).attr('cursor', 'pointer')
    .on('mouseenter', (event, d) => {
      treeTooltip.value = { visible: true, x: event.clientX + 12, y: event.clientY - 10, city: d.data.city, total: d.data.total, avgScore: d.data.avgScore, nonARate: d.data.nonARate }
    })
    .on('mouseleave', () => { treeTooltip.value.visible = false })
    .on('click', (_, d) => { store.selectedCity = store.selectedCity === d.data.city ? null : d.data.city })

  leaf.append('rect')
    .attr('width', d => Math.max(0, d.x1 - d.x0)).attr('height', d => Math.max(0, d.y1 - d.y0))
    .attr('fill', d => colorScale(d.data[key]))
    .attr('opacity', d => store.selectedCity === d.data.city ? 1 : 0.85)
    .attr('stroke', d => store.selectedCity === d.data.city ? '#333' : 'white')
    .attr('stroke-width', d => store.selectedCity === d.data.city ? 2 : 0.5).attr('rx', 2)
  leaf.filter(d => (d.x1 - d.x0) > 40 && (d.y1 - d.y0) > 22)
    .append('text').attr('x', 5).attr('y', 14)
    .attr('font-size', d => (d.x1 - d.x0) > 80 ? '11px' : '8px')
    .attr('fill', '#222').attr('font-weight', '600').text(d => d.data.city)
  leaf.filter(d => (d.x1 - d.x0) > 50 && (d.y1 - d.y0) > 36)
    .append('text').attr('x', 5).attr('y', 28).attr('font-size', '9px').attr('fill', 'rgba(0,0,0,0.5)')
    .text(d => key === 'avgScore' ? d.data.avgScore : d.data.nonARate + '%')
}

// ── Wait for element to have real width, then draw ──
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

onMounted(() => {
  if (props.section === 'trend') {
    waitAndDraw(chartWrap, () => drawChart(true))
    watch([() => store.monthlyTrend, trendMode], () => nextTick(() => drawChart(true)))
  } else if (props.section === 'dist') {
    waitAndDraw(boxWrap, drawBoxPlot)
    watch(() => store.filteredData, () => nextTick(drawBoxPlot))
  } else if (props.section === 'cities') {
    waitAndDraw(treeWrap, drawTreemap)
    watch([treeYearStats, treeColorBy, () => store.selectedCity], () => nextTick(drawTreemap))
  }
})
</script>
