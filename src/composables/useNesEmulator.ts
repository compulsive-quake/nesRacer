import { ref, onUnmounted } from 'vue';
import { NES, Controller } from 'jsnes';

export function useNesEmulator(enableAudio = false) {
  const canvas = ref<HTMLCanvasElement | null>(null);
  const running = ref(false);
  const paused = ref(false);

  // Plain boolean mirrors for the hot rAF loop — avoids Vue Proxy overhead every frame
  let _running = false;
  let _paused = false;

  let nes: NES | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let imageData: ImageData | null = null;
  let frameBuf32: Uint32Array | null = null;
  let animFrameId: number | null = null;
  let lastFrameTime = 0;
  const NES_FPS = 60.098; // actual NES frame rate
  const NES_FRAME_MS = 1000 / NES_FPS;
  let frameDirty = false;

  // Audio — batch samples on main thread and post to AudioWorklet
  let audioCtx: AudioContext | null = null;
  let audioWorkletNode: AudioWorkletNode | null = null;
  let gainNode: GainNode | null = null;
  const audioBatchSize = 512;
  let audioBatchL = new Float32Array(audioBatchSize);
  let audioBatchR = new Float32Array(audioBatchSize);
  let audioBatchPos = 0;

  // Plain variable — no Vue reactivity overhead in the hot loop
  let _onFrameCallback: ((nes: NES) => void) | null = null;

  function init() {
    nes = new NES({
      onFrame(frameBuffer: Int32Array) {
        if (!frameBuf32) return;
        // Write pixels into the ImageData buffer but DON'T present yet.
        // putImageData is deferred to once per rAF tick (after the catch-up loop)
        // to avoid redundant canvas paints on intermediate frames.
        for (let i = 0; i < frameBuffer.length; i++) {
          frameBuf32[i] = 0xFF000000 | (frameBuffer[i] & 0x00FFFFFF);
        }
        frameDirty = true;
      },
      onAudioSample: enableAudio
        ? (left: number, right: number) => {
            audioBatchL[audioBatchPos] = left;
            audioBatchR[audioBatchPos] = right;
            audioBatchPos++;
            if (audioBatchPos >= audioBatchSize) {
              audioWorkletNode?.port.postMessage({
                left: audioBatchL,
                right: audioBatchR,
              });
              audioBatchL = new Float32Array(audioBatchSize);
              audioBatchR = new Float32Array(audioBatchSize);
              audioBatchPos = 0;
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
    ctx = el.getContext('2d', { alpha: false })!;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 256, 240);
    imageData = ctx.getImageData(0, 0, 256, 240);
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

  async function setupAudio() {
    if (!enableAudio) return;
    audioCtx = new AudioContext({ sampleRate: 44100 });

    await audioCtx.audioWorklet.addModule('nes-audio-processor.js');

    // Use a GainNode to fade in and avoid the initial pop
    gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.connect(audioCtx.destination);

    audioWorkletNode = new AudioWorkletNode(audioCtx, 'nes-audio-processor', {
      outputChannelCount: [2],
    });
    audioWorkletNode.connect(gainNode);

    // Keep silent for 1 full second to discard startup noise, then fade in
    const startAudio = () => {
      audioBatchPos = 0;
      setTimeout(() => {
        audioBatchPos = 0;
        gainNode!.gain.linearRampToValueAtTime(targetVolume, audioCtx!.currentTime + 0.3);
      }, 1000);
    };

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(startAudio);
    } else {
      startAudio();
    }
  }

  /** Advance emulation for this timestamp. Call from an external shared rAF loop. */
  function tick(timestamp: number) {
    if (!_running || !nes || _paused) return;

    // Interval-aligned timing (matches jsnes FrameTimer)
    const excess = timestamp % NES_FRAME_MS;
    const alignedTime = timestamp - excess;

    if (lastFrameTime === 0) {
      lastFrameTime = alignedTime;
      return;
    }

    const numFrames = Math.round((alignedTime - lastFrameTime) / NES_FRAME_MS);
    if (numFrames === 0) return;

    // Generate first frame and display it
    nes.frame();
    if (_onFrameCallback) _onFrameCallback(nes);

    if (frameDirty && ctx && imageData) {
      ctx.putImageData(imageData, 0, 0);
      frameDirty = false;
    }

    // Schedule additional catch-up frames spread evenly before next rAF
    const timeToNextFrame = NES_FRAME_MS - excess;
    for (let i = 1; i < numFrames; i++) {
      setTimeout(() => {
        if (!_running || !nes || _paused) return;
        nes.frame();
        if (_onFrameCallback) _onFrameCallback(nes);
      }, (i * timeToNextFrame) / numFrames);
    }

    lastFrameTime = alignedTime;
  }

  function start() {
    if (!nes) return;
    _running = true; running.value = true;
    _paused = false; paused.value = false;
    lastFrameTime = 0;

    if (enableAudio && !audioCtx) setupAudio();
    animFrameId = requestAnimationFrame(frameLoop);
  }

  function frameLoop(timestamp: number) {
    if (!_running || !nes) return;
    tick(timestamp);
    animFrameId = requestAnimationFrame(frameLoop);
  }

  /** Stop the self-driven rAF loop (for when an external loop takes over). */
  function stopSelfDrive() {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  function pause() {
    _paused = true; paused.value = true;
  }

  function resume() {
    _paused = false; paused.value = false;
    // Reset timing so we don't try to catch up for the paused duration
    lastFrameTime = 0;

  }

  function stop() {
    _running = false; running.value = false;
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

  function zapperMove(x: number, y: number) {
    nes?.zapperMove(x, y);
  }

  function zapperFireDown() {
    nes?.zapperFireDown();
  }

  function zapperFireUp() {
    nes?.zapperFireUp();
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
    // Reset frame timing so the loop doesn't try to "catch up" for the
    // time spent inside fromJSON (which recreates CPU/PPU/PAPU objects).
    lastFrameTime = 0;

    // Flush stale audio samples from before the state load
    audioBatchPos = 0;
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
      audioWorkletNode?.disconnect();
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
    tick,
    stopSelfDrive,
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
    zapperMove,
    zapperFireDown,
    zapperFireUp,
    Controller,
  };
}
