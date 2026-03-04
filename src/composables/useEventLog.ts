import { ref, computed } from 'vue';

export interface WatchedAddress {
  label: string
  addr: number
  values: Record<number, string>  // value → human-readable name
}

export interface LogEntry {
  index: number
  watchLabel: string
  player: 1 | 2
  timestamp: number   // ms since page load (performance.now)
  addr: number
  fromValue: number
  fromName: string
  toValue: number
  toName: string
}

// Addresses to watch — add new entries here
const WATCHED_ADDRESSES: WatchedAddress[] = [

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
    }
  },
];

// Singleton state
const entries = ref<LogEntry[]>([]);
const entryCounter = ref(0);

// Track previous values per player to detect transitions
const prevValues: Record<1 | 2, Record<number, number | undefined>> = {
  1: {},
  2: {},
};

function valueName(watch: WatchedAddress, val: number): string {
  return watch.values[val] ?? `$${val.toString(16).toUpperCase().padStart(2, '0')}`;
}

export function useEventLog() {
  function poll(player: 1 | 2, readMemory: (addr: number) => number) {
    const prev = prevValues[player];

    for (const watch of WATCHED_ADDRESSES) {
      const current = readMemory(watch.addr);
      const previous = prev[watch.addr];

      // Debug: track 0x0770 changes
      if (watch.addr === 0x0770 && current !== previous) {
        console.log(`[EventLog] P${player} $0770: ${previous} → ${current}`);
      }

      // Log any change (skip first read to establish baseline)
      if (previous !== undefined && current !== previous) {
        entryCounter.value++;
        entries.value.push({
          index: entryCounter.value,
          watchLabel: watch.label,
          player,
          timestamp: performance.now(),
          addr: watch.addr,
          fromValue: previous,
          fromName: valueName(watch, previous),
          toValue: current,
          toName: valueName(watch, current),
        });
      }

      prev[watch.addr] = current;
    }
  }

  function clear() {
    entries.value = [];
  }

  const count = computed(() => entries.value.length);

  return {
    entries,
    count,
    poll,
    clear,
    watchedAddresses: WATCHED_ADDRESSES,
  };
}
