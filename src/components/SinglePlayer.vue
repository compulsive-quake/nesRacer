<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useNesEmulator } from '../composables/useNesEmulator'
import { useInputManager, DEFAULT_P1, DEFAULT_P2, DEFAULT_P1_GAMEPAD, DEFAULT_P2_GAMEPAD } from '../composables/useInputManager'
import BindDialog from './BindDialog.vue'
import type { InputBinding } from '../types'

const ROM_URL = '/roms/Super Mario Bros. (World).nes'

const emit = defineEmits<{
  backToLobby: []
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const emulator = useNesEmulator(true)

// Route both P1 and P2 bindings to the single emulator so all configured inputs work
const btnDown = (_p: number, btn: number) => emulator.buttonDown(1, btn)
const btnUp = (_p: number, btn: number) => emulator.buttonUp(1, btn)
const inputManager = useInputManager(btnDown, btnUp, btnDown, btnUp)

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

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Escape') { emit('backToLobby'); return }
}

onMounted(async () => {
  if (!canvasRef.value) return
  emulator.setCanvas(canvasRef.value)
  await emulator.loadROM(ROM_URL)
  emulator.start()
  inputManager.attach()
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  inputManager.detach()
  emulator.stop()
})
</script>

<template>
  <div class="single-player">
    <div class="top-bar">
      <button class="bar-btn" @click="emit('backToLobby')">&#x2190; Back</button>
      <button class="bar-btn" @click="handleOpenBindings">Bindings</button>
    </div>
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
  align-items: center;
  justify-content: center;
  position: relative;
}

.top-bar {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 10;
  display: flex;
  gap: 0.4rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.single-player:hover .top-bar {
  opacity: 1;
}

.bar-btn {
  padding: 0.4rem 0.8rem;
  border: 1px solid #444;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.6);
  color: #ccc;
  cursor: pointer;
  font-size: 0.85rem;
  font-family: inherit;
  transition:0.15s;
}

.bar-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.canvas-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
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
