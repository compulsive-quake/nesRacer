const GG_ALPHABET = 'APZLGITYEOXUKSVN'

export interface GameGeniePatch {
  address: number
  value: number
  compare?: number
}

/**
 * Decodes a NES Game Genie code into an address, replacement value,
 * and optional compare value.
 *
 * 6-letter codes: patch ROM reads at address with value unconditionally.
 * 8-letter codes: patch ROM reads at address with value only when current byte matches compare.
 *
 * Addresses are in CPU space (0x8000-0xFFFF, i.e. PRG ROM mapped region).
 */
export function decodeGameGenie(code: string): GameGeniePatch {
  code = code.toUpperCase().replace(/-/g, '')

  if (code.length !== 6 && code.length !== 8) {
    throw new Error(`Game Genie code must be 6 or 8 characters, got ${code.length}`)
  }

  const n = [...code].map((c, i) => {
    const v = GG_ALPHABET.indexOf(c)
    if (v === -1) throw new Error(`Invalid Game Genie character '${c}' at position ${i}`)
    return v
  })

  const address =
    0x8000 |
    ((n[3] & 7) << 12) |
    ((n[4] & 8) << 8) |
    ((n[5] & 7) << 8) |
    ((n[1] & 8) << 4) |
    ((n[2] & 7) << 4) |
    (n[3] & 8) |
    (n[4] & 7)

  if (code.length === 6) {
    const value =
      ((n[0] & 8) << 4) |
      ((n[1] & 7) << 4) |
      (n[5] & 8) |
      (n[0] & 7)

    return { address, value }
  }

  // 8-letter code: has compare value
  const value =
    ((n[0] & 8) << 4) |
    ((n[1] & 7) << 4) |
    (n[7] & 8) |
    (n[0] & 7)

  const compare =
    ((n[6] & 8) << 4) |
    ((n[7] & 7) << 4) |
    (n[5] & 8) |
    (n[6] & 7)

  return { address, value, compare }
}
