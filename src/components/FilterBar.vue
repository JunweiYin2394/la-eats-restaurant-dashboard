<template>
  <div class="filter-bar-global">

    <span class="fb-label">Filters</span>

    <!-- Year -->
    <div class="fb-group">
      <label class="fb-sublabel">Year</label>
      <select class="fb-select" v-model="store.filterYear">
        <option value="all">All years</option>
        <option value="2023">2023</option>
        <option value="2024">2024</option>
        <option value="2025">2025</option>
      </select>
    </div>

    <!-- Grade -->
    <div class="fb-group">
      <label class="fb-sublabel">Grade</label>
      <select class="fb-select" v-model="store.filterGrade">
        <option value="all">All grades</option>
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
      </select>
    </div>

    <!-- Risk -->
    <div class="fb-group">
      <label class="fb-sublabel">Risk</label>
      <select class="fb-select" v-model="store.filterRisk">
        <option value="all">All risk levels</option>
        <option value="High Risk">High Risk</option>
        <option value="Moderate Risk">Moderate Risk</option>
        <option value="Low Risk">Low Risk</option>
      </select>
    </div>

    <!-- City badge (shows when a city is selected via map click) -->
    <div class="fb-city-badge" v-if="store.selectedCity">
      <i class="bi bi-geo-alt-fill"></i>
      {{ store.selectedCity }}
      <button class="fb-clear-city" @click="store.selectedCity = null">×</button>
    </div>

    <!-- Spacer -->
    <div style="flex:1"></div>

    <!-- Record count -->
    <span class="fb-count">
      <strong>{{ store.filteredData.length.toLocaleString() }}</strong> records
    </span>

    <!-- Reset -->
    <button class="fb-reset" @click="store.resetFilters()">
      <i class="bi bi-x-circle"></i> Reset
    </button>

  </div>
</template>

<script setup>
import { useDataStore } from '@/stores/data'
const store = useDataStore()
</script>

<style scoped>
.filter-bar-global {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 20px;
  background: var(--white);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
  position: sticky;
  top: var(--header-h);
  z-index: 100;
}
.fb-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-light);
  font-weight: 600;
}
.fb-group {
  display: flex;
  align-items: center;
  gap: 5px;
}
.fb-sublabel {
  font-size: 0.75rem;
  color: var(--text-mid);
}
.fb-select {
  font-size: 0.78rem;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text-dark);
  cursor: pointer;
  outline: none;
}
.fb-select:focus {
  border-color: var(--orange);
}
.fb-city-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  background: var(--orange-soft);
  color: var(--orange);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 20px;
  border: 1px solid var(--orange);
}
.fb-city-badge i { font-size: 0.7rem; }
.fb-clear-city {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--orange);
  font-size: 1rem;
  line-height: 1;
  padding: 0 0 0 2px;
}
.fb-count {
  font-size: 0.78rem;
  color: var(--text-mid);
}
.fb-reset {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text-mid);
  cursor: pointer;
}
.fb-reset:hover {
  border-color: var(--orange);
  color: var(--orange);
}
</style>
