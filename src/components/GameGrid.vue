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
const keyboardNav = ref(false)

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
  keyboardNav.value = false
  selectedIndex.value = game.index
  emit('update:selectedGame', game)
  emit('activate', game)
}

// Suppress pointer events during scroll to prevent hover recalcs
const gridContainer = ref<HTMLElement | null>(null)
let scrollTimer = 0
let touchScrolling = false  // true while a touch-initiated scroll (including momentum) is active
let touchSnapTimer = 0

function onScroll() {
  if (!gridContainer.value) return
  gridContainer.value.classList.add('scrolling')
  updateCurrentLetter()
  clearTimeout(scrollTimer)
  scrollTimer = window.setTimeout(() => {
    gridContainer.value?.classList.remove('scrolling')
  }, 100)

  // When touch momentum is running, keep debouncing a snap
  if (touchScrolling) {
    clearTimeout(touchSnapTimer)
    touchSnapTimer = window.setTimeout(() => {
      touchScrolling = false
      snapToNearestRow()
    }, 120)
  }
}

function onTouchStart() {
  // Cancel any pending snap from a previous touch scroll
  clearTimeout(touchSnapTimer)
  // Cancel any running wheel/snap animation so it doesn't fight native touch scroll
  cancelAnimationFrame(wheelRafId)
  wheelAnimating = false
  touchScrolling = true
}

function onTouchEnd() {
  // Native momentum will keep firing scroll events;
  // the debounce in onScroll will snap once it settles.
  // If there was no momentum (tap or tiny drag), snap after a short delay.
  clearTimeout(touchSnapTimer)
  touchSnapTimer = window.setTimeout(() => {
    touchScrolling = false
    snapToNearestRow()
  }, 120)
}

// Row-snapping wheel scroll with rAF-based smooth animation
let snapTarget = 0
let wheelRafId = 0
let wheelAnimating = false
const WHEEL_LERP = 0.18 // interpolation factor per frame — higher = faster catch-up

function measureRowHeight(): number {
  const container = gridContainer.value
  const grid = container?.querySelector('.grid') as HTMLElement | null
  if (!container || !grid) return 0
  const items = grid.querySelectorAll('.grid-item')
  const cols = getColumnsCount()
  if (items.length <= cols) return 0
  // Measure from two adjacent visible row-start items to get an accurate
  // height unaffected by content-visibility: auto estimation.
  // Estimate which row is near the viewport top, then measure from there.
  const totalRows = Math.ceil(items.length / cols)
  const maxScroll = container.scrollHeight - container.clientHeight
  const estRow = maxScroll > 0
    ? Math.min(Math.floor((container.scrollTop / maxScroll) * totalRows), totalRows - 2)
    : 0
  const startRow = Math.max(0, estRow)
  for (let r = startRow; r < Math.min(startRow + 3, totalRows - 1); r++) {
    const idx1 = r * cols
    const idx2 = (r + 1) * cols
    if (idx2 >= items.length) break
    const top1 = (items[idx1] as HTMLElement).getBoundingClientRect().top
    const top2 = (items[idx2] as HTMLElement).getBoundingClientRect().top
    const h = top2 - top1
    if (h > 0) return h
  }
  // Fallback: first two rows
  return (items[cols] as HTMLElement).getBoundingClientRect().top -
    (items[0] as HTMLElement).getBoundingClientRect().top
}

function getRowSnapPoints(): number[] {
  const container = gridContainer.value
  const grid = container?.querySelector('.grid') as HTMLElement | null
  if (!container || !grid) return []
  const items = grid.querySelectorAll('.grid-item')
  if (!items.length) return []
  const cols = getColumnsCount()
  const totalRows = Math.ceil(items.length / cols)
  if (totalRows <= 1) return [0]
  // Always re-measure from visible rows — cheap (2-4 DOM reads) and
  // accurate regardless of content-visibility estimation
  const h = measureRowHeight()
  if (!h) return [0]
  return Array.from({ length: totalRows }, (_, r) => r * h)
}

function snapToNearestRow() {
  const container = gridContainer.value
  if (!container) return
  const points = getRowSnapPoints()
  if (!points.length) return
  const cur = container.scrollTop
  // Find closest snap point
  let best = points[0]
  let bestDist = Math.abs(cur - best)
  for (let i = 1; i < points.length; i++) {
    const dist = Math.abs(cur - points[i])
    if (dist < bestDist) {
      best = points[i]
      bestDist = dist
    }
  }
  snapTarget = best
  if (!wheelAnimating) startWheelAnimation()
}

function wheelAnimLoop() {
  const container = gridContainer.value
  if (!container) { wheelAnimating = false; return }
  const diff = snapTarget - container.scrollTop
  if (Math.abs(diff) < 0.5) {
    container.scrollTop = snapTarget
    wheelAnimating = false
    return
  }
  container.scrollTop += diff * WHEEL_LERP
  wheelRafId = requestAnimationFrame(wheelAnimLoop)
}

function startWheelAnimation() {
  if (wheelAnimating) return
  wheelAnimating = true
  wheelRafId = requestAnimationFrame(wheelAnimLoop)
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const container = gridContainer.value
  if (!container) return

  // Middle-click autoscroll is active — wheel click should stop it
  if (midScrollActive) {
    stopMidScroll()
    return
  }

  const points = getRowSnapPoints()
  if (!points.length) return

  // Find current snap index
  if (!wheelAnimating) {
    // Find nearest snap point to current position
    let bestIdx = 0
    let bestDist = Math.abs(container.scrollTop - points[0])
    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(container.scrollTop - points[i])
      if (dist < bestDist) { bestIdx = i; bestDist = dist }
    }
    snapTarget = points[bestIdx]
  }

  // Find index of current snapTarget in points, then move one row.
  // Use nearest match instead of exact indexOf — snap points can shift
  // slightly between calls due to content-visibility: auto relayout.
  let idx = 0
  let idxDist = Math.abs(points[0] - snapTarget)
  for (let i = 1; i < points.length; i++) {
    const dist = Math.abs(points[i] - snapTarget)
    if (dist < idxDist) { idx = i; idxDist = dist }
  }
  if (e.deltaY > 0 && idx < points.length - 1) {
    snapTarget = points[idx + 1]
  } else if (e.deltaY < 0 && idx > 0) {
    snapTarget = points[idx - 1]
  }

  startWheelAnimation()
}

// --- Middle-click (autoscroll) custom implementation ---
let midScrollActive = false
let midScrollHeld = false   // true while button is physically held
let midOriginY = 0
let midCurrentY = 0
let midRafId = 0
const midScrolling = ref(false) // for template cursor class

function midScrollLoop() {
  const container = gridContainer.value
  if (!container || !midScrollActive) return
  const delta = midCurrentY - midOriginY
  const absDelta = Math.abs(delta)
  if (absDelta > 5) {
    const speed = Math.sign(delta) * Math.pow((absDelta - 5) / 20, 1.6)
    container.scrollTop += speed
  }
  midRafId = requestAnimationFrame(midScrollLoop)
}

function startMidScroll(e: MouseEvent) {
  midScrollActive = true
  midScrollHeld = true
  midScrolling.value = true
  midOriginY = e.clientY
  midCurrentY = e.clientY
  midRafId = requestAnimationFrame(midScrollLoop)
}

function stopMidScroll() {
  midScrollActive = false
  midScrollHeld = false
  midScrolling.value = false
  cancelAnimationFrame(midRafId)
  midRafId = 0
  snapToNearestRow()
}

function onMousedown(e: MouseEvent) {
  if (e.button !== 1) return // middle button only
  e.preventDefault()
  if (midScrollActive && !midScrollHeld) {
    // Toggle-mode autoscroll is active, click to stop
    stopMidScroll()
    return
  }
  startMidScroll(e)
}

function onMouseup(e: MouseEvent) {
  if (e.button !== 1 || !midScrollActive) return
  e.preventDefault()
  const moved = Math.abs(e.clientY - midOriginY)
  if (moved < 8) {
    // Barely moved — switch to toggle mode (release button, keep scrolling by mouse position)
    midScrollHeld = false
  } else {
    // Was a hold-and-drag — stop
    stopMidScroll()
  }
}

function onMousemove(e: MouseEvent) {
  if (!midScrollActive) return
  midCurrentY = e.clientY
}

// Stop autoscroll if user clicks anything or presses Escape
function onMousedownGlobal(e: MouseEvent) {
  if (midScrollActive && !midScrollHeld && e.button !== 1) {
    stopMidScroll()
  }
}

function onKeydownGlobal(e: KeyboardEvent) {
  if (midScrollActive && e.key === 'Escape') {
    stopMidScroll()
  }
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
  keyboardNav.value = true
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

// --- Alphabet navigation ---
const currentLetter = ref('')

function updateCurrentLetter() {
  const container = gridContainer.value
  if (!container) return
  const games = filteredGames.value
  if (!games.length) return
  // Estimate visible row from scroll ratio to avoid DOM queries
  // that can force content-visibility: auto relayout
  const maxScroll = container.scrollHeight - container.clientHeight
  if (maxScroll <= 0) {
    const ch = games[0].title[0]?.toUpperCase()
    currentLetter.value = ch >= 'A' && ch <= 'Z' ? ch : '#'
    return
  }
  const ratio = container.scrollTop / maxScroll
  const cols = getColumnsCount()
  const totalRows = Math.ceil(games.length / cols)
  const row = Math.min(Math.floor(ratio * totalRows), totalRows - 1)
  const idx = Math.min(row * cols, games.length - 1)
  const ch = games[idx].title[0]?.toUpperCase()
  currentLetter.value = ch >= 'A' && ch <= 'Z' ? ch : '#'
}

function scrollToLetter(letter: string) {
  const games = filteredGames.value
  const idx = games.findIndex(g => {
    const ch = g.title[0]?.toUpperCase()
    return letter === '#' ? (ch < 'A' || ch > 'Z') : ch >= letter
  })
  if (idx < 0) return

  // Use row index + column count to find the snap point directly,
  // avoiding getBoundingClientRect which is inaccurate for off-screen
  // items due to content-visibility: auto.
  const cols = getColumnsCount()
  const targetRow = Math.floor(idx / cols)
  const points = getRowSnapPoints()
  if (!points.length) return
  snapTarget = targetRow < points.length ? points[targetRow] : points[points.length - 1]
  startWheelAnimation()
}

defineExpose({ currentLetter, scrollToLetter })

onMounted(() => {
  gridContainer.value?.addEventListener('scroll', onScroll, { passive: true })
  gridContainer.value?.addEventListener('wheel', onWheel, { passive: false })
  gridContainer.value?.addEventListener('mousedown', onMousedown)
  gridContainer.value?.addEventListener('touchstart', onTouchStart, { passive: true })
  gridContainer.value?.addEventListener('touchend', onTouchEnd, { passive: true })
  window.addEventListener('mouseup', onMouseup)
  window.addEventListener('mousemove', onMousemove)
  window.addEventListener('mousedown', onMousedownGlobal)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('keydown', onKeydownGlobal)
  updateCurrentLetter()
})

onBeforeUnmount(() => {
  gridContainer.value?.removeEventListener('scroll', onScroll)
  gridContainer.value?.removeEventListener('wheel', onWheel)
  gridContainer.value?.removeEventListener('mousedown', onMousedown)
  gridContainer.value?.removeEventListener('touchstart', onTouchStart)
  gridContainer.value?.removeEventListener('touchend', onTouchEnd)
  clearTimeout(touchSnapTimer)
  window.removeEventListener('mouseup', onMouseup)
  window.removeEventListener('mousemove', onMousemove)
  window.removeEventListener('mousedown', onMousedownGlobal)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('keydown', onKeydownGlobal)
  cancelAnimationFrame(midRafId)
  cancelAnimationFrame(wheelRafId)
  clearTimeout(scrollTimer)
})
</script>

<template>
  <div ref="gridContainer" class="grid-container" :class="{ 'mid-scrolling': midScrolling }">
    <div v-if="filteredGames.length > 0" class="grid">
      <div
        v-for="game in filteredGames"
        :key="game.index"
        class="grid-item"
        :class="{ selected: keyboardNav && game.index === selectedIndex }"
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
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
}

.grid-container.mid-scrolling,
.grid-container.mid-scrolling * {
  cursor: ns-resize !important;
  user-select: none;
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
  height: 230px;
  overflow: hidden;
}

.grid-item:hover {
  transform: scale(1.15);
}

.grid-item.selected {
  transform: scale(1.15);
  outline: 2px solid rgba(100, 160, 255, 0.7);
  outline-offset: -2px;
}

.grid-item-image .fav-star {
  opacity: 0;
}

.grid-item:hover .fav-star {
  opacity: 1;
}
.grid-item .fav-star.active {
  opacity: 1;
}

.grid-item-image {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 0;
}

.grid-item img {
  width: 100%;
  height: 100%;
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
  height: 100%;
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
