<template>
  <div class="stat-card">
    <div class="stat-icon" :style="{ background: iconBg }">
      <i :class="'bi bi-' + icon" :style="{ color: iconColor }"></i>
    </div>
    <div class="stat-val" :style="{ color: iconColor }">{{ value }}</div>
    <div class="stat-label">{{ label }}</div>
    <div class="stat-sub">{{ sub }}</div>
  </div>
</template>

<script setup>
defineProps({
  value:     { type: String, required: true },
  label:     { type: String, required: true },
  sub:       { type: String, default: '' },
  icon:      { type: String, default: 'star' },
  iconColor: { type: String, default: 'var(--orange)' },
  iconBg:    { type: String, default: 'var(--orange-soft)' }
})
</script>
