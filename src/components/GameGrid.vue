<script setup lang="ts">
import { ref, computed, shallowRef, triggerRef, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import type { GameInfo } from '../types'
import { useGameCatalog } from '../composables/useGameCatalog'
import { useFavorites } from '../composables/useFavorites'
import { hasSplitScreen } from '../gameRegistry'

const props = defineProps<{
  filterQuery?: string
  favoritesOnly?: boolean
  splitScreenOnly?: boolean
}>()

const emit = defineEmits<{
  'update:selectedGame': [game: GameInfo]
  activate: [game: GameInfo]
}>()

const { catalog, resolveThumbUrl } = useGameCatalog()
const { isFavorite, toggleFavorite } = useFavorites()

const resolvedUrls = shallowRef(new Map<number, string>())
const selectedIndex = ref(-1)

// Load thumbnails incrementally, batching reactivity updates
{
  let flushTimer = 0
  let dirty = false
  function scheduleFlush() {
    if (!dirty) return
    if (!flushTimer) {
      flushTimer = window.setTimeout(() => {
        flushTimer = 0
        dirty = false
        triggerRef(resolvedUrls)
      }, 80)
    }
  }
  for (const game of catalog) {
    resolveThumbUrl(game.index).then(url => {
      if (url) {
        resolvedUrls.value.set(game.index, url)
        dirty = true
        scheduleFlush()
      }
    })
  }
}

const normalizedFilter = computed(() => props.filterQuery?.trim().toLowerCase() ?? '')
const isFiltered = computed(() => normalizedFilter.value.length > 0)

const filteredGames = computed(() => {
  let games = catalog
  if (isFiltered.value) {
    games = games.filter(g => g.title.toLowerCase().includes(normalizedFilter.value))
  }
  if (props.favoritesOnly) {
    games = games.filter(g => isFavorite(g.index))
  }
  if (props.splitScreenOnly) {
    games = games.filter(g => g.romId != null && hasSplitScreen(g.romId))
  }
  return games
})

const selectedGame = computed(() => {
  return filteredGames.value.find(g => g.index === selectedIndex.value) ?? filteredGames.value[0] ?? null
})

watch(selectedGame, (game) => {
  if (game) emit('update:selectedGame', game)
}, { immediate: true })

function selectGame(game: GameInfo) {
  selectedIndex.value = game.index
  emit('update:selectedGame', game)
  emit('activate', game)
}

// Suppress pointer events during scroll to prevent hover recalcs
const gridContainer = ref<HTMLElement | null>(null)
let scrollTimer = 0

function onScroll() {
  if (!gridContainer.value) return
  gridContainer.value.classList.add('scrolling')
  clearTimeout(scrollTimer)
  scrollTimer = window.setTimeout(() => {
    gridContainer.value?.classList.remove('scrolling')
  }, 100)
}

function getColumnsCount(): number {
  const grid = gridContainer.value?.querySelector('.grid') as HTMLElement | null
  if (!grid) return 1
  const style = getComputedStyle(grid)
  return style.gridTemplateColumns.split(' ').length
}

async function scrollSelectedIntoView() {
  await nextTick()
  const el = gridContainer.value?.querySelector('.grid-item.selected') as HTMLElement | null
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function moveTo(pos: number) {
  const games = filteredGames.value
  if (games.length === 0) return
  const clamped = Math.max(0, Math.min(games.length - 1, pos))
  selectedIndex.value = games[clamped].index
  scrollSelectedIntoView()
}

function onKeydown(e: KeyboardEvent) {
  const games = filteredGames.value
  if (games.length === 0) return
  const curPos = games.findIndex(g => g.index === selectedIndex.value)
  const cols = getColumnsCount()

  // If nothing is selected yet, first arrow key selects the first item
  if (curPos === -1 && ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
    e.preventDefault()
    moveTo(0)
    return
  }

  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault()
      moveTo(curPos + 1)
      break
    case 'ArrowLeft':
      e.preventDefault()
      moveTo(curPos - 1)
      break
    case 'ArrowDown':
      e.preventDefault()
      moveTo(curPos + cols)
      break
    case 'ArrowUp':
      e.preventDefault()
      moveTo(curPos - cols)
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (selectedGame.value) selectGame(selectedGame.value)
      break
  }
}

onMounted(() => {
  gridContainer.value?.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  gridContainer.value?.removeEventListener('scroll', onScroll)
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(scrollTimer)
})
</script>

<template>
  <div ref="gridContainer" class="grid-container">
    <div v-if="filteredGames.length > 0" class="grid">
      <div
        v-for="game in filteredGames"
        :key="game.index"
        class="grid-item"
        :class="{ selected: game.index === selectedIndex }"
        @click="selectGame(game)"
      >
        <div class="grid-item-image">
          <img
            v-if="resolvedUrls.get(game.index)"
            :src="resolvedUrls.get(game.index)"
            :alt="game.title"
            loading="lazy"
            decoding="async"
            draggable="false"
          />
          <div v-else class="placeholder" />
          <button
            class="fav-star"
            :class="{ active: isFavorite(game.index) }"
            title="Toggle favorite"
            @click.stop="toggleFavorite(game.index)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" :fill="isFavorite(game.index) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
        </div>
        <div class="grid-item-title">{{ game.title }}</div>
      </div>
    </div>
    <div v-else-if="isFiltered || favoritesOnly || splitScreenOnly" class="no-results">No games found</div>
  </div>
</template>

<style scoped>
.grid-container {
  width: 100%;
  padding: 0 1.5rem;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
  will-change: scroll-position;
}

.grid-container.scrolling .grid {
  pointer-events: none;
}

.grid-container.scrolling .grid-item {
  transition: none;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  padding: 0.5rem 0 1.5rem;
}

.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: transform 0.15s ease-out;
  contain: layout style paint;
  content-visibility: auto;
  contain-intrinsic-size: 140px 230px;
}

.grid-item:hover,
.grid-item.selected {
  transform: scale(1.15);
  outline: 2px solid rgba(100, 160, 255, 0.7);
  outline-offset: -2px;
}

.grid-item-image .fav-star {
  opacity: 0;
}

.grid-item:hover .fav-star,
.grid-item .fav-star.active {
  opacity: 1;
}

.grid-item-image {
  position: relative;
  width: 100%;
}

.grid-item img {
  width: 100%;
  aspect-ratio: 140 / 190;
  object-fit: contain;
  border-radius: 4px;
}

.fav-star {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #888;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s, color 0.15s;
}

.fav-star:hover {
  color: #f5c518;
  background: rgba(0, 0, 0, 0.8);
}

.fav-star.active {
  color: #f5c518;
}

.placeholder {
  width: 100%;
  aspect-ratio: 140 / 190;
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 4px;
}

.grid-item-title {
  font-size: 0.7rem;
  color: #aaa;
  text-align: center;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.no-results {
  text-align: center;
  color: #666;
  font-size: 0.85rem;
  padding: 3rem 0;
}
</style>
