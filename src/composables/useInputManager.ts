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

const BUTTON_MAP: Record<keyof InputBinding, number> = {
  up: Controller.BUTTON_UP,
  down: Controller.BUTTON_DOWN,
  left: Controller.BUTTON_LEFT,
  right: Controller.BUTTON_RIGHT,
  a: Controller.BUTTON_A,
  b: Controller.BUTTON_B,
  start: Controller.BUTTON_START,
  select: Controller.BUTTON_SELECT,
};

type ButtonHandler = (player: number, button: number) => void

export function useInputManager(
  p1ButtonDown: ButtonHandler,
  p1ButtonUp: ButtonHandler,
  p2ButtonDown: ButtonHandler,
  p2ButtonUp: ButtonHandler,
) {
  function findBinding(code: string): { player: PlayerNumber; action: keyof InputBinding } | null {
    for (const [action, key] of Object.entries(P1_BINDINGS)) {
      if (key === code) return { player: 1, action: action as keyof InputBinding };
    }
    for (const [action, key] of Object.entries(P2_BINDINGS)) {
      if (key === code) return { player: 2, action: action as keyof InputBinding };
    }
    return null;
  }

  function onKeyDown(e: KeyboardEvent) {
    const binding = findBinding(e.code);
    if (!binding) return;
    e.preventDefault();
    const button = BUTTON_MAP[binding.action];
    if (binding.player === 1) {
      p1ButtonDown(1, button);
    } else {
      p2ButtonDown(2, button);
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    const binding = findBinding(e.code);
    if (!binding) return;
    e.preventDefault();
    const button = BUTTON_MAP[binding.action];
    if (binding.player === 1) {
      p1ButtonUp(1, button);
    } else {
      p2ButtonUp(2, button);
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
