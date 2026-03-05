import { ref, computed } from 'vue'

const STORAGE_KEY = 'nesracer-favorites'

function loadFavorites(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return new Set(JSON.parse(raw) as number[])
  } catch { /* ignore */ }
  return new Set()
}

const favorites = ref(loadFavorites())
const showOnlyFavorites = ref(false)

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites.value]))
}

export function useFavorites() {
  function toggleFavorite(gameIndex: number) {
    const next = new Set(favorites.value)
    if (next.has(gameIndex)) {
      next.delete(gameIndex)
    } else {
      next.add(gameIndex)
    }
    favorites.value = next
    persist()
  }

  function isFavorite(gameIndex: number): boolean {
    return favorites.value.has(gameIndex)
  }

  const hasFavorites = computed(() => favorites.value.size > 0)

  return {
    favorites,
    showOnlyFavorites,
    hasFavorites,
    toggleFavorite,
    isFavorite,
  }
}
