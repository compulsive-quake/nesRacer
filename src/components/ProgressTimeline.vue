<script setup lang="ts">
import { computed } from 'vue';
import type { RaceState } from '../types';

const props = defineProps<{
  state: RaceState
}>();

// Build all 32 levels: 8 worlds × 4 levels
const levels = Array.from({ length: 32 }, (_, i) => ({
  world: Math.floor(i / 4) + 1,
  level: (i % 4) + 1,
  index: i,
}));

// Current level as a 0-based index (0–31)
const currentLevelIndex = computed(() => {
  return (props.state.currentWorld - 1) * 4 + (props.state.currentLevel - 1);
});

// Map of "world-level" → winner for completed levels
const resultMap = computed(() => {
  const map = new Map<string, 1 | 2>();
  for (const r of props.state.results) {
    map.set(`${r.world}-${r.level}`, r.winner);
  }
  return map;
});

function levelKey(world: number, level: number) {
  return `${world}-${level}`;
}

// Position as a percentage along the track
function levelPercent(index: number) {
  return (index / (levels.length - 1)) * 100;
}
</script>

<template>
  <div class="progress-timeline" v-if="state.phase !== 'lobby'">
    <div class="timeline-track">
      <!-- Track line -->
      <div class="track-line" />

      <!-- Completed fill -->
      <div
        class="track-fill"
        :style="{ width: levelPercent(currentLevelIndex) + '%' }"
      />

      <!-- World labels -->
      <div
        v-for="w in 8"
        :key="'w' + w"
        class="world-label"
        :style="{ left: levelPercent((w - 1) * 4) + '%' }"
      >
        W{{ w }}
      </div>

      <!-- Level flags -->
      <div
        v-for="lv in levels"
        :key="lv.index"
        class="flag-marker"
        :class="{
          completed: resultMap.has(levelKey(lv.world, lv.level)),
          'won-p1': resultMap.get(levelKey(lv.world, lv.level)) === 1,
          'won-p2': resultMap.get(levelKey(lv.world, lv.level)) === 2,
          current: lv.index === currentLevelIndex,
          'world-start': lv.level === 1,
        }"
        :style="{ left: levelPercent(lv.index) + '%' }"
      >
        <div class="flag-pole" />
        <div class="flag-banner">
          <template v-if="resultMap.has(levelKey(lv.world, lv.level))">★</template>
          <template v-else>⚑</template>
        </div>
        <!-- Winner character icon next to the flag -->
        <div
          v-if="resultMap.get(levelKey(lv.world, lv.level)) === 1"
          class="flag-winner-icon p1-side"
        >
          <svg viewBox="0 0 16 16" width="14" height="14">
            <rect x="3" y="0" width="5" height="1" fill="#E63946"/>
            <rect x="2" y="1" width="8" height="1" fill="#E63946"/>
            <rect x="2" y="2" width="3" height="1" fill="#8B4513"/>
            <rect x="5" y="2" width="1" height="1" fill="#FDBCB4"/>
            <rect x="6" y="2" width="1" height="1" fill="#8B4513"/>
            <rect x="7" y="2" width="1" height="1" fill="#FDBCB4"/>
            <rect x="1" y="3" width="1" height="1" fill="#8B4513"/>
            <rect x="2" y="3" width="1" height="1" fill="#FDBCB4"/>
            <rect x="3" y="3" width="1" height="1" fill="#8B4513"/>
            <rect x="4" y="3" width="3" height="1" fill="#FDBCB4"/>
            <rect x="7" y="3" width="2" height="1" fill="#FDBCB4"/>
            <rect x="2" y="4" width="1" height="1" fill="#FDBCB4"/>
            <rect x="3" y="4" width="2" height="1" fill="#8B4513"/>
            <rect x="5" y="4" width="3" height="1" fill="#FDBCB4"/>
          </svg>
        </div>
        <div
          v-if="resultMap.get(levelKey(lv.world, lv.level)) === 2"
          class="flag-winner-icon p2-side"
        >
          <svg viewBox="0 0 16 16" width="14" height="14">
            <rect x="3" y="0" width="5" height="1" fill="#2D8B46"/>
            <rect x="2" y="1" width="8" height="1" fill="#2D8B46"/>
            <rect x="2" y="2" width="3" height="1" fill="#8B4513"/>
            <rect x="5" y="2" width="1" height="1" fill="#FDBCB4"/>
            <rect x="6" y="2" width="1" height="1" fill="#8B4513"/>
            <rect x="7" y="2" width="1" height="1" fill="#FDBCB4"/>
            <rect x="1" y="3" width="1" height="1" fill="#8B4513"/>
            <rect x="2" y="3" width="1" height="1" fill="#FDBCB4"/>
            <rect x="3" y="3" width="1" height="1" fill="#8B4513"/>
            <rect x="4" y="3" width="3" height="1" fill="#FDBCB4"/>
            <rect x="7" y="3" width="2" height="1" fill="#FDBCB4"/>
            <rect x="2" y="4" width="1" height="1" fill="#FDBCB4"/>
            <rect x="3" y="4" width="2" height="1" fill="#8B4513"/>
            <rect x="5" y="4" width="3" height="1" fill="#FDBCB4"/>
          </svg>
        </div>
        <div class="flag-label">{{ lv.world }}-{{ lv.level }}</div>
      </div>

      <!-- Mario (Player 1) -->
      <div
        class="player-sprite mario"
        :style="{ left: levelPercent(currentLevelIndex) + '%' }"
      >
        <svg viewBox="0 0 16 16" width="28" height="28">
          <!-- Hat -->
          <rect x="3" y="0" width="5" height="1" fill="#E63946"/>
          <rect x="2" y="1" width="8" height="1" fill="#E63946"/>
          <!-- Hair/face -->
          <rect x="2" y="2" width="3" height="1" fill="#8B4513"/>
          <rect x="5" y="2" width="1" height="1" fill="#FDBCB4"/>
          <rect x="6" y="2" width="1" height="1" fill="#8B4513"/>
          <rect x="7" y="2" width="1" height="1" fill="#FDBCB4"/>
          <rect x="1" y="3" width="1" height="1" fill="#8B4513"/>
          <rect x="2" y="3" width="1" height="1" fill="#FDBCB4"/>
          <rect x="3" y="3" width="1" height="1" fill="#8B4513"/>
          <rect x="4" y="3" width="1" height="1" fill="#FDBCB4"/>
          <rect x="5" y="3" width="1" height="1" fill="#FDBCB4"/>
          <rect x="6" y="3" width="1" height="1" fill="#FDBCB4"/>
          <rect x="7" y="3" width="1" height="1" fill="#FDBCB4"/>
          <rect x="8" y="3" width="1" height="1" fill="#FDBCB4"/>
          <rect x="1" y="4" width="1" height="1" fill="#8B4513"/>
          <rect x="2" y="4" width="1" height="1" fill="#FDBCB4"/>
          <rect x="3" y="4" width="1" height="1" fill="#8B4513"/>
          <rect x="4" y="4" width="1" height="1" fill="#8B4513"/>
          <rect x="5" y="4" width="1" height="1" fill="#FDBCB4"/>
          <rect x="6" y="4" width="1" height="1" fill="#FDBCB4"/>
          <rect x="7" y="4" width="1" height="1" fill="#FDBCB4"/>
          <rect x="8" y="4" width="1" height="1" fill="#8B4513"/>
          <!-- Body/overalls -->
          <rect x="3" y="5" width="5" height="1" fill="#8B4513"/>
          <rect x="2" y="6" width="2" height="1" fill="#E63946"/>
          <rect x="4" y="6" width="1" height="1" fill="#4169E1"/>
          <rect x="5" y="6" width="1" height="1" fill="#E63946"/>
          <rect x="6" y="6" width="2" height="1" fill="#E63946"/>
          <rect x="2" y="7" width="1" height="1" fill="#E63946"/>
          <rect x="3" y="7" width="1" height="1" fill="#4169E1"/>
          <rect x="4" y="7" width="1" height="1" fill="#E63946"/>
          <rect x="5" y="7" width="1" height="1" fill="#4169E1"/>
          <rect x="6" y="7" width="1" height="1" fill="#E63946"/>
          <rect x="7" y="7" width="1" height="1" fill="#4169E1"/>
          <!-- Overalls -->
          <rect x="2" y="8" width="1" height="1" fill="#4169E1"/>
          <rect x="3" y="8" width="1" height="1" fill="#4169E1"/>
          <rect x="4" y="8" width="2" height="1" fill="#4169E1"/>
          <rect x="6" y="8" width="1" height="1" fill="#4169E1"/>
          <rect x="7" y="8" width="1" height="1" fill="#4169E1"/>
          <rect x="2" y="9" width="2" height="1" fill="#4169E1"/>
          <rect x="4" y="9" width="2" height="1" fill="#4169E1"/>
          <rect x="6" y="9" width="2" height="1" fill="#4169E1"/>
          <!-- Shoes -->
          <rect x="1" y="10" width="2" height="1" fill="#8B4513"/>
          <rect x="7" y="10" width="2" height="1" fill="#8B4513"/>
        </svg>
        <span class="player-label p1-label">P1</span>
      </div>

      <!-- Luigi (Player 2) -->
      <div
        class="player-sprite luigi"
        :style="{ left: levelPercent(currentLevelIndex) + '%' }"
      >
        <svg viewBox="0 0 16 16" width="28" height="28">
          <!-- Hat -->
          <rect x="3" y="0" width="5" height="1" fill="#2D8B46"/>
          <rect x="2" y="1" width="8" height="1" fill="#2D8B46"/>
          <!-- Hair/face -->
          <rect x="2" y="2" width="3" height="1" fill="#8B4513"/>
          <rect x="5" y="2" width="1" height="1" fill="#FDBCB4"/>
          <rect x="6" y="2" width="1" height="1" fill="#8B4513"/>
          <rect x="7" y="2" width="1" height="1" fill="#FDBCB4"/>
          <rect x="1" y="3" width="1" height="1" fill="#8B4513"/>
          <rect x="2" y="3" width="1" height="1" fill="#FDBCB4"/>
          <rect x="3" y="3" width="1" height="1" fill="#8B4513"/>
          <rect x="4" y="3" width="1" height="1" fill="#FDBCB4"/>
          <rect x="5" y="3" width="1" height="1" fill="#FDBCB4"/>
          <rect x="6" y="3" width="1" height="1" fill="#FDBCB4"/>
          <rect x="7" y="3" width="1" height="1" fill="#FDBCB4"/>
          <rect x="8" y="3" width="1" height="1" fill="#FDBCB4"/>
          <rect x="1" y="4" width="1" height="1" fill="#8B4513"/>
          <rect x="2" y="4" width="1" height="1" fill="#FDBCB4"/>
          <rect x="3" y="4" width="1" height="1" fill="#8B4513"/>
          <rect x="4" y="4" width="1" height="1" fill="#8B4513"/>
          <rect x="5" y="4" width="1" height="1" fill="#FDBCB4"/>
          <rect x="6" y="4" width="1" height="1" fill="#FDBCB4"/>
          <rect x="7" y="4" width="1" height="1" fill="#FDBCB4"/>
          <rect x="8" y="4" width="1" height="1" fill="#8B4513"/>
          <!-- Body -->
          <rect x="3" y="5" width="5" height="1" fill="#8B4513"/>
          <rect x="2" y="6" width="2" height="1" fill="#2D8B46"/>
          <rect x="4" y="6" width="1" height="1" fill="#4169E1"/>
          <rect x="5" y="6" width="1" height="1" fill="#2D8B46"/>
          <rect x="6" y="6" width="2" height="1" fill="#2D8B46"/>
          <rect x="2" y="7" width="1" height="1" fill="#2D8B46"/>
          <rect x="3" y="7" width="1" height="1" fill="#4169E1"/>
          <rect x="4" y="7" width="1" height="1" fill="#2D8B46"/>
          <rect x="5" y="7" width="1" height="1" fill="#4169E1"/>
          <rect x="6" y="7" width="1" height="1" fill="#2D8B46"/>
          <rect x="7" y="7" width="1" height="1" fill="#4169E1"/>
          <!-- Overalls -->
          <rect x="2" y="8" width="1" height="1" fill="#4169E1"/>
          <rect x="3" y="8" width="1" height="1" fill="#4169E1"/>
          <rect x="4" y="8" width="2" height="1" fill="#4169E1"/>
          <rect x="6" y="8" width="1" height="1" fill="#4169E1"/>
          <rect x="7" y="8" width="1" height="1" fill="#4169E1"/>
          <rect x="2" y="9" width="2" height="1" fill="#4169E1"/>
          <rect x="4" y="9" width="2" height="1" fill="#4169E1"/>
          <rect x="6" y="9" width="2" height="1" fill="#4169E1"/>
          <!-- Shoes -->
          <rect x="1" y="10" width="2" height="1" fill="#8B4513"/>
          <rect x="7" y="10" width="2" height="1" fill="#8B4513"/>
        </svg>
        <span class="player-label p2-label">P2</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.progress-timeline {
  width: 100%;
  padding: 0.4rem 2.5rem 0.3rem;
  background: linear-gradient(to bottom, #1a1a2e, #0d0d1a);
  border-top: 1px solid #333;
  user-select: none;
  flex-shrink: 0;
  contain: layout style;
}

.timeline-track {
  position: relative;
  height: 64px;
  margin: 0 12px;
}

/* The base track line */
.track-line {
  position: absolute;
  top: 38px;
  left: 0;
  right: 0;
  height: 3px;
  background: #333;
  border-radius: 2px;
}

/* Completed portion fill */
.track-fill {
  position: absolute;
  top: 38px;
  left: 0;
  height: 3px;
  background: linear-gradient(90deg, #4dabf7, #f06595);
  border-radius: 2px;
  transition: width 0.6s ease;
}

/* World labels above the track */
.world-label {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  font-size: 0.6rem;
  font-weight: 700;
  color: #666;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

/* Flag markers */
.flag-marker {
  position: absolute;
  top: 10px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1;
}

.flag-pole {
  width: 2px;
  height: 18px;
  background: #555;
  border-radius: 1px;
}

.flag-banner {
  font-size: 0.55rem;
  line-height: 1;
  margin-top: -18px;
  margin-left: 3px;
  color: #555;
}

.flag-label {
  font-size: 0;
  color: transparent;
}

.flag-marker.current .flag-label {
  font-size: 0.5rem;
  color: #ffd700;
  margin-top: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.flag-marker.current .flag-pole {
  background: #ffd700;
  box-shadow: 0 0 4px rgba(255, 215, 0, 0.5);
}

.flag-marker.current .flag-banner {
  color: #ffd700;
  font-size: 0.7rem;
}

.flag-marker.world-start .flag-pole {
  height: 22px;
}

/* Completed flags */
.flag-marker.completed .flag-pole {
  background: #888;
}

.flag-marker.won-p1 .flag-banner {
  color: #4dabf7;
  font-size: 0.65rem;
}

.flag-marker.won-p1 .flag-pole {
  background: #4dabf7;
}

.flag-marker.won-p2 .flag-banner {
  color: #f06595;
  font-size: 0.65rem;
}

.flag-marker.won-p2 .flag-pole {
  background: #f06595;
}

/* Winner character icon next to completed flags */
.flag-winner-icon {
  position: absolute;
  top: 2px;
  animation: icon-pop 0.3s ease-out;
}

.flag-winner-icon.p1-side {
  right: 100%;
  margin-right: 1px;
}

.flag-winner-icon.p2-side {
  left: 100%;
  margin-left: 1px;
}

@keyframes icon-pop {
  0% { transform: scale(0); opacity: 0; }
  70% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

/* Player sprites */
.player-sprite {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: left 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 5;
}

.player-sprite.mario {
  top: -4px;
  transform: translateX(-120%);
}

.player-sprite.luigi {
  top: -4px;
  transform: translateX(20%);
}

.player-label {
  font-size: 0.55rem;
  font-weight: 800;
  margin-top: -2px;
  letter-spacing: 0.5px;
}

.p1-label {
  color: #4dabf7;
}

.p2-label {
  color: #f06595;
}
</style>
