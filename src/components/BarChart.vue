<template>
  <div>
    <div v-for="bar in bars" :key="bar.label" class="bar-row">
      <div class="bl">
        <span>{{ bar.label }}</span>
        <span style="font-weight:600;">{{ bar.pct }}%</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" :style="{ width: bar.pct + '%', background: bar.color }"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  bars: { type: Array, required: true }
  // Each bar: { label, pct, color }
})
</script>
