import type { NesEmulator } from './types'
import { gameConfig as smb902Config } from './games/902/gameConfig'
import { gameConfig as kungFu533Config } from './games/533/gameConfig'

export interface WatchedAddress {
  label: string
  addr: number
  values: Record<number, string>
}

export interface CommandButton {
  id: string
  label: string
  hint?: string
  addrDisplay?: string
  perPlayer: boolean
  execute: (emu: NesEmulator) => void
}

export interface GenieCodeDef {
  code: string
  title: string
}

export interface RamLabel {
  addr: number
  label: string
}

export interface GameToolbarConfig {
  watchedAddresses: WatchedAddress[]
  commandButtons: CommandButton[]
  genieCodes: GenieCodeDef[]
  ramLabels: RamLabel[]
}

// ── Default (empty) config for unknown games ─────────────────
const defaultConfig: GameToolbarConfig = {
  watchedAddresses: [],
  commandButtons: [],
  genieCodes: [],
  ramLabels: [],
}

// ── Registry ─────────────────────────────────────────────────
const configs: Record<number, GameToolbarConfig> = {
  902: smb902Config,
  533: kungFu533Config,
}

export function getGameToolbarConfig(romId?: number): GameToolbarConfig {
  return romId != null ? (configs[romId] ?? defaultConfig) : defaultConfig
}
