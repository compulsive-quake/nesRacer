<script setup lang="ts">
import { ref } from 'vue';
import type { RaceState } from '../types';

const props = defineProps<{
  state: RaceState
  volume: number
  muted: boolean
  fps?: number
  perfWarning?: boolean
  p1Paused?: boolean
  p2Paused?: boolean
  godMode?: boolean
  eventLogCount?: number
  p1Sound?: boolean
  p2Sound?: boolean
  p1Music?: boolean
  p2Music?: boolean
}>();

const emit = defineEmits<{
  quit: []
  'update:volume': [volume: number]
  'toggle-mute': []
  'toggle-p1-sound': []
  'toggle-p2-sound': []
  'toggle-p1-music': []
  'toggle-p2-music': []
  'skip-level': []
  'next-screen': []
  'toggle-god-mode': []
  'open-memory': []
  'open-recorder': []
  'open-event-log': []
  'open-command-palette': []
  'restart-level': [mode: number]
  'toggle-pause': []
}>();

const showDebugPanel = ref(false);
const showRestartDialog = ref(false);
const showSettingsModal = ref(false);

function onVolumeInput(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value);
  emit('update:volume', val);
}

function toggleDebugPanel() {
  showDebugPanel.value = !showDebugPanel.value;
}

function closeDebugPanel() {
  showDebugPanel.value = false;
}
</script>

<template>
  <div class="race-overlay">
    <!-- Race Over -->
    <div v-if="state.phase === 'race-over'" class="overlay-center">
      <div class="race-over-banner">
        <div class="race-over-title">Race Over!</div>
        <div class="final-scores">
          <div class="score" :class="{ winner: state.p1Score > state.p2Score }">
            P1: {{ state.p1Score }}
          </div>
          <div class="score-divider">-</div>
          <div class="score" :class="{ winner: state.p2Score > state.p1Score }">
            P2: {{ state.p2Score }}
          </div>
        </div>
        <div class="final-winner">
          <template v-if="state.p1Score > state.p2Score">
            Player 1 is the Champion!
          </template>
          <template v-else-if="state.p2Score > state.p1Score">
            Player 2 is the Champion!
          </template>
          <template v-else>
            It's a Tie!
          </template>
        </div>
      </div>
    </div>

    <!-- Header Bar (always visible) -->
    <div class="score-bar">
      <button class="quit-btn" @click="emit('quit')" title="Quit to Lobby">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <button class="pause-btn" @click="emit('toggle-pause')" :title="p1Paused && p2Paused ? 'Resume' : 'Pause'">
        <svg v-if="p1Paused && p2Paused" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 2l10 6-10 6V2z" fill="currentColor"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="3" y="2" width="4" height="12" rx="1" fill="currentColor"/>
          <rect x="9" y="2" width="4" height="12" rx="1" fill="currentColor"/>
        </svg>
      </button>
      <span class="score-item">
        P1: {{ state.p1Score }}
        <span class="emu-status" :class="p1Paused ? 'paused' : 'playing'">
          {{ p1Paused ? 'PAUSED' : 'PLAYING' }}
        </span>
      </span>
      <span class="level-display">World {{ state.currentWorld }}-{{ state.currentLevel }}</span>
      <span class="score-item">
        P2: {{ state.p2Score }}
        <span class="emu-status" :class="p2Paused ? 'paused' : 'playing'">
          {{ p2Paused ? 'PAUSED' : 'PLAYING' }}
        </span>
      </span>
      <span class="fps-display" :class="{ warn: perfWarning }">
        <svg v-if="perfWarning" class="warn-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L1 14h14L8 1z" fill="currentColor" opacity="0.9"/>
          <path d="M8 6v4M8 11.5v.5" stroke="#111" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        {{ fps ?? 60 }} FPS
      </span>
      <div class="debug-wrapper">
        <button class="debug-btn" :class="{ active: showDebugPanel }" @click="toggleDebugPanel" title="Debug Tools">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6.5 1.5L5.5 3.5M9.5 1.5L10.5 3.5M4 6L1.5 5M12 6L14.5 5M4 10L1.5 11.5M12 10L14.5 11.5M5.5 13L5 15.5M10.5 13L11 15.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <rect x="4" y="3.5" width="8" height="10" rx="4" stroke="currentColor" stroke-width="1.2" fill="none"/>
            <circle cx="6.5" cy="7" r="1" fill="currentColor"/>
            <circle cx="9.5" cy="7" r="1" fill="currentColor"/>
            <path d="M6 9.5Q8 11 10 9.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" fill="none"/>
          </svg>
        </button>
        <div v-if="showDebugPanel" class="debug-panel" @click.stop>
          <div class="debug-panel-title">Debug Tools</div>
          <button class="debug-action" @click="emit('skip-level'); closeDebugPanel()">
            Skip Level
          </button>
          <button class="debug-action" @click="emit('next-screen')">
            Next Screen (P1)
          </button>
          <button class="debug-action" :class="{ toggled: godMode }" @click="emit('toggle-god-mode')">
            God Mode: {{ godMode ? 'ON' : 'OFF' }}
          </button>
          <button class="debug-action" @click="emit('open-memory'); closeDebugPanel()">
            Memory Viewer
          </button>
          <button class="debug-action" @click="emit('open-recorder'); closeDebugPanel()">
            Memory Recorder
          </button>
          <button class="debug-action event-log-btn" @click="emit('open-event-log'); closeDebugPanel()">
            Event Log
            <span v-if="eventLogCount" class="event-badge">{{ eventLogCount }}</span>
          </button>
          <button class="debug-action" @click="emit('open-command-palette'); closeDebugPanel()">
            Command Palette
          </button>
          <button class="debug-action" @click="showRestartDialog = true; closeDebugPanel()">
            Restart Control
          </button>
        </div>
        <div v-if="showDebugPanel" class="debug-backdrop" @click="closeDebugPanel" />
      </div>
      <button class="settings-btn" @click="showSettingsModal = true" title="Settings">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6.7 1h2.6l.3 1.8.9.4 1.5-1 1.8 1.8-1 1.5.4.9 1.8.3v2.6l-1.8.3-.4.9 1 1.5-1.8 1.8-1.5-1-.9.4-.3 1.8H6.7l-.3-1.8-.9-.4-1.5 1-1.8-1.8 1-1.5-.4-.9L1 9.3V6.7l1.8-.3.4-.9-1-1.5L4 2.2l1.5 1 .9-.4L6.7 1z" stroke="currentColor" stroke-width="1.2" fill="none"/>
          <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.2" fill="none"/>
        </svg>
      </button>
      <div class="volume-controls">
        <button class="mute-btn" @click="emit('toggle-mute')" :title="muted ? 'Unmute' : 'Mute'">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <template v-if="muted">
              <path d="M2 5.5h2.5L8 2.5v11l-3.5-3H2V5.5z" fill="currentColor"/>
              <path d="M11 5.5l4 5M15 5.5l-4 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </template>
            <template v-else>
              <path d="M2 5.5h2.5L8 2.5v11l-3.5-3H2V5.5z" fill="currentColor"/>
              <path d="M10.5 4.5a4.5 4.5 0 010 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
              <path d="M12.5 2.5a7.5 7.5 0 010 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            </template>
          </svg>
        </button>
        <input
          type="range"
          class="volume-slider"
          min="0"
          max="1"
          step="0.05"
          :value="muted ? 0 : volume"
          @input="onVolumeInput"
        />
      </div>
    </div>

    <!-- Settings Modal -->
    <div v-if="showSettingsModal" class="dialog-backdrop" @click="showSettingsModal = false">
      <div class="settings-dialog" @click.stop>
        <div class="settings-title">Settings</div>
        <div class="settings-columns">
          <div class="settings-col">
            <div class="settings-col-header">P1</div>
            <label class="settings-toggle" @click="emit('toggle-p1-sound')">
              <span class="toggle-label">Sound</span>
              <span class="toggle-switch" :class="{ on: p1Sound }">
                <span class="toggle-knob" />
              </span>
            </label>
            <label class="settings-toggle" @click="emit('toggle-p1-music')">
              <span class="toggle-label">Music</span>
              <span class="toggle-switch" :class="{ on: p1Music }">
                <span class="toggle-knob" />
              </span>
            </label>
          </div>
          <div class="settings-col">
            <div class="settings-col-header">P2</div>
            <label class="settings-toggle" @click="emit('toggle-p2-sound')">
              <span class="toggle-label">Sound</span>
              <span class="toggle-switch" :class="{ on: p2Sound }">
                <span class="toggle-knob" />
              </span>
            </label>
            <label class="settings-toggle" @click="emit('toggle-p2-music')">
              <span class="toggle-label">Music</span>
              <span class="toggle-switch" :class="{ on: p2Music }">
                <span class="toggle-knob" />
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Restart Control Dialog -->
    <div v-if="showRestartDialog" class="dialog-backdrop" @click="showRestartDialog = false">
      <div class="restart-dialog" @click.stop>
        <div class="restart-dialog-title">Restart Control <span class="restart-addr">$0772</span></div>
        <div class="restart-dialog-desc">Write to Level Loading Setting — affects both players</div>
        <div class="restart-options">
          <button class="restart-option" @click="emit('restart-level', 0x00); showRestartDialog = false">
            <span class="restart-value">$00</span>
            <span class="restart-label">Restart Level</span>
            <span class="restart-hint">Restarts the current level from the beginning</span>
          </button>
          <button class="restart-option" @click="emit('restart-level', 0x01); showRestartDialog = false">
            <span class="restart-value">$01</span>
            <span class="restart-label">Pre-Level Start</span>
            <span class="restart-hint">Right before the start of a level</span>
          </button>
          <button class="restart-option" @click="emit('restart-level', 0x02); showRestartDialog = false">
            <span class="restart-value">$02</span>
            <span class="restart-label">Skip Frame/Input</span>
            <span class="restart-hint">Has an effect but unclear — may skip a frame or input</span>
          </button>
          <button class="restart-option" @click="emit('restart-level', 0x03); showRestartDialog = false">
            <span class="restart-value">$03</span>
            <span class="restart-label">Reset (Bonus Warp)</span>
            <span class="restart-hint">Resets level — mid-level may teleport to bonus levels</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.race-overlay {
  flex-shrink: 0;
  z-index: 10;
}

.overlay-center {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  pointer-events: auto;
  z-index: 20;
}

.race-over-banner {
  text-align: center;
}

.race-over-title {
  font-size: 3rem;
  font-weight: bold;
  color: #fff;
  margin-bottom: 2rem;
}

.final-scores {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  font-size: 2.5rem;
  color: #fff;
  margin-bottom: 1.5rem;
}

.score.winner {
  color: #ffd700;
  text-shadow: 0 0 15px rgba(255, 215, 0, 0.6);
}

.score-divider {
  color: #666;
}

.final-winner {
  font-size: 1.5rem;
  color: #ffd700;
}

.score-bar {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 1rem;
  gap: 1rem;
}

.score-bar .score-item {
  flex: 1;
}

.score-bar .score-item:last-child {
  text-align: right;
}

.quit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  flex-shrink: 0;
}

.quit-btn:hover {
  background: rgba(255, 70, 70, 0.3);
  color: #ff4646;
}

.pause-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  flex-shrink: 0;
}

.pause-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.level-display {
  color: #aaa;
}

.emu-status {
  font-size: 0.6rem;
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 0.4rem;
  font-variant-numeric: tabular-nums;
  vertical-align: middle;
}

.emu-status.playing {
  color: #4caf50;
  background: rgba(76, 175, 80, 0.15);
}

.emu-status.paused {
  color: #ff4444;
  background: rgba(255, 68, 68, 0.15);
}

.fps-display {
  font-size: 0.75rem;
  color: #666;
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 3.5rem;
}

.fps-display.warn {
  color: #ff8800;
}

.warn-icon {
  flex-shrink: 0;
}

.debug-wrapper {
  position: relative;
  flex-shrink: 0;
}

.debug-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  flex-shrink: 0;
}

.debug-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.debug-btn.active {
  background: rgba(255, 180, 0, 0.25);
  color: #ffb400;
}

.debug-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: rgba(20, 20, 20, 0.95);
  border: 1px solid #444;
  border-radius: 6px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 140px;
  z-index: 30;
}

.debug-panel-title {
  font-size: 0.6rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 0.25rem 0.25rem;
  border-bottom: 1px solid #333;
}

.debug-action {
  display: block;
  width: 100%;
  padding: 0.4rem 0.5rem;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: #ccc;
  font-size: 0.75rem;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}

.debug-action:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.debug-action.toggled {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.debug-backdrop {
  position: fixed;
  inset: 0;
  z-index: 25;
}

.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  flex-shrink: 0;
}

.settings-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.settings-dialog {
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 1.2rem;
  min-width: 340px;
  max-width: 420px;
}

.settings-title {
  font-size: 0.9rem;
  font-weight: bold;
  color: #fff;
  margin-bottom: 0.8rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid #333;
}

.settings-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8rem;
}

.settings-col-header {
  font-size: 0.7rem;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid #333;
  font-weight: 600;
}

.settings-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.6rem;
  border: 1px solid #333;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  margin-bottom: 0.4rem;
}

.settings-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: #555;
}

.toggle-label {
  font-size: 0.8rem;
  color: #ccc;
  font-weight: 600;
}

.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: #444;
  transition: background 0.2s;
  flex-shrink: 0;
}

.toggle-switch.on {
  background: #4caf50;
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}

.toggle-switch.on .toggle-knob {
  transform: translateX(16px);
}

.volume-controls {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: 0.5rem;
  flex-shrink: 0;
}

.mute-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  flex-shrink: 0;
}

.mute-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.volume-slider {
  width: 70px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #444;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #aaa;
  cursor: pointer;
  transition: background 0.2s;
}

.volume-slider::-webkit-slider-thumb:hover {
  background: #fff;
}

.volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #aaa;
  border: none;
  cursor: pointer;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.restart-dialog {
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 1.2rem;
  min-width: 320px;
  max-width: 400px;
}

.restart-dialog-title {
  font-size: 0.9rem;
  font-weight: bold;
  color: #fff;
  margin-bottom: 0.25rem;
}

.restart-addr {
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  color: #4fc3f7;
  background: rgba(79, 195, 247, 0.1);
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 0.4rem;
  font-weight: normal;
}

.restart-dialog-desc {
  font-size: 0.7rem;
  color: #888;
  margin-bottom: 1rem;
}

.restart-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.restart-option {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid #333;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: #ccc;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, border-color 0.15s;
}

.restart-option:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: #666;
}

.restart-value {
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  font-weight: bold;
  color: #4fc3f7;
  min-width: 28px;
}

.restart-label {
  font-size: 0.8rem;
  font-weight: bold;
  color: #fff;
}

.restart-hint {
  width: 100%;
  font-size: 0.65rem;
  color: #888;
  margin-top: 0.1rem;
}

.event-log-btn {
  position: relative;
}

.event-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #e53935;
  color: #fff;
  font-size: 0.55rem;
  font-weight: bold;
  margin-left: 0.4rem;
  line-height: 1;
}
</style>
