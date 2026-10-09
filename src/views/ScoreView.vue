<template>
  <div class="page-body">
    <div class="viz-section">
      <div class="viz-section-title">Risk vs. Score Analysis</div>
      <div class="viz-controls">
        <div class="radio-group">
          <label><input type="radio" v-model="viewMode" value="bars"> Bar Chart</label>
          <label><input type="radio" v-model="viewMode" value="scatter"> Scatter Plot</label>
        </div>
      </div>
      <div class="viz-row wide">
        <div class="viz-chart-area" ref="chartWrap">
          <svg ref="chartRef" style="display:block;"></svg>
        </div>
        <div class="viz-description">
          <p>
            This chart compares average inspection scores across
            different risk levels and cities. High-risk restaurants
            tend to show higher score variance.
            The scatter view reveals whether a city's inspection
            volume correlates with its compliance quality.
            Click any bar or dot to filter all views to that city.
          </p>
        </div>
      </div>

      <!-- Summary cards -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:32px;">
        <div v-for="r in store.riskStats" :key="r.riskLevel"
          style="border:1px solid var(--border);border-radius:8px;padding:18px 20px;">
          <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-light);margin-bottom:6px;">
            {{ r.riskLevel }}
          </div>
          <div style="font-size:1.8rem;font-weight:700;">{{ r.avgScore }}</div>
          <div style="font-size:.78rem;color:var(--text-mid);margin-top:4px;">
            Avg Score · {{ r.total?.toLocaleString() }} inspections
          </div>
          <div style="font-size:.75rem;margin-top:6px;"
            :style="{ color: parseFloat(r.nonARate) > 5 ? '#c0392b' : '#27ae60' }">
            Non-A Rate: {{ r.nonARate }}%
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import * as d3 from 'd3'
import { useDataStore } from '@/stores/data'

defineProps({ section: { type: String, default: 'risk' } })
const store = useDataStore()

const chartRef  = ref(null)
const chartWrap = ref(null)
const viewMode  = ref('bars')

const riskColors = {
  'High Risk':     '#c0392b',
  'Moderate Risk': '#f39c12',
  'Low Risk':      '#27ae60',
  'Specialized':   '#2980b9',
}

function getW(wrap, fallback = 700) {
  if (!wrap) return fallback
  const r = wrap.getBoundingClientRect()
  return r.width > 10 ? r.width : (wrap.clientWidth || fallback)
}

function drawBars() {
  if (!chartRef.value) return
  const W = Math.max(getW(chartWrap.value), 300)

  const cityMap = {}
  store.filteredData.forEach(r => {
    const c = r._city
    if (!cityMap[c]) cityMap[c] = { city: c, total: 0, scoreSum: 0, nonA: 0, risk: r._riskLevel }
    cityMap[c].total++
    cityMap[c].scoreSum += r._score
    if (r['GRADE'] !== 'A') cityMap[c].nonA++
  })

  const cities = Object.values(cityMap)
    .filter(c => c.total >= 20)
    .map(c => ({ ...c, avgScore: +(c.scoreSum / c.total).toFixed(1) }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 30)

  if (!cities.length) return

  const barH = 22, gap = 3, labelW = 130, barMaxW = W - labelW - 70
  const H = cities.length * (barH + gap) + 50

  d3.select(chartRef.value).selectAll('*').remove()
  const svg = d3.select(chartRef.value).attr('width', W).attr('height', H)

  const xMin = d3.min(cities, d => d.avgScore) * 0.99
  const xMax = d3.max(cities, d => d.avgScore)
  const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, barMaxW])

  const g = svg.append('g').attr('transform', `translate(${labelW},28)`)
  svg.append('text').attr('x', labelW).attr('y', 16)
    .attr('font-size', '10px').attr('fill', '#ccc').text('← Lower    Higher →')

  cities.forEach((d, i) => {
    const y = i * (barH + gap)
    const barW = xScale(d.avgScore)
    const isSelected = store.selectedCity === d.city
    const color = riskColors[d.risk] || '#888'

    const row = g.append('g').attr('cursor', 'pointer')
      .on('click', () => { store.selectedCity = store.selectedCity === d.city ? null : d.city })

    if (isSelected) {
      row.append('rect').attr('x', -labelW).attr('y', y - 2)
        .attr('width', W).attr('height', barH + 4).attr('fill', '#fef9f8').attr('rx', 2)
    }

    row.append('text').attr('x', -6).attr('y', y + barH / 2)
      .attr('text-anchor', 'end').attr('dominant-baseline', 'central')
      .attr('font-size', '10px').attr('font-weight', isSelected ? '700' : '400')
      .attr('fill', isSelected ? 'var(--accent)' : '#666')
      .text(d.city.length > 14 ? d.city.slice(0, 13) + '…' : d.city)

    row.append('rect').attr('x', 0).attr('y', y).attr('width', 0)
      .attr('height', barH).attr('rx', 2).attr('fill', color).attr('opacity', 0.85)
      .transition().duration(600).delay(i * 12).attr('width', Math.max(barW, 2))

    row.append('text').attr('x', Math.max(barW, 2) + 5).attr('y', y + barH / 2)
      .attr('dominant-baseline', 'central').attr('font-size', '9px').attr('fill', '#bbb')
      .attr('opacity', 0).text(d.avgScore)
      .transition().delay(i * 12 + 500).attr('opacity', 1)
  })
}

function drawScatter() {
  if (!chartRef.value) return
  const W = Math.max(getW(chartWrap.value), 300)
  const H = 360
  const margin = { top: 20, right: 20, bottom: 50, left: 60 }
  const iW = W - margin.left - margin.right
  const iH = H - margin.top - margin.bottom

  const cityMap = {}
  store.filteredData.forEach(r => {
    const c = r._city
    if (!cityMap[c]) cityMap[c] = { city: c, total: 0, scoreSum: 0, risk: r._riskLevel }
    cityMap[c].total++
    cityMap[c].scoreSum += r._score
  })
  const data = Object.values(cityMap)
    .filter(c => c.total >= 10)
    .map(c => ({ ...c, avgScore: +(c.scoreSum / c.total).toFixed(1) }))

  if (!data.length) return

  d3.select(chartRef.value).selectAll('*').remove()
  const svg = d3.select(chartRef.value).attr('width', W).attr('height', H)
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const xScale = d3.scaleLog()
    .domain([d3.min(data, d => d.total), d3.max(data, d => d.total)])
    .range([0, iW]).nice()
  const yScale = d3.scaleLinear()
    .domain([d3.min(data, d => d.avgScore) * 0.998, 101])
    .range([iH, 0]).nice()

  g.append('g').call(d3.axisLeft(yScale).ticks(6).tickSize(-iW).tickFormat(''))
    .call(e => e.select('.domain').remove())
    .call(e => e.selectAll('line').attr('stroke', '#f0f0f0'))
  g.append('g').attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(xScale).ticks(5, '~s'))
    .call(e => e.select('.domain').remove())
    .call(e => e.selectAll('text').attr('font-size', '10px').attr('fill', '#bbb'))
  g.append('g').call(d3.axisLeft(yScale).ticks(6))
    .call(e => e.select('.domain').remove())
    .call(e => e.selectAll('text').attr('font-size', '10px').attr('fill', '#bbb'))

  g.append('text').attr('x', iW / 2).attr('y', iH + 36)
    .attr('text-anchor', 'middle').attr('font-size', '11px').attr('fill', '#aaa')
    .text('Inspection Count (log scale)')
  g.append('text').attr('transform', 'rotate(-90)').attr('x', -iH / 2).attr('y', -44)
    .attr('text-anchor', 'middle').attr('font-size', '11px').attr('fill', '#aaa')
    .text('Avg Score')

  g.selectAll('circle').data(data).join('circle')
    .attr('cx', d => xScale(d.total))
    .attr('cy', d => yScale(d.avgScore))
    .attr('r', 0)
    .attr('fill', d => riskColors[d.risk] || '#888')
    .attr('opacity', 0.75)
    .attr('stroke', d => store.selectedCity === d.city ? '#333' : 'white')
    .attr('stroke-width', d => store.selectedCity === d.city ? 2 : 1)
    .attr('cursor', 'pointer')
    .on('click', (_, d) => { store.selectedCity = store.selectedCity === d.city ? null : d.city })
    .transition().duration(500).attr('r', 6)

  g.selectAll('text.lbl').data(data.filter(d => d.total > 500)).join('text')
    .attr('class', 'lbl')
    .attr('x', d => xScale(d.total) + 8)
    .attr('y', d => yScale(d.avgScore) + 4)
    .attr('font-size', '8px').attr('fill', '#888')
    .text(d => d.city)
}

function drawChart() {
  if (viewMode.value === 'bars') drawBars()
  else drawScatter()
}

function waitAndDraw(wrapRef, drawFn) {
  let tries = 0
  const tryDraw = () => {
    tries++
    if (tries > 20) return
    const el = wrapRef.value
    if (!el) { requestAnimationFrame(tryDraw); return }
    const w = el.getBoundingClientRect().width
    if (w > 10) drawFn()
    else requestAnimationFrame(() => requestAnimationFrame(tryDraw))
  }
  requestAnimationFrame(() => requestAnimationFrame(tryDraw))
}

onMounted(() => {
  waitAndDraw(chartWrap, drawChart)
  watch([() => store.filteredData, viewMode, () => store.selectedCity], () => nextTick(drawChart))
})
</script>