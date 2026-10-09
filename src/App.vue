<template>
  <div class="layout">
    <div class="loading-overlay" v-if="store.loading">
      <div class="spinner"></div>
      <div style="font-size:0.82rem;color:#999;">Loading LA County inspection data…</div>
    </div>

    <aside class="sidebar">
      <div class="sb-logo">
        <div class="brand">🍴 LA Eats</div>
        <div class="tag">Food Safety Dashboard · DSCI 554</div>
      </div>

      <div class="nav-section">
        <RouterLink to="/overview" class="nav-section-header"
          :class="{ active: route.name === 'overview' }">
          <i class="bi bi-grid-1x2-fill"></i>
          Food Safety Overview
        </RouterLink>
      </div>

      <div class="nav-section">
        <RouterLink to="/accessibility" class="nav-section-header"
          :class="{ active: route.name === 'accessibility' }">
          <i class="bi bi-geo-alt-fill"></i>
          Accessibility
        </RouterLink>
      </div>

      <div class="nav-section">
        <RouterLink to="/restaurants" class="nav-section-header"
          :class="{ active: route.name === 'restaurants' }">
          <i class="bi bi-table"></i>
          Restaurants
        </RouterLink>
      </div>

      <div class="nav-section">
        <RouterLink to="/about" class="nav-section-header"
          :class="{ active: route.name === 'about' }">
          <i class="bi bi-info-circle-fill"></i>
          About Data
        </RouterLink>
      </div>

      <div class="sb-spacer"></div>
      <div class="sb-footer">
        USC · DSCI 554 · Spring 2026<br>
        LA County Open Health Data
      </div>
    </aside>

    <div class="main-wrap">
      <RouterView />
      <footer class="pg-footer">
        <span>© 2026 LA Eats · LA County Environmental Health · DSCI 554 · USC</span>
        <span>{{ store.totalCount.toLocaleString() }} inspections loaded</span>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useDataStore } from '@/stores/data'

const store = useDataStore()
const route = useRoute()
onMounted(() => store.loadData())
</script>