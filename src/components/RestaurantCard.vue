<template>
  <div class="r-card" @click="$emit('select', restaurant)">
    <div>
      <div class="rank-b" :class="rank === 1 ? 'r1' : 'rn'">{{ rank }}</div>
    </div>
    <div style="flex:1;min-width:0;">
      <div>
        <span class="r-name">{{ restaurant['FACILITY NAME'] }}</span>
        <span class="g-pill" :class="{ b: restaurant.GRADE === 'B', c: restaurant.GRADE === 'C' }">
          {{ restaurant.GRADE }} {{ restaurant.SCORE }}
        </span>
      </div>
      <div class="r-addr">
        <i class="bi bi-geo-alt-fill me-1"></i>
        {{ restaurant['FACILITY ADDRESS'] }}, {{ restaurant['FACILITY CITY'] }}, CA {{ restaurant['FACILITY ZIP'] }}
      </div>
      <div class="r-desc">{{ store.riskLabel(restaurant['PE DESCRIPTION']) }} · {{ store.seatLabel(restaurant['PE DESCRIPTION']) }}</div>
    </div>
    <div style="flex-shrink:0;text-align:right;">
      <div class="tp-badge" v-if="rank === 1">TOP PICK</div>
      <div class="r-score" :class="{ b: restaurant.GRADE === 'B', c: restaurant.GRADE === 'C' }">
        {{ restaurant.SCORE }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { useDataStore } from '@/stores/data'
const store = useDataStore()

defineProps({
  restaurant: { type: Object, required: true },
  rank:       { type: Number, default: 1 }
})
defineEmits(['select'])
</script>
