import { Controller } from 'jsnes';
import type { InputBinding, PlayerNumber } from '../types';

const P1_BINDINGS: InputBinding = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  a: 'KeyK',
  b: 'KeyJ',
  start: 'Enter',
  select: 'ShiftLeft',
};

const P2_BINDINGS: InputBinding = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  a: 'Period',
  b: 'Comma',
  start: 'Backslash',
  select: 'BracketRight',
};

// Pre-built lookup map: keyCode → { player, nesButton }
// O(1) per keypress instead of iterating both binding objects
const KEY_MAP = new Map<string, { player: PlayerNumber; button: number }>();

for (const [action, code] of Object.entries(P1_BINDINGS)) {
  KEY_MAP.set(code, { player: 1, button: Controller[`BUTTON_${action.toUpperCase()}` as keyof typeof Controller] as number });
}
for (const [action, code] of Object.entries(P2_BINDINGS)) {
  KEY_MAP.set(code, { player: 2, button: Controller[`BUTTON_${action.toUpperCase()}` as keyof typeof Controller] as number });
}

type ButtonHandler = (player: number, button: number) => void

export function useInputManager(
  p1ButtonDown: ButtonHandler,
  p1ButtonUp: ButtonHandler,
  p2ButtonDown: ButtonHandler,
  p2ButtonUp: ButtonHandler,
) {
  function onKeyDown(e: KeyboardEvent) {
    if (e.repeat) return;
    const entry = KEY_MAP.get(e.code);
    if (!entry) return;
    e.preventDefault();
    if (entry.player === 1) {
      p1ButtonDown(1, entry.button);
    } else {
      p2ButtonDown(2, entry.button);
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    const entry = KEY_MAP.get(e.code);
    if (!entry) return;
    e.preventDefault();
    if (entry.player === 1) {
      p1ButtonUp(1, entry.button);
    } else {
      p2ButtonUp(2, entry.button);
    }
  }

  function attach() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  function detach() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  }

  return {
    attach,
    detach,
    P1_BINDINGS,
    P2_BINDINGS,
  };
}
