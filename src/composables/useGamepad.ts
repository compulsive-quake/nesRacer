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

  function onConnected(e: GamepadEvent) {
    if (!connectedPads.value.includes(e.gamepad.index)) {
      connectedPads.value = [...connectedPads.value, e.gamepad.index]
    }
  }

  function onDisconnected(e: GamepadEvent) {
    connectedPads.value = connectedPads.value.filter(i => i !== e.gamepad.index)
    prevButtons.delete(e.gamepad.index)
    prevAxes.delete(e.gamepad.index)
  }

  function poll() {
    const gamepads = navigator.getGamepads()
    for (const gp of gamepads) {
      if (!gp) continue

      // Buttons
      const prev = prevButtons.get(gp.index) ?? []
      const curr: boolean[] = []
      for (let i = 0; i < gp.buttons.length; i++) {
        const pressed = gp.buttons[i].pressed
        curr[i] = pressed
        const wasPressed = prev[i] ?? false
        const code = `GP${gp.index}:B${i}`
        if (pressed && !wasPressed) onPress(code)
        else if (!pressed && wasPressed) onRelease(code)
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
          if (prevDir === 1) onRelease(`GP${gp.index}:AX${i}+`)
          else if (prevDir === -1) onRelease(`GP${gp.index}:AX${i}-`)
          // Press new direction
          if (dir === 1) onPress(`GP${gp.index}:AX${i}+`)
          else if (dir === -1) onPress(`GP${gp.index}:AX${i}-`)
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
    // Pick up already-connected gamepads
    for (const gp of navigator.getGamepads()) {
      if (gp && !connectedPads.value.includes(gp.index)) {
        connectedPads.value = [...connectedPads.value, gp.index]
      }
    }
    rafId = requestAnimationFrame(poll)
  }

  function stop() {
    running = false
    cancelAnimationFrame(rafId)
    window.removeEventListener('gamepadconnected', onConnected)
    window.removeEventListener('gamepaddisconnected', onDisconnected)
    prevButtons.clear()
    prevAxes.clear()
  }

  onUnmounted(stop)

  return { connectedPads, start, stop }
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
