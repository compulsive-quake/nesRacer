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

export function keyCodeToLabel(code: string): string {
  if (SPECIAL[code]) return SPECIAL[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6)
  if (code.startsWith('F') && /^F\d+$/.test(code)) return code
  return code
}
