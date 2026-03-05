const SPECIAL: Record<string, string> = {
  ArrowUp: '\u2191', ArrowDown: '\u2193', ArrowLeft: '\u2190', ArrowRight: '\u2192',
  Space: 'Space', Enter: 'Enter', Tab: 'Tab', Escape: 'Esc',
  ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift',
  ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
  AltLeft: 'L-Alt', AltRight: 'R-Alt',
  Backslash: '\\', BracketLeft: '[', BracketRight: ']',
  Comma: ',', Period: '.', Slash: '/', Semicolon: ';',
  Quote: "'", Backquote: '`', Minus: '-', Equal: '=',
  Backspace: 'Bksp', Delete: 'Del', Insert: 'Ins',
  Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn',
  CapsLock: 'Caps',
}

const GAMEPAD_BUTTONS: Record<number, string> = {
  0: 'A', 1: 'B', 2: 'X', 3: 'Y',
  4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
  8: 'Back', 9: 'Start',
  10: 'L3', 11: 'R3',
  12: 'D-Up', 13: 'D-Down', 14: 'D-Left', 15: 'D-Right',
  16: 'Home',
}

export function isGamepadCode(code: string): boolean {
  return code.startsWith('GP')
}

export function keyCodeToLabel(code: string): string {
  // Gamepad button: GP0:B0
  const gpBtn = code.match(/^GP(\d+):B(\d+)$/)
  if (gpBtn) {
    const pad = gpBtn[1]
    const btn = parseInt(gpBtn[2])
    const label = GAMEPAD_BUTTONS[btn] ?? `B${btn}`
    return `Pad${pad} ${label}`
  }
  // Gamepad axis: GP0:AX0+ or GP0:AX1-
  const gpAxis = code.match(/^GP(\d+):AX(\d+)([+-])$/)
  if (gpAxis) {
    const pad = gpAxis[1]
    const axis = parseInt(gpAxis[2])
    const dir = gpAxis[3]
    const axisNames: Record<string, string> = {
      '0+': 'LS Right', '0-': 'LS Left',
      '1+': 'LS Down', '1-': 'LS Up',
      '2+': 'RS Right', '2-': 'RS Left',
      '3+': 'RS Down', '3-': 'RS Up',
    }
    const label = axisNames[`${axis}${dir}`] ?? `Ax${axis}${dir}`
    return `Pad${pad} ${label}`
  }

  if (SPECIAL[code]) return SPECIAL[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6)
  if (code.startsWith('F') && /^F\d+$/.test(code)) return code
  return code
}
