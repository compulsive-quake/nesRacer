<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { GameInfo } from '../types'
import { hasSplitScreen } from '../gameRegistry'
import { useGameCatalog } from '../composables/useGameCatalog'
import { useFavorites } from '../composables/useFavorites'
import GameCarousel from './GameCarousel.vue'
import GameGrid from './GameGrid.vue'

type ViewMode = 'grid' | 'carousel'

const emit = defineEmits<{
  startLocal: [romUrl: string, romId: number]
  startSingle: [romUrl: string, romId: number]
}>()

const { preloadAll, resolveImageUrl } = useGameCatalog()
const { showOnlyFavorites, hasFavorites } = useFavorites()
const showOnlySplitScreen = ref(false)

const selectedGame = ref<GameInfo | null>(null)
const activatedGame = ref<GameInfo | null>(null)
const activatedGameImage = ref('')
const filterQuery = ref('')
const viewMode = ref<ViewMode>('grid')

const gridRef = ref<InstanceType<typeof GameGrid> | null>(null)
const carouselRef = ref<InstanceType<typeof GameCarousel> | null>(null)

const LETTERS = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const currentLetter = computed(() => {
  if (viewMode.value === 'carousel') {
    return carouselRef.value?.currentLetter ?? ''
  }
  return gridRef.value?.currentLetter ?? ''
})

function onLetterClick(letter: string) {
  if (viewMode.value === 'carousel') {
    carouselRef.value?.scrollToLetter(letter)
  } else {
    gridRef.value?.scrollToLetter(letter)
  }
}

const isFullscreen = ref(!!document.fullscreenElement)

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    document.documentElement.requestFullscreen()
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

// Preload full-size images in the background (for mode-select screen)
onMounted(() => {
  preloadAll()
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('popstate', onPopState)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('popstate', onPopState)
})

function onGameSelected(game: GameInfo) {
  selectedGame.value = game
}

async function onGameActivated(game: GameInfo) {
  selectedGame.value = game
  activatedGame.value = game
  activatedGameImage.value = await resolveImageUrl(game.index) ?? ''
  history.pushState({ view: 'modeSelect' }, '')
}

function backToGrid() {
  activatedGame.value = null
  activatedGameImage.value = ''
}

function goBack() {
  history.back()
}

function onPopState() {
  if (activatedGame.value) {
    backToGrid()
  }
}

function romUrl(): string {
  const game = activatedGame.value ?? selectedGame.value
  if (!game) return ''
  return `/roms/${game.filename.replace(/\.png$/, '.nes')}`
}

const splitScreenAvailable = computed(() => {
  const id = activatedGame.value?.romId
  return id != null && hasSplitScreen(id)
})
</script>

<template>
  <div class="lobby" @contextmenu.prevent>
    <header class="toolbar">
      <div class="toolbar-logo">
        <span class="toolbar-title">NES<span class="accent">Racer</span></span>
        <img src="../assets/mario-run-fast.gif" alt="NESRacer" class="toolbar-mario" />
      </div>
      <div v-if="!activatedGame" class="filter-wrapper">
        <input
          v-model="filterQuery"
          class="game-filter"
          type="text"
          placeholder="Search games..."
        />
      </div>
      <div v-if="!activatedGame" class="toolbar-filters">
        <button
          v-if="hasFavorites"
          class="toolbar-filter-btn"
          :class="{ active: showOnlyFavorites }"
          title="Show favorites only"
          @click="showOnlyFavorites = !showOnlyFavorites"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" :fill="showOnlyFavorites ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
        <button
          class="toolbar-filter-btn"
          :class="{ active: showOnlySplitScreen }"
          title="Show split-screen games only"
          @click="showOnlySplitScreen = !showOnlySplitScreen"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" :opacity="showOnlySplitScreen ? 1 : 0.6">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
        </button>
      </div>
      <div v-if="!activatedGame" class="view-toggle">
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'grid' }"
          title="Grid view"
          @click="viewMode = 'grid'"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
        </button>
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'carousel' }"
          title="Carousel view"
          @click="viewMode = 'carousel'"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="5" y="2" width="6" height="12" rx="1" />
            <rect x="0" y="4" width="4" height="8" rx="1" opacity="0.5" />
            <rect x="12" y="4" width="4" height="8" rx="1" opacity="0.5" />
          </svg>
        </button>
      </div>
      <button
        class="fullscreen-btn"
        :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
        @click="toggleFullscreen"
      >
        <svg v-if="!isFullscreen" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2h4V0H0v6h2V2zm12 0v4h2V0h-6v2h4zM2 14v-4H0v6h6v-2H2zm12 0h-4v2h6v-6h-2v4z"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 0v4H0v2h6V0H4zm8 0v4h4v2h-6V0h2zM0 10h4v4h2v-6H0v2zm10 0v6h2v-4h4v-2h-6z"/>
        </svg>
      </button>
    </header>

      <!-- Mode selection screen -->
      <div v-show="activatedGame" class="mode-select">
        <button class="back-btn" @click="goBack">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M12.7 15.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4l4.6-4.6a1 1 0 1 1 1.4 1.4L8.8 10l3.9 3.9a1 1 0 0 1 0 1.4z"/>
          </svg>
          Back
        </button>
        <div class="mode-select-content">
          <img
            v-if="activatedGameImage"
            :src="activatedGameImage"
            :alt="activatedGame?.title"
            class="mode-select-cover"
          />
          <div class="mode-select-info">
            <h2 class="mode-select-title">{{ activatedGame?.title }}</h2>
            <div class="mode-select-buttons">
              <button class="mode-card" @click="activatedGame && emit('startSingle', romUrl(), activatedGame.romId ?? 0)">
                <svg class="mode-icon" width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
                <span class="mode-card-label">Single Player</span>
              </button>
              <button
                class="mode-card"
                :disabled="!splitScreenAvailable"
                @click="splitScreenAvailable && activatedGame && emit('startLocal', romUrl(), activatedGame.romId!)"
              >
                <svg class="mode-icon" width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
                <span class="mode-card-label">Split Screen</span>
              </button>
              <button class="mode-card" disabled>
                <svg class="mode-icon" width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                <span class="mode-card-label">Online</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Game browser -->
      <div v-show="!activatedGame" class="game-browser">
        <nav class="alphabet-bar">
          <button
            v-for="letter in LETTERS"
            :key="letter"
            class="alpha-btn"
            :class="{ active: currentLetter === letter }"
            @click="onLetterClick(letter)"
          >{{ letter }}</button>
        </nav>

        <GameCarousel
          v-if="viewMode === 'carousel'"
          ref="carouselRef"
          default-game="Super Mario Bros. (World)"
          :filter-query="filterQuery"
          :favorites-only="showOnlyFavorites"
          :split-screen-only="showOnlySplitScreen"
          @update:selected-game="onGameSelected"
          @activate="onGameActivated"
        />

        <GameGrid
          v-else
          ref="gridRef"
          :filter-query="filterQuery"
          :favorites-only="showOnlyFavorites"
          :split-screen-only="showOnlySplitScreen"
          @update:selected-game="onGameSelected"
          @activate="onGameActivated"
        />
      </div>
  </div>
</template>

<style scoped>
.lobby {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
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

.view-toggle {
  flex: 1;
  display: flex;
  gap: 2px;
  justify-content: flex-end;
}

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #444;
  background: rgba(255, 255, 255, 0.04);
  color: #666;
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-btn:first-child {
  border-radius: 6px 0 0 6px;
}

.toggle-btn:last-child {
  border-radius: 0 6px 6px 0;
}

.toggle-btn:hover {
  color: #aaa;
  background: rgba(255, 255, 255, 0.08);
}

.toggle-btn.active {
  color: #e63946;
  border-color: #e63946;
  background: rgba(230, 57, 70, 0.12);
}

.toolbar-filters {
  display: flex;
  gap: 4px;
  margin-right: 0.75rem;
  flex-shrink: 0;
}

.toolbar-filter-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #444;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: #666;
  cursor: pointer;
  transition: all 0.15s;
}

.toolbar-filter-btn:hover {
  color: #e63946;
  border-color: #e63946;
  background: rgba(230, 57, 70, 0.08);
}

.toolbar-filter-btn.active {
  color: #e63946;
  border-color: #e63946;
  background: rgba(230, 57, 70, 0.12);
}

.fullscreen-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #444;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: #666;
  cursor: pointer;
  transition: all 0.15s;
  margin-left: 0.5rem;
  flex-shrink: 0;
}

.fullscreen-btn:hover {
  color: #e63946;
  border-color: #e63946;
  background: rgba(230, 57, 70, 0.08);
}

.filter-wrapper {
  flex: 0 1 360px;
  position: relative;
  margin-right: 0.75rem;
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
  user-select: text;
  -webkit-user-select: text;
}

.game-filter::placeholder {
  color: #666;
}

.game-filter:focus {
  border-color: #e63946;
}


.game-browser {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.alphabet-bar {
  display: flex;
  justify-content: center;
  gap: 1px;
  padding: 0.35rem 1rem;
  background: rgba(0, 0, 0, 0.25);
  border-bottom: 1px solid #1a1a1a;
  flex-shrink: 0;
}

.alpha-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 36px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: #555;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.12s, background 0.12s;
}

.alpha-btn:hover {
  color: #ccc;
  background: rgba(255, 255, 255, 0.08);
}

.alpha-btn.active {
  color: #e63946;
  background: rgba(230, 57, 70, 0.15);
}

.mode-select {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  min-height: 0;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.8rem;
  border: 1px solid #444;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #aaa;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
  align-self: flex-start;
  margin-bottom: 1.5rem;
}

.back-btn:hover {
  color: #fff;
  border-color: #666;
  background: rgba(255, 255, 255, 0.1);
}

.mode-select-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3rem;
}

.mode-select-cover {
  width: 400px;
  aspect-ratio: 140 / 190;
  object-fit: contain;
  border-radius: 6px;
  filter: drop-shadow(0 4px 24px rgba(0, 0, 0, 0.6));
  flex-shrink: 0;
}

.mode-select-info {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.mode-select-title {
  font-size: 1.6rem;
  font-weight: bold;
  color: #fff;
  margin: 0;
}

.mode-select-buttons {
  display: flex;
  gap: 1rem;
}

.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 2rem;
  border: 2px solid #333;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: #ccc;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 120px;
}

.mode-card:hover:not(:disabled) {
  border-color: #e63946;
  background: rgba(230, 57, 70, 0.1);
  color: #fff;
}

.mode-card:hover:not(:disabled) .mode-icon {
  color: #e63946;
}

.mode-card:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.mode-icon {
  color: #888;
  transition: color 0.2s;
}

.mode-card-label {
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}
</style>
