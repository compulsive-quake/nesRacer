import { ref, onUnmounted } from 'vue'

const AXIS_THRESHOLD = 0.5

export interface GamepadInput {
  code: string          // e.g. "GP0:B0" or "GP0:AX0+"
  gamepadIndex: number
}

/**
 * Polls connected gamepads each animation frame.
 * Tracks button/axis state and fires callbacks on press/release.
 */
export function useGamepad(
  onPress: (code: string) => void,
  onRelease: (code: string) => void,
) {
  const connectedPads = ref<number[]>([])
  let rafId = 0
  let running = false

  // Track previous state per gamepad: button pressed booleans + axis direction signs
  const prevButtons = new Map<number, boolean[]>()
  const prevAxes = new Map<number, number[]>() // -1, 0, or 1 per axis

  // Pre-computed code strings per gamepad to avoid template literal allocations every frame
  const buttonCodes = new Map<number, string[]>()
  const axisPlusCodes = new Map<number, string[]>()
  const axisMinusCodes = new Map<number, string[]>()

  function getButtonCode(gpIndex: number, btnIndex: number): string {
    let codes = buttonCodes.get(gpIndex)
    if (!codes) { codes = []; buttonCodes.set(gpIndex, codes) }
    if (!codes[btnIndex]) codes[btnIndex] = `GP${gpIndex}:B${btnIndex}`
    return codes[btnIndex]
  }

  function getAxisCode(gpIndex: number, axisIndex: number, positive: boolean): string {
    const map = positive ? axisPlusCodes : axisMinusCodes
    let codes = map.get(gpIndex)
    if (!codes) { codes = []; map.set(gpIndex, codes) }
    if (!codes[axisIndex]) codes[axisIndex] = `GP${gpIndex}:AX${axisIndex}${positive ? '+' : '-'}`
    return codes[axisIndex]
  }

  function syncConnectedPads() {
    const indices: number[] = []
    for (const gp of navigator.getGamepads()) {
      if (gp) indices.push(gp.index)
    }
    const prev = connectedPads.value
    if (indices.length !== prev.length || indices.some((v, i) => v !== prev[i])) {
      // Clean up state for disconnected pads
      for (const idx of prev) {
        if (!indices.includes(idx)) {
          prevButtons.delete(idx)
          prevAxes.delete(idx)
        }
      }
      connectedPads.value = indices
    }
  }

  function onConnected(e: GamepadEvent) {
    if (!connectedPads.value.includes(e.gamepad.index)) {
      connectedPads.value = [...connectedPads.value, e.gamepad.index]
    }
  }

  function onDisconnected(e: GamepadEvent) {
    connectedPads.value = connectedPads.value.filter(i => i !== e.gamepad.index)
    prevButtons.delete(e.gamepad.index)
    prevAxes.delete(e.gamepad.index)
    buttonCodes.delete(e.gamepad.index)
    axisPlusCodes.delete(e.gamepad.index)
    axisMinusCodes.delete(e.gamepad.index)
  }

  function poll() {
    const gamepads = navigator.getGamepads()

    for (const gp of gamepads) {
      if (!gp) continue

      // Buttons — use pre-computed code strings to avoid allocations
      const prev = prevButtons.get(gp.index) ?? []
      const curr: boolean[] = []
      for (let i = 0; i < gp.buttons.length; i++) {
        const pressed = gp.buttons[i].pressed
        curr[i] = pressed
        const wasPressed = prev[i] ?? false
        if (pressed && !wasPressed) onPress(getButtonCode(gp.index, i))
        else if (!pressed && wasPressed) onRelease(getButtonCode(gp.index, i))
      }
      prevButtons.set(gp.index, curr)

      // Axes (convert to discrete -1/0/+1)
      const prevAx = prevAxes.get(gp.index) ?? []
      const currAx: number[] = []
      for (let i = 0; i < gp.axes.length; i++) {
        const val = gp.axes[i]
        const dir = val > AXIS_THRESHOLD ? 1 : val < -AXIS_THRESHOLD ? -1 : 0
        currAx[i] = dir
        const prevDir = prevAx[i] ?? 0

        if (dir !== prevDir) {
          // Release previous direction
          if (prevDir === 1) onRelease(getAxisCode(gp.index, i, true))
          else if (prevDir === -1) onRelease(getAxisCode(gp.index, i, false))
          // Press new direction
          if (dir === 1) onPress(getAxisCode(gp.index, i, true))
          else if (dir === -1) onPress(getAxisCode(gp.index, i, false))
        }
      }
      prevAxes.set(gp.index, currAx)
    }

    if (running) rafId = requestAnimationFrame(poll)
  }

  function start() {
    if (running) return
    running = true
    window.addEventListener('gamepadconnected', onConnected)
    window.addEventListener('gamepaddisconnected', onDisconnected)
    syncConnectedPads()
    rafId = requestAnimationFrame(poll)
  }

  function stop() {
    running = false
    cancelAnimationFrame(rafId)
    window.removeEventListener('gamepadconnected', onConnected)
    window.removeEventListener('gamepaddisconnected', onDisconnected)
    prevButtons.clear()
    prevAxes.clear()
    buttonCodes.clear()
    axisPlusCodes.clear()
    axisMinusCodes.clear()
  }

  onUnmounted(stop)

  return { connectedPads, start, stop }
}

/**
 * Listens for any gamepad button press and resolves with the gamepad index.
 * Used for quick "assign controller to player" flow.
 * Returns a stop function.
 */
export function listenForGamepadAssign(onDetected: (gamepadIndex: number) => void): () => void {
  let running = true
  let rafId = 0
  const prevButtons = new Map<number, boolean[]>()

  function poll() {
    const gamepads = navigator.getGamepads()
    for (const gp of gamepads) {
      if (!gp) continue
      const prev = prevButtons.get(gp.index) ?? []
      const curr: boolean[] = []
      for (let i = 0; i < gp.buttons.length; i++) {
        const pressed = gp.buttons[i].pressed
        curr[i] = pressed
        if (pressed && !(prev[i] ?? false)) {
          onDetected(gp.index)
          running = false
          return
        }
      }
      prevButtons.set(gp.index, curr)
    }
    if (running) rafId = requestAnimationFrame(poll)
  }

  rafId = requestAnimationFrame(poll)
  return () => { running = false; cancelAnimationFrame(rafId) }
}

/**
 * Lightweight gamepad listener for the bind dialog.
 * Calls onInput when any gamepad button/axis is pressed.
 * Returns a stop function.
 */
export function listenForGamepadInput(onInput: (code: string) => void): () => void {
  let running = true
  let rafId = 0
  const prevButtons = new Map<number, boolean[]>()
  const prevAxes = new Map<number, number[]>()

  function poll() {
    const gamepads = navigator.getGamepads()
    for (const gp of gamepads) {
      if (!gp) continue

      const prev = prevButtons.get(gp.index) ?? []
      const curr: boolean[] = []
      for (let i = 0; i < gp.buttons.length; i++) {
        const pressed = gp.buttons[i].pressed
        curr[i] = pressed
        if (pressed && !(prev[i] ?? false)) {
          onInput(`GP${gp.index}:B${i}`)
          return // one input at a time
        }
      }
      prevButtons.set(gp.index, curr)

      const prevAx = prevAxes.get(gp.index) ?? []
      const currAx: number[] = []
      for (let i = 0; i < gp.axes.length; i++) {
        const val = gp.axes[i]
        const dir = val > AXIS_THRESHOLD ? 1 : val < -AXIS_THRESHOLD ? -1 : 0
        currAx[i] = dir
        if (dir !== 0 && dir !== (prevAx[i] ?? 0)) {
          onInput(`GP${gp.index}:AX${i}${dir > 0 ? '+' : '-'}`)
          return
        }
      }
      prevAxes.set(gp.index, currAx)
    }

    if (running) rafId = requestAnimationFrame(poll)
  }

  rafId = requestAnimationFrame(poll)

  return () => {
    running = false
    cancelAnimationFrame(rafId)
  }
}
