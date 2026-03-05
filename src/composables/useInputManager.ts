import { ref } from 'vue'
import { Controller } from 'jsnes'
import type { InputBinding, PlayerNumber, NesButton } from '../types'
import { NES_BUTTONS } from '../types'
import { useGamepad } from './useGamepad'

export const DEFAULT_P1: Readonly<InputBinding> = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
  a: 'KeyK', b: 'KeyJ', start: 'Enter', select: 'ShiftLeft',
}

export const DEFAULT_P2: Readonly<InputBinding> = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  a: 'Period', b: 'Comma', start: 'Backslash', select: 'BracketRight',
}

function loadBindings(key: string, fallback: Readonly<InputBinding>): InputBinding {
  try {
    const stored = localStorage.getItem(key)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore corrupt data */ }
  return { ...fallback }
}

function saveBindings(key: string, bindings: InputBinding) {
  localStorage.setItem(key, JSON.stringify(bindings))
}

type ButtonHandler = (player: number, button: number) => void

export function useInputManager(
  p1ButtonDown: ButtonHandler,
  p1ButtonUp: ButtonHandler,
  p2ButtonDown: ButtonHandler,
  p2ButtonUp: ButtonHandler,
) {
  const p1Bindings = ref<InputBinding>(loadBindings('nesRacer:p1Bindings', DEFAULT_P1))
  const p2Bindings = ref<InputBinding>(loadBindings('nesRacer:p2Bindings', DEFAULT_P2))

  // Mutable map — rebuilt when bindings change. Plain variable (not reactive) for hot-path perf.
  let keyMap = new Map<string, { player: PlayerNumber; button: number }>()

  function rebuildKeyMap() {
    keyMap = new Map()
    for (const action of NES_BUTTONS) {
      keyMap.set(p1Bindings.value[action], {
        player: 1,
        button: Controller[`BUTTON_${action.toUpperCase()}` as keyof typeof Controller] as number,
      })
      keyMap.set(p2Bindings.value[action], {
        player: 2,
        button: Controller[`BUTTON_${action.toUpperCase()}` as keyof typeof Controller] as number,
      })
    }
  }

  rebuildKeyMap()

  function updateBindings(p1: InputBinding, p2: InputBinding) {
    p1Bindings.value = { ...p1 }
    p2Bindings.value = { ...p2 }
    saveBindings('nesRacer:p1Bindings', p1Bindings.value)
    saveBindings('nesRacer:p2Bindings', p2Bindings.value)
    rebuildKeyMap()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.repeat) return
    const entry = keyMap.get(e.code)
    if (!entry) return
    e.preventDefault()
    if (entry.player === 1) p1ButtonDown(1, entry.button)
    else p2ButtonDown(2, entry.button)
  }

  function onKeyUp(e: KeyboardEvent) {
    const entry = keyMap.get(e.code)
    if (!entry) return
    e.preventDefault()
    if (entry.player === 1) p1ButtonUp(1, entry.button)
    else p2ButtonUp(2, entry.button)
  }

  // Gamepad polling — uses the same keyMap with GP codes
  function onGamepadPress(code: string) {
    const entry = keyMap.get(code)
    if (!entry) return
    if (entry.player === 1) p1ButtonDown(1, entry.button)
    else p2ButtonDown(2, entry.button)
  }

  function onGamepadRelease(code: string) {
    const entry = keyMap.get(code)
    if (!entry) return
    if (entry.player === 1) p1ButtonUp(1, entry.button)
    else p2ButtonUp(2, entry.button)
  }

  const { start: startGamepad, stop: stopGamepad, connectedPads } = useGamepad(onGamepadPress, onGamepadRelease)

  function attach() {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    startGamepad()
  }

  function detach() {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    stopGamepad()
  }

  return {
    attach,
    detach,
    p1Bindings,
    p2Bindings,
    updateBindings,
    connectedPads,
  }
}
