<script setup lang="ts">
import {ref, shallowRef, computed, onUnmounted, Ref, UnwrapRef} from 'vue';
import NesScreen from './NesScreen.vue';
import RaceOverlay from './RaceOverlay.vue';
import ProgressTimeline from './ProgressTimeline.vue';
import WaypointPanel from './WaypointPanel.vue';
import BindDialog from './BindDialog.vue';
import { useGameDetector } from '../composables/useGameDetector';
import { useRaceManager } from '../composables/useRaceManager';
import { useInputManager, DEFAULT_P1, DEFAULT_P2 } from '../composables/useInputManager';
import { useWaypoints, type Waypoint } from '../composables/useWaypoints';
import { useMemoryRecorder } from '../composables/useMemoryRecorder';
import { useEventLog, type LogEntry } from '../composables/useEventLog';
import type { NesEmulator } from '../types';

const ROM_URL = '/roms/Super Mario Bros. (World).nes';

const emit = defineEmits<{
  backToLobby: []
}>();

const p1Emu = shallowRef<NesEmulator | null>(null);
const p2Emu = shallowRef<NesEmulator | null>(null);
const bothReady = ref(false);
const volume = ref(parseFloat(localStorage.getItem('nesRacer:volume') ?? '0.5'));
const muted = ref(localStorage.getItem('nesRacer:muted') === 'true');
const godMode = ref(localStorage.getItem('nesRacer:godMode') === 'true');
const p1Sound = ref(localStorage.getItem('nesRacer:p1Sound') !== 'false');
const p2Sound = ref(localStorage.getItem('nesRacer:p2Sound') !== 'false');
const p1Music = ref(localStorage.getItem('nesRacer:p1Music') !== 'false');
const p2Music = ref(localStorage.getItem('nesRacer:p2Music') === 'true');
const p1CurrentPalette = ref(1)
const p2CurrentPalette = ref(1)
// const p1PaletteIndex = ref(Number(localStorage.getItem('nesRacer:p1PaletteIndex')) || 0);
// const p2PaletteIndex = ref(Number(localStorage.getItem('nesRacer:p2PaletteIndex')) || 0);
// let allPalettes: number[] = [];

const p1LastSong: Ref<0x01 | 0x02 | 0x03 | 0x04 | 0x08 | 0x10 | 0x20 | 0x80> = ref(0x80);
const p2LastSong: Ref<0x01 | 0x02 | 0x03 | 0x04 | 0x08 | 0x10 | 0x20 | 0x80> = ref(0x80);

// SMB star invincibility timer address
const ADDR_STAR_TIMER = 0x079e;
// SMB Time Up flag — setting to 1 triggers the game's time-out death sequence
const ADDR_TIME_UP_FLAG = 0x0759;

function handleVolumeChange(v: number) {
  volume.value = v;
  muted.value = v === 0;
  localStorage.setItem('nesRacer:volume', String(v));
  localStorage.setItem('nesRacer:muted', String(v === 0));
  p1Emu.value?.setVolume(p1Sound.value ? v : 0);
  p2Emu.value?.setVolume(p2Sound.value ? v : 0);
}

function handleMuteToggle() {
  muted.value = !muted.value;
  localStorage.setItem('nesRacer:muted', String(muted.value));
  const vol = muted.value ? 0 : volume.value;
  p1Emu.value?.setVolume(p1Sound.value ? vol : 0);
  p2Emu.value?.setVolume(p2Sound.value ? vol : 0);
}

function handleToggleP1Sound() {
  p1Sound.value = !p1Sound.value;
  localStorage.setItem('nesRacer:p1Sound', String(p1Sound.value));
  p1Emu.value?.setVolume(p1Sound.value && !muted.value ? volume.value : 0);
}

function handleToggleP2Sound() {
  p2Sound.value = !p2Sound.value;
  localStorage.setItem('nesRacer:p2Sound', String(p2Sound.value));
  p2Emu.value?.setVolume(p2Sound.value ? volume.value : 0);
}

function handleToggleP1Music() {
  p1Music.value = !p1Music.value;

  if (!p1Music.value) {
    stopMusic(p1Emu);
  } else {
    playMusic(p1Emu, p1LastSong.value);
  }

  localStorage.setItem('nesRacer:p1Music', String(p1Music.value));
}

function stopMusic(nes: any) {
  nes.value?.writeMemory(ADDR_AREA_MUSIC, 0x80);
}

function playMusic(nes: any, music: 0x01 | 0x02 | 0x03 | 0x04 | 0x08 | 0x10 | 0x20 | 0x80) {
  if (!nes || !music) return;

  nes.value?.writeMemory(ADDR_AREA_MUSIC, music);
}

function handleToggleP2Music() {
  p2Music.value = !p2Music.value;

  if (!p2Music.value) {
    stopMusic(p2Emu);
  } else {
    playMusic(p2Emu, p2LastSong.value);
  }

  localStorage.setItem('nesRacer:p2Music', String(p2Music.value));
}

const p1Detector = useGameDetector();
const p2Detector = useGameDetector();
const race = useRaceManager();
const wp = useWaypoints();
const recorder = useMemoryRecorder();
const eventLog = useEventLog();
const eventLogUnsubscribers: (() => void)[] = [];

/** Subscribe to event log entries matching a filter. Automatically cleaned up on unmount. */
function onEventLog(
  filter: (entry: LogEntry) => boolean,
  action: (entry: LogEntry) => void,
) {
  const unsub = eventLog.subscribe((entry) => {
    if (filter(entry)) action(entry);
  });
  eventLogUnsubscribers.push(unsub);
}

let inputManager: ReturnType<typeof useInputManager> | null = null;
const showBindDialog = ref(false);
const currentP1Bindings = ref<import('../types').InputBinding>({ ...DEFAULT_P1 });
const currentP2Bindings = ref<import('../types').InputBinding>({ ...DEFAULT_P2 });

function handleOpenBindings() {
  if (inputManager) {
    currentP1Bindings.value = { ...inputManager.p1Bindings.value };
    currentP2Bindings.value = { ...inputManager.p2Bindings.value };
  }
  inputManager?.detach();
  showBindDialog.value = true;
}

function handleBindingsApply(p1: import('../types').InputBinding, p2: import('../types').InputBinding) {
  inputManager?.updateBindings(p1, p2);
  currentP1Bindings.value = { ...p1 };
  currentP2Bindings.value = { ...p2 };
  showBindDialog.value = false;
  inputManager?.attach();
}

function handleBindingsClose() {
  showBindDialog.value = false;
  inputManager?.attach();
}

const p1Banner = computed(() => {
  if (!race.state.levelWinner) return null;
  return race.state.levelWinner === 1 ? 'win' : 'lose';
});

const p2Banner = computed(() => {
  if (!race.state.levelWinner) return null;
  return race.state.levelWinner === 2 ? 'win' : 'lose';
});

// Guard: skip game detection during level transitions
const transitioning = ref(false);

// Debug: expose emulator paused state
const p1Paused = computed(() => p1Emu.value?.paused.value ?? true);
const p2Paused = computed(() => p2Emu.value?.paused.value ?? true);

// FPS tracking
const fps = ref(60);
let fpsFrameCount = 0;
let fpsLastTime = performance.now();
const perfWarning = computed(() => fps.value < 50);

// SMB RAM addresses (datacrystal.tcrf.net RAM map)
const ADDR_AREA_MUSIC = 0x00fb;        // Area Music Register
const ADDR_GAME_ENGINE_SUB = 0x000e;   // GameEngineSubroutine
const ADDR_CURRENT_PLAYER = 0x0753;    // 0=Mario, 1=Luigi
const ADDR_NUMBER_OF_PLAYERS = 0x077a; // 0=1P, 1=2P
const ADDR_LIVES = 0x075a;

function setLuigi(nes: any) {
  nes.cpu.mem[ADDR_NUMBER_OF_PLAYERS] = 0;
  nes.cpu.mem[ADDR_CURRENT_PLAYER] = 1;
}

function setMario(nes: any) {
  nes.cpu.mem[ADDR_NUMBER_OF_PLAYERS] = 0;
  nes.cpu.mem[ADDR_CURRENT_PLAYER] = 0;
}

function forceUnlimitedLives(nes: any) {
  // Max single-digit display in SMB (value 8 shows as "x 9" on lives screen)
  // Value 9+ overflows into non-digit tiles and looks garbled
  nes.cpu.mem[ADDR_LIVES] = 8;
}

// Patch "MARIO" text in the HUD to say "MARIA"
// PPU nametable 0 starts at $2000; "MARIO" is at row 2, col 3 → $2043
// SMB tile indices: A=0x0A, I=0x12, M=0x16, R=0x1B
function patchMarioName(nes: any) {
  nes.ppu.writeMem(0x2043, 0x16); // M
  nes.ppu.writeMem(0x2044, 0x0A); // A
  nes.ppu.writeMem(0x2045, 0x1B); // R
  nes.ppu.writeMem(0x2046, 0x12); // I
  nes.ppu.writeMem(0x2047, 0x0A); // A
}

function onP1Ready(emu: NesEmulator) {
  p1Emu.value = emu;
  // Pause immediately — wait for race start
  // emu.pause();
  const vol = muted.value ? 0 : volume.value;
  emu.setVolume(p1Sound.value ? vol : 0);
  checkBothReady();
}

function onP2Ready(emu: NesEmulator) {
  p2Emu.value = emu;
  // emu.pause();
  // Mute P2 after audio ramp finishes (1s silence + 0.3s fade in)
  const vol = muted.value ? 0 : volume.value;
  setTimeout(() => emu.setVolume(p2Sound.value ? vol : 0), 1500);
  checkBothReady();
}

function checkBothReady() {
  if (!p1Emu.value || !p2Emu.value) return;
  bothReady.value = true;

  // Setup input manager — cache refs to avoid reactive .value access on every keypress
  const p1 = p1Emu.value!;
  const p2 = p2Emu.value!;
  inputManager = useInputManager(
    (p, b) => p1.buttonDown(p, b),
    (p, b) => p1.buttonUp(p, b),
    (p, b) => p2.buttonDown(p, b),
    (p, b) => p2.buttonUp(p, b),
  );
  inputManager.attach();

  p1Emu.value.onFrame((nes: any) => {

    forceUnlimitedLives(nes);
    // changePlayerColor(1, p1CurrentPalette.value);

    // God mode: keep star invincibility active
    if (godMode.value) {
      nes.cpu.mem[ADDR_STAR_TIMER] = 1;
    }

    // Lock music off: force silence every frame so the game can't restart music
    if (!p1Music.value && nes.cpu.mem[ADDR_AREA_MUSIC] !== 0x00) {

      p1LastSong.value = nes.cpu.mem[ADDR_AREA_MUSIC];
      nes.cpu.mem[ADDR_AREA_MUSIC] = 0x80;
    }

    // FPS tracking
    fpsFrameCount++;
    const now = performance.now();
    if (now - fpsLastTime >= 1000) {
      fps.value = fpsFrameCount;
      fpsFrameCount = 0;
      fpsLastTime = now;
    }

    // Event log: detect watched memory transitions for P1
    eventLog.poll(1, p1Emu.value!.readMemory);

    if (race.state.phase === 'racing' && !transitioning.value) {
      console.log(`racing and !transitioning`)
      p1Detector.poll(p1Emu.value!.readMemory);
      p2Detector.poll(p2Emu.value!.readMemory);
      race.checkFrame(p1Detector.state, p2Detector.state);
    }
  });

  // Force Luigi mode + unlimited lives on P2 each frame
  p2Emu.value.onFrame((nes: any) => {
    // Event log: detect watched memory transitions for P2
    eventLog.poll(2, p2Emu.value!.readMemory);

    forceUnlimitedLives(nes);

    if (!p2Music.value && nes.cpu.mem[ADDR_AREA_MUSIC] !== 0x00) {
      // setLuigi(nes);
      p2LastSong.value = nes.cpu.mem[ADDR_AREA_MUSIC];
      patchMarioName(nes);
      forceLuigiPlayer(2);
      nes.cpu.mem[ADDR_AREA_MUSIC] = 0x80;
    }
  });

  // Auto-press Start to get past title screen on both
  skipTitleScreen(p1Emu.value);
  skipTitleScreen(p2Emu.value);

  // Start the race!
  startRace();
}

function skipTitleScreen(emu: NesEmulator) {
  // Unpause briefly, press Start to get past title, then re-pause
  emu.resume();
  // Run a few frames to let the title screen load
  setTimeout(() => {
    emu.buttonDown(1, emu.Controller.BUTTON_START);
    setTimeout(() => {
      emu.buttonUp(1, emu.Controller.BUTTON_START);
      // Press Start again for 1-player game select
      setTimeout(() => {
        emu.buttonDown(1, emu.Controller.BUTTON_START);
        setTimeout(() => {
          emu.buttonUp(1, emu.Controller.BUTTON_START);
        }, 100);
      }, 500);
    }, 100);
  }, 1000);
}

function startRace() {
  // Wait for title screen skipping to complete
  setTimeout(() => {
    // console.log(`starting race`);
    race.startRace({
      onRaceReady() {
        // console.log(`onRaceReady`);
        // Unpause both emulators — no countdown, race starts immediately
        // p1Emu.value?.resume();
        // p2Emu.value?.resume();
      },
      onLevelWin(winner: 1 | 2) {
        const loser = winner !== 1 ? 1 : 2;
        const winnerEmu = winner === 1 ? p1Emu.value : p2Emu.value;
        const loserEmu = winner === 1 ? p2Emu.value : p1Emu.value;
        let p1Ready = false;
        let p2Ready = false;
        let loserPaused = false;
        let alreadyResumed = false;
        let skipFirst = false;
        // Subscribe — callback fires on every new LogEntry
        const unsubscribe = eventLog.subscribe((entry) => {

          if (entry.addr === 0x07A0) {

            if (entry.player === loser && entry.toValue === 6 && !loserPaused && !alreadyResumed) {
              console.log(`pausing because loser entered score screen`);
              loserPaused = true;
              loserEmu?.pause();
            }
            if (entry.player === winner && entry.toValue === 6 && loserPaused && !alreadyResumed) {
              alreadyResumed = true;
              console.log(`rusuming because winner entered score screen`);
              loserEmu?.resume();
            }
          }

          if (entry.addr === 0x000E && entry.toValue === 0x08) {
            p1Emu.value?.pause();
            p2Emu.value?.pause();
            startCountdown().then(()=>{
              console.log(`countdown over`);
              p1Emu.value?.resume();
              p2Emu.value?.resume();
              startRace();
              unsubscribe();
            });
          }
          if (entry.addr === 0x0772) {
            // console.log(`level loading`);
          }

        });

        eventLogUnsubscribers.push(unsubscribe);
        deathScreenPlayer(loser);
        // timeoutPlayer(loser);
        nextLevelPlayer(loser);
      },
      onWinnerReachedNextLevel(winner: 1 | 2, world: number, level: number) {
        console.log(`onWinnerREachedNextLevel`);
        // watchWinnerAndSyncLoser(winner, world, level);
      },
    });
  }, 3000);
}

function watchWinnerAndSyncLoser(winner: 1 | 2, targetWorld: number, targetLevel: number) {
  // transitioning.value = true;
  // const winnerEmu = winner === 1 ? p1Emu.value : p2Emu.value;
  // const loserEmu = winner === 1 ? p2Emu.value : p1Emu.value;
  // if (!winnerEmu || !loserEmu) return;

  // let winnerReady = false;
  // let loserReady = false;
  // let loserWarped = false;
  // let resolved = false;
  // let warpInterval: ReturnType<typeof setInterval> | null = null;

  // // Safety fallback — if either never reaches the target level
  // setTimeout(() => {
  //   if (!resolved) {
  //     resolved = true;
  //     if (warpInterval) clearInterval(warpInterval);
  //     winnerEmu.pause();
  //     loserEmu.pause();

  //   }
  // }, 15000);
}

function finishTransition(loserEmu: NesEmulator, winner: 1 | 2) {

  // Reset detectors so stale isLevelComplete doesn't re-trigger
  p1Detector.resetDetection();
  p2Detector.resetDetection();

  transitioning.value = false;

  // Resume both at the same time for a fair start
  race.readyToRace();
}

function handleSkipLevel() {
  if (race.state.phase !== 'racing' || race.state.levelWinner) return;
}

function handleNextScreen() {
  // console.log(p1Emu.cpu)
  const p1 = p1Emu.value;
  if (!p1) return;
  // Advance P1 to the next screen within the current level
  // const current = p1.readMemory(0x071b);
  // p1.writeMemory(0x071b, current + 1);
}

function handleToggleGodMode() {
  godMode.value = !godMode.value;
  localStorage.setItem('nesRacer:godMode', String(godMode.value));
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

// Waypoint handlers
function handleAddWaypoint(player: 1 | 2) {
  const emu = player === 1 ? p1Emu.value : p2Emu.value;
  const detector = player === 1 ? p1Detector : p2Detector;
  if (!emu) return;
  const state = emu.saveState();
  if (state) {
    wp.addWaypoint(player, detector.state.world, detector.state.level, state);
  }
}

function handleLoadWaypoint(player: 1 | 2, waypoint: Waypoint) {
  const emu = player === 1 ? p1Emu.value : p2Emu.value;
  if (!emu) return;
  emu.loadState(waypoint.state);
  // Re-stamp Luigi identity on P2
  if (player === 2) {
    emu.writeMemory(ADDR_CURRENT_PLAYER, 1);
    emu.writeMemory(ADDR_NUMBER_OF_PLAYERS, 1);
  }
  // Sync off-screen player info to match on-screen ($075A-$0760 → $0761-$0767)
  for (let i = 0; i < 7; i++) {
    emu.writeMemory(0x0761 + i, emu.readMemory(0x075a + i));
  }
  // Reset event log tracking so the abrupt RAM change from the state load
  // doesn't trigger spurious events (which can cascade into race callbacks)
  eventLog.resetPlayer(player);
  // Reset detector so stale isLevelComplete doesn't trigger handleLevelWin
  const detector = player === 1 ? p1Detector : p2Detector;
  detector.resetDetection();
}

function handleRestartLevel(mode: number) {
  const p1 = p1Emu.value;
  const p2 = p2Emu.value;
  if (!p1 || !p2) return;
  p1.writeMemory(0x0772, mode);
  p2.writeMemory(0x0772, mode);
}

function handleBack() {
  race.returnToLobby();
  inputManager?.detach();
  window.removeEventListener('keydown', onDebugKey);
  emit('backToLobby');
}

// SMB RAM map labels (from datacrystal.tcrf.net/wiki/Super_Mario_Bros./RAM_map)
const SMB_RAM_MAP: Array<{ addr: number; label: string }> = [
  // Player physics & state
  { addr: 0x0000, label: 'Temp / Gravity Acceleration' },
  { addr: 0x0001, label: 'Player Animation' },
  { addr: 0x0003, label: 'Player Direction (1=R, 2=L)' },
  { addr: 0x0008, label: 'Object Offset' },
  { addr: 0x0009, label: 'Frame Counter' },
  { addr: 0x000A, label: 'Button State AB' },
  { addr: 0x000B, label: 'Vertical Direction Input' },
  { addr: 0x000E, label: 'GameEngineSubroutine' },
  { addr: 0x000F, label: 'Enemy 0 Drawn Flag' },
  { addr: 0x0010, label: 'Enemy 1 Drawn Flag' },
  { addr: 0x0011, label: 'Enemy 2 Drawn Flag' },
  { addr: 0x0012, label: 'Enemy 3 Drawn Flag' },
  { addr: 0x0013, label: 'Enemy 4 Drawn Flag' },
  { addr: 0x0014, label: 'Powerup Drawn Flag' },
  { addr: 0x0016, label: 'Enemy 0 Type' },
  { addr: 0x0017, label: 'Enemy 1 Type' },
  { addr: 0x0018, label: 'Enemy 2 Type' },
  { addr: 0x0019, label: 'Enemy 3 Type' },
  { addr: 0x001A, label: 'Enemy 4 Type' },
  { addr: 0x001B, label: 'Powerup On Screen' },
  { addr: 0x001D, label: 'Player Float State' },
  { addr: 0x001E, label: 'Enemy 0 State' },
  { addr: 0x001F, label: 'Enemy 1 State' },
  { addr: 0x0020, label: 'Enemy 2 State' },
  { addr: 0x0021, label: 'Enemy 3 State' },
  { addr: 0x0022, label: 'Enemy 4 State' },
  { addr: 0x0023, label: 'Powerup State/Heading' },
  { addr: 0x0033, label: 'Player Facing Direction' },
  { addr: 0x0039, label: 'Powerup Type (0=Mush, 1=Flower, 2=Star, 3=1up)' },
  { addr: 0x0045, label: 'Player Moving Direction' },
  { addr: 0x0057, label: 'Player Horizontal Speed' },
  { addr: 0x006D, label: 'Player Horiz Page (level pos)' },
  { addr: 0x0086, label: 'Player X On Screen' },
  { addr: 0x009F, label: 'Player Y Speed (signed)' },
  { addr: 0x00B5, label: 'Player Y Screen Position' },
  { addr: 0x00CE, label: 'Player Y On Screen' },
  // Sound
  { addr: 0x00FA, label: 'Pause Effect Register' },
  { addr: 0x00FB, label: 'Area Music Register' },
  { addr: 0x00FC, label: 'Event Music Register' },
  { addr: 0x00FD, label: 'Sound Effect Register 1' },
  { addr: 0x00FE, label: 'Sound Effect Register 2' },
  { addr: 0x00FF, label: 'Sound Effect Register 3' },
  // Player position detail
  { addr: 0x03AD, label: 'Player X Within Screen Offset' },
  { addr: 0x03B8, label: 'Player Y Within Screen' },
  { addr: 0x03C4, label: 'Player Palette (star cycle)' },
  { addr: 0x0400, label: 'Player X-MoveForce' },
  { addr: 0x0433, label: 'Player Vert Frac Velocity' },
  { addr: 0x0450, label: 'Player Max Velocity Left' },
  { addr: 0x0456, label: 'Player Max Velocity Right' },
  { addr: 0x0490, label: 'Player Collision Bits' },
  // Level data
  { addr: 0x06CE, label: 'Fireball Counter' },
  { addr: 0x06D4, label: 'Cycle Counter (coins/blocks)' },
  { addr: 0x06D5, label: 'PlayerGfx Offset' },
  { addr: 0x06D6, label: 'Warpzone Control' },
  { addr: 0x06D9, label: 'MultiLoop Correct Control' },
  { addr: 0x06DE, label: 'ChangeArea Timer' },
  { addr: 0x06FC, label: 'Player 1 Input Pattern' },
  { addr: 0x06FD, label: 'Player 2 Input Pattern' },
  { addr: 0x0700, label: 'Player X-Speed Absolute' },
  { addr: 0x0701, label: 'Friction Adder High' },
  { addr: 0x0702, label: 'Walk Animation' },
  { addr: 0x0704, label: 'Swimming Flag' },
  { addr: 0x0705, label: 'Player X-MoveForce (alt)' },
  { addr: 0x0709, label: 'Current Gravity' },
  { addr: 0x070A, label: 'Current Fall Gravity' },
  { addr: 0x070B, label: 'Big-Small Animation Flag' },
  { addr: 0x070C, label: 'Walk Animation Delay' },
  { addr: 0x070D, label: 'Walk Animation Frame Index' },
  { addr: 0x0712, label: 'DeathMusicLoaded Flag' },
  { addr: 0x0714, label: 'Ducking State (big mario)' },
  { addr: 0x071A, label: 'Current Screen (in level)' },
  { addr: 0x071B, label: 'Next Screen (in level)' },
  { addr: 0x071C, label: 'ScreenEdge X-Position' },
  { addr: 0x071D, label: 'Player X Position' },
  { addr: 0x0722, label: 'Player HitDetect Flag' },
  { addr: 0x0723, label: 'Scroll Lock' },
  { addr: 0x072C, label: 'Level Layout Index' },
  { addr: 0x0733, label: 'Tree/Mushroom Platform Flag' },
  { addr: 0x0739, label: 'Enemy Layout Index' },
  { addr: 0x0743, label: 'Ground As Clouds Flag' },
  { addr: 0x0744, label: 'Background Palette Control' },
  { addr: 0x0746, label: 'Star Flag Task (flagpole)' },
  { addr: 0x0747, label: 'Timer Control' },
  { addr: 0x074A, label: 'Buttons Pressed P1' },
  { addr: 0x074B, label: 'Buttons Pressed P2' },
  { addr: 0x074E, label: 'Gold Block Palette' },
  { addr: 0x0750, label: 'Area Offset' },
  { addr: 0x0752, label: 'Level Entry Control' },
  { addr: 0x0753, label: 'CurrentPlayer (0=Mario, 1=Luigi)' },
  { addr: 0x0754, label: 'Player State (Big/Small/Fire)' },
  { addr: 0x0755, label: 'Player Position For Scroll' },
  { addr: 0x0756, label: 'Powerup State' },
  { addr: 0x0759, label: 'Time Up Flag' },
  { addr: 0x075A, label: 'Lives' },
  { addr: 0x075B, label: 'Halfway Page' },
  { addr: 0x075C, label: 'LevelNumber (alt)' },
  { addr: 0x075E, label: 'Coins' },
  { addr: 0x075F, label: 'WorldNumber (0-indexed)' },
  { addr: 0x0760, label: 'LevelNumber (0-indexed)' },
  { addr: 0x0761, label: 'Off-Screen Lives' },
  { addr: 0x0762, label: 'Off-Screen HalfwayPage' },
  { addr: 0x0763, label: 'Off-Screen LevelNumber' },
  { addr: 0x0766, label: 'Off-Screen WorldNumber' },
  { addr: 0x0767, label: 'Off-Screen LevelNumber (2)' },
  { addr: 0x0770, label: 'OperMode (0=Demo,1=Play,2=Win,3=GO)' },
  { addr: 0x0772, label: 'Level Loading Setting' },
  { addr: 0x0773, label: 'Level Palette' },
  { addr: 0x0774, label: 'Disable Screen Flag' },
  { addr: 0x0775, label: 'Scroll Amount' },
  { addr: 0x0776, label: 'Game Pause Status' },
  { addr: 0x0777, label: 'GamePauseTimer' },
  { addr: 0x0778, label: 'Mirror PPU CTRL_REG1' },
  { addr: 0x0779, label: 'Mirror PPU CTRL_REG2' },
  { addr: 0x077A, label: 'Number Of Players (0=1P, 1=2P)' },
  { addr: 0x077F, label: 'Interval Timer Control' },
  { addr: 0x0781, label: 'Player Animation Timer' },
  { addr: 0x0782, label: 'JumpSwim Timer' },
  { addr: 0x0783, label: 'Running Timer' },
  { addr: 0x0784, label: 'BlockBounce Timer' },
  { addr: 0x0785, label: 'SideCollision Timer' },
  { addr: 0x0786, label: 'Jumpspring Timer' },
  { addr: 0x0787, label: 'GameTimer Control Timer' },
  { addr: 0x0789, label: 'ClimbSide Timer' },
  { addr: 0x078A, label: 'EnemyFrame Timer' },
  { addr: 0x078F, label: 'FrenzyEnemy Timer' },
  { addr: 0x0790, label: 'BowserFireBreath Timer' },
  { addr: 0x0791, label: 'Stomp Timer' },
  { addr: 0x0792, label: 'AirBubble Timer' },
  { addr: 0x0795, label: 'Falling Down Pit Timer' },
  { addr: 0x079D, label: 'Multi-Coin Block Timer' },
  { addr: 0x079E, label: 'Star Timer (invincibility)' },
  { addr: 0x079F, label: 'Star Timer (star power)' },
  { addr: 0x07A0, label: 'Pre-Level Screen Timer' },
  { addr: 0x07A2, label: 'Demo Start Timer' },
  { addr: 0x07B1, label: 'EventMusic Buffer' },
  { addr: 0x07D7, label: 'High Score (BCD) byte 1' },
  { addr: 0x07D8, label: 'High Score (BCD) byte 2' },
  { addr: 0x07D9, label: 'High Score (BCD) byte 3' },
  { addr: 0x07DD, label: 'Mario Score (BCD) byte 1' },
  { addr: 0x07DE, label: 'Mario Score (BCD) byte 2' },
  { addr: 0x07DF, label: 'Mario Score (BCD) byte 3' },
  { addr: 0x07E0, label: 'Mario Score (BCD) byte 4' },
  { addr: 0x07E1, label: 'Mario Score (BCD) byte 5' },
  { addr: 0x07E2, label: 'Mario Score (BCD) byte 6' },
  { addr: 0x07ED, label: 'Coins Display (BCD) tens' },
  { addr: 0x07EE, label: 'Coins Display (BCD) ones' },
  { addr: 0x07F8, label: 'Game Timer Hundreds' },
  { addr: 0x07F9, label: 'Game Timer Tens' },
  { addr: 0x07FA, label: 'Game Timer Ones' },
  { addr: 0x07FC, label: 'Game Difficulty' },
];

let memoryWindow: Window | null = null;
let memoryInterval: ReturnType<typeof setInterval> | null = null;

const RAM_FAVORITES_KEY = 'nesRacer-ramFavorites';

function loadRamFavorites(): Set<number> {
  try {
    const data = localStorage.getItem(RAM_FAVORITES_KEY);
    return data ? new Set(JSON.parse(data) as number[]) : new Set();
  } catch { return new Set(); }
}

function saveRamFavorites(favs: Set<number>) {
  try { localStorage.setItem(RAM_FAVORITES_KEY, JSON.stringify([...favs])); }
  catch (e) { console.warn('Failed to save RAM favorites:', e); }
}

function openMemoryViewer() {
  // If already open, just focus it
  if (memoryWindow && !memoryWindow.closed) {
    memoryWindow.focus();
    return;
  }

  memoryWindow = window.open('', 'nesRacerMemory', 'width=1100,height=800,scrollbars=yes');
  if (!memoryWindow) return;

  const favorites = loadRamFavorites();
  let favoritesOnly = false;
  let searchQuery = '';

  const doc = memoryWindow.document;
  doc.write(`<!DOCTYPE html>
<html><head><title>nesRacer — RAM Viewer</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #ccc; font-family: 'Courier New', monospace; font-size: 13px; padding: 0; }
  .sticky-header { position: sticky; top: 0; z-index: 10; background: #111; border-bottom: 1px solid #333; padding: 12px 16px; display: flex; align-items: center; gap: 12px; }
  .sticky-header h1 { font-family: sans-serif; font-size: 18px; color: #fff; white-space: nowrap; margin: 0; }
  .search-input { flex: 1; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #ccc; font-family: 'Courier New', monospace; font-size: 13px; padding: 6px 10px; outline: none; min-width: 120px; }
  .search-input:focus { border-color: #4fc3f7; }
  .search-input::placeholder { color: #555; }
  .fav-toggle { background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #888; font-size: 13px; padding: 6px 12px; cursor: pointer; white-space: nowrap; font-family: sans-serif; }
  .fav-toggle:hover { border-color: #555; color: #ccc; }
  .fav-toggle.active { border-color: #f5a623; color: #f5a623; background: rgba(245, 166, 35, 0.1); }
  .content { padding: 8px 16px 16px; }
  .container { display: flex; gap: 24px; }
  .player-col { flex: 1; min-width: 0; }
  .player-header { font-family: sans-serif; font-size: 14px; font-weight: bold; padding: 6px 10px; border-radius: 4px; margin-bottom: 8px; text-align: center; }
  .p1-header { background: #1a3a1a; color: #4caf50; }
  .p2-header { background: #1a1a3a; color: #5c8fff; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 4px 8px; border-bottom: 1px solid #333; color: #888; font-size: 11px; text-transform: uppercase; position: sticky; top: 49px; background: #0a0a0a; z-index: 5; }
  td { padding: 3px 8px; border-bottom: 1px solid #1a1a1a; white-space: nowrap; }
  .star { cursor: pointer; font-size: 14px; color: #444; user-select: none; width: 24px; text-align: center; }
  .star.favorited { color: #f5a623; }
  .star:hover { color: #f5a623; opacity: 0.7; }
  .addr { color: #888; }
  .val { color: #4fc3f7; font-weight: bold; min-width: 32px; display: inline-block; text-align: right; cursor: pointer; border-radius: 2px; padding: 0 2px; }
  .val:hover { background: rgba(79, 195, 247, 0.15); }
  .val-input { background: #1a1a1a; border: 1px solid #4fc3f7; border-radius: 2px; color: #4fc3f7; font-family: 'Courier New', monospace; font-size: 13px; font-weight: bold; width: 40px; padding: 0 2px; text-align: right; outline: none; }
  .val-dec { color: #666; font-size: 11px; }
  .label { color: #aaa; font-size: 12px; }
  .changed { background: rgba(255, 200, 0, 0.12); }
  .footer { text-align: center; margin-top: 12px; color: #555; font-size: 11px; font-family: sans-serif; }
</style></head>
<body>
  <div class="sticky-header">
    <h1>RAM Viewer</h1>
    <input id="ram-search" class="search-input" type="text" placeholder="Filter by addr, hex, dec, or label..." autocomplete="off" />
    <button id="fav-toggle" class="fav-toggle">&#9733; Favorites</button>
  </div>
  <div class="content">
    <div class="container">
      <div class="player-col">
        <div class="player-header p1-header">Player 1 (Mario)</div>
        <table><thead><tr><th></th><th>Addr</th><th>Hex</th><th>Dec</th><th>Label</th></tr></thead>
        <tbody id="p1-body"></tbody></table>
      </div>
      <div class="player-col">
        <div class="player-header p2-header">Player 2 (Luigi)</div>
        <table><thead><tr><th></th><th>Addr</th><th>Hex</th><th>Dec</th><th>Label</th></tr></thead>
        <tbody id="p2-body"></tbody></table>
      </div>
    </div>
    <div class="footer">Auto-refreshes every 100ms — close this window to stop</div>
  </div>
</body></html>`);
  doc.close();

  // Wire up search input
  const searchInput = doc.getElementById('ram-search') as HTMLInputElement;
  searchInput.addEventListener('input', () => { searchQuery = searchInput.value; });

  // Wire up favorites toggle
  const favToggleBtn = doc.getElementById('fav-toggle') as HTMLButtonElement;
  favToggleBtn.addEventListener('click', () => {
    favoritesOnly = !favoritesOnly;
    favToggleBtn.classList.toggle('active', favoritesOnly);
  });

  // Handle star clicks via event delegation — use mousedown instead of click
  // because innerHTML is replaced every 100ms, destroying elements between
  // mousedown and mouseup which prevents click from firing
  function handleStarClick(e: Event) {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('star')) return;
    e.preventDefault();
    const addr = Number(target.dataset.addr);
    if (isNaN(addr)) return;
    if (favorites.has(addr)) favorites.delete(addr);
    else favorites.add(addr);
    saveRamFavorites(favorites);
  }
  doc.getElementById('p1-body')?.addEventListener('mousedown', handleStarClick);
  doc.getElementById('p2-body')?.addEventListener('mousedown', handleStarClick);

  // Inline editing state
  let editingCell: { tbodyId: string; addr: number } | null = null;

  function commitEdit(input: HTMLInputElement, tbodyId: string, addr: number) {
    const parsed = parseInt(input.value, 16);
    if (!isNaN(parsed)) {
      const clamped = Math.max(0, Math.min(0xFF, parsed));
      const emu = tbodyId === 'p1-body' ? p1Emu.value : p2Emu.value;
      if (emu) emu.writeMemory(addr, clamped);
    }
    editingCell = null;
  }

  function cancelEdit() {
    editingCell = null;
  }

  function handleValClick(e: Event) {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('val')) return;
    e.preventDefault();
    e.stopPropagation();

    const addr = Number(target.dataset.addr);
    if (isNaN(addr)) return;
    const tbodyId = target.closest('tbody')?.id;
    if (!tbodyId) return;

    // Already editing this cell
    if (editingCell && editingCell.tbodyId === tbodyId && editingCell.addr === addr) return;

    editingCell = { tbodyId, addr };

    const currentHex = target.textContent?.replace('$', '').trim() || '00';
    const td = target.parentElement!;
    td.innerHTML = `<input class="val-input" data-addr="${addr}" value="${currentHex}" maxlength="2" />`;
    const input = td.querySelector('input') as HTMLInputElement;
    input.focus();
    input.select();

    input.addEventListener('keydown', (ke: KeyboardEvent) => {
      if (ke.key === 'Enter') {
        commitEdit(input, tbodyId, addr);
      } else if (ke.key === 'Escape') {
        cancelEdit();
      }
    });
    input.addEventListener('blur', () => {
      if (editingCell && editingCell.addr === addr && editingCell.tbodyId === tbodyId) {
        commitEdit(input, tbodyId, addr);
      }
    });
  }

  doc.getElementById('p1-body')?.addEventListener('mousedown', handleValClick);
  doc.getElementById('p2-body')?.addEventListener('mousedown', handleValClick);

  // Store previous values for change highlighting
  const prevP1: Record<number, number> = {};
  const prevP2: Record<number, number> = {};

  function buildRows(emu: NesEmulator, tbodyId: string, prev: Record<number, number>) {
    // Skip refresh while user is editing a cell in this tbody
    if (editingCell && editingCell.tbodyId === tbodyId) return;

    const tbody = memoryWindow?.document.getElementById(tbodyId);
    if (!tbody) return;
    const rows: string[] = [];
    const query = searchQuery.toLowerCase();
    for (const entry of SMB_RAM_MAP) {
      const val = emu.readMemory(entry.addr);
      const hex = val.toString(16).toUpperCase().padStart(2, '0');
      const changed = prev[entry.addr] !== undefined && prev[entry.addr] !== val;
      prev[entry.addr] = val;
      const addrHex = entry.addr.toString(16).toUpperCase().padStart(4, '0');

      // Filter by search query (addr, hex value, dec value, or label)
      if (query) {
        const addrStr = addrHex.toLowerCase();
        const hexStr = hex.toLowerCase();
        const decStr = String(val);
        const labelStr = entry.label.toLowerCase();
        if (!addrStr.includes(query) && !hexStr.includes(query) && !decStr.includes(query) && !labelStr.includes(query)) continue;
      }
      // Filter by favorites
      if (favoritesOnly && !favorites.has(entry.addr)) continue;
      const isFav = favorites.has(entry.addr);
      rows.push(
        `<tr class="${changed ? 'changed' : ''}">` +
        `<td class="star ${isFav ? 'favorited' : ''}" data-addr="${entry.addr}">${isFav ? '\u2605' : '\u2606'}</td>` +
        `<td class="addr">$${addrHex}</td>` +
        `<td><span class="val" data-addr="${entry.addr}">$${hex}</span></td>` +
        `<td class="val-dec">${val}</td>` +
        `<td class="label">${entry.label}</td></tr>`
      );
    }
    tbody.innerHTML = rows.join('');
  }

  function refresh() {
    if (!memoryWindow || memoryWindow.closed) {
      if (memoryInterval) clearInterval(memoryInterval);
      memoryInterval = null;
      return;
    }
    if (p1Emu.value) buildRows(p1Emu.value, 'p1-body', prevP1);
    if (p2Emu.value) buildRows(p2Emu.value, 'p2-body', prevP2);
  }

  refresh();
  memoryInterval = setInterval(refresh, 100);
}

let eventLogWindow: Window | null = null;
let eventLogInterval: ReturnType<typeof setInterval> | null = null;

function openEventLog() {
  if (eventLogWindow && !eventLogWindow.closed) {
    eventLogWindow.focus();
    return;
  }

  eventLogWindow = window.open('', 'nesRacerEventLog', 'width=750,height=500,scrollbars=yes');
  if (!eventLogWindow) return;

  const doc = eventLogWindow.document;
  doc.write(`<!DOCTYPE html>
<html><head><title>nesRacer — Event Log</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #ccc; font-family: 'Courier New', monospace; font-size: 13px; }

  .toolbar { position: sticky; top: 0; z-index: 10; background: #111; border-bottom: 1px solid #333;
             padding: 10px 16px; display: flex; align-items: center; gap: 12px; }
  .toolbar h1 { font-family: sans-serif; font-size: 16px; color: #fff; margin: 0; white-space: nowrap; }
  .toolbar .count { font-size: 12px; color: #888; }
  .btn { background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #ccc;
         padding: 5px 12px; cursor: pointer; font-size: 12px; font-family: sans-serif; transition: all 0.15s; }
  .btn:hover { border-color: #555; color: #fff; }
  .btn-danger { border-color: #e53935; color: #e53935; }
  .btn-danger:hover { background: rgba(229, 57, 53, 0.1); }
  .spacer { flex: 1; }

  .watched-section { padding: 8px 16px; border-bottom: 1px solid #1a1a1a; }
  .watched-section h3 { font-family: sans-serif; font-size: 11px; color: #666; text-transform: uppercase;
                         letter-spacing: 0.05em; margin-bottom: 4px; }
  .watched-item { font-size: 11px; color: #888; padding: 2px 0; }
  .watched-addr { color: #4fc3f7; }
  .watched-label { color: #aaa; }
  .watched-values { color: #666; }

  .content { padding: 8px 16px 16px; }

  .log-entry { display: flex; gap: 10px; padding: 5px 8px; border-bottom: 1px solid #1a1a1a;
               font-size: 12px; align-items: baseline; }
  .log-entry:hover { background: rgba(255,255,255,0.03); }
  .log-entry.new { animation: flash 0.6s ease-out; }
  @keyframes flash { 0% { background: rgba(245, 166, 35, 0.2); } 100% { background: transparent; } }
  .e-index { color: #555; min-width: 28px; font-size: 11px; }
  .e-time { color: #888; min-width: 70px; font-size: 11px; }
  .e-player { font-size: 11px; font-weight: bold; min-width: 24px; }
  .e-player.p1 { color: #4caf50; }
  .e-player.p2 { color: #5c8fff; }
  .e-label { color: #f5a623; flex: 1; }
  .e-values { color: #ccc; white-space: nowrap; font-size: 11px; }
  .e-from { color: #e53935; }
  .e-to { color: #4caf50; }

  .empty-state { text-align: center; padding: 40px; color: #555; font-family: sans-serif; font-size: 13px; }
</style></head>
<body>
  <div class="toolbar">
    <h1>Event Log</h1>
    <span id="count" class="count"></span>
    <span class="spacer"></span>
    <button id="btn-clear" class="btn btn-danger">Clear</button>
  </div>
  <div id="watched" class="watched-section"></div>
  <div class="content">
    <div id="log-body"></div>
  </div>
</body></html>`);
  doc.close();

  const countEl = doc.getElementById('count')!;
  const logBody = doc.getElementById('log-body')!;
  const watchedEl = doc.getElementById('watched')!;
  const btnClear = doc.getElementById('btn-clear') as HTMLButtonElement;

  // Show watched addresses
  let watchedHtml = '<h3>Watching</h3>';
  for (const w of eventLog.watchedAddresses) {
    const addrHex = w.addr.toString(16).toUpperCase().padStart(4, '0');
    watchedHtml += `<div class="watched-item">`;
    watchedHtml += `<span class="watched-addr">$${addrHex}</span> `;
    watchedHtml += `<span class="watched-label">${w.label}</span> `;
    const valStrs = Object.entries(w.values)
      .map(([v, name]) => `$${Number(v).toString(16).toUpperCase().padStart(2, '0')}=${name}`)
      .join(', ');
    watchedHtml += `<span class="watched-values">${valStrs}</span>`;
    watchedHtml += `</div>`;
  }
  watchedEl.innerHTML = watchedHtml;

  btnClear.addEventListener('click', () => {
    eventLog.clear();
  });

  let lastRenderedCount = 0;
  const startTime = performance.now();

  function refresh() {
    if (!eventLogWindow || eventLogWindow.closed) {
      if (eventLogInterval) clearInterval(eventLogInterval);
      eventLogInterval = null;
      return;
    }

    const allEntries = eventLog.entries.value;
    countEl.textContent = `${allEntries.length} event${allEntries.length !== 1 ? 's' : ''}`;

    if (allEntries.length === 0) {
      logBody.innerHTML = '<div class="empty-state">No events detected yet. Play the game and events will appear here.</div>';
      lastRenderedCount = 0;
      return;
    }

    // Only re-render if count changed
    if (allEntries.length === lastRenderedCount) return;
    lastRenderedCount = allEntries.length;

    let html = '';
    for (let i = allEntries.length - 1; i >= 0; i--) {
      const e = allEntries[i];
      const elapsed = (e.timestamp - startTime) / 1000;
      const mins = Math.floor(elapsed / 60);
      const secs = (elapsed % 60).toFixed(1);
      const timeStr = mins > 0 ? `${mins}:${secs.padStart(4, '0')}` : `${secs}s`;
      const isNew = i === allEntries.length - 1;
      html += `<div class="log-entry${isNew ? ' new' : ''}">`;
      html += `<span class="e-index">#${e.index}</span>`;
      html += `<span class="e-time">${timeStr}</span>`;
      html += `<span class="e-player ${e.player === 1 ? 'p1' : 'p2'}">P${e.player}</span>`;
      html += `<span class="e-label">${e.watchLabel}</span>`;
      html += `<span class="e-values"><span class="e-from">${e.fromName}</span> &rarr; <span class="e-to">${e.toName}</span></span>`;
      html += `</div>`;
    }
    logBody.innerHTML = html;
  }

  refresh();
  eventLogInterval = setInterval(refresh, 200);
}

let recorderWindow: Window | null = null;
let recorderRefreshInterval: ReturnType<typeof setInterval> | null = null;

function openMemoryRecorder() {
  if (recorderWindow && !recorderWindow.closed) {
    recorderWindow.focus();
    return;
  }

  recorderWindow = window.open('', 'nesRacerRecorder', 'width=1200,height=700,scrollbars=yes');
  if (!recorderWindow) return;

  let selectedPlayer: 1 | 2 = 1;
  let activeTriggerCancel: (() => void) | null = null;

  const doc = recorderWindow.document;
  doc.write(`<!DOCTYPE html>
<html><head><title>nesRacer — Memory Recorder</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #ccc; font-family: 'Courier New', monospace; font-size: 13px; }

  .toolbar { position: sticky; top: 0; z-index: 10; background: #111; border-bottom: 1px solid #333;
             padding: 10px 16px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .toolbar h1 { font-family: sans-serif; font-size: 16px; color: #fff; margin: 0; white-space: nowrap; }

  .player-select { background: #1a1a1a; border: 1px solid #333; border-radius: 4px;
                   color: #ccc; padding: 4px 8px; font-size: 12px; outline: none; }

  .btn { background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #ccc;
         padding: 5px 12px; cursor: pointer; font-size: 12px; font-family: sans-serif; transition: all 0.15s; }
  .btn:hover { border-color: #555; color: #fff; }
  .btn:disabled { opacity: 0.4; cursor: default; }
  .btn-record { border-color: #e53935; color: #e53935; }
  .btn-record:hover:not(:disabled) { background: rgba(229, 57, 53, 0.15); }
  .btn-record.active { background: rgba(229, 57, 53, 0.2); animation: pulse 1s infinite; }
  .btn-stop { border-color: #888; color: #ccc; }
  .btn-export { border-color: #4fc3f7; color: #4fc3f7; }
  .btn-export:hover { background: rgba(79, 195, 247, 0.1); }
  .btn-trigger { border-color: #f5a623; color: #f5a623; }
  .btn-trigger:hover { background: rgba(245, 166, 35, 0.1); }
  .btn-run { border-color: #4caf50; color: #4caf50; }
  .btn-run:hover { background: rgba(76, 175, 80, 0.1); }
  .btn-danger { border-color: #e53935; color: #e53935; }
  .btn-danger:hover { background: rgba(229, 57, 53, 0.1); }

  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }

  .status { font-size: 11px; color: #888; margin-left: auto; }
  .recording-badge { color: #e53935; font-weight: bold; }

  .content { padding: 12px 16px; }

  .heatmap-wrapper { overflow: auto; margin: 12px 0; max-height: 400px; border: 1px solid #222; border-radius: 4px; }
  .heatmap { border-collapse: collapse; font-size: 11px; }
  .heatmap th { position: sticky; top: 0; background: #111; padding: 3px 6px;
                border: 1px solid #222; color: #888; font-weight: normal; font-size: 10px; z-index: 2; white-space: nowrap; }
  .heatmap th.addr-col { position: sticky; left: 0; z-index: 3; background: #111; min-width: 200px; text-align: left; }
  .heatmap td { padding: 2px 5px; border: 1px solid #1a1a1a; text-align: center;
                min-width: 36px; font-size: 10px; }
  .heatmap td.addr-cell { position: sticky; left: 0; background: #0a0a0a; text-align: left;
                           font-size: 11px; z-index: 1; white-space: nowrap; padding-right: 12px; }
  .heatmap td.unchanged { color: #444; }
  .heatmap td.changed { background: rgba(255, 200, 0, 0.12); color: #f5a623; }
  .heatmap td.first-change { background: rgba(229, 57, 53, 0.15); color: #e53935;
                              box-shadow: inset 0 0 0 1px rgba(229, 57, 53, 0.4); }

  .timeline { margin: 16px 0; }
  .timeline h3 { font-family: sans-serif; font-size: 13px; color: #aaa; margin-bottom: 8px; }
  .timeline-entry { display: flex; gap: 12px; padding: 3px 8px; border-bottom: 1px solid #1a1a1a; font-size: 11px; }
  .timeline-entry:hover { background: rgba(255,255,255,0.03); }
  .t-index { color: #666; min-width: 32px; }
  .t-time { color: #888; min-width: 64px; }
  .t-addr { color: #4fc3f7; min-width: 48px; }
  .t-label { color: #aaa; flex: 1; }
  .t-delta { color: #f5a623; white-space: nowrap; }

  .section-divider { border: none; border-top: 1px solid #222; margin: 16px 0; }

  .recordings h3 { font-family: sans-serif; font-size: 13px; color: #aaa; margin-bottom: 8px; }
  .rec-item { display: flex; align-items: center; gap: 6px; padding: 6px 8px;
              background: rgba(255,255,255,0.03); border-radius: 4px; margin-bottom: 4px; flex-wrap: wrap; }
  .rec-label { flex: 1; font-size: 12px; color: #ccc; min-width: 120px; }
  .rec-meta { font-size: 10px; color: #666; min-width: 120px; }

  .empty-state { text-align: center; padding: 40px; color: #555; font-family: sans-serif; font-size: 13px; }

  .import-area h3 { font-family: sans-serif; font-size: 13px; color: #aaa; margin-bottom: 8px; }
  .import-area textarea { width: 100%; height: 80px; background: #111; border: 1px solid #333;
                          border-radius: 4px; color: #ccc; font-family: monospace; font-size: 11px;
                          padding: 8px; resize: vertical; outline: none; }
  .import-area textarea:focus { border-color: #4fc3f7; }

  .legend { font-size: 11px; color: #666; margin: 8px 0; display: flex; gap: 16px; font-family: sans-serif; }
  .legend-item { display: flex; align-items: center; gap: 4px; }
  .legend-swatch { display: inline-block; width: 14px; height: 14px; border-radius: 2px; border: 1px solid #333; }
  .swatch-unchanged { background: #0a0a0a; }
  .swatch-changed { background: rgba(255, 200, 0, 0.2); }
  .swatch-first { background: rgba(229, 57, 53, 0.25); box-shadow: inset 0 0 0 1px rgba(229, 57, 53, 0.5); }
</style></head>
<body>
  <div class="toolbar">
    <h1>Memory Recorder</h1>
    <select id="player-select" class="player-select">
      <option value="1">Player 1 (Mario)</option>
      <option value="2">Player 2 (Luigi)</option>
    </select>
    <button id="btn-record" class="btn btn-record">&#9679; Record</button>
    <button id="btn-stop" class="btn btn-stop" disabled>&#9632; Stop</button>
    <span id="status" class="status"></span>
  </div>
  <div class="content">
    <div id="heatmap-section"></div>
    <div id="timeline-section"></div>
    <hr class="section-divider" />
    <div class="recordings">
      <h3>Saved Recordings</h3>
      <div id="recordings-list"><div class="empty-state">No recordings yet. Hit Record and play!</div></div>
    </div>
    <hr class="section-divider" />
    <div class="import-area">
      <h3>Import Trigger</h3>
      <textarea id="import-json" placeholder="Paste trigger JSON here..."></textarea>
      <div style="margin-top:6px;display:flex;gap:8px;">
        <button id="btn-import" class="btn btn-trigger">Import &amp; Run</button>
      </div>
    </div>
  </div>
</body></html>`);
  doc.close();

  // Wire up controls
  const btnRecord = doc.getElementById('btn-record') as HTMLButtonElement;
  const btnStop = doc.getElementById('btn-stop') as HTMLButtonElement;
  const playerSelect = doc.getElementById('player-select') as HTMLSelectElement;
  const statusEl = doc.getElementById('status')!;
  const heatmapSection = doc.getElementById('heatmap-section')!;
  const timelineSection = doc.getElementById('timeline-section')!;
  const recordingsList = doc.getElementById('recordings-list')!;
  const importJson = doc.getElementById('import-json') as HTMLTextAreaElement;
  const btnImport = doc.getElementById('btn-import') as HTMLButtonElement;

  playerSelect.addEventListener('change', () => {
    selectedPlayer = Number(playerSelect.value) as 1 | 2;
  });

  btnRecord.addEventListener('click', () => {
    const emu = selectedPlayer === 1 ? p1Emu.value : p2Emu.value;
    if (!emu) return;
    recorder.startRecording(selectedPlayer, emu.readMemory, SMB_RAM_MAP);
    btnRecord.disabled = true;
    btnRecord.classList.add('active');
    btnStop.disabled = false;
    playerSelect.disabled = true;
    statusEl.innerHTML = '<span class="recording-badge">RECORDING...</span>';
  });

  btnStop.addEventListener('click', () => {
    const recording = recorder.stopRecording();
    btnRecord.disabled = false;
    btnRecord.classList.remove('active');
    btnStop.disabled = true;
    playerSelect.disabled = false;
    statusEl.textContent = recording
      ? `Captured ${recording.changes.length} changes in ${(recording.durationMs / 1000).toFixed(1)}s`
      : 'No data captured';
    if (recording) {
      renderHeatmap(recording);
      renderTimeline(recording);
      renderRecordingsList();
    }
  });

  btnImport.addEventListener('click', () => {
    const trigger = recorder.importTrigger(importJson.value);
    if (!trigger) {
      statusEl.textContent = 'Invalid trigger JSON';
      return;
    }
    const emu = selectedPlayer === 1 ? p1Emu.value : p2Emu.value;
    if (!emu) return;
    activeTriggerCancel?.();
    const handle = recorder.executeTrigger(trigger, emu.writeMemory);
    activeTriggerCancel = handle.cancel;
    statusEl.textContent = `Running trigger: ${trigger.steps.length} steps on P${selectedPlayer}...`;
  });

  function renderHeatmap(recording: typeof recorder.recordings.value[0]) {
    const changedAddrs = new Set(recording.changes.map(c => c.addr));
    const addrsToShow = recording.addresses.filter(a => changedAddrs.has(a.addr));

    if (addrsToShow.length === 0 || recording.snapshots.length === 0) {
      heatmapSection.innerHTML = '<div class="empty-state">No changes detected</div>';
      return;
    }

    // Sort by first-change tick
    const firstChangeTick = new Map<number, number>();
    for (const change of recording.changes) {
      if (!firstChangeTick.has(change.addr)) {
        firstChangeTick.set(change.addr, change.tick);
      }
    }
    addrsToShow.sort((a, b) => (firstChangeTick.get(a.addr) ?? 0) - (firstChangeTick.get(b.addr) ?? 0));

    // Downsample columns if recording is very long
    let snapshots = recording.snapshots;
    let sampleLabel = '';
    if (snapshots.length > 80) {
      const step = Math.ceil(snapshots.length / 80);
      snapshots = snapshots.filter((_, i) => i % step === 0 || i === recording.snapshots.length - 1);
      sampleLabel = ` (showing every ${step}${step === 2 ? 'nd' : step === 3 ? 'rd' : 'th'} sample)`;
    }

    let html = '<div class="legend">';
    html += '<span class="legend-item"><span class="legend-swatch swatch-unchanged"></span> Unchanged</span>';
    html += '<span class="legend-item"><span class="legend-swatch swatch-changed"></span> Changed</span>';
    html += '<span class="legend-item"><span class="legend-swatch swatch-first"></span> First change</span>';
    if (sampleLabel) html += `<span style="color:#888">${sampleLabel}</span>`;
    html += '</div>';

    html += '<div class="heatmap-wrapper"><table class="heatmap"><thead><tr>';
    html += '<th class="addr-col">Address</th>';
    for (const snap of snapshots) {
      const label = snap.timestampMs < 1000
        ? `${Math.round(snap.timestampMs)}ms`
        : `${(snap.timestampMs / 1000).toFixed(1)}s`;
      html += `<th>${label}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const addrEntry of addrsToShow) {
      const addrHex = addrEntry.addr.toString(16).toUpperCase().padStart(4, '0');
      html += `<tr><td class="addr-cell">$${addrHex} ${addrEntry.label}</td>`;

      for (let i = 0; i < snapshots.length; i++) {
        const val = snapshots[i].values[addrEntry.addr];
        const hex = val.toString(16).toUpperCase().padStart(2, '0');
        let cls = 'unchanged';
        if (i > 0) {
          const prevVal = snapshots[i - 1].values[addrEntry.addr];
          if (prevVal !== val) {
            cls = firstChangeTick.get(addrEntry.addr) === snapshots[i].tick
              ? 'first-change'
              : 'changed';
          }
        }
        html += `<td class="${cls}" title="Dec: ${val}">$${hex}</td>`;
      }
      html += '</tr>';
    }

    html += '</tbody></table></div>';
    heatmapSection.innerHTML = html;
  }

  function renderTimeline(recording: typeof recorder.recordings.value[0]) {
    if (recording.changes.length === 0) {
      timelineSection.innerHTML = '';
      return;
    }

    let html = '<div class="timeline"><h3>Change Timeline (' + recording.changes.length + ' changes)</h3>';
    const maxShow = 500;
    const changes = recording.changes.length > maxShow
      ? recording.changes.slice(0, maxShow)
      : recording.changes;

    for (let i = 0; i < changes.length; i++) {
      const c = changes[i];
      const addrHex = c.addr.toString(16).toUpperCase().padStart(4, '0');
      const oldHex = c.oldValue.toString(16).toUpperCase().padStart(2, '0');
      const newHex = c.newValue.toString(16).toUpperCase().padStart(2, '0');
      const timeLabel = c.timestampMs < 1000
        ? `${Math.round(c.timestampMs)}ms`
        : `${(c.timestampMs / 1000).toFixed(1)}s`;
      html += `<div class="timeline-entry">`;
      html += `<span class="t-index">#${i + 1}</span>`;
      html += `<span class="t-time">${timeLabel}</span>`;
      html += `<span class="t-addr">$${addrHex}</span>`;
      html += `<span class="t-label">${c.label}</span>`;
      html += `<span class="t-delta">$${oldHex} &rarr; $${newHex}</span>`;
      html += `</div>`;
    }
    if (recording.changes.length > maxShow) {
      html += `<div class="timeline-entry" style="color:#888;justify-content:center;">... ${recording.changes.length - maxShow} more changes (export JSON for full list)</div>`;
    }
    html += '</div>';
    timelineSection.innerHTML = html;
  }

  function renderRecordingsList() {
    const recs = recorder.recordings.value;
    if (recs.length === 0) {
      recordingsList.innerHTML = '<div class="empty-state">No recordings yet</div>';
      return;
    }
    let html = '';
    for (const rec of recs) {
      html += `<div class="rec-item">`;
      html += `<span class="rec-label">${rec.label}</span>`;
      html += `<span class="rec-meta">P${rec.player} &middot; ${rec.changes.length} changes &middot; ${(rec.durationMs / 1000).toFixed(1)}s</span>`;
      html += `<button class="btn btn-export btn-sm btn-view" data-id="${rec.id}">View</button>`;
      html += `<button class="btn btn-export btn-sm btn-export-json" data-id="${rec.id}">JSON</button>`;
      html += `<button class="btn btn-trigger btn-sm btn-export-trigger" data-id="${rec.id}">Trigger</button>`;
      html += `<button class="btn btn-run btn-sm btn-run-trigger" data-id="${rec.id}">Run</button>`;
      html += `<button class="btn btn-danger btn-sm btn-delete" data-id="${rec.id}">&times;</button>`;
      html += `</div>`;
    }
    recordingsList.innerHTML = html;
  }

  // Event delegation for recording list buttons
  recordingsList.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    const id = target.dataset?.id;
    if (!id) return;
    const rec = recorder.recordings.value.find(r => r.id === id);

    if (target.classList.contains('btn-view') && rec) {
      renderHeatmap(rec);
      renderTimeline(rec);
    }
    if (target.classList.contains('btn-export-json') && rec) {
      downloadJson(recorder.exportRecordingJson(rec), `recording-${rec.id.slice(0, 8)}.json`);
    }
    if (target.classList.contains('btn-export-trigger') && rec) {
      const trigger = recorder.recordingToTrigger(rec);
      downloadJson(recorder.exportTriggerJson(trigger), `trigger-${trigger.id.slice(0, 8)}.json`);
    }
    if (target.classList.contains('btn-run-trigger') && rec) {
      const trigger = recorder.recordingToTrigger(rec);
      const emu = selectedPlayer === 1 ? p1Emu.value : p2Emu.value;
      if (!emu) return;
      activeTriggerCancel?.();
      const handle = recorder.executeTrigger(trigger, emu.writeMemory);
      activeTriggerCancel = handle.cancel;
      statusEl.textContent = `Running trigger: ${trigger.steps.length} steps on P${selectedPlayer}...`;
    }
    if (target.classList.contains('btn-delete')) {
      recorder.deleteRecording(id);
      renderRecordingsList();
    }
  });

  function downloadJson(content: string, filename: string) {
    if (!recorderWindow || recorderWindow.closed) return;
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = recorderWindow.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Periodic status update while recording
  recorderRefreshInterval = setInterval(() => {
    if (!recorderWindow || recorderWindow.closed) {
      if (recorderRefreshInterval) clearInterval(recorderRefreshInterval);
      recorderRefreshInterval = null;
      if (recorder.isRecording.value) recorder.stopRecording();
      return;
    }
    if (recorder.isRecording.value && recorder.currentRecording.value) {
      const snapCount = recorder.currentRecording.value.snapshots.length;
      const elapsed = ((performance.now() - recorder.getRecordingStartTime()) / 1000).toFixed(1);
      statusEl.innerHTML = `<span class="recording-badge">RECORDING</span> ${snapCount} samples, ${elapsed}s`;
    }
  }, 200);
}

// ── Command Palette ──────────────────────────────────────────
let commandPaletteWindow: Window | null = null;

function timeoutPlayer(playerNum: 1 | 2) {
  const emu = playerNum === 1 ? p1Emu.value : p2Emu.value;
  if (!emu) return;
  emu.writeMemory(0x07FA, 0); // Game Timer Ones
  emu.writeMemory(0x07F9, 0); // Game Timer Tens
  emu.writeMemory(0x07F8, 0); // Game Timer Hundreds
}

function nextLevelPlayer(playerNum: 1 | 2) {
  const emu = playerNum === 1 ? p1Emu.value : p2Emu.value;
  if (!emu) return;

  let currentLevelAlt = emu.readMemory(0x075C);
  let currentLevel = emu.readMemory(0x0760);
  let currentWorld = emu.readMemory(0x075F);

  emu.writeMemory(0x072C, 0);

  if (currentWorld === 3) {
    emu.writeMemory(0x075C, 0);
    emu.writeMemory(0x0760, 0);
    emu.writeMemory(0x075F, currentWorld + 1);
  } else {
    emu.writeMemory(0x075C, currentLevelAlt + 1);
    emu.writeMemory(0x0760, currentLevel + 1);
  }
}

function getPalettes(playerNum: 1 | 2): number[] {
  const emu = playerNum === 1 ? p1Emu.value : p2Emu.value;
  if (!emu) return [];
  const nes = emu.getNes();
  if (!nes) return [];
  const palettes: number[] = [];

  //underwater
  for (let addr = 0x0CB7; addr <= 0x0CD6; addr++) {
    palettes.push(nes.ppu.vramMem[addr]);
  }

  //backgrounds
  for (let addr = 0x05DF; addr <= 0x05E6; addr++) {
    palettes.push(nes.ppu.vramMem[addr]);
  }

  //player
  for (let addr = 0x05E8; addr <= 0x05F2; addr++) {
    palettes.push(nes.ppu.vramMem[addr]);
  }

  //overworld
  for (let addr = 0x0CDB; addr <= 0x0CFA; addr++) {
    palettes.push(nes.ppu.vramMem[addr]);
  }

  //underground
  for (let addr = 0x0CFF; addr <= 0x0D1E; addr++) {
    palettes.push(nes.ppu.vramMem[addr]);
  }

  //underground
  for (let addr = 0x0D23; addr <= 0x0D42; addr++) {
    palettes.push(nes.ppu.vramMem[addr]);
  }

  //Miscellaneous/Caveat Palettes
  for (let addr = 0x0D47; addr <= 0x09D8; addr++) {
    palettes.push(nes.ppu.vramMem[addr]);
  }

  return palettes;
}

function changePlayerColor(playerNum: 1 | 2, palette: number) {
  const emu = playerNum === 1 ? p1Emu.value : p2Emu.value;
  if (!emu) return;
  const nes = emu.getNes();
  if (!nes) return;

  nes.cpu.mem[0x03C4]= palette;
}

function forceMarioPlayer(playerNum: 1 | 2) {
  const emu = playerNum === 1 ? p1Emu.value : p2Emu.value;
  if (!emu) return;
  const nes = emu.getNes();
  if (nes) setMario(nes);
}

function forceLuigiPlayer(playerNum: 1 | 2) {
  const emu = playerNum === 1 ? p1Emu.value : p2Emu.value;
  if (!emu) return;
  const nes = emu.getNes();
  if (nes) setLuigi(nes);
}

function deathScreenPlayer(playerNum: 1 | 2) {
  const emu = playerNum === 1 ? p1Emu.value : p2Emu.value;
  if (!emu) return;
  emu.writeMemory(0x000E, 0x06); // GameEngineSubroutine = PlayerDeath
}

function setOnePlayer(playerNum: 1 | 2) {
  const emu = playerNum === 1 ? p1Emu.value : p2Emu.value;
  if (!emu) return;
  emu.writeMemory(ADDR_NUMBER_OF_PLAYERS, 0); // 0 = 1-player mode
}

function setTwoPlayer(playerNum: 1 | 2) {
  const emu = playerNum === 1 ? p1Emu.value : p2Emu.value;
  if (!emu) return;
  emu.writeMemory(ADDR_NUMBER_OF_PLAYERS, 1); // 1 = 2-player mode
}

function openCommandPalette() {
  if (commandPaletteWindow && !commandPaletteWindow.closed) {
    commandPaletteWindow.focus();
    return;
  }

  commandPaletteWindow = window.open('', 'nesRacerCommandPalette', 'width=480,height=800');
  if (!commandPaletteWindow) return;

  const doc = commandPaletteWindow.document;
  doc.write(`<!DOCTYPE html>
<html><head><title>nesRacer — Command Palette</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #ccc; font-family: 'Segoe UI', sans-serif; padding: 20px; }
  h1 { font-size: 16px; color: #fff; margin-bottom: 16px; border-bottom: 1px solid #333; padding-bottom: 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .cmd-btn {
    padding: 16px 12px;
    border: 1px solid #333;
    border-radius: 8px;
    background: rgba(255,255,255,0.05);
    color: #ccc;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    text-align: center;
    line-height: 1.3;
  }
  .cmd-btn:hover { background: rgba(255,255,255,0.12); border-color: #666; color: #fff; }
  .cmd-btn:active { background: rgba(255,80,80,0.25); border-color: #e53935; }
  .cmd-btn .label { display: block; font-size: 14px; }
  .cmd-btn .hint { display: block; font-size: 10px; color: #888; margin-top: 4px; font-weight: normal; }
  .cmd-btn .addr { font-family: 'Courier New', monospace; color: #4fc3f7; font-size: 10px; }
</style>
</head><body>
<h1>Command Palette</h1>
<div class="grid">
  <button class="cmd-btn" id="timeout-p1">
    <span class="label">Timeout P1</span>
    <span class="hint">Set timer to 000</span>
    <span class="addr">$07FA $07F9 $07F8 = 0</span>
  </button>
  <button class="cmd-btn" id="timeout-p2">
    <span class="label">Timeout P2</span>
    <span class="hint">Set timer to 000</span>
    <span class="addr">$07FA $07F9 $07F8 = 0</span>
  </button>
  <button class="cmd-btn" id="nextlevel-p1">
    <span class="label">Next Level P1</span>
    <span class="hint">Advance to next level</span>
    <span class="addr">$072C = 0, $075C += 1, $0760 += 1</span>
  </button>
  <button class="cmd-btn" id="nextlevel-p2">
    <span class="label">Next Level P2</span>
    <span class="hint">Advance to next level</span>
    <span class="addr">$072C = 0, $075C += 1, $0760 += 1</span>
  </button>
  <button class="cmd-btn" id="death-p1">
    <span class="label">Death Screen P1</span>
    <span class="hint">Trigger death sequence</span>
    <span class="addr">$000E = 06</span>
  </button>
  <button class="cmd-btn" id="death-p2">
    <span class="label">Death Screen P2</span>
    <span class="hint">Trigger death sequence</span>
    <span class="addr">$000E = 06</span>
  </button>
  <button class="cmd-btn" id="oneplayer-p1">
    <span class="label">1P Mode P1</span>
    <span class="hint">Set to 1-player mode</span>
    <span class="addr">$077A = 0</span>
  </button>
  <button class="cmd-btn" id="oneplayer-p2">
    <span class="label">1P Mode P2</span>
    <span class="hint">Set to 1-player mode</span>
    <span class="addr">$077A = 0</span>
  </button>
  <button class="cmd-btn" id="twoplayer-p1">
    <span class="label">2P Mode P1</span>
    <span class="hint">Set to 2-player mode</span>
    <span class="addr">$077A = 1</span>
  </button>
  <button class="cmd-btn" id="twoplayer-p2">
    <span class="label">2P Mode P2</span>
    <span class="hint">Set to 2-player mode</span>
    <span class="addr">$077A = 1</span>
  </button>
  <button class="cmd-btn" id="color-p1">
    <span class="label">Color P1</span>
    <span class="hint">Cycle palette index</span>
    <span class="addr" id="color-p1-idx">idx: ${p1CurrentPalette.value}</span>
  </button>
  <button class="cmd-btn" id="color-p2">
    <span class="label">Color P2</span>
    <span class="hint">Cycle palette index</span>
    <span class="addr" id="color-p2-idx">idx: ${p2CurrentPalette.value}</span>
  </button>
  <button class="cmd-btn" id="mario-p1">
    <span class="label">Force Mario P1</span>
    <span class="hint">Switch to Mario</span>
    <span class="addr">$077A = 0, $0753 = 0</span>
  </button>
  <button class="cmd-btn" id="mario-p2">
    <span class="label">Force Mario P2</span>
    <span class="hint">Switch to Mario</span>
    <span class="addr">$077A = 0, $0753 = 0</span>
  </button>
  <button class="cmd-btn" id="luigi-p1">
    <span class="label">Force Luigi P1</span>
    <span class="hint">Switch to Luigi</span>
    <span class="addr">$0753 = 1</span>
  </button>
  <button class="cmd-btn" id="luigi-p2">
    <span class="label">Force Luigi P2</span>
    <span class="hint">Switch to Luigi</span>
    <span class="addr">$0753 = 1</span>
  </button>
</div>
</body></html>`);
  doc.close();

  // Resize window to fit content with no scrollbars
  const win = commandPaletteWindow;
  const body = doc.body;
  const contentWidth = body.scrollWidth;
  const contentHeight = body.scrollHeight;
  const chromeWidth = win.outerWidth - win.innerWidth;
  const chromeHeight = win.outerHeight - win.innerHeight;
  win.resizeTo(contentWidth + chromeWidth, contentHeight + chromeHeight);

  doc.getElementById('timeout-p1')!.addEventListener('click', () => timeoutPlayer(1));
  doc.getElementById('timeout-p2')!.addEventListener('click', () => timeoutPlayer(2));
  doc.getElementById('nextlevel-p1')!.addEventListener('click', () => nextLevelPlayer(1));
  doc.getElementById('nextlevel-p2')!.addEventListener('click', () => nextLevelPlayer(2));
  doc.getElementById('death-p1')!.addEventListener('click', () => deathScreenPlayer(1));
  doc.getElementById('death-p2')!.addEventListener('click', () => deathScreenPlayer(2));
  doc.getElementById('oneplayer-p1')!.addEventListener('click', () => setOnePlayer(1));
  doc.getElementById('oneplayer-p2')!.addEventListener('click', () => setOnePlayer(2));
  doc.getElementById('twoplayer-p1')!.addEventListener('click', () => setTwoPlayer(1));
  doc.getElementById('twoplayer-p2')!.addEventListener('click', () => setTwoPlayer(2));
  doc.getElementById('color-p1')!.addEventListener('click', () => {
    // if (allPalettes.length === 0) return;
    // p1PaletteIndex.value = (p1PaletteIndex.value + 1) % p1CurrentPalette.length;
    localStorage.setItem('nesRacer:p1PaletteIndex', String(p1CurrentPalette.value));
    // changePlayerColor(1, p1CurrentPalette.value);
    p1CurrentPalette.value += 1;
    doc.getElementById('color-p1-idx')!.textContent = 'idx: ' + p1CurrentPalette.value;
  });
  doc.getElementById('color-p2')!.addEventListener('click', () => {

    localStorage.setItem('nesRacer:p2PaletteIndex', String(p2CurrentPalette.value));
    p2CurrentPalette.value += 1;
    // changePlayerColor(2, p2CurrentPalette.value);
    doc.getElementById('color-p2-idx')!.textContent = 'idx: ' + p2CurrentPalette.value;
  });
  doc.getElementById('mario-p1')!.addEventListener('click', () => forceMarioPlayer(1));
  doc.getElementById('mario-p2')!.addEventListener('click', () => forceMarioPlayer(2));
  doc.getElementById('luigi-p1')!.addEventListener('click', () => forceLuigiPlayer(1));
  doc.getElementById('luigi-p2')!.addEventListener('click', () => forceLuigiPlayer(2));
}

// Debug: F9 = skip level (P1 warps to next level)
function onDebugKey(e: KeyboardEvent) {
  if (e.code === 'F9') handleSkipLevel();
}
window.addEventListener('keydown', onDebugKey);

onUnmounted(() => {
  inputManager?.detach();
  window.removeEventListener('keydown', onDebugKey);
  if (memoryInterval) clearInterval(memoryInterval);
  if (memoryWindow && !memoryWindow.closed) memoryWindow.close();
  if (recorderRefreshInterval) clearInterval(recorderRefreshInterval);
  if (recorderWindow && !recorderWindow.closed) recorderWindow.close();
  if (recorder.isRecording.value) recorder.stopRecording();
  if (eventLogInterval) clearInterval(eventLogInterval);
  if (eventLogWindow && !eventLogWindow.closed) eventLogWindow.close();
  if (commandPaletteWindow && !commandPaletteWindow.closed) commandPaletteWindow.close();
  eventLogUnsubscribers.forEach(unsub => unsub());
  eventLog.reset();
});

// --- Countdown ---
const countdownText = ref<string | null>(null);
let countdownTimer: ReturnType<typeof setTimeout> | null = null;

function startCountdown(): Promise<void> {
  return new Promise((resolve) => {
    const steps = ['3', '2', '1', 'GO!'];
    let i = 0;

    function tick() {
      countdownText.value = steps[i];
      i++;
      if (i < steps.length) {
        countdownTimer = setTimeout(tick, 1000);
      } else {
        countdownTimer = setTimeout(() => {
          countdownText.value = null;
          resolve();
        }, 600);
      }
    }

    tick();
  });
}
</script>

<template>
  <div class="split-screen">
    <RaceOverlay
      :state="race.state"
      :volume="muted ? 0 : volume"
      :muted="muted"
      :fps="fps"
      :perf-warning="perfWarning"
      :p1-paused="p1Paused"
      :p2-paused="p2Paused"
      :god-mode="godMode"
      :event-log-count="eventLog.count.value"
      :p1-sound="p1Sound"
      :p2-sound="p2Sound"
      :p1-music="p1Music"
      :p2-music="p2Music"
      @quit="handleBack"
      @update:volume="handleVolumeChange"
      @toggle-mute="handleMuteToggle"
      @toggle-p1-sound="handleToggleP1Sound"
      @toggle-p2-sound="handleToggleP2Sound"
      @toggle-p1-music="handleToggleP1Music"
      @toggle-p2-music="handleToggleP2Music"
      @skip-level="handleSkipLevel"
      @next-screen="handleNextScreen"
      @toggle-god-mode="handleToggleGodMode"
      @open-memory="openMemoryViewer"
      @open-recorder="openMemoryRecorder"
      @open-event-log="openEventLog"
      @open-command-palette="openCommandPalette"
      @restart-level="handleRestartLevel"
      @toggle-pause="handleTogglePause"
      @open-bindings="handleOpenBindings"
    />

    <BindDialog
      v-if="showBindDialog"
      :p1-bindings="currentP1Bindings"
      :p2-bindings="currentP2Bindings"
      @close="handleBindingsClose"
      @apply="handleBindingsApply"
    />

    <div class="screens">
      <div class="player-screen">
        <div v-if="countdownText" class="countdown-overlay" :key="countdownText">{{ countdownText }}</div>
        <div v-if="p1Paused" class="debug-paused">PAUSED</div>
        <NesScreen
          :rom-url="ROM_URL"
          :player-id="1"
          :paused="false"
          :enable-audio="true"
          @ready="onP1Ready"
        />
       <div v-if="p1Banner" class="player-banner" :class="p1Banner">
          {{ p1Banner === 'win' ? 'YOU WIN!' : 'YOU LOSE!' }}
        </div>
        <WaypointPanel
          class="wp-left"
          :waypoints="wp.p1Waypoints.value"
          @add="handleAddWaypoint(1)"
          @load="handleLoadWaypoint(1, $event)"
          @remove="wp.removeWaypoint($event)"
        />
      </div>
      <div class="divider" />
      <div class="player-screen">
        <div v-if="countdownText" class="countdown-overlay" :key="countdownText">{{ countdownText }}</div>
        <div v-if="p2Paused" class="debug-paused">PAUSED</div>
        <NesScreen
          :rom-url="ROM_URL"
          :player-id="2"
          :paused="false"
          :enable-audio="true"
          @ready="onP2Ready"
        />
        <div v-if="p2Banner" class="player-banner" :class="p2Banner">
          {{ p2Banner === 'win' ? 'YOU WIN!' : 'YOU LOSE!' }}
        </div>
        <WaypointPanel
          class="wp-right"
          :waypoints="wp.p2Waypoints.value"
          @add="handleAddWaypoint(2)"
          @load="handleLoadWaypoint(2, $event)"
          @remove="wp.removeWaypoint($event)"
        />
      </div>
    </div>

    <ProgressTimeline :state="race.state" />
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
}

.divider {
  width: 3px;
  align-self: stretch;
  background: linear-gradient(to bottom, transparent, #444, transparent);
  margin: 0;
}

.debug-paused {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'Press Start 2P', monospace;
  font-size: 0.65rem;
  color: #ff4444;
  background: rgba(0, 0, 0, 0.6);
  padding: 2px 8px;
  border-radius: 2px;
  z-index: 8;
  pointer-events: none;
}

.player-banner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 50px;
  font-family: 'Press Start 2P', monospace;
  font-size: 1.4rem;
  color: #fcfcfc;
  pointer-events: none;
  filter: blur(0.6px);
  -webkit-font-smoothing: none;
  animation: banner-pop 0.3s ease-out;
  z-index: 5;
}

.player-banner.win {
}

.player-banner.lose {
}

@keyframes banner-pop {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}

.countdown-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Press Start 2P', monospace;
  font-size: 3rem;
  color: #fff;
  text-shadow: 0 0 20px rgba(230, 57, 70, 0.8), 0 4px 8px rgba(0, 0, 0, 0.6);
  z-index: 10;
  pointer-events: none;
  animation: countdown-pop 0.4s ease-out;
}

@keyframes countdown-pop {
  0% { transform: scale(2); opacity: 0; }
  50% { transform: scale(0.9); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.wp-left {
  left: 8px;
}

.wp-right {
  right: 8px;
}
</style>
