<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue'
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
const containerRef = ref<HTMLElement | null>(null)
const hoveredIndex = ref<number | null>(null)
const scrollOffset = ref(0)
const velocity = ref(0)
const isDragging = ref(false)
const resolvedUrls = reactive(new Map<number, string>())

const VISIBLE_RANGE = 8

// --- Filtering ---
const normalizedFilter = computed(() => props.filterQuery?.trim().toLowerCase() ?? '')
const isFiltered = computed(() => normalizedFilter.value.length > 0)

const filteredIndices = computed<number[]>(() => {
  return catalog.reduce<number[]>((acc, g, i) => {
    if (isFiltered.value && !g.title.toLowerCase().includes(normalizedFilter.value)) return acc
    if (props.favoritesOnly && !isFavorite(g.index)) return acc
    if (props.splitScreenOnly && (g.romId == null || !hasSplitScreen(g.romId))) return acc
    acc.push(i)
    return acc
  }, [])
})

const effectiveTotal = computed(() => filteredIndices.value.length)

// --- Transition state ---
const isTransitioning = ref(false)

interface VisibleItem {
  game: GameInfo
  distFromCenter: number
  imageUrl: string | null
}

const exitingItems = ref<VisibleItem[]>([])
let transitionTimer: ReturnType<typeof setTimeout> | null = null
let cachedVisibleItems: VisibleItem[] = []

watch(normalizedFilter, (newQ, oldQ) => {
  if (newQ === oldQ) return

  const newFilteredSet = new Set(filteredIndices.value)

  // Items that were visible but are now filtered out
  const exits = cachedVisibleItems.filter(item => !newFilteredSet.has(item.game.index))
  exitingItems.value = exits
  isTransitioning.value = true

  velocity.value = 0
  scrollOffset.value = 0

  if (transitionTimer) clearTimeout(transitionTimer)
  transitionTimer = setTimeout(() => {
    isTransitioning.value = false
    exitingItems.value = []
  }, 400)
})

// --- Selection ---
const selectedIndex = computed(() => {
  const total = effectiveTotal.value
  if (total === 0) return -1
  const idx = Math.round(scrollOffset.value)
  return ((idx % total) + total) % total
})

const selectedGame = computed(() => {
  if (selectedIndex.value < 0) return null
  const catIdx = filteredIndices.value[selectedIndex.value]
  return catalog[catIdx]
})

watch(selectedIndex, () => {
  if (selectedGame.value) {
    emit('update:selectedGame', selectedGame.value)
  }
})

// --- Visible items ---
const visibleItems = computed(() => {
  const total = effectiveTotal.value
  if (total === 0) return []

  const center = scrollOffset.value
  const range = Math.min(VISIBLE_RANGE, Math.max(Math.floor(total / 2), 1))
  const items: VisibleItem[] = []
  const seen = new Set<number>()

  for (let offset = -range; offset <= range; offset++) {
    let pos = Math.floor(center) + offset
    pos = ((pos % total) + total) % total

    if (seen.has(pos)) continue
    seen.add(pos)

    const catIdx = filteredIndices.value[pos]
    const distFromCenter = (Math.floor(center) + offset) - center

    items.push({
      game: catalog[catIdx],
      distFromCenter,
      imageUrl: resolvedUrls.get(catIdx) ?? null,
    })
  }
  return items
})

function getItemStyle(distFromCenter: number) {
  const w = containerRef.value?.clientWidth ?? 1200
  const spacing = w * 0.08

  const gapSize = spacing * 0.35
  const push = gapSize * Math.tanh(distFromCenter * 2.5)

  const x = distFromCenter * spacing + push

  const maxArc = 160
  const norm = distFromCenter / VISIBLE_RANGE
  const y = -maxArc * (1 - Math.cos(norm * Math.PI * 0.7))

  const absDist = Math.abs(distFromCenter)
  const absVel = Math.abs(velocity.value)

  const baseScale = Math.max(0.35, 0.95 - absDist * 0.08)

  const sharpness = 3 + Math.min(absVel * 0.8, 12)
  const centerBoost = 0.8 * Math.exp(-sharpness * absDist * absDist)

  const scale = baseScale + centerBoost
  const opacity = Math.max(0.1, 1.0 - absDist * 0.13)
  const zIndex = 100 - Math.round(absDist * 10)

  return {
    transform: `translate(calc(-50% + ${x}px), ${y}px) scale(${scale})`,
    opacity: String(opacity),
    zIndex: String(zIndex),
  }
}

// --- Click to select ---
let dragDistance = 0

let clickTarget: number | null = null

function onItemClick(item: VisibleItem) {
  // Only count as a click if the user didn't drag
  if (dragDistance > 5) return

  const pos = filteredIndices.value.indexOf(item.game.index)
  // If already centered on this item, activate it
  if (pos === selectedIndex.value) {
    emit('activate', item.game)
    return
  }

  // Otherwise glide there
  if (pos >= 0) {
    velocity.value = 0
    clickTarget = pos
  }
}

// --- Mouse interaction ---
let lastMouseX = 0
let lastMoveTime = 0

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  isDragging.value = true
  dragDistance = 0
  clickTarget = null
  lastMouseX = e.clientX
  lastMoveTime = performance.now()
  velocity.value = 0
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  const dx = e.clientX - lastMouseX
  dragDistance += Math.abs(dx)
  const now = performance.now()
  const dt = now - lastMoveTime

  const w = containerRef.value?.clientWidth ?? 1200
  const spacing = w * 0.08
  const indexDelta = -dx / spacing

  scrollOffset.value += indexDelta

  if (dt > 1) {
    const instantVelocity = indexDelta / (dt / 1000)
    velocity.value = velocity.value * 0.7 + instantVelocity * 0.3
  }

  lastMouseX = e.clientX
  lastMoveTime = now
}

const MAX_RELEASE_VELOCITY = 25
const MIN_FLING_VELOCITY = 4

function onMouseUp() {
  isDragging.value = false
  const timeSinceLastMove = performance.now() - lastMoveTime
  if (timeSinceLastMove > 50 || Math.abs(velocity.value) < MIN_FLING_VELOCITY) {
    velocity.value = 0
  } else {
    velocity.value = Math.max(-MAX_RELEASE_VELOCITY, Math.min(MAX_RELEASE_VELOCITY, velocity.value))
  }
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

// --- Mouse wheel ---
function onWheel(e: WheelEvent) {
  e.preventDefault()
  clickTarget = null
  const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY
  velocity.value += delta * 0.025
}

// --- Keyboard ---
function onKeyDown(e: KeyboardEvent) {
  if ((e.target as HTMLElement)?.tagName === 'INPUT') return

  if (e.key === 'ArrowRight') {
    e.preventDefault()
    velocity.value = 0
    scrollOffset.value = Math.round(scrollOffset.value) + 1
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    velocity.value = 0
    scrollOffset.value = Math.round(scrollOffset.value) - 1
  }
}

// --- Physics loop ---
const FRICTION = 0.985
const SNAP_STIFFNESS = 0.15
const SNAP_DAMPING = 0.8
const SNAP_BLEND_SPEED = 8
const VELOCITY_CUTOFF = 0.001

let rafId: number | null = null

function physicsStep() {
  const total = effectiveTotal.value

  if (total > 0 && !isTransitioning.value) {
    if (!isDragging.value) {
      const absVel = Math.abs(velocity.value)

      // When a click target is active, use a stiffer spring toward it
      if (clickTarget !== null) {
        const displacement = scrollOffset.value - clickTarget
        const springForce = -0.3 * displacement
        velocity.value = (velocity.value + springForce) * 0.75
        scrollOffset.value += velocity.value * (1 / 60)

        if (Math.abs(displacement) < 0.01 && absVel < VELOCITY_CUTOFF) {
          scrollOffset.value = clickTarget
          velocity.value = 0
          clickTarget = null
        }
      } else {
        velocity.value *= FRICTION
        scrollOffset.value += velocity.value * (1 / 60)

        const snapBlend = Math.max(0, 1 - absVel / SNAP_BLEND_SPEED)
        if (snapBlend > 0) {
          const target = Math.round(scrollOffset.value)
          const displacement = scrollOffset.value - target
          const springForce = -SNAP_STIFFNESS * snapBlend * displacement
          velocity.value += springForce
          velocity.value *= 1 - (1 - SNAP_DAMPING) * snapBlend
        }

        if (absVel < VELOCITY_CUTOFF &&
            Math.abs(scrollOffset.value - Math.round(scrollOffset.value)) < 0.001) {
          scrollOffset.value = Math.round(scrollOffset.value)
          velocity.value = 0
        }
      }

      scrollOffset.value = ((scrollOffset.value % total) + total) % total
    }

    // Cache visible items for transition calculations
    cachedVisibleItems = visibleItems.value.slice()
  }

  if (total > 0) {
    resolveVisibleImages()
  }

  rafId = requestAnimationFrame(physicsStep)
}

function resolveVisibleImages() {
  const total = effectiveTotal.value
  if (total === 0) return

  const center = scrollOffset.value
  const preloadRange = VISIBLE_RANGE + 3

  for (let offset = -preloadRange; offset <= preloadRange; offset++) {
    let pos = Math.floor(center) + offset
    pos = ((pos % total) + total) % total
    const catIdx = filteredIndices.value[pos]

    if (catIdx !== undefined && !resolvedUrls.has(catIdx)) {
      resolveImageUrl(catIdx).then(url => {
        if (url) resolvedUrls.set(catIdx, url)
      })
    }
  }
}

function scrollToIndex(catalogIndex: number) {
  velocity.value = 0
  const filteredPos = filteredIndices.value.indexOf(catalogIndex)
  scrollOffset.value = filteredPos >= 0 ? filteredPos : 0
}

const currentLetter = computed(() => {
  const game = selectedGame.value
  if (!game) return ''
  const ch = game.title[0]?.toUpperCase()
  return ch >= 'A' && ch <= 'Z' ? ch : '#'
})

function scrollToLetter(letter: string) {
  const indices = filteredIndices.value
  const pos = indices.findIndex(catIdx => {
    const ch = catalog[catIdx].title[0]?.toUpperCase()
    return letter === '#' ? (ch < 'A' || ch > 'Z') : ch >= letter
  })
  if (pos >= 0) {
    velocity.value = 0
    scrollOffset.value = pos
  }
}

defineExpose({ scrollToIndex, currentLetter, scrollToLetter })

onMounted(() => {
  const defaultName = props.defaultGame ?? 'Super Mario Bros. (World)'
  const catIdx = findGameIndex(defaultName)
  scrollToIndex(catIdx)
  resolveVisibleImages()
  rafId = requestAnimationFrame(physicsStep)

  if (selectedGame.value) {
    emit('update:selectedGame', selectedGame.value)
  }

  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
  if (transitionTimer) clearTimeout(transitionTimer)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div
    ref="containerRef"
    class="carousel-container"
    @mousedown="onMouseDown"
    @wheel="onWheel"
  >
    <div class="carousel-track" :class="{ transitioning: isTransitioning }">
      <!-- Active items -->
      <div
        v-for="item in visibleItems"
        :key="item.game.index"
        class="carousel-item"
        :style="getItemStyle(item.distFromCenter)"
        @click="onItemClick(item)"
        @mouseenter="hoveredIndex = item.game.index"
        @mouseleave="hoveredIndex = null"
      >
        <img
          v-if="item.imageUrl"
          :src="item.imageUrl"
          :alt="item.game.title"
          draggable="false"
        />
        <div v-else class="placeholder" />
        <button
          v-if="hoveredIndex === item.game.index || isFavorite(item.game.index)"
          class="fav-star"
          :class="{ active: isFavorite(item.game.index) }"
          title="Toggle favorite"
          @click.stop="toggleFavorite(item.game.index)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" :fill="isFavorite(item.game.index) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      </div>

      <!-- Exiting items (fading out) -->
      <div
        v-for="item in exitingItems"
        :key="'exit-' + item.game.index"
        class="carousel-item exiting"
        :style="getItemStyle(item.distFromCenter)"
      >
        <img
          v-if="item.imageUrl"
          :src="item.imageUrl"
          :alt="item.game.title"
          draggable="false"
        />
        <div v-else class="placeholder" />
      </div>
    </div>

  </div>

  <div v-if="effectiveTotal > 0" class="game-title">{{ selectedGame?.title }}</div>
  <div v-else-if="isFiltered" class="game-title no-results">No games found</div>
</template>

<style scoped>
.carousel-container {
  width: 100%;
  height: 500px;
  position: relative;
  overflow: hidden;
  cursor: grab;
  user-select: none;
}

.carousel-container:active {
  cursor: grabbing;
}

.carousel-track {
  position: relative;
  width: 100%;
  height: 300px;
  top: 120px;
}

.carousel-track.transitioning .carousel-item:not(.exiting) {
  transition: transform 0.35s ease-out, opacity 0.35s ease-out;
}

.carousel-item {
  position: absolute;
  left: 50%;
  top: 0;
  width: 140px;
  height: 190px;
  will-change: transform, opacity;
  cursor: pointer;
}

.carousel-item img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 4px;
  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.7));
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
  height: 100%;
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 4px;
}

.carousel-item.exiting {
  animation: item-exit 0.35s ease-out forwards;
  pointer-events: none;
}

@keyframes item-exit {
  to {
    opacity: 0;
    transform: translateY(40px) scale(0.5);
  }
}

.game-title {
  text-align: center;
  color: #4dabf7;
  font-size: 0.85rem;
  margin-top: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 2rem;
  text-shadow: 0 0 10px rgba(77, 171, 247, 0.3);
}

.game-title.no-results {
  color: #666;
}
</style>
