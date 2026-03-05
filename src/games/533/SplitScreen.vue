<script setup lang="ts">
import { ref, shallowRef, computed, watch, onUnmounted } from 'vue';
import NesScreen from '../../components/NesScreen.vue';
import RaceOverlay, { type GenieCode } from '../../components/RaceOverlay.vue';
import BindDialog from '../../components/BindDialog.vue';
import { useInputManager, DEFAULT_P1, DEFAULT_P2, DEFAULT_P1_GAMEPAD, DEFAULT_P2_GAMEPAD } from '../../composables/useInputManager';
import { useEventLog } from '../../composables/useEventLog';
import { useToolbarWindows } from '../../composables/useToolbarWindows';
import { getGameToolbarConfig } from '../../gameConfigs';
import type { NesEmulator, InputBinding } from '../../types';

const props = defineProps<{
  romUrl: string
}>();

const emit = defineEmits<{
  backToLobby: []
}>();

const config = getGameToolbarConfig(533);

const p1Emu = shallowRef<NesEmulator | null>(null);
const p2Emu = shallowRef<NesEmulator | null>(null);
const bothReady = ref(false);
let sharedRafId: number | null = null;

const volume = ref(parseFloat(localStorage.getItem('nesRacer:volume') ?? '0.5'));
const muted = ref(localStorage.getItem('nesRacer:muted') === 'true');
const pixelated = ref(localStorage.getItem('nesRacer:pixelated') !== 'false');
const bareMode = ref(false);
let bareModeRaw = false;

// FPS tracking
const fps = ref(60);
let fpsFrameCount = 0;
let fpsLastTime = performance.now();
const perfWarning = computed(() => fps.value < 50);

// Event log
const eventLog = useEventLog();
eventLog.configure(config.watchedAddresses);

// Toolbar popup windows
const toolbarWindows = useToolbarWindows({
  config,
  emus: [p1Emu, p2Emu],
  eventLog,
});

// Genie codes from config
const genieCodes = ref<GenieCode[]>(
  config.genieCodes.map(gc => ({ ...gc, enabled: false }))
);

// Gamepad state
const connectedPads = ref<number[]>([]);
const padPlayerMap = computed<Record<number, string>>(() => {
  const map: Record<number, string> = {};
  const p1Code = currentP1GpBindings.value.a || '';
  const p2Code = currentP2GpBindings.value.a || '';
  const m1 = p1Code.match(/^GP(\d+):/);
  const m2 = p2Code.match(/^GP(\d+):/);
  if (m1) map[parseInt(m1[1])] = 'P1';
  if (m2) map[parseInt(m2[1])] = 'P2';
  return map;
});

let inputManager: ReturnType<typeof useInputManager> | null = null;
const showBindDialog = ref(false);
const currentP1Bindings = ref<InputBinding>({ ...DEFAULT_P1 });
const currentP2Bindings = ref<InputBinding>({ ...DEFAULT_P2 });
const currentP1GpBindings = ref<InputBinding>({ ...DEFAULT_P1_GAMEPAD });
const currentP2GpBindings = ref<InputBinding>({ ...DEFAULT_P2_GAMEPAD });

// Pause state
const p1Paused = computed(() => p1Emu.value?.paused.value ?? true);
const p2Paused = computed(() => p2Emu.value?.paused.value ?? true);

function handleVolumeChange(v: number) {
  volume.value = v;
  muted.value = v === 0;
  localStorage.setItem('nesRacer:volume', String(v));
  localStorage.setItem('nesRacer:muted', String(v === 0));
  p1Emu.value?.setVolume(v);
  p2Emu.value?.setVolume(v);
}

function handleMuteToggle() {
  muted.value = !muted.value;
  localStorage.setItem('nesRacer:muted', String(muted.value));
  const vol = muted.value ? 0 : volume.value;
  p1Emu.value?.setVolume(vol);
  p2Emu.value?.setVolume(vol);
}

function handleTogglePause() {
  const paused = p1Paused.value && p2Paused.value;
  if (paused) {
    p1Emu.value?.resume();
    p2Emu.value?.resume();
  } else {
    p1Emu.value?.pause();
    p2Emu.value?.pause();
  }
}

function togglePixelated() {
  pixelated.value = !pixelated.value;
  localStorage.setItem('nesRacer:pixelated', String(pixelated.value));
}

function toggleBareMode() {
  bareMode.value = !bareMode.value;
  bareModeRaw = bareMode.value;
  if (bareMode.value) {
    toolbarWindows.stopIntervals();
    inputManager?.stopGamepad();
  } else {
    inputManager?.startGamepad();
  }
}

function handleToggleGenieCode(index: number) {
  const gc = genieCodes.value[index];
  gc.enabled = !gc.enabled;
  for (const emu of [p1Emu.value, p2Emu.value]) {
    if (!emu) continue;
    const nes = emu.getNes() as any;
    if (!nes) continue;
    nes.gameGenie.removeAllCodes();
    for (const c of genieCodes.value) {
      if (c.enabled) nes.gameGenie.addCode(c.code);
    }
  }
}

function handleOpenBindings() {
  if (inputManager) {
    currentP1Bindings.value = { ...inputManager.p1Bindings.value };
    currentP2Bindings.value = { ...inputManager.p2Bindings.value };
    currentP1GpBindings.value = { ...inputManager.p1GamepadBindings.value };
    currentP2GpBindings.value = { ...inputManager.p2GamepadBindings.value };
  }
  inputManager?.detach();
  showBindDialog.value = true;
}

function handleBindingsApply(p1: InputBinding, p2: InputBinding, p1Gp: InputBinding, p2Gp: InputBinding) {
  inputManager?.updateBindings(p1, p2, p1Gp, p2Gp);
  currentP1Bindings.value = { ...p1 };
  currentP2Bindings.value = { ...p2 };
  currentP1GpBindings.value = { ...p1Gp };
  currentP2GpBindings.value = { ...p2Gp };
  showBindDialog.value = false;
  inputManager?.attach();
}

function handleBindingsClose() {
  showBindDialog.value = false;
  inputManager?.attach();
}

function handleBack() {
  emit('backToLobby');
}

function onP1Ready(emu: NesEmulator) {
  p1Emu.value = emu;
  const vol = muted.value ? 0 : volume.value;
  emu.setVolume(vol);
  checkBothReady();
}

function onP2Ready(emu: NesEmulator) {
  p2Emu.value = emu;
  const vol = muted.value ? 0 : volume.value;
  setTimeout(() => emu.setVolume(vol), 1500);
  checkBothReady();
}

function checkBothReady() {
  if (!p1Emu.value || !p2Emu.value) return;
  bothReady.value = true;

  const p1 = p1Emu.value!;
  const p2 = p2Emu.value!;
  inputManager = useInputManager(
    (p, b) => p1.buttonDown(p, b),
    (p, b) => p1.buttonUp(p, b),
    (p, b) => p2.buttonDown(p, b),
    (p, b) => p2.buttonUp(p, b),
  );
  inputManager.attach();
  connectedPads.value = inputManager.connectedPads.value;
  watch(inputManager.connectedPads, (pads) => { connectedPads.value = [...pads]; });

  const p1ReadMem = p1Emu.value.readMemory;
  const p2ReadMem = p2Emu.value.readMemory;

  // Take over frame driving
  const emu1 = p1Emu.value!;
  const emu2 = p2Emu.value!;
  emu1.stopSelfDrive();
  emu2.stopSelfDrive();

  function sharedFrameLoop(timestamp: number) {
    emu1.tick(timestamp);
    emu2.tick(timestamp);
    sharedRafId = requestAnimationFrame(sharedFrameLoop);
  }
  sharedRafId = requestAnimationFrame(sharedFrameLoop);

  // Per-frame polling
  p1Emu.value.onFrame(() => {
    if (bareModeRaw) return;

    fpsFrameCount++;
    const now = performance.now();
    if (now - fpsLastTime >= 1000) {
      fps.value = fpsFrameCount;
      fpsFrameCount = 0;
      fpsLastTime = now;
    }

    eventLog.poll(1, p1ReadMem);
  });

  p2Emu.value.onFrame(() => {
    if (bareModeRaw) return;
    eventLog.poll(2, p2ReadMem);
  });
}

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Escape') handleBack();
}

window.addEventListener('keydown', onKeyDown);

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
  if (sharedRafId !== null) cancelAnimationFrame(sharedRafId);
  inputManager?.detach();
  p1Emu.value?.stop();
  p2Emu.value?.stop();
  eventLog.reset();
});
</script>

<template>
  <div class="split-screen">
    <RaceOverlay
      :volume="muted ? 0 : volume"
      :muted="muted"
      :fps="fps"
      :perf-warning="perfWarning"
      :p1-paused="p1Paused"
      :p2-paused="p2Paused"
      :event-log-count="eventLog.count.value"
      :connected-pads="connectedPads"
      :pad-player-map="padPlayerMap"
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

    <BindDialog
      v-if="showBindDialog"
      :p1-bindings="currentP1Bindings"
      :p2-bindings="currentP2Bindings"
      :p1-gamepad-bindings="currentP1GpBindings"
      :p2-gamepad-bindings="currentP2GpBindings"
      @close="handleBindingsClose"
      @apply="handleBindingsApply"
    />

    <div class="screens">
      <div class="player-screen">
        <NesScreen
          :rom-url="props.romUrl"
          :player-id="1"
          :paused="false"
          :enable-audio="true"
          :pixelated="pixelated"
          @ready="onP1Ready"
        />
      </div>
      <div class="divider" />
      <div class="player-screen">
        <NesScreen
          :rom-url="props.romUrl"
          :player-id="2"
          :paused="false"
          :enable-audio="true"
          :pixelated="pixelated"
          @ready="onP2Ready"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.split-screen {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #111;
  overflow: hidden;
  position: relative;
}

.screens {
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 0;
  padding: 0;
  min-height: 0;
}

.player-screen {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  background: #000;
  contain: layout style;
}

.divider {
  width: 3px;
  align-self: stretch;
  background: linear-gradient(to bottom, transparent, #444, transparent);
  margin: 0;
}
</style>
