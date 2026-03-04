<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue'
import type { GameInfo } from '../types'
import { useGameCatalog } from '../composables/useGameCatalog'

const props = defineProps<{
  defaultGame?: string
}>()

const emit = defineEmits<{
  'update:selectedGame': [game: GameInfo]
}>()

const { catalog, totalGames, resolveImageUrl, findGameIndex } = useGameCatalog()

const containerRef = ref<HTMLElement | null>(null)
const scrollOffset = ref(0)
const velocity = ref(0)
const isDragging = ref(false)
const resolvedUrls = reactive(new Map<number, string>())

const VISIBLE_RANGE = 8

const selectedIndex = computed(() => {
  const idx = Math.round(scrollOffset.value)
  return ((idx % totalGames) + totalGames) % totalGames
})

const selectedGame = computed(() => catalog[selectedIndex.value])

watch(selectedIndex, () => {
  if (selectedGame.value) {
    emit('update:selectedGame', selectedGame.value)
  }
})

interface VisibleItem {
  game: GameInfo
  distFromCenter: number
  imageUrl: string | null
}

const visibleItems = computed(() => {
  const center = scrollOffset.value
  const items: VisibleItem[] = []

  for (let offset = -VISIBLE_RANGE; offset <= VISIBLE_RANGE; offset++) {
    let idx = Math.floor(center) + offset
    idx = ((idx % totalGames) + totalGames) % totalGames
    const distFromCenter = (Math.floor(center) + offset) - center

    items.push({
      game: catalog[idx],
      distFromCenter,
      imageUrl: resolvedUrls.get(idx) ?? null,
    })
  }
  return items
})

function getItemStyle(distFromCenter: number) {
  const w = containerRef.value?.clientWidth ?? 1200
  const spacing = w * 0.08

  const x = distFromCenter * spacing

  const maxArc = 160
  const norm = distFromCenter / VISIBLE_RANGE
  const y = -maxArc * (1 - Math.cos(norm * Math.PI * 0.7))

  const absDist = Math.abs(distFromCenter)
  const scale = Math.max(0.35, 1.2 - absDist * 0.1)
  const opacity = Math.max(0.1, 1.0 - absDist * 0.13)
  const zIndex = 100 - Math.round(absDist * 10)

  return {
    transform: `translate(calc(-50% + ${x}px), ${y}px) scale(${scale})`,
    opacity: String(opacity),
    zIndex: String(zIndex),
  }
}

// --- Mouse interaction ---
let lastMouseX = 0
let lastMoveTime = 0

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  isDragging.value = true
  lastMouseX = e.clientX
  lastMoveTime = performance.now()
  velocity.value = 0
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  const dx = e.clientX - lastMouseX
  const now = performance.now()
  const dt = now - lastMoveTime

  const w = containerRef.value?.clientWidth ?? 1200
  const spacing = w * 0.08
  const indexDelta = -dx / spacing

  scrollOffset.value += indexDelta

  if (dt > 0) {
    const instantVelocity = indexDelta / (dt / 1000)
    velocity.value = velocity.value * 0.5 + instantVelocity * 0.5
  }

  lastMouseX = e.clientX
  lastMoveTime = now
}

function onMouseUp() {
  isDragging.value = false
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

// --- Mouse wheel ---
function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY
  velocity.value += delta * 0.01
}

// --- Keyboard ---
function onKeyDown(e: KeyboardEvent) {
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
const FRICTION = 0.95
const SNAP_THRESHOLD = 0.5
const SNAP_STIFFNESS = 0.08
const SNAP_DAMPING = 0.85
const VELOCITY_CUTOFF = 0.001

let rafId: number | null = null

function physicsStep() {
  if (!isDragging.value) {
    const absVel = Math.abs(velocity.value)

    if (absVel > SNAP_THRESHOLD) {
      velocity.value *= FRICTION
      scrollOffset.value += velocity.value * (1 / 60)
    } else {
      const target = Math.round(scrollOffset.value)
      const displacement = scrollOffset.value - target
      const springForce = -SNAP_STIFFNESS * displacement
      velocity.value += springForce
      velocity.value *= SNAP_DAMPING
      scrollOffset.value += velocity.value
    }

    // Wrap into valid range
    scrollOffset.value = ((scrollOffset.value % totalGames) + totalGames) % totalGames

    if (absVel < VELOCITY_CUTOFF &&
        Math.abs(scrollOffset.value - Math.round(scrollOffset.value)) < 0.001) {
      scrollOffset.value = Math.round(scrollOffset.value)
      velocity.value = 0
    }
  }

  resolveVisibleImages()
  rafId = requestAnimationFrame(physicsStep)
}

function resolveVisibleImages() {
  const center = scrollOffset.value
  const preloadRange = VISIBLE_RANGE + 3

  for (let offset = -preloadRange; offset <= preloadRange; offset++) {
    let idx = Math.floor(center) + offset
    idx = ((idx % totalGames) + totalGames) % totalGames

    if (!resolvedUrls.has(idx)) {
      resolveImageUrl(idx).then(url => {
        if (url) resolvedUrls.set(idx, url)
      })
    }
  }
}

onMounted(() => {
  const defaultName = props.defaultGame ?? 'Super Mario Bros. (World)'
  scrollOffset.value = findGameIndex(defaultName)
  resolveVisibleImages()
  rafId = requestAnimationFrame(physicsStep)

  if (selectedGame.value) {
    emit('update:selectedGame', selectedGame.value)
  }

  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
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
    <div class="carousel-track">
      <div
        v-for="(item, i) in visibleItems"
        :key="`${item.game.index}-${i}`"
        class="carousel-item"
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

    <div class="game-title">{{ selectedGame?.title }}</div>
  </div>
</template>

<style scoped>
.carousel-container {
  width: 100%;
  height: 380px;
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
  top: 50px;
}

.carousel-item {
  position: absolute;
  left: 50%;
  top: 0;
  width: 140px;
  height: 190px;
  will-change: transform, opacity;
  pointer-events: none;
}

.carousel-item img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 4px;
  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.7));
}

.placeholder {
  width: 100%;
  height: 100%;
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 4px;
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
</style>
