<template>
  <div class="page-body">
    <div style="margin-bottom:24px;">
      <h1 style="font-size:1.3rem;font-weight:700;margin-bottom:6px;">Restaurant Inspections</h1>
      <p style="font-size:0.83rem;color:var(--text-mid);">
        Browse all LA County restaurant inspection records. Use filters to narrow by year, grade, risk level, or city. Click any row to see full inspection history, score trend, and location.
      </p>
    </div>

    <!-- Filters -->
    <div class="page-filter-bar">
      <label>Year</label>
      <select class="pf-select" v-model="store.filterYear">
        <option value="all">All years</option>
        <option value="2023">2023</option>
        <option value="2024">2024</option>
        <option value="2025">2025</option>
      </select>

      <label>Grade</label>
      <select class="pf-select" v-model="store.filterGrade">
        <option value="all">All grades</option>
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
      </select>

      <label>Risk</label>
      <select class="pf-select" v-model="store.filterRisk">
        <option value="all">All risk levels</option>
        <option value="High Risk">High Risk</option>
        <option value="Moderate Risk">Moderate Risk</option>
        <option value="Low Risk">Low Risk</option>
      </select>

      <div style="display:flex;align-items:center;gap:6px;">
        <i class="bi bi-search" style="font-size:.78rem;color:var(--text-light);"></i>
        <input class="pf-select" style="min-width:200px;" v-model="nameSearch" placeholder="Search restaurant name…" @input="curPage = 1" />
      </div>

      <div class="pf-city-badge" v-if="store.selectedCity">
        <i class="bi bi-geo-alt-fill" style="font-size:.72rem;"></i>
        {{ store.selectedCity }}
        <button class="pf-city-clear" @click="store.selectedCity = null">×</button>
      </div>

      <span class="pf-count"><strong>{{ filtered.length.toLocaleString() }}</strong> records</span>

      <button class="pf-reset" @click="store.resetFilters(); nameSearch = ''">
        <i class="bi bi-x-circle"></i> Reset
      </button>
    </div>

    <!-- Table -->
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;">
      <table class="data-table">
        <thead>
          <tr>
            <th @click="setSort('FACILITY NAME')">Restaurant <i :class="sortIcon('FACILITY NAME')"></i></th>
            <th>Address</th>
            <th @click="setSort('FACILITY CITY')">City <i :class="sortIcon('FACILITY CITY')"></i></th>
            <th @click="setSort('GRADE')">Grade <i :class="sortIcon('GRADE')"></i></th>
            <th @click="setSort('_score')">Score <i :class="sortIcon('_score')"></i></th>
            <th>Risk</th>
            <th @click="setSort('ACTIVITY DATE')">Date <i :class="sortIcon('ACTIVITY DATE')"></i></th>
            <th @click="setSort('_inspCount')" style="text-align:center;">History <i :class="sortIcon('_inspCount')"></i></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in paginated" :key="r['RECORD ID']" class="clickable-row" @click="openDetails(r)">
            <td style="font-weight:600;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ r['FACILITY NAME'] }}</td>
            <td style="max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-mid);">{{ r['FACILITY ADDRESS'] }}</td>
            <td>{{ r['FACILITY CITY'] }}</td>
            <td><span :class="'badge-' + (r['GRADE'] || '').toLowerCase()">{{ r['GRADE'] }}</span></td>
            <td style="font-weight:700;" :style="{ color: r['GRADE']==='A' ? '#27ae60' : r['GRADE']==='B' ? '#f39c12' : '#c0392b' }">{{ r['SCORE'] }}</td>
            <td style="font-size:.72rem;color:var(--text-mid);">{{ store.riskShort(r['PE DESCRIPTION']) }}</td>
            <td style="color:var(--text-mid);">{{ r['ACTIVITY DATE'] }}</td>
            <td style="text-align:center;">
              <span class="insp-count-pill">{{ store.inspectionCountsByFacility[r['FACILITY ID']] || 1 }}</span>
            </td>
          </tr>
          <tr v-if="paginated.length === 0">
            <td colspan="8" style="text-align:center;padding:32px;color:var(--text-light);">No results found.</td>
          </tr>
        </tbody>
      </table>

      <div style="padding:12px 16px;border-top:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <button class="pg-btn" @click="curPage = Math.max(1, curPage - 1)"><i class="bi bi-chevron-left"></i></button>
          <button v-for="p in pageNums" :key="p" class="pg-btn" :class="{ on: p === curPage }" @click="curPage = p">{{ p }}</button>
          <button class="pg-btn" @click="curPage = Math.min(totalPages, curPage + 1)"><i class="bi bi-chevron-right"></i></button>
          <span style="font-size:.74rem;color:var(--text-light);margin-left:6px;">Page {{ curPage }} of {{ totalPages }}</span>
        </div>
      </div>
    </div>

    <!-- ═════════════ Inspection Details Modal ═════════════ -->
    <div v-if="detailsFacility" class="rd-modal-backdrop" @click.self="closeDetails">
      <div class="rd-modal">
        <!-- Header -->
        <div class="rd-header">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <h2 style="font-size:1.15rem;font-weight:700;margin:0;">{{ detailsFacility.name }}</h2>
              <span :class="'badge-' + (detailsFacility.latestGrade || '').toLowerCase()" style="font-size:.85rem;">{{ detailsFacility.latestGrade }}</span>
            </div>
            <div style="font-size:.78rem;color:var(--text-mid);">
              <i class="bi bi-geo-alt" style="margin-right:4px;"></i>{{ detailsFacility.address }}, {{ detailsFacility.city }} {{ detailsFacility.zip }}
            </div>
            <div style="font-size:.72rem;color:var(--text-light);margin-top:2px;">
              Facility ID: <strong>{{ detailsFacility.id }}</strong>
              <span v-if="detailsFacility.owner" style="margin-left:12px;">Owner: {{ detailsFacility.owner }}</span>
            </div>
          </div>
          <button class="rd-close" @click="closeDetails" title="Close"><i class="bi bi-x-lg"></i></button>
        </div>

        <!-- Stat cards row -->
        <div class="rd-stats-row">
          <div class="rd-stat">
            <div class="rd-stat-label">Latest Grade</div>
            <div class="rd-stat-value" :style="{ color: gradeTextColor(detailsFacility.latestGrade) }">{{ detailsFacility.latestGrade }}</div>
          </div>
          <div class="rd-stat">
            <div class="rd-stat-label">Latest Score</div>
            <div class="rd-stat-value" :style="{ color: gradeTextColor(detailsFacility.latestGrade) }">{{ detailsFacility.latestScore }}</div>
          </div>
          <div class="rd-stat">
            <div class="rd-stat-label">Avg Score</div>
            <div class="rd-stat-value">{{ detailsFacility.avgScore }}</div>
          </div>
          <div class="rd-stat">
            <div class="rd-stat-label">Inspections</div>
            <div class="rd-stat-value">{{ detailsFacility.history.length }}</div>
          </div>
          <div class="rd-stat">
            <div class="rd-stat-label">Risk Level</div>
            <div class="rd-stat-value" style="font-size:.95rem;">{{ detailsFacility.risk || '—' }}</div>
          </div>
        </div>

        <!-- Two columns: trend chart + mini map -->
        <div class="rd-grid">
          <!-- D3 Trend chart -->
          <div class="rd-panel">
            <div class="rd-panel-title">
              <i class="bi bi-graph-up" style="color:var(--orange);margin-right:5px;"></i>
              Score History
              <span v-if="detailsFacility.history.length < 2" style="font-size:.7rem;color:var(--text-light);font-weight:400;margin-left:6px;">(single inspection)</span>
            </div>
            <svg ref="trendSvg" class="rd-trend-svg"></svg>
          </div>

          <!-- Leaflet mini-map -->
          <div class="rd-panel">
            <div class="rd-panel-title">
              <i class="bi bi-pin-map" style="color:var(--orange);margin-right:5px;"></i>
              Location
              <button class="rd-map-btn" @click="viewOnBigMap">
                View on Map <i class="bi bi-arrow-right"></i>
              </button>
            </div>
            <div ref="miniMapEl" class="rd-mini-map">
              <div v-if="!detailsFacility.lat || !detailsFacility.lon" class="rd-no-geo">
                <i class="bi bi-geo-alt-fill" style="font-size:1.4rem;color:var(--text-light);"></i>
                <div style="margin-top:6px;">No coordinates available</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Inspection history sub-table -->
        <div class="rd-panel" style="margin-top:14px;">
          <div class="rd-panel-title">
            <i class="bi bi-list-check" style="color:var(--orange);margin-right:5px;"></i>
            Full Inspection History
          </div>
          <div class="rd-history-table-wrap">
            <table class="rd-history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Grade</th>
                  <th>Risk</th>
                  <th>Service</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in detailsFacility.history" :key="h['RECORD ID']">
                  <td>{{ h['ACTIVITY DATE'] }}</td>
                  <td style="font-weight:700;" :style="{ color: gradeTextColor(h['GRADE']) }">{{ h['SCORE'] }}</td>
                  <td><span :class="'badge-' + (h['GRADE'] || '').toLowerCase()">{{ h['GRADE'] }}</span></td>
                  <td style="font-size:.72rem;color:var(--text-mid);">{{ store.riskShort(h['PE DESCRIPTION']) }}</td>
                  <td style="font-size:.72rem;color:var(--text-mid);">{{ h['SERVICE DESCRIPTION'] || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import * as d3 from 'd3'
import { useDataStore } from '@/stores/data'

const store = useDataStore()
const router = useRouter()
const PER_PAGE = 20
const curPage = ref(1)
const nameSearch = ref('')
const sortKey = ref('_score')
const sortDir = ref('desc')

function setSort(key) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = key; sortDir.value = 'desc' }
  curPage.value = 1
}
function sortIcon(key) {
  if (sortKey.value !== key) return 'bi bi-chevron-expand'
  return sortDir.value === 'asc' ? 'bi bi-chevron-up' : 'bi bi-chevron-down'
}

const filtered = computed(() => {
  let rows = store.filteredData
  if (nameSearch.value) { const q = nameSearch.value.toLowerCase(); rows = rows.filter(r => (r['FACILITY NAME'] || '').toLowerCase().includes(q)) }
  const k = sortKey.value
  const counts = store.inspectionCountsByFacility
  return [...rows].sort((a, b) => {
    let av, bv
    if (k === '_score')          { av = a._score; bv = b._score }
    else if (k === '_inspCount') { av = counts[a['FACILITY ID']] || 0; bv = counts[b['FACILITY ID']] || 0 }
    else                         { av = a[k] || ''; bv = b[k] || '' }
    if (av < bv) return sortDir.value === 'asc' ? -1 : 1
    if (av > bv) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PER_PAGE)))
const paginated  = computed(() => filtered.value.slice((curPage.value - 1) * PER_PAGE, curPage.value * PER_PAGE))
const pageNums   = computed(() => {
  const total = totalPages.value, cur = curPage.value
  const nums = []
  for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) nums.push(i)
  return nums
})
watch(filtered, () => { curPage.value = 1 })

// ════════════════ Inspection Details Modal ════════════════
const detailsFacility = ref(null)
const trendSvg = ref(null)
const miniMapEl = ref(null)
let miniMap = null

function gradeTextColor(g) {
  if (g === 'A') return '#27ae60'
  if (g === 'B') return '#f39c12'
  if (g === 'C') return '#c0392b'
  return 'var(--text-dark)'
}

function buildDetailsFor(row) {
  const id = row['FACILITY ID']
  // Pull the full inspection history for this facility from the unfiltered dataset
  const history = store.allData
    .filter(r => r['FACILITY ID'] === id)
    .sort((a, b) => (a['ACTIVITY DATE'] || '').localeCompare(b['ACTIVITY DATE'] || ''))
  const latest = history.length ? history[history.length - 1] : row
  const scores = history.map(h => h._score).filter(s => !isNaN(s))
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : latest._score
  const withCoords = history.find(h => h._lat != null && h._lon != null) || (row._lat != null ? row : null)
  return {
    id,
    name:        latest['FACILITY NAME'] || row['FACILITY NAME'],
    address:     latest['FACILITY ADDRESS'] || row['FACILITY ADDRESS'],
    city:        latest['FACILITY CITY'] || row['FACILITY CITY'],
    zip:         latest['FACILITY ZIP'] || row['FACILITY ZIP'] || '',
    owner:       latest['OWNER NAME'] || row['OWNER NAME'] || '',
    latestGrade: latest['GRADE'] || '',
    latestScore: latest['SCORE'] || '',
    avgScore:    avg,
    risk:        store.riskLabel(latest['PE DESCRIPTION']),
    lat:         withCoords ? withCoords._lat : null,
    lon:         withCoords ? withCoords._lon : null,
    history,
  }
}

async function openDetails(row) {
  detailsFacility.value = buildDetailsFor(row)
  document.body.style.overflow = 'hidden'
  await nextTick()
  drawTrendChart()
  await mountMiniMap()
}

function closeDetails() {
  detailsFacility.value = null
  document.body.style.overflow = ''
  if (miniMap) { miniMap.remove(); miniMap = null }
  // Clear the cross-nav trigger so re-navigating won't auto-reopen
  store.selectedFacilityId = null
}

// ── D3 score-history line chart ──
function drawTrendChart() {
  const svg = d3.select(trendSvg.value)
  svg.selectAll('*').remove()
  const data = detailsFacility.value.history.filter(h => !isNaN(h._score)).map(h => ({
    date:  h['ACTIVITY DATE'],
    score: h._score,
    grade: h['GRADE'],
  }))
  if (!data.length) return

  const rect = trendSvg.value.getBoundingClientRect()
  const W = rect.width || 420, H = 220
  const margin = { top: 14, right: 16, bottom: 28, left: 34 }
  const iw = W - margin.left - margin.right
  const ih = H - margin.top - margin.bottom
  svg.attr('viewBox', `0 0 ${W} ${H}`)

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const parse = d3.timeParse('%Y-%m-%d')
  data.forEach(d => { d._t = parse(d.date) })
  const x = d3.scaleTime().domain(d3.extent(data, d => d._t)).range([0, iw])
  const y = d3.scaleLinear().domain([Math.min(70, d3.min(data, d => d.score) - 3), 101]).range([ih, 0])

  // Gridlines
  g.append('g').attr('class', 'rd-grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(''))
    .selectAll('line').attr('stroke', '#eee')
  g.selectAll('.rd-grid .domain').remove()

  // Reference line at 95 (Grade A threshold)
  g.append('line')
    .attr('x1', 0).attr('x2', iw).attr('y1', y(95)).attr('y2', y(95))
    .attr('stroke', '#27ae60').attr('stroke-dasharray', '3 3').attr('stroke-width', 1).attr('opacity', 0.5)
  g.append('text')
    .attr('x', iw - 4).attr('y', y(95) - 3).attr('text-anchor', 'end')
    .attr('font-size', '9px').attr('fill', '#27ae60').text('Grade A (95)')

  // Line
  if (data.length > 1) {
    const line = d3.line().x(d => x(d._t)).y(d => y(d.score)).curve(d3.curveMonotoneX)
    g.append('path').datum(data)
      .attr('d', line).attr('fill', 'none').attr('stroke', '#f39c12').attr('stroke-width', 2)
  }

  // Points
  g.selectAll('.dot').data(data).enter().append('circle')
    .attr('cx', d => x(d._t)).attr('cy', d => y(d.score)).attr('r', 4.5)
    .attr('fill', d => gradeTextColor(d.grade))
    .attr('stroke', 'white').attr('stroke-width', 1.5)
    .append('title').text(d => `${d.date}\nScore: ${d.score} · Grade ${d.grade}`)

  // Axes
  const xTicks = data.length <= 6 ? data.length : 6
  g.append('g').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(xTicks).tickFormat(d3.timeFormat('%b %Y')))
    .selectAll('text').attr('font-size', '10px').attr('fill', '#666')
  g.append('g').call(d3.axisLeft(y).ticks(5))
    .selectAll('text').attr('font-size', '10px').attr('fill', '#666')
  g.selectAll('.domain').attr('stroke', '#ccc')
  g.selectAll('.tick line').attr('stroke', '#ccc')
}

// ── Leaflet mini-map ──
async function loadLeaflet() {
  if (window.L) return
  if (!document.querySelector('link[data-leaflet]')) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    link.setAttribute('data-leaflet', '1')
    document.head.appendChild(link)
  }
  if (!document.querySelector('script[data-leaflet]')) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      s.setAttribute('data-leaflet', '1')
      s.onload = resolve; s.onerror = reject
      document.head.appendChild(s)
    })
  }
}

async function mountMiniMap() {
  const f = detailsFacility.value
  if (!f || f.lat == null || f.lon == null) return
  await loadLeaflet()
  if (!miniMapEl.value) return
  if (miniMap) { miniMap.remove(); miniMap = null }

  miniMap = window.L.map(miniMapEl.value, {
    center: [f.lat, f.lon], zoom: 15, zoomControl: true, attributionControl: false, scrollWheelZoom: false,
  })
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(miniMap)
  const color = gradeTextColor(f.latestGrade)
  const icon = window.L.divIcon({
    className: 'rd-pin',
    html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);"></div>`,
    iconSize: [20, 20], iconAnchor: [10, 10],
  })
  window.L.marker([f.lat, f.lon], { icon })
    .addTo(miniMap)
    .bindPopup(`<strong>${f.name}</strong><br>Score ${f.latestScore} · Grade ${f.latestGrade}`)
  // Leaflet needs size invalidation when inserted into a previously-hidden modal
  setTimeout(() => { if (miniMap) miniMap.invalidateSize() }, 100)
}

function viewOnBigMap() {
  const f = detailsFacility.value
  if (!f) return
  // Route to the Food Safety Overview map; OverviewView watches
  // store.highlightedFacilityId to drop a pin + flyTo on arrival.
  store.highlightedFacilityId = f.id
  closeDetails()
  router.push('/overview')
}

// ── Auto-open modal when navigated from MapView "View Details →" ──
function handleSelectedFacility() {
  const id = store.selectedFacilityId
  if (!id) return
  const row = store.allData.find(r => r['FACILITY ID'] === id)
  if (row) openDetails(row)
}

onMounted(() => { handleSelectedFacility() })
watch(() => store.selectedFacilityId, (v) => { if (v) handleSelectedFacility() })

onUnmounted(() => {
  document.body.style.overflow = ''
  if (miniMap) { miniMap.remove(); miniMap = null }
})
</script>

<style scoped>
.clickable-row { cursor: pointer; transition: background .12s; }
.clickable-row:hover { background: var(--bg-light, #fafafa); }

.insp-count-pill {
  display: inline-block;
  min-width: 28px;
  padding: 2px 8px;
  font-size: .72rem;
  font-weight: 600;
  border-radius: 10px;
  background: #fff2e6;
  color: #d35400;
  border: 1px solid #f5d5b0;
}

/* ─── Modal ─── */
.rd-modal-backdrop {
  position: fixed; inset: 0; background: rgba(20,20,20,.55);
  display: flex; justify-content: center; align-items: center;
  z-index: 2000; padding: 24px; backdrop-filter: blur(2px);
}
.rd-modal {
  background: #fff; border-radius: 14px; max-width: 960px; width: 100%;
  max-height: calc(100vh - 48px); overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,.3); padding: 22px 26px;
}
.rd-header {
  display: flex; align-items: flex-start; gap: 12px;
  padding-bottom: 14px; border-bottom: 1px solid var(--border, #e8e8e8); margin-bottom: 16px;
}
.rd-close {
  background: transparent; border: none; font-size: 1.1rem;
  color: var(--text-mid); cursor: pointer; padding: 6px 10px;
  border-radius: 6px; transition: background .12s;
}
.rd-close:hover { background: #f3f3f3; color: #000; }

.rd-stats-row {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px;
}
.rd-stat {
  background: var(--bg-light, #fafafa); border: 1px solid var(--border, #e8e8e8);
  border-radius: 10px; padding: 10px 12px;
}
.rd-stat-label { font-size: .68rem; text-transform: uppercase; letter-spacing: .06em; color: var(--text-light); }
.rd-stat-value { font-size: 1.25rem; font-weight: 700; margin-top: 2px; color: var(--text-dark); }

.rd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.rd-panel {
  border: 1px solid var(--border, #e8e8e8); border-radius: 10px;
  padding: 12px 14px; background: #fff;
}
.rd-panel-title {
  font-size: .8rem; font-weight: 700; color: var(--text-dark);
  margin-bottom: 10px; display: flex; align-items: center;
}
.rd-trend-svg { width: 100%; height: 220px; display: block; }
.rd-mini-map { width: 100%; height: 220px; border-radius: 8px; overflow: hidden; background: #f0f0f0; position: relative; }
.rd-no-geo {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; color: var(--text-light); font-size: .8rem;
}
.rd-map-btn {
  margin-left: auto; font-size: .7rem; padding: 4px 10px;
  background: var(--orange, #f39c12); color: white; border: none;
  border-radius: 6px; cursor: pointer; font-weight: 600;
  display: flex; align-items: center; gap: 4px;
}
.rd-map-btn:hover { filter: brightness(.95); }

.rd-history-table-wrap { max-height: 260px; overflow-y: auto; border: 1px solid var(--border, #e8e8e8); border-radius: 8px; }
.rd-history-table { width: 100%; border-collapse: collapse; font-size: .78rem; }
.rd-history-table th {
  position: sticky; top: 0; background: var(--bg-light, #fafafa);
  padding: 8px 12px; text-align: left; font-weight: 600; color: var(--text-mid);
  border-bottom: 1px solid var(--border, #e8e8e8); font-size: .72rem;
  text-transform: uppercase; letter-spacing: .04em;
}
.rd-history-table td { padding: 7px 12px; border-bottom: 1px solid #f3f3f3; }
.rd-history-table tr:last-child td { border-bottom: none; }

@media (max-width: 720px) {
  .rd-stats-row { grid-template-columns: repeat(2, 1fr); }
  .rd-grid { grid-template-columns: 1fr; }
}
</style>
