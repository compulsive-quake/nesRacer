/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'jsnes' {
  export class NES {
    constructor(opts: {
      onFrame?: (frameBuffer: Int32Array) => void
      onAudioSample?: (left: number, right: number) => void
      emulateSound?: boolean
      sampleRate?: number
    })
    cpu: { mem: Uint8Array }
    loadROM(data: string): void
    frame(): void
    reset(): void
    reloadROM(): void
    buttonDown(player: number, button: number): void
    buttonUp(player: number, button: number): void
    toJSON(): object
    fromJSON(data: object): void
    getFPS(): number
    setFramerate(rate: number): void
  }

  export const Controller: {
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
