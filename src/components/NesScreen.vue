<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useNesEmulator } from '../composables/useNesEmulator';
import type { NesEmulator } from '../types';

const props = defineProps<{
  romUrl: string
  playerId: 1 | 2
  paused: boolean
  enableAudio?: boolean
  pixelated?: boolean
}>();

const emit = defineEmits<{
  ready: [emulator: NesEmulator]
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const emulator = useNesEmulator(props.enableAudio ?? false);

function canvasNesCoords(e: MouseEvent): { x: number; y: number } | null {
  const cv = canvasRef.value;
  if (!cv) return null;
  const rect = cv.getBoundingClientRect();
  const scaleX = rect.width / 256;
  const scaleY = rect.height / 240;
  const scale = Math.min(scaleX, scaleY);
  const imgW = 256 * scale;
  const imgH = 240 * scale;
  const offsetX = (rect.width - imgW) / 2;
  const offsetY = (rect.height - imgH) / 2;
  const x = Math.round((e.clientX - rect.left - offsetX) / scale);
  const y = Math.round((e.clientY - rect.top - offsetY) / scale);
  if (x < 0 || x > 255 || y < 0 || y > 239) return null;
  return { x, y };
}

function onMouseMove(e: MouseEvent) {
  const pos = canvasNesCoords(e);
  if (pos) emulator.zapperMove(pos.x, pos.y);
}

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  const pos = canvasNesCoords(e);
  if (pos) emulator.zapperMove(pos.x, pos.y);
  emulator.zapperFireDown();
}

function onMouseUp(e: MouseEvent) {
  if (e.button !== 0) return;
  emulator.zapperFireUp();
}

onMounted(async () => {
  if (!canvasRef.value) return;
  emulator.setCanvas(canvasRef.value);
  await emulator.loadROM(props.romUrl);
  emulator.start();

  canvasRef.value.addEventListener('mousemove', onMouseMove);
  canvasRef.value.addEventListener('mousedown', onMouseDown);
  canvasRef.value.addEventListener('mouseup', onMouseUp);

  emit('ready', emulator);
});

onBeforeUnmount(() => {
  canvasRef.value?.removeEventListener('mousemove', onMouseMove);
  canvasRef.value?.removeEventListener('mousedown', onMouseDown);
  canvasRef.value?.removeEventListener('mouseup', onMouseUp);
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
        :class="{ smooth: pixelated === false }"
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
  contain: layout style;
}

canvas {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  display: block;
  background: #000;
}

canvas.smooth {
  image-rendering: auto;
}
</style>
