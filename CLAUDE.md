# nesRacer

Split-screen Super Mario Bros racing game — two jsnes NES emulators running side-by-side, racing through all 32 SMB levels.

## Tech Stack

- Vue 3.5 + TypeScript 5.9 + Vite 7.3
- jsnes 2.0 (NES emulator library)
- No component library — custom CSS

## Commands

- `npm run dev` — Start dev server (port 3000)
- `npm run build` — Type-check (vue-tsc) + production build
- `npm run preview` — Preview production build
- `npm run lint` — ESLint

## Architecture

**Entry flow:** `main.ts` → `App.vue` (screen router) → `LobbyScreen` | `SplitScreen`

**SplitScreen** is the main orchestrator (~1800 lines). It creates two `NesScreen` emulator instances (P1 Mario, P2 Luigi) and coordinates race logic via composables.

### Components

| Component | Role |
|-----------|------|
| `LobbyScreen` | Menu/welcome screen |
| `SplitScreen` | Race orchestrator — manages both emulators, race state, input, overlays |
| `NesScreen` | Canvas wrapper per emulator instance |
| `RaceOverlay` | HUD bar, settings modal, debug tools |
| `ProgressTimeline` | Visual 32-level progress bar |
| `ScoreBoard` | Level results table |
| `WaypointPanel` | Savestate manager |

### Composables

| Composable | Purpose |
|-----------|---------|
| `useNesEmulator` | jsnes wrapper — canvas rendering, audio, save/load state |
| `useInputManager` | Keyboard → controller button mapping (WASD+JK for P1, arrows+period/comma for P2) |
| `useGameDetector` | Parses SMB RAM addresses to detect game state (level, position, win/loss) |
| `useRaceManager` | Race logic — scores, level wins, advancement |
| `useMemoryRecorder` | RAM snapshot recording and trigger system |
| `useWaypoints` | Savestate persistence via localStorage |
| `useEventLog` | RAM change event tracking |

### Key Design Patterns

- **Dual-emulator:** Two independent jsnes instances; race manager watches frame callbacks to detect level completion
- **RAM introspection:** Game state detected by polling known SMB memory addresses (e.g., 0x0770 operMode, 0x075F world) — no ROM modifications
- **Composable architecture:** Each concern (emulation, input, detection, race logic, persistence) is a separate composable
- **Winner sync:** On level completion, winner's savestate is cloned to loser's emulator for next level
