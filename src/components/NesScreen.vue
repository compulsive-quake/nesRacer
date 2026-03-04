<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useNesEmulator } from '../composables/useNesEmulator';
import type { NesEmulator } from '../types';

const props = defineProps<{
  romUrl: string
  playerId: 1 | 2
  paused: boolean
  enableAudio?: boolean
}>();

const emit = defineEmits<{
  ready: [emulator: NesEmulator]
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const emulator = useNesEmulator(props.enableAudio ?? false);

onMounted(async () => {
  if (!canvasRef.value) return;
  emulator.setCanvas(canvasRef.value);
  await emulator.loadROM(props.romUrl);
  emulator.start();
  emit('ready', emulator);
});

watch(() => props.paused, (isPaused) => {
  if (isPaused) {
    emulator.pause();
  } else {
    emulator.resume();
  }
});
</script>

<template>
  <div class="nes-screen">
<div class="canvas-wrapper">
      <canvas
        ref="canvasRef"
        width="256"
        height="240"
      />
    </div>
  </div>
</template>

<style scoped>
.nes-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.canvas-wrapper {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

canvas {
  height: 100%;
  width: auto;
  max-width: 100%;
  max-height: 100%;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  display: block;
  background: #000;
}
</style>
