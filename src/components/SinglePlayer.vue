<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onUnmounted } from 'vue'
import { useNesEmulator } from '../composables/useNesEmulator'
import { useInputManager, DEFAULT_P1, DEFAULT_P2, DEFAULT_P1_GAMEPAD, DEFAULT_P2_GAMEPAD } from '../composables/useInputManager'
import { useEventLog } from '../composables/useEventLog'
import { useToolbarWindows } from '../composables/useToolbarWindows'
import { getGameToolbarConfig } from '../gameConfigs'
import RaceOverlay, { type GenieCode } from './RaceOverlay.vue'
import BindDialog from './BindDialog.vue'
import type { InputBinding, NesEmulator } from '../types'

const props = defineProps<{
  romUrl: string
  romId?: number
}>()

const emit = defineEmits<{
  backToLobby: []
}>()

const config = getGameToolbarConfig(props.romId)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const emulator = useNesEmulator(true)
// Wrap in a shallowRef so useToolbarWindows can access it
const emuRef = shallowRef<NesEmulator | null>(null)

// Route both P1 and P2 bindings to the single emulator so all configured inputs work
const btnDown = (_p: number, btn: number) => emulator.buttonDown(1, btn)
const btnUp = (_p: number, btn: number) => emulator.buttonUp(1, btn)
const inputManager = useInputManager(btnDown, btnUp, btnDown, btnUp)

// Event log
const eventLog = useEventLog()
eventLog.configure(config.watchedAddresses)

// Toolbar popup windows
const toolbarWindows = useToolbarWindows({
  config,
  emus: [emuRef],
  eventLog,
})

// Volume / mute
const volume = ref(parseFloat(localStorage.getItem('nesRacer:volume') ?? '0.5'))
const muted = ref(localStorage.getItem('nesRacer:muted') === 'true')
const pixelated = ref(localStorage.getItem('nesRacer:pixelated') !== 'false')
const bareMode = ref(false)
let bareModeRaw = false

// FPS tracking
const fps = ref(60)
let fpsFrameCount = 0
let fpsLastTime = performance.now()
const perfWarning = computed(() => fps.value < 50)

// Genie codes from config
const genieCodes = ref<GenieCode[]>(
  config.genieCodes.map(gc => ({ ...gc, enabled: false }))
)

// Gamepad state
const connectedPads = ref<number[]>([])

function handleVolumeChange(v: number) {
  volume.value = v
  muted.value = v === 0
  localStorage.setItem('nesRacer:volume', String(v))
  localStorage.setItem('nesRacer:muted', String(v === 0))
  emulator.setVolume(v)
}

function handleMuteToggle() {
  muted.value = !muted.value
  localStorage.setItem('nesRacer:muted', String(muted.value))
  emulator.setVolume(muted.value ? 0 : volume.value)
}

function handleTogglePause() {
  if (emulator.paused.value) {
    emulator.resume()
  } else {
    emulator.pause()
  }
}

function togglePixelated() {
  pixelated.value = !pixelated.value
  localStorage.setItem('nesRacer:pixelated', String(pixelated.value))
}

function toggleBareMode() {
  bareMode.value = !bareMode.value
  bareModeRaw = bareMode.value
  if (bareMode.value) {
    toolbarWindows.stopIntervals()
    inputManager.stopGamepad()
  } else {
    inputManager.startGamepad()
  }
}

function handleToggleGenieCode(index: number) {
  const gc = genieCodes.value[index]
  gc.enabled = !gc.enabled
  const nes = emulator.getNes() as any
  if (!nes) return
  nes.gameGenie.removeAllCodes()
  for (const c of genieCodes.value) {
    if (c.enabled) nes.gameGenie.addCode(c.code)
  }
}

// Binding dialog state
const showBindDialog = ref(false)
const currentP1Bindings = ref<InputBinding>({ ...DEFAULT_P1 })
const currentP2Bindings = ref<InputBinding>({ ...DEFAULT_P2 })
const currentP1GpBindings = ref<InputBinding>({ ...DEFAULT_P1_GAMEPAD })
const currentP2GpBindings = ref<InputBinding>({ ...DEFAULT_P2_GAMEPAD })

function handleOpenBindings() {
  currentP1Bindings.value = { ...inputManager.p1Bindings.value }
  currentP2Bindings.value = { ...inputManager.p2Bindings.value }
  currentP1GpBindings.value = { ...inputManager.p1GamepadBindings.value }
  currentP2GpBindings.value = { ...inputManager.p2GamepadBindings.value }
  inputManager.detach()
  showBindDialog.value = true
}

function handleBindingsApply(p1: InputBinding, p2: InputBinding, p1Gp: InputBinding, p2Gp: InputBinding) {
  inputManager.updateBindings(p1, p2, p1Gp, p2Gp)
  currentP1Bindings.value = { ...p1 }
  currentP2Bindings.value = { ...p2 }
  currentP1GpBindings.value = { ...p1Gp }
  currentP2GpBindings.value = { ...p2Gp }
  showBindDialog.value = false
  inputManager.attach()
}

function handleBindingsClose() {
  showBindDialog.value = false
  inputManager.attach()
}

function handleBack() {
  emit('backToLobby')
}

onMounted(async () => {
  if (!canvasRef.value) return
  emulator.setCanvas(canvasRef.value)
  await emulator.loadROM(props.romUrl)
  emulator.start()
  inputManager.attach()
  connectedPads.value = inputManager.connectedPads.value

  // Store emulator ref for toolbar windows
  emuRef.value = emulator as unknown as NesEmulator

  // Per-frame polling for event log + FPS
  emulator.onFrame(() => {
    if (bareModeRaw) return

    fpsFrameCount++
    const now = performance.now()
    if (now - fpsLastTime >= 1000) {
      fps.value = fpsFrameCount
      fpsFrameCount = 0
      fpsLastTime = now
    }

    eventLog.poll(1, emulator.readMemory)
  })

  window.addEventListener('keydown', onKeyDown)
})

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Escape') { emit('backToLobby'); return }
}

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  inputManager.detach()
  emulator.stop()
  eventLog.reset()
})
</script>

<template>
  <div class="single-player">
    <RaceOverlay
      :volume="muted ? 0 : volume"
      :muted="muted"
      :fps="fps"
      :perf-warning="perfWarning"
      :p1-paused="emulator.paused.value"
      :p2-paused="emulator.paused.value"
      :event-log-count="eventLog.count.value"
      :connected-pads="connectedPads"
      :bare-mode="bareMode"
      :genie-codes="genieCodes"
      :pixelated="pixelated"
      @quit="handleBack"
      @update:volume="handleVolumeChange"
      @toggle-mute="handleMuteToggle"
      @toggle-pause="handleTogglePause"
      @open-event-log="toolbarWindows.openEventLog"
      @open-command-palette="toolbarWindows.openCommandPalette"
      @open-memory="toolbarWindows.openMemoryViewer"
      @open-bindings="handleOpenBindings"
      @toggle-bare-mode="toggleBareMode"
      @toggle-genie-code="handleToggleGenieCode"
      @toggle-pixelated="togglePixelated"
    />

    <div class="canvas-wrapper">
      <canvas ref="canvasRef" width="256" height="240" />
    </div>

    <BindDialog
      v-if="showBindDialog"
      :p1-bindings="currentP1Bindings"
      :p2-bindings="currentP2Bindings"
      :p1-gamepad-bindings="currentP1GpBindings"
      :p2-gamepad-bindings="currentP2GpBindings"
      @apply="handleBindingsApply"
      @close="handleBindingsClose"
    />
  </div>
</template>

<style scoped>
.single-player {
  width: 100vw;
  height: 100vh;
  background: #000;
  display: flex;
  flex-direction: column;
  position: relative;
}

.canvas-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

canvas {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  display: block;
  background: #000;
  will-change: contents;
  contain: strict;
}
</style>
