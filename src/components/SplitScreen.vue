<script setup lang="ts">
import { ref, shallowRef, computed, onUnmounted } from 'vue'
import NesScreen from './NesScreen.vue'
import RaceOverlay from './RaceOverlay.vue'
import ProgressTimeline from './ProgressTimeline.vue'
import WaypointPanel from './WaypointPanel.vue'
import { useGameDetector } from '../composables/useGameDetector'
import { useRaceManager } from '../composables/useRaceManager'
import { useInputManager } from '../composables/useInputManager'
import { useWaypoints, type Waypoint } from '../composables/useWaypoints'
import type { NesEmulator } from '../types'

const ROM_URL = '/roms/Super Mario Bros. (JU) (PRG0) [!].nes'

const emit = defineEmits<{
  backToLobby: []
}>()

const p1Emu = shallowRef<NesEmulator | null>(null)
const p2Emu = shallowRef<NesEmulator | null>(null)
const bothReady = ref(false)
const volume = ref(0.5)
const muted = ref(false)
const godMode = ref(false)

// SMB star invincibility timer address
const ADDR_STAR_TIMER = 0x079e
// SMB Time Up flag — setting to 1 triggers the game's time-out death sequence
const ADDR_TIME_UP_FLAG = 0x0759

function handleVolumeChange(v: number) {
  volume.value = v
  muted.value = v === 0
  p1Emu.value?.setVolume(v)
}

function handleMuteToggle() {
  muted.value = !muted.value
  p1Emu.value?.setVolume(muted.value ? 0 : volume.value)
}

const p1Detector = useGameDetector()
const p2Detector = useGameDetector()
const race = useRaceManager()
const wp = useWaypoints()

let inputManager: ReturnType<typeof useInputManager> | null = null

const p1Banner = computed(() => {
  if (!race.state.levelWinner) return null
  return race.state.levelWinner === 1 ? 'win' : 'lose'
})

const p2Banner = computed(() => {
  if (!race.state.levelWinner) return null
  return race.state.levelWinner === 2 ? 'win' : 'lose'
})

// Guard: skip game detection during level transitions
const transitioning = ref(false)

// Debug: expose emulator paused state
const p1Paused = computed(() => p1Emu.value?.paused.value ?? true)
const p2Paused = computed(() => p2Emu.value?.paused.value ?? true)

// FPS tracking
const fps = ref(60)
let fpsFrameCount = 0
let fpsLastTime = performance.now()
const perfWarning = computed(() => fps.value < 50)

// SMB RAM addresses (datacrystal.tcrf.net RAM map)
const ADDR_GAME_ENGINE_SUB = 0x000e   // GameEngineSubroutine
const ADDR_CURRENT_PLAYER = 0x0753    // 0=Mario, 1=Luigi
const ADDR_NUMBER_OF_PLAYERS = 0x077a // 0=1P, 1=2P
const ADDR_LIVES = 0x075a

function forceLuigi(nes: any) {
  nes.cpu.mem[ADDR_NUMBER_OF_PLAYERS] = 1
  nes.cpu.mem[ADDR_CURRENT_PLAYER] = 1
}

function forceUnlimitedLives(nes: any) {
  // Max single-digit display in SMB (value 8 shows as "x 9" on lives screen)
  // Value 9+ overflows into non-digit tiles and looks garbled
  nes.cpu.mem[ADDR_LIVES] = 8
}

function onP1Ready(emu: NesEmulator) {
  p1Emu.value = emu
  // Pause immediately — wait for race start
  emu.pause()
  checkBothReady()
}

function onP2Ready(emu: NesEmulator) {
  p2Emu.value = emu
  emu.pause()
  checkBothReady()
}

function checkBothReady() {
  if (!p1Emu.value || !p2Emu.value) return
  bothReady.value = true

  // Setup input manager
  inputManager = useInputManager(
    (p, b) => p1Emu.value!.buttonDown(p, b),
    (p, b) => p1Emu.value!.buttonUp(p, b),
    (p, b) => p2Emu.value!.buttonDown(p, b),
    (p, b) => p2Emu.value!.buttonUp(p, b),
  )
  inputManager.attach()

  // Setup per-frame callbacks for game state detection + unlimited lives
  p1Emu.value.onFrame((nes: any) => {
    forceUnlimitedLives(nes)

    // God mode: keep star invincibility active
    if (godMode.value) {
      nes.cpu.mem[ADDR_STAR_TIMER] = 1
    }

    // FPS tracking
    fpsFrameCount++
    const now = performance.now()
    if (now - fpsLastTime >= 1000) {
      fps.value = fpsFrameCount
      fpsFrameCount = 0
      fpsLastTime = now
    }

    if (race.state.phase === 'racing' && !transitioning.value) {
      p1Detector.poll(p1Emu.value!.readMemory)
      p2Detector.poll(p2Emu.value!.readMemory)
      race.checkFrame(p1Detector.state, p2Detector.state)
    }
  })

  // Force Luigi mode + unlimited lives on P2 each frame
  p2Emu.value.onFrame((nes: any) => {
    forceLuigi(nes)
    forceUnlimitedLives(nes)
  })

  // Auto-press Start to get past title screen on both
  // P2 selects 2-player mode first so the game initializes Luigi data
  skipTitleScreen(p1Emu.value)
  skipTitleScreenAsLuigi(p2Emu.value)

  // Start the race!
  startRace()
}

function skipTitleScreen(emu: NesEmulator) {
  // Unpause briefly, press Start to get past title, then re-pause
  emu.resume()
  // Run a few frames to let the title screen load
  setTimeout(() => {
    emu.buttonDown(1, emu.Controller.BUTTON_START)
    setTimeout(() => {
      emu.buttonUp(1, emu.Controller.BUTTON_START)
      // Press Start again for 1-player game select
      setTimeout(() => {
        emu.buttonDown(1, emu.Controller.BUTTON_START)
        setTimeout(() => {
          emu.buttonUp(1, emu.Controller.BUTTON_START)
          // Now pause and wait for race start
          setTimeout(() => {
            emu.pause()
          }, 500)
        }, 100)
      }, 500)
    }, 100)
  }, 1000)
}

function skipTitleScreenAsLuigi(emu: NesEmulator) {
  // Same as skipTitleScreen but selects 2-player mode first
  emu.resume()
  setTimeout(() => {
    // First Start press — exit demo / show title screen
    emu.buttonDown(1, emu.Controller.BUTTON_START)
    setTimeout(() => {
      emu.buttonUp(1, emu.Controller.BUTTON_START)
      // Press Select to switch cursor to "2 PLAYER GAME"
      setTimeout(() => {
        emu.buttonDown(1, emu.Controller.BUTTON_SELECT)
        setTimeout(() => {
          emu.buttonUp(1, emu.Controller.BUTTON_SELECT)
          // Press Start to begin in 2-player mode
          setTimeout(() => {
            emu.buttonDown(1, emu.Controller.BUTTON_START)
            setTimeout(() => {
              emu.buttonUp(1, emu.Controller.BUTTON_START)
              // Set CurrentPlayer=1 so game loads as Luigi
              setTimeout(() => {
                emu.writeMemory(ADDR_CURRENT_PLAYER, 1)
                emu.writeMemory(ADDR_NUMBER_OF_PLAYERS, 1)
                emu.pause()
              }, 500)
            }, 100)
          }, 300)
        }, 100)
      }, 300)
    }, 100)
  }, 1000)
}

function killPlayer(emu: NesEmulator) {
  // Replicate SMB's KillPlayer: set upward bounce velocity, then enter dying state
  emu.writeMemory(0x009F, 0xFC)  // Player_Y_Speed — initial upward bounce (same as KillPlayer in SMB ROM)
  emu.writeMemory(0x000E, 0x0B)  // GameEngineSubroutine = PlayerDeath (dying)
}

function startRace() {
  // Wait for title screen skipping to complete
  setTimeout(() => {
    race.startRace({
      onRaceReady() {
        // Unpause both emulators — no countdown, race starts immediately
        p1Emu.value?.resume()
        p2Emu.value?.resume()
      },
      onLevelWin(_winner: 1 | 2) {
        // Don't kill or time-out the loser — let the winner finish naturally
        // and warp both players in watchWinnerAndSyncLoser
      },
      onWinnerReachedNextLevel(winner: 1 | 2, world: number, level: number) {
        // The winner's game will auto-advance to the next level on its own.
        // Watch for the winner to reach gameplay, then clone state to the loser.
        watchWinnerAndSyncLoser(winner, world, level)
      },
    })
  }, 3000)
}

function watchWinnerAndSyncLoser(winner: 1 | 2, targetWorld: number, targetLevel: number) {
  transitioning.value = true
  const winnerEmu = winner === 1 ? p1Emu.value : p2Emu.value
  const loserEmu = winner === 1 ? p2Emu.value : p1Emu.value
  if (!winnerEmu || !loserEmu) return

  const targetWorldIdx = targetWorld - 1  // 0-indexed for SMB RAM
  const targetLevelIdx = targetLevel - 1

  let winnerReady = false
  let loserReady = false
  let loserWarped = false
  let resolved = false
  let warpInterval: ReturnType<typeof setInterval> | null = null

  const poll = setInterval(() => {
    if (resolved) return

    // Step 1: Wait for winner to reach gameplay on the target level
    if (!winnerReady) {
      const geSub = winnerEmu.readMemory(ADDR_GAME_ENGINE_SUB)
      const operMode = winnerEmu.readMemory(0x0770)
      const worldNum = winnerEmu.readMemory(0x075f) + 1
      const levelNum = winnerEmu.readMemory(0x0760) + 1
      if (operMode === 1 && geSub === 8 && worldNum === targetWorld && levelNum === targetLevel) {
        winnerReady = true
        winnerEmu.pause()

        // Step 2: Warp loser — set world/level then restart level via $0772
        loserEmu.writeMemory(0x075f, targetWorldIdx)  // WorldNumber
        loserEmu.writeMemory(0x0760, targetLevelIdx)  // LevelNumber
        loserEmu.writeMemory(0x075b, 0)               // HalfwayPage
        loserEmu.writeMemory(0x0766, targetWorldIdx)  // Off-screen WorldNumber
        loserEmu.writeMemory(0x0767, targetLevelIdx)  // Off-screen LevelNumber
        loserEmu.writeMemory(0x0762, 0)               // Off-screen HalfwayPage
        loserEmu.writeMemory(0x0772, 0x00)            // Restart level loading
        loserWarped = true

        // Keep writing warp addresses during level load in case SMB
        // overwrites them via TransposePlayers
        warpInterval = setInterval(() => {
          loserEmu.writeMemory(0x075f, targetWorldIdx)
          loserEmu.writeMemory(0x0760, targetLevelIdx)
          loserEmu.writeMemory(0x075b, 0)
          loserEmu.writeMemory(0x0766, targetWorldIdx)
          loserEmu.writeMemory(0x0767, targetLevelIdx)
          loserEmu.writeMemory(0x0762, 0)
        }, 16)
      }
    }

    // Step 3: Wait for loser to reach gameplay on the target level
    if (loserWarped && !loserReady) {
      const geSub = loserEmu.readMemory(ADDR_GAME_ENGINE_SUB)
      const operMode = loserEmu.readMemory(0x0770)
      const worldNum = loserEmu.readMemory(0x075f) + 1
      const levelNum = loserEmu.readMemory(0x0760) + 1
      if (operMode === 1 && geSub === 8 && worldNum === targetWorld && levelNum === targetLevel) {
        loserReady = true
        if (warpInterval) clearInterval(warpInterval)
        loserEmu.pause()
      }
    }

    if (winnerReady && loserReady) {
      resolved = true
      clearInterval(poll)
      finishTransition(loserEmu, winner)
    }
  }, 32)

  // Safety fallback — if either never reaches the target level
  setTimeout(() => {
    if (!resolved) {
      resolved = true
      clearInterval(poll)
      if (warpInterval) clearInterval(warpInterval)
      winnerEmu.pause()
      loserEmu.pause()
      finishTransition(loserEmu, winner)
    }
  }, 15000)
}

function finishTransition(loserEmu: NesEmulator, winner: 1 | 2) {
  // Fix up identity: P2 is always Luigi
  if (winner === 1) {
    loserEmu.writeMemory(ADDR_CURRENT_PLAYER, 1)
    loserEmu.writeMemory(ADDR_NUMBER_OF_PLAYERS, 1)
  }

  // Final sync of off-screen player data to match on-screen ($075A-$0760 → $0761-$0767)
  for (let i = 0; i < 7; i++) {
    loserEmu.writeMemory(0x0761 + i, loserEmu.readMemory(0x075a + i))
  }

  // Reset detectors so stale isLevelComplete doesn't re-trigger
  p1Detector.resetDetection()
  p2Detector.resetDetection()

  transitioning.value = false

  // Resume both at the same time for a fair start
  race.readyToRace()
}

function handleSkipLevel() {
  if (race.state.phase !== 'racing' || race.state.levelWinner) return

  const p1 = p1Emu.value
  const p2 = p2Emu.value
  if (!p1 || !p2) return

  // Read current world and level from P1's RAM
  // $075F = World (0-indexed), $075C = Level (0-indexed)
  const currentWorld = p1.readMemory(0x075f)
  const currentLevel = p1.readMemory(0x075c)

  // Advance one level: increment $075C, wrap at 4 (values 0-3)
  let targetWorldIdx = currentWorld
  let targetLevelIdx = currentLevel + 1
  if (targetLevelIdx > 3) {
    targetLevelIdx = 0
    targetWorldIdx++
  }

  // Convert to 1-indexed for race state
  const nextWorld = targetWorldIdx + 1
  const nextLevel = targetLevelIdx + 1

  if (nextWorld > 8) {
    race.state.phase = 'race-over'
    return
  }

  // Record P1 as level winner
  race.state.levelWinner = 1
  race.state.results.push({
    world: race.state.currentWorld,
    level: race.state.currentLevel,
    winner: 1,
  })
  race.state.p1Score++

  race.state.currentWorld = nextWorld
  race.state.currentLevel = nextLevel

  // Warp both players to the next level
  transitioning.value = true

  // Write warp addresses to $075F (World) and $075C (Level)
  for (const emu of [p1, p2]) {
    emu.writeMemory(0x075f, targetWorldIdx)  // WorldNumber
    emu.writeMemory(0x075c, targetLevelIdx)  // LevelNumber
    emu.writeMemory(0x075b, 0)               // HalfwayPage — start from beginning
    // Off-screen player data (SMB swaps these via TransposePlayers)
    emu.writeMemory(0x0766, targetWorldIdx)  // Off-screen WorldNumber
    emu.writeMemory(0x0763, targetLevelIdx)  // Off-screen LevelNumber
    emu.writeMemory(0x0762, 0)               // Off-screen HalfwayPage
  }

  // Force reload by killing both players — the death sequence causes
  // the game to reload world/level from RAM into the PPU
  killPlayer(p1)
  killPlayer(p2)

  // Continuously write warp addresses during the death/reload sequence
  // so SMB loads the correct level when it reads these on level init
  const warpInterval = setInterval(() => {
    for (const emu of [p1, p2]) {
      emu.writeMemory(0x075f, targetWorldIdx)
      emu.writeMemory(0x075c, targetLevelIdx)
      emu.writeMemory(0x075b, 0)
      emu.writeMemory(0x0766, targetWorldIdx)
      emu.writeMemory(0x0763, targetLevelIdx)
      emu.writeMemory(0x0762, 0)
    }
  }, 16)

  // Poll until both emulators reach gameplay (GameEngineSubroutine=8) on the target level
  let p1Ready = false
  let p2Ready = false
  let resolved = false

  const poll = setInterval(() => {
    if (resolved) return

    if (!p1Ready) {
      const geSub = p1.readMemory(ADDR_GAME_ENGINE_SUB)
      const operMode = p1.readMemory(0x0770)
      const w = p1.readMemory(0x075f)
      const l = p1.readMemory(0x075c)
      if (operMode === 1 && geSub === 8 && w === targetWorldIdx && l === targetLevelIdx) {
        p1Ready = true
        p1.pause()
      }
    }

    if (!p2Ready) {
      const geSub = p2.readMemory(ADDR_GAME_ENGINE_SUB)
      const operMode = p2.readMemory(0x0770)
      const w = p2.readMemory(0x075f)
      const l = p2.readMemory(0x075c)
      if (operMode === 1 && geSub === 8 && w === targetWorldIdx && l === targetLevelIdx) {
        p2Ready = true
        p2.pause()
      }
    }

    if (p1Ready && p2Ready) {
      resolved = true
      clearInterval(poll)
      clearInterval(warpInterval)
      finishSkipTransition()
    }
  }, 32)

  // Safety fallback
  setTimeout(() => {
    if (!resolved) {
      resolved = true
      clearInterval(poll)
      clearInterval(warpInterval)
      p1.pause()
      p2.pause()
      finishSkipTransition()
    }
  }, 15000)
}

function finishSkipTransition() {
  // Re-stamp Luigi identity on P2
  const p2 = p2Emu.value
  if (p2) {
    p2.writeMemory(ADDR_CURRENT_PLAYER, 1)
    p2.writeMemory(ADDR_NUMBER_OF_PLAYERS, 1)
    // Sync off-screen player data to match on-screen ($075A-$0760 → $0761-$0767)
    for (let i = 0; i < 7; i++) {
      p2.writeMemory(0x0761 + i, p2.readMemory(0x075a + i))
    }
  }

  p1Detector.resetDetection()
  p2Detector.resetDetection()
  transitioning.value = false

  // Resume both at the same time for a fair start
  race.readyToRace()
}

function handleNextScreen() {
  const p1 = p1Emu.value
  if (!p1) return
  // Advance P1 to the next screen within the current level
  const current = p1.readMemory(0x071b)
  p1.writeMemory(0x071b, current + 1)
}

function handleToggleGodMode() {
  godMode.value = !godMode.value
}

// Waypoint handlers
function handleAddWaypoint(player: 1 | 2) {
  const emu = player === 1 ? p1Emu.value : p2Emu.value
  const detector = player === 1 ? p1Detector : p2Detector
  if (!emu) return
  const state = emu.saveState()
  if (state) {
    wp.addWaypoint(player, detector.state.world, detector.state.level, state)
  }
}

function handleLoadWaypoint(player: 1 | 2, waypoint: Waypoint) {
  const emu = player === 1 ? p1Emu.value : p2Emu.value
  if (!emu) return
  emu.loadState(waypoint.state)
  // Re-stamp Luigi identity on P2
  if (player === 2) {
    emu.writeMemory(ADDR_CURRENT_PLAYER, 1)
    emu.writeMemory(ADDR_NUMBER_OF_PLAYERS, 1)
  }
  // Sync off-screen player info to match on-screen ($075A-$0760 → $0761-$0767)
  for (let i = 0; i < 7; i++) {
    emu.writeMemory(0x0761 + i, emu.readMemory(0x075a + i))
  }
}

function handleRestartLevel(mode: number) {
  const p1 = p1Emu.value
  const p2 = p2Emu.value
  if (!p1 || !p2) return
  p1.writeMemory(0x0772, mode)
  p2.writeMemory(0x0772, mode)
}

function handleBack() {
  race.returnToLobby()
  inputManager?.detach()
  window.removeEventListener('keydown', onDebugKey)
  emit('backToLobby')
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
]

let memoryWindow: Window | null = null
let memoryInterval: ReturnType<typeof setInterval> | null = null

function openMemoryViewer() {
  // If already open, just focus it
  if (memoryWindow && !memoryWindow.closed) {
    memoryWindow.focus()
    return
  }

  memoryWindow = window.open('', 'nesRacerMemory', 'width=1100,height=800,scrollbars=yes')
  if (!memoryWindow) return

  const doc = memoryWindow.document
  doc.write(`<!DOCTYPE html>
<html><head><title>nesRacer — RAM Viewer</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #ccc; font-family: 'Courier New', monospace; font-size: 13px; padding: 16px; }
  h1 { font-family: sans-serif; font-size: 18px; color: #fff; margin-bottom: 12px; text-align: center; }
  .container { display: flex; gap: 24px; }
  .player-col { flex: 1; min-width: 0; }
  .player-header { font-family: sans-serif; font-size: 14px; font-weight: bold; padding: 6px 10px; border-radius: 4px; margin-bottom: 8px; text-align: center; }
  .p1-header { background: #1a3a1a; color: #4caf50; }
  .p2-header { background: #1a1a3a; color: #5c8fff; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 4px 8px; border-bottom: 1px solid #333; color: #888; font-size: 11px; text-transform: uppercase; position: sticky; top: 0; background: #0a0a0a; }
  td { padding: 3px 8px; border-bottom: 1px solid #1a1a1a; white-space: nowrap; }
  .addr { color: #888; }
  .val { color: #4fc3f7; font-weight: bold; min-width: 32px; display: inline-block; text-align: right; }
  .val-dec { color: #666; font-size: 11px; }
  .label { color: #aaa; font-size: 12px; }
  .changed { background: rgba(255, 200, 0, 0.12); }
  .footer { text-align: center; margin-top: 12px; color: #555; font-size: 11px; font-family: sans-serif; }
</style></head>
<body>
  <h1>Super Mario Bros. — RAM Viewer</h1>
  <div class="container">
    <div class="player-col">
      <div class="player-header p1-header">Player 1 (Mario)</div>
      <table><thead><tr><th>Addr</th><th>Hex</th><th>Dec</th><th>Label</th></tr></thead>
      <tbody id="p1-body"></tbody></table>
    </div>
    <div class="player-col">
      <div class="player-header p2-header">Player 2 (Luigi)</div>
      <table><thead><tr><th>Addr</th><th>Hex</th><th>Dec</th><th>Label</th></tr></thead>
      <tbody id="p2-body"></tbody></table>
    </div>
  </div>
  <div class="footer">Auto-refreshes every 100ms — close this window to stop</div>
</body></html>`)
  doc.close()

  // Store previous values for change highlighting
  const prevP1: Record<number, number> = {}
  const prevP2: Record<number, number> = {}

  function buildRows(emu: NesEmulator, tbodyId: string, prev: Record<number, number>) {
    const tbody = memoryWindow?.document.getElementById(tbodyId)
    if (!tbody) return
    const rows: string[] = []
    for (const entry of SMB_RAM_MAP) {
      const val = emu.readMemory(entry.addr)
      const hex = val.toString(16).toUpperCase().padStart(2, '0')
      const changed = prev[entry.addr] !== undefined && prev[entry.addr] !== val
      const addrHex = entry.addr.toString(16).toUpperCase().padStart(4, '0')
      rows.push(
        `<tr class="${changed ? 'changed' : ''}">` +
        `<td class="addr">$${addrHex}</td>` +
        `<td><span class="val">$${hex}</span></td>` +
        `<td class="val-dec">${val}</td>` +
        `<td class="label">${entry.label}</td></tr>`
      )
      prev[entry.addr] = val
    }
    tbody.innerHTML = rows.join('')
  }

  function refresh() {
    if (!memoryWindow || memoryWindow.closed) {
      if (memoryInterval) clearInterval(memoryInterval)
      memoryInterval = null
      return
    }
    if (p1Emu.value) buildRows(p1Emu.value, 'p1-body', prevP1)
    if (p2Emu.value) buildRows(p2Emu.value, 'p2-body', prevP2)
  }

  refresh()
  memoryInterval = setInterval(refresh, 100)
}

// Debug: F9 = skip level (P1 warps to next level)
function onDebugKey(e: KeyboardEvent) {
  if (e.code === 'F9') handleSkipLevel()
}
window.addEventListener('keydown', onDebugKey)

onUnmounted(() => {
  inputManager?.detach()
  window.removeEventListener('keydown', onDebugKey)
  if (memoryInterval) clearInterval(memoryInterval)
  if (memoryWindow && !memoryWindow.closed) memoryWindow.close()
})
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
      @quit="handleBack"
      @update:volume="handleVolumeChange"
      @toggle-mute="handleMuteToggle"
      @skip-level="handleSkipLevel"
      @next-screen="handleNextScreen"
      @toggle-god-mode="handleToggleGodMode"
      @open-memory="openMemoryViewer"
      @restart-level="handleRestartLevel"
    />

    <div class="screens">
      <div class="player-screen">
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
        <div v-if="p2Paused" class="debug-paused">PAUSED</div>
        <NesScreen
          :rom-url="ROM_URL"
          :player-id="2"
          :paused="false"
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
}

.divider {
  width: 3px;
  align-self: stretch;
  background: linear-gradient(to bottom, transparent, #444, transparent);
  margin: 0 0.5rem;
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
  font-family: 'Press Start 2P', monospace;
  font-size: 1.4rem;
  color: #fcfcfc;
  text-shadow: 1px 1px 0 #000;
  pointer-events: none;
  image-rendering: pixelated;
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

.wp-left {
  left: 8px;
}

.wp-right {
  right: 8px;
}
</style>
