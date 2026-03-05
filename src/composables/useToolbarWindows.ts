import { onUnmounted, type ShallowRef } from 'vue'
import type { NesEmulator } from '../types'
import type { GameToolbarConfig, RamLabel } from '../gameConfigs'
import type { LogEntry } from './useEventLog'

interface ToolbarWindowsOptions {
  config: GameToolbarConfig
  emus: ShallowRef<NesEmulator | null>[]
  eventLog: ReturnType<typeof import('./useEventLog').useEventLog>
}

export function useToolbarWindows(opts: ToolbarWindowsOptions) {
  const { config, emus, eventLog } = opts

  let commandPaletteWindow: Window | null = null
  let eventLogWindow: Window | null = null
  let eventLogInterval: ReturnType<typeof setInterval> | null = null
  let memoryWindow: Window | null = null
  let memoryInterval: ReturnType<typeof setInterval> | null = null

  const RAM_FAVORITES_KEY = 'nesRacer-ramFavorites'

  function loadRamFavorites(): Set<number> {
    try {
      const data = localStorage.getItem(RAM_FAVORITES_KEY)
      return data ? new Set(JSON.parse(data) as number[]) : new Set()
    } catch { return new Set() }
  }

  function saveRamFavorites(favs: Set<number>) {
    try { localStorage.setItem(RAM_FAVORITES_KEY, JSON.stringify([...favs])) }
    catch (e) { console.warn('Failed to save RAM favorites:', e) }
  }

  // ── Command Palette ────────────────────────────────────────
  function openCommandPalette() {
    if (commandPaletteWindow && !commandPaletteWindow.closed) {
      commandPaletteWindow.focus()
      return
    }

    commandPaletteWindow = window.open('', 'nesRacerCommandPalette', 'width=480,height=800')
    if (!commandPaletteWindow) return

    const playerCount = emus.length
    const buttons = config.commandButtons

    // Build button HTML
    let buttonsHtml = ''
    for (const btn of buttons) {
      if (btn.perPlayer) {
        for (let p = 1; p <= playerCount; p++) {
          buttonsHtml += cmdButtonHtml(btn.id, p as 1 | 2, `${btn.label} P${p}`, btn.hint, btn.addrDisplay)
        }
      } else {
        buttonsHtml += cmdButtonHtml(btn.id, undefined, btn.label, btn.hint, btn.addrDisplay)
      }
    }

    if (buttons.length === 0) {
      buttonsHtml = '<div style="grid-column: 1/-1; text-align:center; color:#666; padding:20px;">No commands configured for this game.</div>'
    }

    const doc = commandPaletteWindow.document
    doc.write(`<!DOCTYPE html>
<html><head><title>nesRacer — Command Palette</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #ccc; font-family: 'Segoe UI', sans-serif; padding: 20px; }
  h1 { font-size: 16px; color: #fff; margin-bottom: 16px; border-bottom: 1px solid #333; padding-bottom: 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .cmd-btn {
    padding: 16px 12px; border: 1px solid #333; border-radius: 8px;
    background: rgba(255,255,255,0.05); color: #ccc; font-size: 14px; font-weight: 600;
    cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s;
    text-align: center; line-height: 1.3;
  }
  .cmd-btn:hover { background: rgba(255,255,255,0.12); border-color: #666; color: #fff; }
  .cmd-btn:active { background: rgba(255,80,80,0.25); border-color: #e53935; }
  .cmd-btn .label { display: block; font-size: 14px; }
  .cmd-btn .hint { display: block; font-size: 10px; color: #888; margin-top: 4px; font-weight: normal; }
  .cmd-btn .addr { font-family: 'Courier New', monospace; color: #4fc3f7; font-size: 10px; }
</style>
</head><body>
<h1>Command Palette</h1>
<div class="grid">${buttonsHtml}</div>
</body></html>`)
    doc.close()

    // Resize to fit
    const win = commandPaletteWindow
    const contentWidth = doc.body.scrollWidth
    const contentHeight = doc.body.scrollHeight
    const chromeWidth = win.outerWidth - win.innerWidth
    const chromeHeight = win.outerHeight - win.innerHeight
    win.resizeTo(contentWidth + chromeWidth, contentHeight + chromeHeight)

    // Wire up click handlers
    for (const btn of buttons) {
      if (btn.perPlayer) {
        for (let p = 1; p <= playerCount; p++) {
          const el = doc.getElementById(`cmd-${btn.id}-p${p}`)
          if (el) {
            const pIdx = p - 1
            el.addEventListener('click', () => {
              const emu = emus[pIdx]?.value
              if (emu) btn.execute(emu)
            })
          }
        }
      } else {
        const el = doc.getElementById(`cmd-${btn.id}`)
        if (el) {
          el.addEventListener('click', () => {
            const emu = emus[0]?.value
            if (emu) btn.execute(emu)
          })
        }
      }
    }
  }

  function cmdButtonHtml(id: string, player: 1 | 2 | undefined, label: string, hint?: string, addrDisplay?: string): string {
    const elId = player != null ? `cmd-${id}-p${player}` : `cmd-${id}`
    return `<button class="cmd-btn" id="${elId}">
    <span class="label">${label}</span>
    ${hint ? `<span class="hint">${hint}</span>` : ''}
    ${addrDisplay ? `<span class="addr">${addrDisplay}</span>` : ''}
  </button>`
  }

  // ── Event Log ──────────────────────────────────────────────
  function openEventLog() {
    if (eventLogWindow && !eventLogWindow.closed) {
      eventLogWindow.focus()
      return
    }

    eventLogWindow = window.open('', 'nesRacerEventLog', 'width=750,height=500,scrollbars=yes')
    if (!eventLogWindow) return

    const doc = eventLogWindow.document
    doc.write(`<!DOCTYPE html>
<html><head><title>nesRacer — Event Log</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #ccc; font-family: 'Courier New', monospace; font-size: 13px; }
  .toolbar { position: sticky; top: 0; z-index: 10; background: #111; border-bottom: 1px solid #333;
             padding: 10px 16px; display: flex; align-items: center; gap: 12px; }
  .toolbar h1 { font-family: sans-serif; font-size: 16px; color: #fff; margin: 0; white-space: nowrap; }
  .toolbar .count { font-size: 12px; color: #888; }
  .btn { background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #ccc;
         padding: 5px 12px; cursor: pointer; font-size: 12px; font-family: sans-serif; transition: all 0.15s; }
  .btn:hover { border-color: #555; color: #fff; }
  .btn-danger { border-color: #e53935; color: #e53935; }
  .btn-danger:hover { background: rgba(229, 57, 53, 0.1); }
  .spacer { flex: 1; }
  .watched-section { padding: 8px 16px; border-bottom: 1px solid #1a1a1a; }
  .watched-section h3 { font-family: sans-serif; font-size: 11px; color: #666; text-transform: uppercase;
                         letter-spacing: 0.05em; margin-bottom: 4px; }
  .watched-item { font-size: 11px; color: #888; padding: 2px 0; }
  .watched-addr { color: #4fc3f7; }
  .watched-label { color: #aaa; }
  .watched-values { color: #666; }
  .content { padding: 8px 16px 16px; }
  .log-entry { display: flex; gap: 10px; padding: 5px 8px; border-bottom: 1px solid #1a1a1a;
               font-size: 12px; align-items: baseline; }
  .log-entry:hover { background: rgba(255,255,255,0.03); }
  .log-entry.new { animation: flash 0.6s ease-out; }
  @keyframes flash { 0% { background: rgba(245, 166, 35, 0.2); } 100% { background: transparent; } }
  .e-index { color: #555; min-width: 28px; font-size: 11px; }
  .e-time { color: #888; min-width: 70px; font-size: 11px; }
  .e-player { font-size: 11px; font-weight: bold; min-width: 24px; }
  .e-player.p1 { color: #4caf50; }
  .e-player.p2 { color: #5c8fff; }
  .e-label { color: #f5a623; flex: 1; }
  .e-values { color: #ccc; white-space: nowrap; font-size: 11px; }
  .e-from { color: #e53935; }
  .e-to { color: #4caf50; }
  .empty-state { text-align: center; padding: 40px; color: #555; font-family: sans-serif; font-size: 13px; }
</style></head>
<body>
  <div class="toolbar">
    <h1>Event Log</h1>
    <span id="count" class="count"></span>
    <span class="spacer"></span>
    <button id="btn-clear" class="btn btn-danger">Clear</button>
  </div>
  <div id="watched" class="watched-section"></div>
  <div class="content">
    <div id="log-body"></div>
  </div>
</body></html>`)
    doc.close()

    const countEl = doc.getElementById('count')!
    const logBody = doc.getElementById('log-body')!
    const watchedEl = doc.getElementById('watched')!
    const btnClear = doc.getElementById('btn-clear') as HTMLButtonElement

    // Show watched addresses
    const addresses = eventLog.watchedAddresses
    if (addresses.length > 0) {
      let watchedHtml = '<h3>Watching</h3>'
      for (const w of addresses) {
        const addrHex = w.addr.toString(16).toUpperCase().padStart(4, '0')
        watchedHtml += `<div class="watched-item">`
        watchedHtml += `<span class="watched-addr">$${addrHex}</span> `
        watchedHtml += `<span class="watched-label">${w.label}</span> `
        const valStrs = Object.entries(w.values)
          .map(([v, name]) => `$${Number(v).toString(16).toUpperCase().padStart(2, '0')}=${name}`)
          .join(', ')
        watchedHtml += `<span class="watched-values">${valStrs}</span>`
        watchedHtml += `</div>`
      }
      watchedEl.innerHTML = watchedHtml
    } else {
      watchedEl.innerHTML = '<h3>No watched addresses configured for this game</h3>'
    }

    btnClear.addEventListener('click', () => {
      eventLog.clear()
    })

    let lastRenderedCount = 0
    const startTime = performance.now()

    function refresh() {
      if (!eventLogWindow || eventLogWindow.closed) {
        if (eventLogInterval) clearInterval(eventLogInterval)
        eventLogInterval = null
        return
      }

      const allEntries = eventLog.entries.value
      countEl.textContent = `${allEntries.length} event${allEntries.length !== 1 ? 's' : ''}`

      if (allEntries.length === 0) {
        logBody.innerHTML = '<div class="empty-state">No events detected yet. Play the game and events will appear here.</div>'
        lastRenderedCount = 0
        return
      }

      if (allEntries.length === lastRenderedCount) return
      lastRenderedCount = allEntries.length

      let html = ''
      for (let i = allEntries.length - 1; i >= 0; i--) {
        const e = allEntries[i]
        const elapsed = (e.timestamp - startTime) / 1000
        const mins = Math.floor(elapsed / 60)
        const secs = (elapsed % 60).toFixed(1)
        const timeStr = mins > 0 ? `${mins}:${secs.padStart(4, '0')}` : `${secs}s`
        const isNew = i === allEntries.length - 1
        html += `<div class="log-entry${isNew ? ' new' : ''}">`
        html += `<span class="e-index">#${e.index}</span>`
        html += `<span class="e-time">${timeStr}</span>`
        html += `<span class="e-player ${e.player === 1 ? 'p1' : 'p2'}">P${e.player}</span>`
        html += `<span class="e-label">${e.watchLabel}</span>`
        html += `<span class="e-values"><span class="e-from">${e.fromName}</span> &rarr; <span class="e-to">${e.toName}</span></span>`
        html += `</div>`
      }
      logBody.innerHTML = html
    }

    refresh()
    eventLogInterval = setInterval(refresh, 200)
  }

  // ── Memory Viewer ──────────────────────────────────────────
  function openMemoryViewer() {
    if (memoryWindow && !memoryWindow.closed) {
      memoryWindow.focus()
      return
    }

    memoryWindow = window.open('', 'nesRacerMemory', 'width=1100,height=800,scrollbars=yes')
    if (!memoryWindow) return

    const ramLabels = config.ramLabels
    const favorites = loadRamFavorites()
    let favoritesOnly = false
    let searchQuery = ''

    const doc = memoryWindow.document
    doc.write(`<!DOCTYPE html>
<html><head><title>nesRacer — RAM Viewer</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #ccc; font-family: 'Courier New', monospace; font-size: 13px; padding: 0; }
  .sticky-header { position: sticky; top: 0; z-index: 10; background: #111; border-bottom: 1px solid #333; padding: 12px 16px; display: flex; align-items: center; gap: 12px; }
  .sticky-header h1 { font-family: sans-serif; font-size: 18px; color: #fff; white-space: nowrap; margin: 0; }
  .search-input { flex: 1; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #ccc; font-family: 'Courier New', monospace; font-size: 13px; padding: 6px 10px; outline: none; min-width: 120px; }
  .search-input:focus { border-color: #4fc3f7; }
  .btn { background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #ccc; padding: 6px 14px; cursor: pointer; font-size: 12px; font-family: sans-serif; transition: all 0.15s; white-space: nowrap; }
  .btn:hover { border-color: #555; color: #fff; }
  .btn.active { border-color: #ffd700; color: #ffd700; }
  .label-count { font-size: 12px; color: #666; font-family: sans-serif; }
  table { width: 100%; border-collapse: collapse; }
  th { font-family: sans-serif; font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 10px; text-align: left; border-bottom: 1px solid #222; position: sticky; top: 48px; background: #0d0d0d; z-index: 5; }
  td { padding: 4px 10px; border-bottom: 1px solid #111; }
  tr:hover { background: rgba(255,255,255,0.03); }
  .addr { color: #4fc3f7; }
  .val { color: #fff; font-weight: bold; min-width: 30px; display: inline-block; }
  .lbl { color: #aaa; }
  .fav-btn { background: none; border: none; cursor: pointer; font-size: 14px; padding: 0 4px; opacity: 0.3; transition: opacity 0.15s; }
  .fav-btn:hover { opacity: 0.7; }
  .fav-btn.active { opacity: 1; }
  .empty-msg { text-align: center; padding: 40px; color: #555; font-family: sans-serif; }
</style></head>
<body>
  <div class="sticky-header">
    <h1>RAM Viewer</h1>
    <input class="search-input" id="search" placeholder="Search address or label..." />
    <button class="btn" id="fav-filter">&#x2605; Favorites</button>
    <span class="label-count" id="label-count">${ramLabels.length} labels</span>
  </div>
  <table><thead><tr><th></th><th>Addr</th><th>P1</th>${emus.length > 1 ? '<th>P2</th>' : ''}<th>Label</th></tr></thead>
  <tbody id="ram-body"></tbody></table>
</body></html>`)
    doc.close()

    const ramBody = doc.getElementById('ram-body')!
    const searchEl = doc.getElementById('search') as HTMLInputElement
    const favFilterBtn = doc.getElementById('fav-filter')!

    searchEl.addEventListener('input', () => {
      searchQuery = searchEl.value.toLowerCase()
    })

    favFilterBtn.addEventListener('click', () => {
      favoritesOnly = !favoritesOnly
      favFilterBtn.classList.toggle('active', favoritesOnly)
    })

    function refresh() {
      if (!memoryWindow || memoryWindow.closed) {
        if (memoryInterval) clearInterval(memoryInterval)
        memoryInterval = null
        return
      }

      const emu1 = emus[0]?.value
      const emu2 = emus.length > 1 ? emus[1]?.value : null

      // If no labeled addresses, show raw hex dump of first 2KB
      const rows = ramLabels.length > 0 ? ramLabels : Array.from({ length: 128 }, (_, i) => ({
        addr: i * 16,
        label: '',
      }))

      let html = ''
      for (const row of rows) {
        if (favoritesOnly && !favorites.has(row.addr)) continue
        const addrHex = '$' + row.addr.toString(16).toUpperCase().padStart(4, '0')
        if (searchQuery && !addrHex.toLowerCase().includes(searchQuery) && !row.label.toLowerCase().includes(searchQuery)) continue

        const p1Val = emu1 ? emu1.readMemory(row.addr) : 0
        const p1Hex = '$' + p1Val.toString(16).toUpperCase().padStart(2, '0')
        const p2Val = emu2 ? emu2.readMemory(row.addr) : 0
        const p2Hex = '$' + p2Val.toString(16).toUpperCase().padStart(2, '0')
        const isFav = favorites.has(row.addr)

        html += `<tr>`
        html += `<td><button class="fav-btn ${isFav ? 'active' : ''}" data-addr="${row.addr}">&#x2605;</button></td>`
        html += `<td class="addr">${addrHex}</td>`
        html += `<td><span class="val">${p1Hex}</span> <span style="color:#666">${p1Val}</span></td>`
        if (emus.length > 1) {
          html += `<td><span class="val">${p2Hex}</span> <span style="color:#666">${p2Val}</span></td>`
        }
        html += `<td class="lbl">${row.label}</td>`
        html += `</tr>`
      }

      if (!html) {
        html = '<tr><td colspan="5" class="empty-msg">No matches</td></tr>'
      }

      ramBody.innerHTML = html

      // Re-wire fav buttons
      for (const btn of ramBody.querySelectorAll('.fav-btn')) {
        btn.addEventListener('click', (e) => {
          const addr = Number((e.currentTarget as HTMLElement).dataset.addr)
          if (favorites.has(addr)) {
            favorites.delete(addr)
          } else {
            favorites.add(addr)
          }
          saveRamFavorites(favorites)
        })
      }
    }

    refresh()
    memoryInterval = setInterval(refresh, 200)
  }

  // ── Cleanup ────────────────────────────────────────────────
  function stopIntervals() {
    if (eventLogInterval) { clearInterval(eventLogInterval); eventLogInterval = null }
    if (memoryInterval) { clearInterval(memoryInterval); memoryInterval = null }
  }

  function cleanup() {
    stopIntervals()
    if (commandPaletteWindow && !commandPaletteWindow.closed) commandPaletteWindow.close()
    if (eventLogWindow && !eventLogWindow.closed) eventLogWindow.close()
    if (memoryWindow && !memoryWindow.closed) memoryWindow.close()
  }

  onUnmounted(cleanup)

  return {
    openCommandPalette,
    openEventLog,
    openMemoryViewer,
    stopIntervals,
    cleanup,
  }
}
