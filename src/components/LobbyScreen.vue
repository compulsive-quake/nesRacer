<script setup lang="ts">
import { ref } from 'vue'
import type { GameInfo } from '../types'
import GameCarousel from './GameCarousel.vue'

const emit = defineEmits<{
  startLocal: []
}>()

const selectedGame = ref<GameInfo | null>(null)
const filterQuery = ref('')

function onGameSelected(game: GameInfo) {
  selectedGame.value = game
}
</script>

<template>
  <div class="lobby">
    <header class="toolbar">
      <div class="toolbar-logo">
        <span class="toolbar-title">NES<span class="accent">Racer</span></span>
        <img src="../assets/mario-run-fast.gif" alt="NESRacer" class="toolbar-mario" />
      </div>
      <div class="filter-wrapper">
        <input
          v-model="filterQuery"
          class="game-filter"
          type="text"
          placeholder="Search games..."
        />
      </div>
      <div class="toolbar-spacer" />
    </header>

    <GameCarousel
      default-game="Super Mario Bros. (World)"
      :filter-query="filterQuery"
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
  gap: 1.5rem;
  padding: 0 0 2rem;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);
}

.toolbar {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0.75rem 1.5rem;
  background: rgba(0, 0, 0, 0.4);
  border-bottom: 1px solid #222;
}

.toolbar-logo {
  flex: 1;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toolbar-mario {
  height: 32px;
  image-rendering: pixelated;
  transform: scaleX(-1);
}

.toolbar-title {
  font-size: 1.5rem;
  font-weight: bold;
  color: #fff;
  letter-spacing: 0.08em;
}

.accent {
  color: #e63946;
}

.toolbar-spacer {
  flex: 1;
}

.filter-wrapper {
  flex: 0 1 360px;
  position: relative;
}

.game-filter {
  width: 100%;
  padding: 0.4rem 0.75rem;
  border: 1px solid #444;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: #ddd;
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.15s;
}

.game-filter::placeholder {
  color: #666;
}

.game-filter:focus {
  border-color: #e63946;
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
