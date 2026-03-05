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
    }
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
    }
  }
];

// Singleton state
const entries = ref<LogEntry[]>([]);
const entryCounter = ref(0);

// Push-based subscriber registry
const subscribers = new Set<(entry: LogEntry) => void>();

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

      // Log any change (skip first read to establish baseline)
      if (previous !== undefined && current !== previous) {
        entryCounter.value++;
        const entry: LogEntry = {
          index: entryCounter.value,
          watchLabel: watch.label,
          player,
          timestamp: performance.now(),
          addr: watch.addr,
          fromValue: previous,
          fromName: valueName(watch, previous),
          toValue: current,
          toName: valueName(watch, current),
        };
        entries.value.push(entry);
        for (const cb of subscribers) cb(entry);
      }

      prev[watch.addr] = current;
    }
  }

  function clear() {
    entries.value = [];
  }

  /** Clear tracked previous values for a player so the next poll()
   *  establishes a fresh baseline instead of detecting spurious transitions. */
  function resetPlayer(player: 1 | 2) {
    prevValues[player] = {};
  }

  function reset() {
    entries.value = [];
    entryCounter.value = 0;
    prevValues[1] = {};
    prevValues[2] = {};
    subscribers.clear();
  }

  const count = computed(() => entries.value.length);

  function subscribe(callback: (entry: LogEntry) => void): () => void {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  }

  return {
    entries,
    count,
    poll,
    clear,
    reset,
    resetPlayer,
    subscribe,
    watchedAddresses: WATCHED_ADDRESSES,
  };
}
