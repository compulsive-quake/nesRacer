<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import type { GameInfo } from '../types'
import { useGameCatalog } from '../composables/useGameCatalog'
import { useFavorites } from '../composables/useFavorites'
import { hasSplitScreen } from '../gameRegistry'

const props = defineProps<{
  defaultGame?: string
  filterQuery?: string
  favoritesOnly?: boolean
  splitScreenOnly?: boolean
}>()

const emit = defineEmits<{
  'update:selectedGame': [game: GameInfo]
  activate: [game: GameInfo]
}>()

const { catalog, resolveImageUrl, findGameIndex } = useGameCatalog()
const { isFavorite, toggleFavorite } = useFavorites()
const hoveredIndex = ref<number | null>(null)

const resolvedUrls = reactive(new Map<number, string>())
const selectedIndex = ref(0)

// Populate from already-cached URLs (preloaded by LobbyScreen)
for (const game of catalog) {
  resolveImageUrl(game.index).then(url => {
    if (url) resolvedUrls.set(game.index, url)
  })
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

onMounted(() => {
  const defaultName = props.defaultGame ?? 'Super Mario Bros. (World)'
  const catIdx = findGameIndex(defaultName)
  selectedIndex.value = catIdx
})
</script>

<template>
  <div class="grid-container">
    <div v-if="filteredGames.length > 0" class="grid">
      <div
        v-for="game in filteredGames"
        :key="game.index"
        class="grid-item"
        :class="{ selected: game.index === selectedIndex }"
        @click="selectGame(game)"
        @mouseenter="hoveredIndex = game.index"
        @mouseleave="hoveredIndex = null"
      >
        <div class="grid-item-image">
          <img
            v-if="resolvedUrls.get(game.index)"
            :src="resolvedUrls.get(game.index)"
            :alt="game.title"
            draggable="false"
          />
          <div v-else class="placeholder" />
          <button
            v-if="hoveredIndex === game.index || isFavorite(game.index)"
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
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1.25rem;
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
  border: 2px solid transparent;
  transition: all 0.15s;
}

.grid-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: #444;
}

.grid-item.selected {
  border-color: #e63946;
  background: rgba(230, 57, 70, 0.1);
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
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));
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
  transition: all 0.15s;
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

.grid-item.selected .grid-item-title {
  color: #e63946;
}

.no-results {
  text-align: center;
  color: #666;
  font-size: 0.85rem;
  padding: 3rem 0;
}
</style>
