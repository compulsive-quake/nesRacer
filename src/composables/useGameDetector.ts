import { reactive } from 'vue';
import type { GameState } from '../types';

// Super Mario Bros. RAM map
// Reference: https://datacrystal.tcrf.net/wiki/Super_Mario_Bros./RAM_map
const ADDR = {
  OPER_MODE: 0x0770,           // 0=Demo, 1=Normal, 2=End world, 3=Game over
  OPER_MODE_TASK: 0x0772,      // Level loading setting (00=Restart level)

  // GameEngineSubroutine — game engine state machine:
  //  0=Entrance_GameTimerSetup, 1=Vine_AutoClimb, 2=SideExitPipeEntry,
  //  3=VerticalPipeEntry, 4=FlagpoleSlide, 5=PlayerEndLevel,
  //  6=PlayerLoseLife, 7=PlayerEntrance, 8=PlayerCtrlRoutine (normal play),
  //  9=PlayerChangeSize, 10=PlayerInjuryBlink, 11=PlayerDeath, 12=PlayerFireFlower
  GAME_ENGINE_SUB: 0x000e,
  WORLD_NUMBER: 0x075f,        // 0-7 (zero-indexed)
  LEVEL_NUMBER: 0x0760,        // 0-3 (zero-indexed, per datacrystal)
  LIVES: 0x075a,
  PLAYER_STATE: 0x001d,        // 0=Ground, 1=Jumping, 2=Falling, 3=Climbing (vine/flagpole)
  PLAYER_PAGE: 0x006d,         // Screen page number
  PLAYER_X: 0x0086,            // X position on screen
  PLAYER_Y: 0x00ce,            // Y position on screen
  PLAYER_SIZE: 0x0754,         // 0=Big, 1=Small
  PLAYER_STATUS: 0x0756,       // 0=Small, 1=Super, 2=Fire
  GAME_PAUSE: 0x0776,          // Non-zero = paused
  STAR_FLAG_TASK: 0x0746,      // End-of-level star flag ceremony (>=1 means flagpole touched)
  TIMER_HUNDREDS: 0x07f8,
  TIMER_TENS: 0x07f9,
  TIMER_ONES: 0x07fa,
} as const;

export function useGameDetector() {
  const state = reactive<GameState>({
    operMode: 0,
    world: 1,
    level: 1,
    lives: 0,
    playerX: 0,
    playerY: 0,
    isDead: false,
    isLevelComplete: false,
    gameEngineState: 0,
  });

  let prevOperMode = 0;
  let levelCompleteEmitted = false;

  function poll(readMemory: (addr: number) => number): GameState {
    state.operMode = readMemory(ADDR.OPER_MODE);
    state.world = readMemory(ADDR.WORLD_NUMBER) + 1;
    state.level = readMemory(ADDR.LEVEL_NUMBER) + 1;
    state.lives = readMemory(ADDR.LIVES);
    state.gameEngineState = readMemory(ADDR.GAME_ENGINE_SUB);

    const page = readMemory(ADDR.PLAYER_PAGE);
    const x = readMemory(ADDR.PLAYER_X);
    state.playerX = page * 256 + x;
    state.playerY = readMemory(ADDR.PLAYER_Y);

    const geSub = state.gameEngineState;

    // Dead: 6=PlayerLoseLife, 11=PlayerDeath (falling off screen)
    state.isDead = geSub === 6 || geSub === 11;

    // Level complete detection:
    // Flagpole levels (X-1, X-2, X-3): geSub 4=FlagpoleSlide or 5=PlayerEndLevel
    // Castle levels (X-4): OperMode 2 = VictoryMode (axe touched, bridge collapses)
    state.isLevelComplete =
      geSub === 4 || geSub === 5 || state.operMode === 0x02;

    prevOperMode = state.operMode;
    return state;
  }

  function resetDetection() {
    state.isLevelComplete = false;
    state.isDead = false;
    levelCompleteEmitted = false;
    prevOperMode = 0;
  }

  return {
    state,
    poll,
    resetDetection,
    ADDR,
  };
}
