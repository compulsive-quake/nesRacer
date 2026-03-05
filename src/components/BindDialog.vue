<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import type { InputBinding, NesButton } from '../types'
import { NES_BUTTONS } from '../types'
import { keyCodeToLabel, isGamepadCode } from '../utils/keyLabels'
import { useBindingPresets } from '../composables/useBindingPresets'
import { listenForGamepadInput, listenForGamepadAssign } from '../composables/useGamepad'
import { defaultGamepadBindings } from '../composables/useInputManager'
import NesControllerPreview from './NesControllerPreview.vue'

const props = defineProps<{
  p1Bindings: InputBinding
  p2Bindings: InputBinding
  p1GamepadBindings: InputBinding
  p2GamepadBindings: InputBinding
}>()

const emit = defineEmits<{
  close: []
  apply: [p1: InputBinding, p2: InputBinding, p1Gp: InputBinding, p2Gp: InputBinding]
}>()

const editP1 = ref<InputBinding>({ ...props.p1Bindings })
const editP2 = ref<InputBinding>({ ...props.p2Bindings })
const editP1Gp = ref<InputBinding>({ ...props.p1GamepadBindings })
const editP2Gp = ref<InputBinding>({ ...props.p2GamepadBindings })
const listeningFor = ref<{ player: 1 | 2; button: NesButton; source: 'keyboard' | 'gamepad' } | null>(null)

const { presets, addPreset, removePreset, getPreset } = useBindingPresets()
const selectedPresetId = ref(presets.value[0]?.id ?? '')
const newPresetName = ref('')

const BUTTON_LABELS: Record<NesButton, string> = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right',
  a: 'A', b: 'B', start: 'Start', select: 'Select',
}

// Conflict detection: find keys assigned more than once (within same source type)
const conflicts = computed(() => {
  const seen = new Map<string, { player: 1 | 2; button: NesButton; source: string }[]>()
  function add(code: string, player: 1 | 2, button: NesButton, source: string) {
    if (!seen.has(code)) seen.set(code, [])
    seen.get(code)!.push({ player, button, source })
  }
  for (const btn of NES_BUTTONS) {
    add(editP1.value[btn], 1, btn, 'keyboard')
    add(editP2.value[btn], 2, btn, 'keyboard')
    add(editP1Gp.value[btn], 1, btn, 'gamepad')
    add(editP2Gp.value[btn], 2, btn, 'gamepad')
  }
  const dupes: string[] = []
  for (const [code, entries] of seen) {
    if (entries.length > 1) dupes.push(code)
  }
  return dupes
})

function hasConflict(player: 1 | 2, btn: NesButton, source: 'keyboard' | 'gamepad'): boolean {
  const binding = source === 'keyboard'
    ? (player === 1 ? editP1.value : editP2.value)
    : (player === 1 ? editP1Gp.value : editP2Gp.value)
  return conflicts.value.includes(binding[btn])
}

function startListening(player: 1 | 2, btn: NesButton, source: 'keyboard' | 'gamepad') {
  listeningFor.value = { player, button: btn, source }
}

function setBinding(player: 1 | 2, button: NesButton, source: 'keyboard' | 'gamepad', code: string) {
  if (source === 'keyboard') {
    if (player === 1) editP1.value = { ...editP1.value, [button]: code }
    else editP2.value = { ...editP2.value, [button]: code }
  } else {
    if (player === 1) editP1Gp.value = { ...editP1Gp.value, [button]: code }
    else editP2Gp.value = { ...editP2Gp.value, [button]: code }
  }
}

function onKeyCapture(e: KeyboardEvent) {
  if (!listeningFor.value) return
  e.preventDefault()
  e.stopPropagation()

  if (e.code === 'Escape') {
    listeningFor.value = null
    return
  }

  const { player, button, source } = listeningFor.value
  // Only accept keyboard codes for keyboard slots
  if (source === 'keyboard') {
    setBinding(player, button, source, e.code)
    listeningFor.value = null
  }
}

function loadPreset() {
  const preset = getPreset(selectedPresetId.value)
  if (!preset) return
  editP1.value = { ...preset.p1 }
  editP2.value = { ...preset.p2 }
  editP1Gp.value = { ...preset.p1Gamepad }
  editP2Gp.value = { ...preset.p2Gamepad }
}

function savePreset() {
  const name = newPresetName.value.trim()
  if (!name) return
  const p = addPreset(name, editP1.value, editP2.value, editP1Gp.value, editP2Gp.value)
  selectedPresetId.value = p.id
  newPresetName.value = ''
}

function deletePreset() {
  const preset = getPreset(selectedPresetId.value)
  if (!preset || preset.builtIn) return
  removePreset(selectedPresetId.value)
  selectedPresetId.value = presets.value[0]?.id ?? ''
}

// --- Controller assignment ---
const assigningPlayer = ref<1 | 2 | null>(null)
let stopAssignListen: (() => void) | null = null

function startAssign(player: 1 | 2) {
  cancelAssign()
  assigningPlayer.value = player
  stopAssignListen = listenForGamepadAssign((gpIndex) => {
    const bindings = defaultGamepadBindings(gpIndex)
    if (player === 1) editP1Gp.value = { ...bindings }
    else editP2Gp.value = { ...bindings }
    assigningPlayer.value = null
    stopAssignListen = null
  })
}

function cancelAssign() {
  if (stopAssignListen) { stopAssignListen(); stopAssignListen = null }
  assigningPlayer.value = null
}

// --- Pressed-state tracking for controller preview ---
const pressedCodes = reactive(new Set<string>())

function onPreviewKeyDown(e: KeyboardEvent) {
  if (listeningFor.value) return
  pressedCodes.add(e.code)
}
function onPreviewKeyUp(e: KeyboardEvent) {
  pressedCodes.delete(e.code)
}

// Gamepad polling for preview
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

function pressedForPlayer(kbBindings: InputBinding, gpBindings: InputBinding): Set<NesButton> {
  const s = new Set<NesButton>()
  for (const btn of NES_BUTTONS) {
    if (pressedCodes.has(kbBindings[btn]) || pressedCodes.has(gpBindings[btn])) s.add(btn)
  }
  return s
}

const p1Pressed = computed(() => pressedForPlayer(editP1.value, editP1Gp.value))
const p2Pressed = computed(() => pressedForPlayer(editP2.value, editP2Gp.value))

function applyBindings() {
  if (conflicts.value.length > 0) return
  emit('apply', editP1.value, editP2.value, editP1Gp.value, editP2Gp.value)
}

// Gamepad input capture — active only while listening for a binding
let stopGamepadListen: (() => void) | null = null

watch(listeningFor, (val) => {
  if (stopGamepadListen) { stopGamepadListen(); stopGamepadListen = null }
  if (!val) return

  // For gamepad slots, listen for gamepad input
  if (val.source === 'gamepad') {
    stopGamepadListen = listenForGamepadInput((code) => {
      if (!listeningFor.value) return
      const { player, button, source } = listeningFor.value
      setBinding(player, button, source, code)
      listeningFor.value = null
    })
  }
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
  cancelAssign()
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
            <!-- P1 -->
            <div class="bind-col">
              <div class="bind-col-header">
                P1 (Mario)
                <button
                  class="assign-btn"
                  :class="{ listening: assigningPlayer === 1 }"
                  @click="assigningPlayer === 1 ? cancelAssign() : startAssign(1)"
                >
                  {{ assigningPlayer === 1 ? 'Press any button...' : 'Assign Controller' }}
                </button>
              </div>
              <div class="bind-sub-headers">
                <span class="bind-action"></span>
                <span class="bind-sub-label">Keyboard</span>
                <span class="bind-sub-label">Controller</span>
              </div>
              <div v-for="btn in NES_BUTTONS" :key="btn" class="bind-row">
                <span class="bind-action">{{ BUTTON_LABELS[btn] }}</span>
                <button
                  class="bind-key"
                  :class="{
                    listening: listeningFor?.player === 1 && listeningFor?.button === btn && listeningFor?.source === 'keyboard',
                    conflict: hasConflict(1, btn, 'keyboard'),
                  }"
                  @click="startListening(1, btn, 'keyboard')"
                >
                  {{ listeningFor?.player === 1 && listeningFor?.button === btn && listeningFor?.source === 'keyboard'
                    ? 'Press key...'
                    : keyCodeToLabel(editP1[btn]) }}
                </button>
                <button
                  class="bind-key gamepad-key"
                  :class="{
                    listening: listeningFor?.player === 1 && listeningFor?.button === btn && listeningFor?.source === 'gamepad',
                    conflict: hasConflict(1, btn, 'gamepad'),
                  }"
                  @click="startListening(1, btn, 'gamepad')"
                >
                  {{ listeningFor?.player === 1 && listeningFor?.button === btn && listeningFor?.source === 'gamepad'
                    ? 'Press btn...'
                    : keyCodeToLabel(editP1Gp[btn]) }}
                </button>
              </div>
            </div>
            <!-- P2 -->
            <div class="bind-col">
              <div class="bind-col-header">
                P2 (Luigi)
                <button
                  class="assign-btn"
                  :class="{ listening: assigningPlayer === 2 }"
                  @click="assigningPlayer === 2 ? cancelAssign() : startAssign(2)"
                >
                  {{ assigningPlayer === 2 ? 'Press any button...' : 'Assign Controller' }}
                </button>
              </div>
              <div class="bind-sub-headers">
                <span class="bind-action"></span>
                <span class="bind-sub-label">Keyboard</span>
                <span class="bind-sub-label">Controller</span>
              </div>
              <div v-for="btn in NES_BUTTONS" :key="btn" class="bind-row">
                <span class="bind-action">{{ BUTTON_LABELS[btn] }}</span>
                <button
                  class="bind-key"
                  :class="{
                    listening: listeningFor?.player === 2 && listeningFor?.button === btn && listeningFor?.source === 'keyboard',
                    conflict: hasConflict(2, btn, 'keyboard'),
                  }"
                  @click="startListening(2, btn, 'keyboard')"
                >
                  {{ listeningFor?.player === 2 && listeningFor?.button === btn && listeningFor?.source === 'keyboard'
                    ? 'Press key...'
                    : keyCodeToLabel(editP2[btn]) }}
                </button>
                <button
                  class="bind-key gamepad-key"
                  :class="{
                    listening: listeningFor?.player === 2 && listeningFor?.button === btn && listeningFor?.source === 'gamepad',
                    conflict: hasConflict(2, btn, 'gamepad'),
                  }"
                  @click="startListening(2, btn, 'gamepad')"
                >
                  {{ listeningFor?.player === 2 && listeningFor?.button === btn && listeningFor?.source === 'gamepad'
                    ? 'Press btn...'
                    : keyCodeToLabel(editP2Gp[btn]) }}
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
  min-width: 580px;
  max-width: 960px;
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
  margin-bottom: 0.3rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.assign-btn {
  font-size: 0.6rem;
  font-family: inherit;
  padding: 0.15rem 0.4rem;
  border: 1px solid #555;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #aed581;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
  text-transform: none;
  letter-spacing: normal;
  font-weight: normal;
}

.assign-btn:hover {
  border-color: #aed581;
  background: rgba(174, 213, 129, 0.12);
}

.assign-btn.listening {
  border-color: #4dabf7;
  color: #4dabf7;
  animation: pulse 1s infinite;
}

.bind-sub-headers {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 0.3rem;
}

.bind-sub-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #666;
  min-width: 70px;
  text-align: center;
}

.bind-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 0.3rem;
}

.bind-action {
  font-size: 0.78rem;
  color: #ccc;
  min-width: 42px;
}

.bind-key {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid #333;
  border-radius: 6px;
  color: #fff;
  font-size: 0.68rem;
  padding: 0.25rem 0.4rem;
  min-width: 70px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  font-family: inherit;
}

.bind-key.gamepad-key {
  color: #aed581;
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
