<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import type { InputBinding, NesButton } from '../types'
import { NES_BUTTONS } from '../types'
import { keyCodeToLabel, isGamepadCode } from '../utils/keyLabels'
import { useBindingPresets } from '../composables/useBindingPresets'
import { listenForGamepadInput } from '../composables/useGamepad'
import NesControllerPreview from './NesControllerPreview.vue'

const props = defineProps<{
  p1Bindings: InputBinding
  p2Bindings: InputBinding
}>()

const emit = defineEmits<{
  close: []
  apply: [p1: InputBinding, p2: InputBinding]
}>()

const editP1 = ref<InputBinding>({ ...props.p1Bindings })
const editP2 = ref<InputBinding>({ ...props.p2Bindings })
const listeningFor = ref<{ player: 1 | 2; button: NesButton } | null>(null)

const { presets, addPreset, removePreset, getPreset } = useBindingPresets()
const selectedPresetId = ref(presets.value[0]?.id ?? '')
const newPresetName = ref('')

const BUTTON_LABELS: Record<NesButton, string> = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right',
  a: 'A', b: 'B', start: 'Start', select: 'Select',
}

// Conflict detection: find keys assigned more than once
const conflicts = computed(() => {
  const seen = new Map<string, { player: 1 | 2; button: NesButton }[]>()
  for (const btn of NES_BUTTONS) {
    const k1 = editP1.value[btn]
    const k2 = editP2.value[btn]
    if (!seen.has(k1)) seen.set(k1, [])
    seen.get(k1)!.push({ player: 1, button: btn })
    if (!seen.has(k2)) seen.set(k2, [])
    seen.get(k2)!.push({ player: 2, button: btn })
  }
  const dupes: string[] = []
  for (const [code, entries] of seen) {
    if (entries.length > 1) dupes.push(code)
  }
  return dupes
})

function hasConflict(player: 1 | 2, btn: NesButton): boolean {
  const code = player === 1 ? editP1.value[btn] : editP2.value[btn]
  return conflicts.value.includes(code)
}

function startListening(player: 1 | 2, btn: NesButton) {
  listeningFor.value = { player, button: btn }
}

function onKeyCapture(e: KeyboardEvent) {
  if (!listeningFor.value) return
  e.preventDefault()
  e.stopPropagation()

  // Escape cancels listening
  if (e.code === 'Escape') {
    listeningFor.value = null
    return
  }

  const { player, button } = listeningFor.value
  if (player === 1) {
    editP1.value = { ...editP1.value, [button]: e.code }
  } else {
    editP2.value = { ...editP2.value, [button]: e.code }
  }
  listeningFor.value = null
}

function loadPreset() {
  const preset = getPreset(selectedPresetId.value)
  if (!preset) return
  editP1.value = { ...preset.p1 }
  editP2.value = { ...preset.p2 }
}

function savePreset() {
  const name = newPresetName.value.trim()
  if (!name) return
  const p = addPreset(name, editP1.value, editP2.value)
  selectedPresetId.value = p.id
  newPresetName.value = ''
}

function deletePreset() {
  const preset = getPreset(selectedPresetId.value)
  if (!preset || preset.builtIn) return
  removePreset(selectedPresetId.value)
  selectedPresetId.value = presets.value[0]?.id ?? ''
}

// --- Pressed-state tracking for controller preview ---
const pressedCodes = reactive(new Set<string>())

function onPreviewKeyDown(e: KeyboardEvent) {
  if (listeningFor.value) return // binding capture is active
  pressedCodes.add(e.code)
}
function onPreviewKeyUp(e: KeyboardEvent) {
  pressedCodes.delete(e.code)
}

// Gamepad polling for preview (runs continuously while dialog is open)
let previewRafId = 0
const prevGpButtons = new Map<number, boolean[]>()
const prevGpAxes = new Map<number, number[]>()
const GP_AXIS_THRESHOLD = 0.5

function pollGamepadPreview() {
  const gamepads = navigator.getGamepads()
  for (const gp of gamepads) {
    if (!gp) continue
    const prev = prevGpButtons.get(gp.index) ?? []
    const curr: boolean[] = []
    for (let i = 0; i < gp.buttons.length; i++) {
      const pressed = gp.buttons[i].pressed
      curr[i] = pressed
      const code = `GP${gp.index}:B${i}`
      if (pressed && !(prev[i] ?? false)) pressedCodes.add(code)
      else if (!pressed && (prev[i] ?? false)) pressedCodes.delete(code)
    }
    prevGpButtons.set(gp.index, curr)

    const prevAx = prevGpAxes.get(gp.index) ?? []
    const currAx: number[] = []
    for (let i = 0; i < gp.axes.length; i++) {
      const val = gp.axes[i]
      const dir = val > GP_AXIS_THRESHOLD ? 1 : val < -GP_AXIS_THRESHOLD ? -1 : 0
      currAx[i] = dir
      const prevDir = prevAx[i] ?? 0
      if (dir !== prevDir) {
        if (prevDir === 1) pressedCodes.delete(`GP${gp.index}:AX${i}+`)
        else if (prevDir === -1) pressedCodes.delete(`GP${gp.index}:AX${i}-`)
        if (dir === 1) pressedCodes.add(`GP${gp.index}:AX${i}+`)
        else if (dir === -1) pressedCodes.add(`GP${gp.index}:AX${i}-`)
      }
    }
    prevGpAxes.set(gp.index, currAx)
  }
  previewRafId = requestAnimationFrame(pollGamepadPreview)
}

function pressedForPlayer(bindings: InputBinding): Set<NesButton> {
  const s = new Set<NesButton>()
  for (const btn of NES_BUTTONS) {
    if (pressedCodes.has(bindings[btn])) s.add(btn)
  }
  return s
}

const p1Pressed = computed(() => pressedForPlayer(editP1.value))
const p2Pressed = computed(() => pressedForPlayer(editP2.value))

function applyBindings() {
  if (conflicts.value.length > 0) return
  emit('apply', editP1.value, editP2.value)
}

// Gamepad input capture — active only while listening for a binding
let stopGamepadListen: (() => void) | null = null

watch(listeningFor, (val) => {
  // Clean up previous listener
  if (stopGamepadListen) { stopGamepadListen(); stopGamepadListen = null }
  if (!val) return

  stopGamepadListen = listenForGamepadInput((code) => {
    if (!listeningFor.value) return
    const { player, button } = listeningFor.value
    if (player === 1) {
      editP1.value = { ...editP1.value, [button]: code }
    } else {
      editP2.value = { ...editP2.value, [button]: code }
    }
    listeningFor.value = null
  })
})

onMounted(() => {
  window.addEventListener('keydown', onKeyCapture, true)
  window.addEventListener('keydown', onPreviewKeyDown)
  window.addEventListener('keyup', onPreviewKeyUp)
  previewRafId = requestAnimationFrame(pollGamepadPreview)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyCapture, true)
  window.removeEventListener('keydown', onPreviewKeyDown)
  window.removeEventListener('keyup', onPreviewKeyUp)
  cancelAnimationFrame(previewRafId)
  if (stopGamepadListen) { stopGamepadListen(); stopGamepadListen = null }
})
</script>

<template>
  <div class="dialog-backdrop" @click="emit('close')">
    <div class="bind-dialog" @click.stop>
      <div class="bind-title">Key Bindings</div>

      <div v-if="conflicts.length" class="conflict-banner">
        Duplicate key assignments detected — resolve before applying.
      </div>

      <div class="bind-body">
        <div class="bind-left">
          <div class="bind-columns">
            <div class="bind-col">
              <div class="bind-col-header">P1 (Mario)</div>
              <div v-for="btn in NES_BUTTONS" :key="btn" class="bind-row">
                <span class="bind-action">{{ BUTTON_LABELS[btn] }}</span>
                <button
                  class="bind-key"
                  :class="{
                    listening: listeningFor?.player === 1 && listeningFor?.button === btn,
                    conflict: hasConflict(1, btn),
                  }"
                  @click="startListening(1, btn)"
                >
                  {{ listeningFor?.player === 1 && listeningFor?.button === btn
                    ? 'Press key/button...'
                    : keyCodeToLabel(editP1[btn]) }}
                </button>
              </div>
            </div>
            <div class="bind-col">
              <div class="bind-col-header">P2 (Luigi)</div>
              <div v-for="btn in NES_BUTTONS" :key="btn" class="bind-row">
                <span class="bind-action">{{ BUTTON_LABELS[btn] }}</span>
                <button
                  class="bind-key"
                  :class="{
                    listening: listeningFor?.player === 2 && listeningFor?.button === btn,
                    conflict: hasConflict(2, btn),
                  }"
                  @click="startListening(2, btn)"
                >
                  {{ listeningFor?.player === 2 && listeningFor?.button === btn
                    ? 'Press key/button...'
                    : keyCodeToLabel(editP2[btn]) }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="bind-preview">
          <NesControllerPreview :pressed="p1Pressed" label="P1 Preview" />
          <NesControllerPreview :pressed="p2Pressed" label="P2 Preview" />
        </div>
      </div>

      <div class="preset-section">
        <div class="preset-header">Presets</div>
        <div class="preset-row">
          <select v-model="selectedPresetId" class="preset-select">
            <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <button class="preset-btn" @click="loadPreset" title="Load">Load</button>
          <button
            class="preset-btn danger"
            @click="deletePreset"
            :disabled="getPreset(selectedPresetId)?.builtIn"
            title="Delete"
          >Del</button>
        </div>
        <div class="preset-row">
          <input
            v-model="newPresetName"
            class="preset-input"
            placeholder="Preset name..."
            @keydown.enter="savePreset"
          />
          <button class="preset-btn" @click="savePreset" :disabled="!newPresetName.trim()">Save</button>
        </div>
      </div>

      <div class="bind-actions">
        <button class="bind-btn cancel" @click="emit('close')">Cancel</button>
        <button class="bind-btn apply" @click="applyBindings" :disabled="conflicts.length > 0">Apply</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.bind-dialog {
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 1.2rem;
  min-width: 480px;
  max-width: 800px;
}

.bind-body {
  display: flex;
  gap: 1.2rem;
}

.bind-left {
  flex: 1;
  min-width: 0;
}

.bind-preview {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
  padding: 0.4rem 0;
  border-left: 1px solid #333;
  padding-left: 1.2rem;
}

.bind-title {
  font-size: 0.9rem;
  font-weight: bold;
  color: #fff;
  padding-bottom: 0.6rem;
  margin-bottom: 0.8rem;
  border-bottom: 1px solid #333;
}

.conflict-banner {
  background: rgba(229, 57, 53, 0.15);
  border: 1px solid rgba(229, 57, 53, 0.4);
  border-radius: 4px;
  padding: 0.4rem 0.6rem;
  font-size: 0.75rem;
  color: #e53935;
  margin-bottom: 0.8rem;
}

.bind-columns {
  display: flex;
  gap: 1.2rem;
}

.bind-col {
  flex: 1;
}

.bind-col-header {
  font-size: 0.7rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #aaa;
  margin-bottom: 0.5rem;
}

.bind-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.3rem;
}

.bind-action {
  font-size: 0.78rem;
  color: #ccc;
  min-width: 50px;
}

.bind-key {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid #333;
  border-radius: 6px;
  color: #fff;
  font-size: 0.75rem;
  padding: 0.3rem 0.6rem;
  min-width: 80px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  font-family: inherit;
}

.bind-key:hover {
  border-color: #666;
  background: rgba(255, 255, 255, 0.12);
}

.bind-key.listening {
  border-color: #4dabf7;
  color: #4dabf7;
  animation: pulse 1s infinite;
}

.bind-key.conflict {
  border-color: #e53935;
  color: #e53935;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.preset-section {
  margin-top: 0.8rem;
  padding-top: 0.8rem;
  border-top: 1px solid #333;
}

.preset-header {
  font-size: 0.7rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #aaa;
  margin-bottom: 0.5rem;
}

.preset-row {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.preset-select {
  flex: 1;
  background: #222;
  border: 1px solid #444;
  border-radius: 4px;
  color: #fff;
  font-size: 0.75rem;
  padding: 0.3rem 0.4rem;
  font-family: inherit;
}

.preset-input {
  flex: 1;
  background: #222;
  border: 1px solid #444;
  border-radius: 4px;
  color: #fff;
  font-size: 0.75rem;
  padding: 0.3rem 0.4rem;
  outline: none;
  font-family: inherit;
}

.preset-input:focus {
  border-color: #666;
}

.preset-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #444;
  border-radius: 4px;
  color: #ccc;
  font-size: 0.7rem;
  padding: 0.3rem 0.6rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  font-family: inherit;
}

.preset-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.preset-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.preset-btn.danger:hover:not(:disabled) {
  background: rgba(229, 57, 53, 0.25);
  color: #e53935;
}

.bind-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.bind-btn {
  border: 1px solid #444;
  border-radius: 6px;
  padding: 0.4rem 1rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  font-family: inherit;
}

.bind-btn.cancel {
  background: transparent;
  color: #aaa;
}

.bind-btn.cancel:hover {
  color: #fff;
  border-color: #666;
}

.bind-btn.apply {
  background: rgba(76, 175, 80, 0.2);
  border-color: rgba(76, 175, 80, 0.5);
  color: #4caf50;
}

.bind-btn.apply:hover:not(:disabled) {
  background: rgba(76, 175, 80, 0.3);
  color: #66bb6a;
}

.bind-btn.apply:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
