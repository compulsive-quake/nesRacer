import { ref, computed } from 'vue';
import type { WatchedAddress } from '../gameConfigs';

export type { WatchedAddress };

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

// Configurable watched addresses — set via configure()
let activeAddresses: WatchedAddress[] = [];

function valueName(watch: WatchedAddress, val: number): string {
  return watch.values[val] ?? `$${val.toString(16).toUpperCase().padStart(2, '0')}`;
}

export function useEventLog() {
  /** Set the watched addresses for this session. Call before polling. */
  function configure(addresses: WatchedAddress[]) {
    activeAddresses = addresses;
  }

  function poll(player: 1 | 2, readMemory: (addr: number) => number) {
    const prev = prevValues[player];

    for (const watch of activeAddresses) {
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
    configure,
    get watchedAddresses() { return activeAddresses; },
  };
}
