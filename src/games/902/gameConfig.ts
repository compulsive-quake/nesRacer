import type { GameToolbarConfig } from '../../gameConfigs'

export const gameConfig: GameToolbarConfig = {
  watchedAddresses: [
    {
      label: 'Game Mode',
      addr: 0x0770,
      values: {
        0x00: 'Start Demo',
        0x01: 'Start Normal',
        0x02: 'End Current World',
        0x03: 'End Game (dead)',
      },
    },
    {
      label: 'Level loading',
      addr: 0x0772,
      values: {
        0x00: 'Restarts Level',
        0x01: 'start of level',
        0x02: 'unsure',
        0x03: 'Reset Level',
      },
    },
    {
      label: 'Players State',
      addr: 0x000E,
      values: {
        0x00: 'Leftmost of screen',
        0x01: 'Climbing vine',
        0x02: 'Entering reversed-L pipe',
        0x03: 'Going down a pipe',
        0x04: 'Autowalk',
        0x05: 'Autowalk',
        0x06: 'Player dies',
        0x07: 'Entering area',
        0x08: 'Normal',
        0x09: 'Small to Large',
        0x0A: 'Large to Small',
        0x0B: 'Dying',
        0x0C: 'Fire Mario transform',
      },
    },
    {
      label: 'Pre-Level Screen Timer',
      addr: 0x07A0,
      values: {
        0x07: '7 seconds left',
        0x06: '6 seconds left',
        0x05: '5 seconds left',
        0x04: '4 seconds left',
        0x03: '3 seconds left',
        0x02: '2 seconds left',
        0x01: '1 seconds left',
        0x00: '0 seconds left',
      },
    },
  ],

  commandButtons: [
    {
      id: 'timeout',
      label: 'Timeout',
      hint: 'Set timer to 000',
      addrDisplay: '$07FA $07F9 $07F8 = 0',
      perPlayer: true,
      execute: (emu) => {
        emu.writeMemory(0x07FA, 0)
        emu.writeMemory(0x07F9, 0)
        emu.writeMemory(0x07F8, 0)
      },
    },
    {
      id: 'nextlevel',
      label: 'Next Level',
      hint: 'Advance to next level',
      addrDisplay: '$072C = 0, $075C += 1, $0760 += 1',
      perPlayer: true,
      execute: (emu) => {
        const currentLevelAlt = emu.readMemory(0x075C)
        const currentLevel = emu.readMemory(0x0760)
        const currentWorld = emu.readMemory(0x075F)
        emu.writeMemory(0x072C, 0)
        if (currentWorld === 3) {
          emu.writeMemory(0x075C, 0)
          emu.writeMemory(0x0760, 0)
          emu.writeMemory(0x075F, currentWorld + 1)
        } else {
          emu.writeMemory(0x075C, currentLevelAlt + 1)
          emu.writeMemory(0x0760, currentLevel + 1)
        }
      },
    },
    {
      id: 'death',
      label: 'Death Screen',
      hint: 'Trigger death sequence',
      addrDisplay: '$000E = 06',
      perPlayer: true,
      execute: (emu) => {
        emu.writeMemory(0x000E, 0x06)
      },
    },
    {
      id: 'oneplayer',
      label: '1P Mode',
      hint: 'Set to 1-player mode',
      addrDisplay: '$077A = 0',
      perPlayer: true,
      execute: (emu) => {
        emu.writeMemory(0x077A, 0)
      },
    },
    {
      id: 'twoplayer',
      label: '2P Mode',
      hint: 'Set to 2-player mode',
      addrDisplay: '$077A = 1',
      perPlayer: true,
      execute: (emu) => {
        emu.writeMemory(0x077A, 1)
      },
    },
    {
      id: 'force-mario',
      label: 'Force Mario',
      hint: 'Switch to Mario',
      addrDisplay: '$077A = 0, $0753 = 0',
      perPlayer: true,
      execute: (emu) => {
        const nes = emu.getNes()
        if (!nes) return
        nes.cpu.mem[0x077A] = 0
        nes.cpu.mem[0x0753] = 0
      },
    },
    {
      id: 'force-luigi',
      label: 'Force Luigi',
      hint: 'Switch to Luigi',
      addrDisplay: '$0753 = 1',
      perPlayer: true,
      execute: (emu) => {
        const nes = emu.getNes()
        if (!nes) return
        nes.cpu.mem[0x0753] = 1
      },
    },
  ],

  genieCodes: [
    { code: 'APZLGK', title: 'Super jump from a standing start only' },
    { code: 'TPZLTG', title: 'Super jump from walking only' },
    { code: 'GPZUAG', title: 'Super jump from running only' },
    { code: 'APZLGG', title: 'Mega-jump from a standing start only' },
    { code: 'APZLTG', title: 'Mega-jump from walking only' },
    { code: 'GAZUAG', title: 'Mega-jump from running only' },
    { code: 'YAZULG', title: '"Moon gravity" from a standing start' },
    { code: 'YAZUIG', title: '"Moon gravity" from a walking start' },
    { code: 'YAZUYG', title: '"Moon gravity" from running only' },
    { code: 'GOZSXX', title: 'Everything is a star!' },
  ],

  ramLabels: [
    { addr: 0x0000, label: 'Temp / Gravity Acceleration' },
    { addr: 0x0001, label: 'Player Animation' },
    { addr: 0x0003, label: 'Player Direction (1=R, 2=L)' },
    { addr: 0x0008, label: 'Object Offset' },
    { addr: 0x0009, label: 'Frame Counter' },
    { addr: 0x000A, label: 'Button State AB' },
    { addr: 0x000B, label: 'Vertical Direction Input' },
    { addr: 0x000E, label: 'GameEngineSubroutine' },
    { addr: 0x00FA, label: 'Pause Effect Register' },
    { addr: 0x00FB, label: 'Area Music Register' },
    { addr: 0x00FC, label: 'Event Music Register' },
    { addr: 0x00FD, label: 'Sound Effect Register 1' },
    { addr: 0x00FE, label: 'Sound Effect Register 2' },
    { addr: 0x00FF, label: 'Sound Effect Register 3' },
    { addr: 0x03AD, label: 'Player X Within Screen Offset' },
    { addr: 0x03B8, label: 'Player Y Within Screen' },
    { addr: 0x03C4, label: 'Player Palette (star cycle)' },
    { addr: 0x0400, label: 'Player X-MoveForce' },
    { addr: 0x0450, label: 'Player Max Velocity Left' },
    { addr: 0x0456, label: 'Player Max Velocity Right' },
    { addr: 0x06D6, label: 'Warpzone Control' },
    { addr: 0x071A, label: 'Current Screen (in level)' },
    { addr: 0x071B, label: 'Next Screen (in level)' },
    { addr: 0x071D, label: 'Player X Position' },
    { addr: 0x0750, label: 'Area Offset' },
    { addr: 0x0753, label: 'CurrentPlayer (0=Mario, 1=Luigi)' },
    { addr: 0x0754, label: 'Player State (Big/Small/Fire)' },
    { addr: 0x0759, label: 'Time Up Flag' },
    { addr: 0x075A, label: 'Lives' },
    { addr: 0x075C, label: 'LevelNumber (alt)' },
    { addr: 0x075E, label: 'Coins' },
    { addr: 0x075F, label: 'WorldNumber (0-indexed)' },
    { addr: 0x0760, label: 'LevelNumber (0-indexed)' },
    { addr: 0x0770, label: 'OperMode (0=Demo,1=Play,2=Win,3=GO)' },
    { addr: 0x0772, label: 'Level Loading Setting' },
    { addr: 0x0776, label: 'Game Pause Status' },
    { addr: 0x077A, label: 'Number Of Players (0=1P, 1=2P)' },
    { addr: 0x079E, label: 'Star Timer (invincibility)' },
    { addr: 0x07A0, label: 'Pre-Level Screen Timer' },
    { addr: 0x07F8, label: 'Game Timer Hundreds' },
    { addr: 0x07F9, label: 'Game Timer Tens' },
    { addr: 0x07FA, label: 'Game Timer Ones' },
  ],
}
