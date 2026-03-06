export interface GameState {
  operMode: number        // 0=Title, 1=Playing, 2=Victory, 3=GameOver
  world: number           // 1-8
  level: number           // 1-4
  lives: number
  playerX: number         // absolute X position (page * 256 + x)
  playerY: number
  isDead: boolean
  isLevelComplete: boolean
  gameEngineState: number // $000E value
}

export interface RaceResult {
  world: number
  level: number
  winner: 1 | 2
}

export interface RaceState {
  phase: 'lobby' | 'racing' | 'race-over'
  currentWorld: number
  currentLevel: number
  results: RaceResult[]
  p1Score: number
  p2Score: number
  levelWinner: 1 | 2 | null
}

export type PlayerNumber = 1 | 2

export interface InputBinding {
  up: string
  down: string
  left: string
  right: string
  a: string
  b: string
  start: string
  select: string
}

export type NesButton = keyof InputBinding

export const NES_BUTTONS: NesButton[] = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select']

export interface BindingPreset {
  id: string
  name: string
  p1: InputBinding
  p2: InputBinding
  p1Gamepad: InputBinding
  p2Gamepad: InputBinding
  builtIn?: boolean
}

export interface GameInfo {
  filename: string
  title: string
  index: number
  romId: number | undefined
}

export interface NesEmulator {
  canvas: import('vue').Ref<HTMLCanvasElement | null>
  running: import('vue').Ref<boolean>
  paused: import('vue').Ref<boolean>
  setCanvas: (el: HTMLCanvasElement) => void
  loadROM: (url: string) => Promise<void>
  start: () => void
  tick: (timestamp: number) => void
  stopSelfDrive: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  reset: () => void
  buttonDown: (player: number, button: number) => void
  buttonUp: (player: number, button: number) => void
  zapperMove: (x: number, y: number) => void
  zapperFireDown: () => void
  zapperFireUp: () => void
  readMemory: (address: number) => number
  writeMemory: (address: number, value: number) => void
  saveState: () => object | null
  loadState: (state: object) => void
  getNes: () => any
  onFrame: (callback: (nes: any) => void) => void
  setVolume: (volume: number) => void
  Controller: {
    BUTTON_A: number
    BUTTON_B: number
    BUTTON_SELECT: number
    BUTTON_START: number
    BUTTON_UP: number
    BUTTON_DOWN: number
    BUTTON_LEFT: number
    BUTTON_RIGHT: number
  }
}
