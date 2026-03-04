import { ref, shallowRef, onUnmounted } from 'vue';
import { NES, Controller } from 'jsnes';

export function useNesEmulator(enableAudio = false) {
  const canvas = ref<HTMLCanvasElement | null>(null);
  const running = ref(false);
  const paused = ref(false);

  let nes: NES | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let imageData: ImageData | null = null;
  let frameBuf32: Uint32Array | null = null;
  let animFrameId: number | null = null;
  let lastFrameTime = 0;
  let accumulator = 0;
  const NES_FRAME_MS = 1000 / 60;

  // Audio
  let audioCtx: AudioContext | null = null;
  const audioBuffer: number[][] = [[], []];
  const audioBufferSize = 8192;
  let audioScriptNode: ScriptProcessorNode | null = null;
  let gainNode: GainNode | null = null;

  // Plain variable — no Vue reactivity overhead in the hot loop
  let _onFrameCallback: ((nes: NES) => void) | null = null;

  function init() {
    nes = new NES({
      onFrame(frameBuffer: Int32Array) {
        if (!ctx || !imageData || !frameBuf32) return;
        // Uint32Array bulk copy: 1 write per pixel instead of 4 byte writes
        // jsnes pixels: R[0:7] | G[8:15] | B[16:23]
        // ImageData on little-endian: Uint32 = 0xAABBGGRR → bytes [R,G,B,A]
        // So we just set alpha=0xFF and keep the rest as-is
        for (let i = 0; i < frameBuffer.length; i++) {
          frameBuf32[i] = 0xFF000000 | (frameBuffer[i] & 0x00FFFFFF);
        }
        ctx.putImageData(imageData, 0, 0);
      },
      onAudioSample: enableAudio
        ? (left: number, right: number) => {
            if (audioBuffer[0].length < audioBufferSize) {
              audioBuffer[0].push(left);
              audioBuffer[1].push(right);
            }
          }
        : undefined,
      emulateSound: enableAudio,
      sampleRate: enableAudio ? 44100 : undefined,
    });
    return nes;
  }

  function setCanvas(el: HTMLCanvasElement) {
    canvas.value = el;
    ctx = el.getContext('2d', { desynchronized: true, alpha: false })!;
    imageData = ctx.createImageData(256, 240);
    // Create a Uint32Array view over the same buffer for fast pixel writes
    frameBuf32 = new Uint32Array(imageData.data.buffer);
  }

  async function loadROM(url: string) {
    if (!nes) init();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    // jsnes expects a binary string
    let romData = '';
    for (let i = 0; i < bytes.length; i++) {
      romData += String.fromCharCode(bytes[i]);
    }
    nes!.loadROM(romData);
  }

  let targetVolume = 1;

  function setupAudio() {
    if (!enableAudio) return;
    audioCtx = new AudioContext({ sampleRate: 44100 });
    // Use a GainNode to fade in and avoid the initial pop
    gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.connect(audioCtx.destination);

    audioScriptNode = audioCtx.createScriptProcessor(4096, 0, 2);
    audioScriptNode.onaudioprocess = (e) => {
      const left = e.outputBuffer.getChannelData(0);
      const right = e.outputBuffer.getChannelData(1);
      const len = Math.min(left.length, audioBuffer[0].length);
      for (let i = 0; i < len; i++) {
        left[i] = audioBuffer[0][i];
        right[i] = audioBuffer[1][i];
      }
      // Fill rest with silence
      for (let i = len; i < left.length; i++) {
        left[i] = 0;
        right[i] = 0;
      }
      audioBuffer[0] = audioBuffer[0].slice(len);
      audioBuffer[1] = audioBuffer[1].slice(len);
    };
    audioScriptNode.connect(gainNode);

    // Keep silent for 1 full second to discard startup noise, then fade in
    const startAudio = () => {
      audioBuffer[0] = [];
      audioBuffer[1] = [];
      setTimeout(() => {
        audioBuffer[0] = [];
        audioBuffer[1] = [];
        gainNode!.gain.linearRampToValueAtTime(targetVolume, audioCtx!.currentTime + 0.3);
      }, 1000);
    };

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(startAudio);
    } else {
      startAudio();
    }
  }

  function start() {
    if (!nes) return;
    running.value = true;
    paused.value = false;
    lastFrameTime = 0;
    accumulator = 0;
    if (enableAudio && !audioCtx) setupAudio();
    animFrameId = requestAnimationFrame(frameLoop);
  }

  function frameLoop(timestamp: number) {
    if (!running.value || !nes) return;
    if (!paused.value) {
      // Initialize on first callback to avoid a huge initial delta
      if (lastFrameTime === 0) lastFrameTime = timestamp;

      accumulator += timestamp - lastFrameTime;
      lastFrameTime = timestamp;

      // Cap to 3 frames to prevent spiral-of-death after tab switch / debugger pause
      if (accumulator > NES_FRAME_MS * 3) accumulator = NES_FRAME_MS * 3;

      while (accumulator >= NES_FRAME_MS) {
        nes.frame();
        if (_onFrameCallback) _onFrameCallback(nes);
        accumulator -= NES_FRAME_MS;
      }
    }
    animFrameId = requestAnimationFrame(frameLoop);
  }

  function pause() {
    paused.value = true;
  }

  function resume() {
    paused.value = false;
    // Reset timing so we don't try to catch up for the paused duration
    lastFrameTime = 0;
    accumulator = 0;
  }

  function stop() {
    running.value = false;
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  function reset() {
    nes?.reset();
  }

  function buttonDown(player: number, button: number) {
    nes?.buttonDown(player, button);
  }

  function buttonUp(player: number, button: number) {
    nes?.buttonUp(player, button);
  }

  function readMemory(address: number): number {
    if (!nes) return 0;
    return nes.cpu.mem[address];
  }

  function writeMemory(address: number, value: number) {
    if (!nes) return;
    nes.cpu.mem[address] = value;
  }

  function saveState(): object | null {
    return nes?.toJSON() ?? null;
  }

  function loadState(state: object) {
    nes?.fromJSON(state);
  }

  function getNes(): NES | null {
    return nes;
  }

  function setVolume(volume: number) {
    targetVolume = volume;
    if (gainNode && audioCtx) {
      gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    }
  }

  function onFrame(callback: (nes: NES) => void) {
    _onFrameCallback = callback;
  }

  onUnmounted(() => {
    stop();
    if (audioCtx) {
      audioScriptNode?.disconnect();
      audioCtx.close();
    }
  });

  return {
    canvas,
    running,
    paused,
    setCanvas,
    loadROM,
    start,
    pause,
    resume,
    stop,
    reset,
    buttonDown,
    buttonUp,
    readMemory,
    writeMemory,
    saveState,
    loadState,
    getNes,
    onFrame,
    setVolume,
    Controller,
  };
}
