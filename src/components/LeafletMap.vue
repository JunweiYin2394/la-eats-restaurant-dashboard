<template>
  <div :id="mapId" class="map-box" :style="{ height: height }"></div>
</template>

<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'

const props = defineProps({
  mapId:      { type: String,  default: 'leaflet-map' },
  height:     { type: String,  default: '340px' },
  data:       { type: Array,   default: () => [] },
  maxMarkers: { type: Number,  default: 2000 }
})

const emit = defineEmits(['city-click'])

let map = null
let markersLayer = null

function gradeColor(grade) {
  if (grade === 'A') return '#22a85a'
  if (grade === 'B') return '#f2be1a'
  return '#eb5428'
}

function drawMarkers(data) {
  if (!map) return
  if (markersLayer) markersLayer.clearLayers()
  else markersLayer = L.layerGroup().addTo(map)

  const sample = data
    .filter(r => r._lat && r._lon)
    .slice(0, props.maxMarkers)

  sample.forEach(r => {
    L.circleMarker([r._lat, r._lon], {
      radius: 5,
      fillColor: gradeColor(r['GRADE']),
      color: '#fff',
      weight: 1,
      opacity: 0.9,
      fillOpacity: 0.8
    })
    .bindPopup(`
      <div class="pop-name">${r['FACILITY NAME']}</div>
      <div class="pop-score">Score: ${r['SCORE']} · Grade ${r['GRADE']}</div>
      <div class="pop-addr">${r['FACILITY ADDRESS']}, ${r['FACILITY CITY']}</div>
    `)
    .on('click', () => {
      // emit city click so other views can filter
      if (r._city) emit('city-click', r._city)
    })
    .addTo(markersLayer)
  })
}

onMounted(() => {
  map = L.map(props.mapId).setView([34.05, -118.24], 11)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map)

  if (props.data.length > 0) drawMarkers(props.data)
})

watch(() => props.data, (newData) => {
  drawMarkers(newData)
})

onUnmounted(() => {
  if (map) { map.remove(); map = null }
})
</script>
