import { reactive } from 'vue';
import type { RaceState, GameState } from '../types';

export function useRaceManager() {
  const state = reactive<RaceState>({
    phase: 'lobby',
    currentWorld: 1,
    currentLevel: 1,
    results: [],
    p1Score: 0,
    p2Score: 0,
    levelWinner: null,
  });

  let levelCompleteTimer: ReturnType<typeof setTimeout> | null = null;

  // Callbacks set by the split screen
  let onRaceReady: (() => void) | null = null;
  let onLevelWin: ((winner: 1 | 2) => void) | null = null;
  let onWinnerReachedNextLevel: ((winner: 1 | 2, world: number, level: number) => void) | null = null;

  function startRace(callbacks: {
    onRaceReady: () => void
    onLevelWin: (winner: 1 | 2) => void
    onWinnerReachedNextLevel: (winner: 1 | 2, world: number, level: number) => void
  }) {
    onRaceReady = callbacks.onRaceReady;
    onLevelWin = callbacks.onLevelWin;
    onWinnerReachedNextLevel = callbacks.onWinnerReachedNextLevel;

    state.phase = 'racing';
    state.results = [];
    state.p1Score = 0;
    state.p2Score = 0;
    state.currentWorld = 1;
    state.currentLevel = 1;
    state.levelWinner = null;

    onRaceReady();
  }

  function readyToRace() {
    state.phase = 'racing';
    state.levelWinner = null;
    onRaceReady?.();
  }

  function checkFrame(p1State: GameState, p2State: GameState) {
    if (state.phase !== 'racing') return;

    // Check if either player completed the level
    const p1Complete = p1State.isLevelComplete;
    const p2Complete = p2State.isLevelComplete;

    if (p1Complete && !state.levelWinner) {
      handleLevelWin(1, p1State);
    } else if (p2Complete && !state.levelWinner) {
      handleLevelWin(2, p2State);
    }

    // Check if either player got game over (0 lives and dead)
    const p1GameOver = p1State.operMode === 0x03;
    const p2GameOver = p2State.operMode === 0x03;

    if (p1GameOver && !p2GameOver && !state.levelWinner) {
      handleLevelWin(2, p2State);
    } else if (p2GameOver && !p1GameOver && !state.levelWinner) {
      handleLevelWin(1, p1State);
    } else if (p1GameOver && p2GameOver && !state.levelWinner) {
      // Both game over — tie, no winner
      handleLevelWin(0 as any, p1State);
    }
  }

  function handleLevelWin(winner: 1 | 2, _winnerState: GameState) {
    state.levelWinner = winner;
    // Notify SplitScreen — it will kill the loser and keep both running
    onLevelWin?.(winner);

    state.results.push({
      world: state.currentWorld,
      level: state.currentLevel,
      winner,
    });

    if (winner === 1) state.p1Score++;
    else if (winner === 2) state.p2Score++;

    // Advance to next level after delay (flag ceremony + death animation)
    levelCompleteTimer = setTimeout(() => {
      console.log(`levelCompleteTimer`);
      advanceToNextLevel();
    }, 6000);
  }

  function advanceToNextLevel() {
    // Advance SMB level: 1-1 -> 1-2 -> 1-3 -> 1-4 -> 2-1 ...
    let nextLevel = state.currentLevel + 1;
    let nextWorld = state.currentWorld;
    if (nextLevel > 4) {
      nextLevel = 1;
      nextWorld++;
    }
    if (nextWorld > 8) {
      // Game complete!
      state.phase = 'race-over';
      return;
    }

    state.currentWorld = nextWorld;
    state.currentLevel = nextLevel;

    // Notify SplitScreen to watch the winner's emulator — it will naturally
    // advance to this level, and we clone its state onto the loser when ready.
    onWinnerReachedNextLevel?.(state.levelWinner!, nextWorld, nextLevel);
  }

  function endRace() {
    state.phase = 'race-over';
    if (levelCompleteTimer) clearTimeout(levelCompleteTimer);
  }

  function returnToLobby() {
    state.phase = 'lobby';
    state.levelWinner = null;
    if (levelCompleteTimer) clearTimeout(levelCompleteTimer);
  }

  return {
    state,
    startRace,
    readyToRace,
    checkFrame,
    endRace,
    returnToLobby,
  };
}
