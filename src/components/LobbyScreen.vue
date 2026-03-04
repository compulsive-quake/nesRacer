<script setup lang="ts">
import { ref } from 'vue'
import type { GameInfo } from '../types'
import GameCarousel from './GameCarousel.vue'

const emit = defineEmits<{
  startLocal: []
}>()

const selectedGame = ref<GameInfo | null>(null)

function onGameSelected(game: GameInfo) {
  selectedGame.value = game
}
</script>

<template>
  <div class="lobby">
    <div class="logo">
      <h1>NES<span class="accent">Racer</span></h1>
      <p class="subtitle">Split-Screen NES Racing</p>
    </div>

    <GameCarousel
      default-game="Super Mario Bros. (World)"
      @update:selected-game="onGameSelected"
    />

    <div class="modes">
      <button class="mode-btn local" @click="emit('startLocal')">
        <div class="mode-icon">&#x1F3AE;</div>
        <div class="mode-label">Local Race</div>
        <div class="mode-desc">Two players, one screen</div>
      </button>

      <button class="mode-btn online" disabled>
        <div class="mode-icon">&#x1F310;</div>
        <div class="mode-label">Online Race</div>
        <div class="mode-desc">Coming soon</div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding: 2rem;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);
}

.logo h1 {
  font-size: 3.5rem;
  margin: 0;
  color: #fff;
  letter-spacing: 0.1em;
}

.accent {
  color: #e63946;
}

.subtitle {
  color: #666;
  margin: 0.25rem 0 0;
  font-size: 1rem;
  text-align: center;
}

.modes {
  display: flex;
  gap: 1.5rem;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem 3rem;
  border: 2px solid #333;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 180px;
}

.mode-btn:hover:not(:disabled) {
  border-color: #e63946;
  background: rgba(230, 57, 70, 0.1);
  transform: translateY(-2px);
}

.mode-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mode-icon {
  font-size: 2.5rem;
}

.mode-label {
  font-size: 1.2rem;
  font-weight: bold;
}

.mode-desc {
  font-size: 0.8rem;
  color: #666;
}
</style>
