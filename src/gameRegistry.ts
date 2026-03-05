import type { Component } from 'vue'
import { defineAsyncComponent } from 'vue'

export interface GameComponentSet {
  splitScreen?: () => Promise<Component>
}

// Maps ROM IDs to their available game-specific components.
// Games without entries here get generic single-player only.
const gameComponents: Record<number, GameComponentSet> = {
  // Super Mario Bros. (World).nes — ID 902
  902: {
    splitScreen: () => import('./games/902/SplitScreen.vue').then(m => m.default),
  },
  // Kung Fu (Japan, USA).nes — ID 533
  533: {
    splitScreen: () => import('./games/533/SplitScreen.vue').then(m => m.default),
  },
}

export function hasSplitScreen(romId: number): boolean {
  return !!gameComponents[romId]?.splitScreen
}

export function getSplitScreenComponent(romId: number): Component | undefined {
  const loader = gameComponents[romId]?.splitScreen
  if (!loader) return undefined
  return defineAsyncComponent(loader)
}

export { gameComponents }
