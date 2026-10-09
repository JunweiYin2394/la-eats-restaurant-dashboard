import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Papa from 'papaparse'

export const useDataStore = defineStore('data', () => {

  // ── Raw data ──────────────────────────────────────────────
  const allData = ref([])
  const loading = ref(true)
  const error = ref(null)

  // ── Global filters ────────────────────────────────────────
  const filterYear  = ref('all')   // 'all' | '2023' | '2024' | '2025'
  const filterGrade = ref('all')   // 'all' | 'A' | 'B' | 'C'
  const filterRisk  = ref('all')   // 'all' | 'High Risk' | 'Moderate Risk' | 'Low Risk'
  const selectedCity = ref(null)   // string | null

  // ── Map ↔ Table cross-navigation state ───────────────────
  // Set by Restaurants "View on Map" button → consumed by MapView.onMounted (flyTo + popup)
  const highlightedFacilityId = ref(null)
  // Set by MapView popup "View Details →" button → consumed by RestaurantsView to auto-open modal
  const selectedFacilityId    = ref(null)

  // ── Load CSV ──────────────────────────────────────────────
  async function loadData() {
    if (allData.value.length > 0) return
    return new Promise((resolve) => {
      Papa.parse('./data/restaurants_with_coords.csv', {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete(results) {
          allData.value = results.data.map(parseRow).filter(r => r !== null)
          loading.value = false
          resolve()
        },
        error(err) {
          error.value = err.message
          loading.value = false
          resolve()
        }
      })
    })
  }

  // ── Parse each row ────────────────────────────────────────
  function parseRow(r) {
    const score = parseInt(r['SCORE'])
    const lat   = parseFloat(r['latitude'])
    const lon   = parseFloat(r['longitude'])
    if (isNaN(score)) return null

    const pe = r['PE DESCRIPTION'] || ''
    let riskLevel = 'Specialized'
    if (pe.includes('HIGH RISK'))     riskLevel = 'High Risk'
    else if (pe.includes('MODERATE')) riskLevel = 'Moderate Risk'
    else if (pe.includes('LOW RISK')) riskLevel = 'Low Risk'

    const dateStr = (r['ACTIVITY DATE'] || '').trim()
    const year  = dateStr.slice(0, 4)
    const month = dateStr.slice(0, 7)

    return {
      // original fields kept for LeafletMap / RestaurantCard compatibility
      ...r,
      // parsed fields
      _score:     score,
      _year:      year,
      _month:     month,
      _riskLevel: riskLevel,
      _city:      (r['FACILITY CITY'] || '').trim().toUpperCase(),
      _lat:       isNaN(lat) ? null : lat,
      _lon:       isNaN(lon) ? null : lon,
    }
  }

  // ── Reset filters ─────────────────────────────────────────
  function resetFilters() {
    filterYear.value   = 'all'
    filterGrade.value  = 'all'
    filterRisk.value   = 'all'
    selectedCity.value = null
  }

  // ── Core filtered dataset ─────────────────────────────────
  const filteredData = computed(() => {
    return allData.value.filter(r => {
      if (filterYear.value  !== 'all' && r._year      !== filterYear.value)  return false
      if (filterGrade.value !== 'all' && r['GRADE']   !== filterGrade.value) return false
      if (filterRisk.value  !== 'all' && r._riskLevel !== filterRisk.value)  return false
      if (selectedCity.value          && r._city      !== selectedCity.value) return false
      return true
    })
  })

  // ── Summary stat cards ────────────────────────────────────
  const summaryStats = computed(() => {
    const d = filteredData.value
    if (!d.length) return { total: 0, avgScore: 0, nonARate: 0, gradeC: 0 }
    const scoreSum = d.reduce((s, r) => s + r._score, 0)
    const nonA     = d.filter(r => r['GRADE'] !== 'A').length
    return {
      total:     d.length,
      avgScore:  (scoreSum / d.length).toFixed(1),
      nonARate:  (nonA / d.length * 100).toFixed(1),
      gradeC:    d.filter(r => r['GRADE'] === 'C').length,
    }
  })

  // ── City-level stats (for choropleth) ─────────────────────
  // Uses year/grade/risk filters but NOT selectedCity
  const cityStats = computed(() => {
    const base = allData.value.filter(r => {
      if (filterYear.value  !== 'all' && r._year      !== filterYear.value)  return false
      if (filterGrade.value !== 'all' && r['GRADE']   !== filterGrade.value) return false
      if (filterRisk.value  !== 'all' && r._riskLevel !== filterRisk.value)  return false
      return true
    })
    const map = {}
    for (const r of base) {
      if (!map[r._city]) map[r._city] = { city: r._city, total: 0, scoreSum: 0, nonA: 0 }
      map[r._city].total++
      map[r._city].scoreSum += r._score
      if (r['GRADE'] !== 'A') map[r._city].nonA++
    }
    return Object.values(map).map(c => ({
      ...c,
      avgScore: +(c.scoreSum / c.total).toFixed(2),
      nonARate: +(c.nonA / c.total * 100).toFixed(1),
    }))
  })

  // ── Monthly trend (for line chart) ───────────────────────
  const monthlyTrend = computed(() => {
    const base = allData.value.filter(r => {
      if (filterGrade.value !== 'all' && r['GRADE']   !== filterGrade.value) return false
      if (filterRisk.value  !== 'all' && r._riskLevel !== filterRisk.value)  return false
      if (selectedCity.value          && r._city      !== selectedCity.value) return false
      return true
    })
    const map = {}
    for (const r of base) {
      if (!r._month) continue
      if (!map[r._month]) map[r._month] = { month: r._month, total: 0, scoreSum: 0, nonA: 0 }
      map[r._month].total++
      map[r._month].scoreSum += r._score
      if (r['GRADE'] !== 'A') map[r._month].nonA++
    }
    return Object.values(map)
      .map(m => ({
        ...m,
        avgScore: +(m.scoreSum / m.total).toFixed(2),
        nonARate: +(m.nonA / m.total * 100).toFixed(1),
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
  })

  // ── Risk category stats (for bar chart) ──────────────────
  const riskStats = computed(() => {
    const base = allData.value.filter(r => {
      if (filterYear.value  !== 'all' && r._year    !== filterYear.value)  return false
      if (filterGrade.value !== 'all' && r['GRADE'] !== filterGrade.value) return false
      if (selectedCity.value          && r._city    !== selectedCity.value) return false
      return true
    })
    const map = {}
    for (const r of base) {
      const k = r._riskLevel
      if (!map[k]) map[k] = { riskLevel: k, total: 0, scoreSum: 0, nonA: 0 }
      map[k].total++
      map[k].scoreSum += r._score
      if (r['GRADE'] !== 'A') map[k].nonA++
    }
    return ['High Risk', 'Moderate Risk', 'Low Risk']
      .filter(k => map[k])
      .map(k => ({
        ...map[k],
        avgScore: +(map[k].scoreSum / map[k].total).toFixed(2),
        nonARate: +(map[k].nonA / map[k].total * 100).toFixed(1),
      }))
  })

  // ── Inspection counts per facility (FACILITY ID → count) ─
  // Uses ALL inspections (not filtered) so the count reflects the full history.
  const inspectionCountsByFacility = computed(() => {
    const map = {}
    for (const r of allData.value) {
      const id = r['FACILITY ID']
      if (!id) continue
      map[id] = (map[id] || 0) + 1
    }
    return map
  })

  // ── Legacy computed (kept for existing views) ─────────────
  const totalCount = computed(() => allData.value.length)

  const avgScore = computed(() => {
    const scores = allData.value.map(r => r._score).filter(s => !isNaN(s))
    if (!scores.length) return 0
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
  })

  const topCities = computed(() => {
    const counts = {}
    allData.value.forEach(r => {
      if (r._city) counts[r._city] = (counts[r._city] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 25).map(e => e[0])
  })

  const topCityScores = computed(() => {
    const map = {}
    allData.value.forEach(r => {
      if (!map[r._city]) map[r._city] = []
      map[r._city].push(r._score)
    })
    return Object.entries(map)
      .filter(([, v]) => v.length >= 50)
      .map(([city, vals]) => ({
        city,
        avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
        count: vals.length
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10)
  })

  const gradeDist = computed(() => {
    const total = allData.value.length || 1
    const a = allData.value.filter(r => r['GRADE'] === 'A').length
    const b = allData.value.filter(r => r['GRADE'] === 'B').length
    const c = allData.value.filter(r => r['GRADE'] === 'C').length
    return [
      { label: 'A (95–100)', pct: Math.round(a / total * 100), color: 'var(--green)' },
      { label: 'B (80–94)',  pct: Math.round(b / total * 100), color: 'var(--yellow)' },
      { label: 'C (70–79)',  pct: Math.round(c / total * 100), color: 'var(--orange)' },
    ]
  })

  const riskDist = computed(() => {
    const total = allData.value.length || 1
    let lo = 0, mo = 0, hi = 0
    allData.value.forEach(r => {
      if (r._riskLevel === 'High Risk')     hi++
      else if (r._riskLevel === 'Moderate Risk') mo++
      else if (r._riskLevel === 'Low Risk') lo++
    })
    return [
      { label: 'High Risk',     pct: Math.round(hi / total * 100), color: 'var(--orange)' },
      { label: 'Moderate Risk', pct: Math.round(mo / total * 100), color: 'var(--yellow)' },
      { label: 'Low Risk',      pct: Math.round(lo / total * 100), color: 'var(--green)' },
    ]
  })

  const riskAvgScores = computed(() => {
    const buckets = { 'High Risk': [], 'Moderate Risk': [], 'Low Risk': [] }
    allData.value.forEach(r => {
      if (buckets[r._riskLevel]) buckets[r._riskLevel].push(r._score)
    })
    const colors = {
      'High Risk': 'var(--orange)',
      'Moderate Risk': 'var(--yellow)',
      'Low Risk': 'var(--green)',
    }
    return Object.entries(buckets).map(([label, vals]) => ({
      label,
      avg: vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 'N/A',
      color: colors[label]
    }))
  })

  function riskLabel(pe) {
    if (!pe) return ''
    const u = pe.toUpperCase()
    if (u.includes('HIGH RISK')) return 'High Risk'
    if (u.includes('MODERATE'))  return 'Moderate Risk'
    if (u.includes('LOW RISK'))  return 'Low Risk'
    return 'Specialized'
  }

  function riskShort(pe) {
    if (!pe) return ''
    const u = pe.toUpperCase()
    if (u.includes('HIGH RISK')) return 'High'
    if (u.includes('MODERATE'))  return 'Moderate'
    if (u.includes('LOW RISK'))  return 'Low'
    return ''
  }

  function seatLabel(pe) {
    if (!pe) return ''
    const m = pe.match(/\((\d+[-–]\d+)\)/i)
    return m ? `${m[1]} seats` : ''
  }

  return {
    // state
    allData, loading, error,
    // filters
    filterYear, filterGrade, filterRisk, selectedCity,
    // map ↔ table cross-nav
    highlightedFacilityId, selectedFacilityId,
    // actions
    loadData, resetFilters,
    // new computed
    filteredData, summaryStats, cityStats, monthlyTrend, riskStats,
    inspectionCountsByFacility,
    // legacy computed (existing views still work)
    totalCount, avgScore, topCities, topCityScores,
    gradeDist, riskDist, riskAvgScores,
    riskLabel, riskShort, seatLabel,
  }
})
