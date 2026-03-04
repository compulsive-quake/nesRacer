<script setup lang="ts">
import type { RaceResult } from '../types';

const props = defineProps<{
  results: RaceResult[]
  p1Score: number
  p2Score: number
}>();
</script>

<template>
  <div class="scoreboard" v-if="results.length > 0">
    <h3>Race Results</h3>
    <div class="results-list">
      <div
        v-for="(result, i) in results"
        :key="i"
        class="result-row"
      >
        <span class="result-level">{{ result.world }}-{{ result.level }}</span>
        <span
          class="result-winner"
          :class="{ p1: result.winner === 1, p2: result.winner === 2 }"
        >
          P{{ result.winner }}
        </span>
      </div>
    </div>
    <div class="totals">
      <span :class="{ leading: p1Score > p2Score }">P1: {{ p1Score }}</span>
      <span class="separator">|</span>
      <span :class="{ leading: p2Score > p1Score }">P2: {{ p2Score }}</span>
    </div>
  </div>
</template>

<style scoped>
.scoreboard {
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #333;
  border-radius: 8px;
  padding: 1rem;
  color: #fff;
  min-width: 200px;
}

h3 {
  margin: 0 0 0.75rem;
  text-align: center;
  font-size: 1rem;
  color: #aaa;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.result-row {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 0.85rem;
}

.result-level {
  color: #888;
}

.result-winner.p1 {
  color: #4dabf7;
}

.result-winner.p2 {
  color: #f06595;
}

.totals {
  display: flex;
  justify-content: center;
  gap: 1rem;
  font-size: 1.1rem;
  font-weight: bold;
  padding-top: 0.5rem;
  border-top: 1px solid #333;
}

.separator {
  color: #444;
}

.leading {
  color: #ffd700;
}
</style>
