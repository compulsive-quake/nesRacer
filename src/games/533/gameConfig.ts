import type { GameToolbarConfig } from '../../gameConfigs'

export const gameConfig: GameToolbarConfig = {
  watchedAddresses: [],
  commandButtons: [],
  genieCodes: [
    { code: 'SUAAXA', title: 'Both players have infinite lives' },
    { code: 'PEZELG', title: 'Both players have 1 life' },
    { code: 'PEZELK', title: 'Both players have 9 lives' },
    { code: 'GZLATG', title: 'Player 1 start at last level reached' },
    { code: 'GZLEPG', title: 'Player 2 start at last level reached' },
    { code: 'SEZEGG', title: 'Give player 2 an advantage' },
    { code: 'AEVXLSPT', title: 'Enemy easier to shrug off' },
    { code: 'ZEVXPIGE', title: 'Enemy harder to shrug off' },
    { code: 'LEEXSYPA', title: 'Normal enemies do more damage' },
    { code: 'XYUXEUZK', title: 'Knife thrower harder to beat' },
    { code: 'GZVKIYSA', title: "Don't die when time runs out (1/2)" },
    { code: 'ATVKYNGG', title: "Don't die when time runs out (2/2)" },
  ],
  ramLabels: [],
}
