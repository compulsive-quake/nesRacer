import { ref, computed } from 'vue'

export interface WatchedEvent {
  id: string
  label: string
  addr: number
  fromValue?: number
  toValue: number
}

export interface LogEntry {
  index: number
  eventId: string
  eventLabel: string
  player: 1 | 2
  timestamp: number   // ms since page load (performance.now)
  addr: number
  fromValue: number
  toValue: number
}

// Events to watch — add new entries here
const WATCHED_EVENTS: WatchedEvent[] = [
  {
    id: 'sliding-start',
    label: 'Sliding Flag',
    addr: 0x000E,
    toValue: 0x04,
  },
]

// Singleton state
const entries = ref<LogEntry[]>([])
const entryCounter = ref(0)

// Track previous values per player to detect transitions
const prevValues: Record<1 | 2, Record<number, number | undefined>> = {
  1: {},
  2: {},
}

export function useEventLog() {
  function poll(player: 1 | 2, readMemory: (addr: number) => number) {
    const prev = prevValues[player]

    for (const event of WATCHED_EVENTS) {
      const current = readMemory(event.addr)
      const previous = prev[event.addr]

      // Detect the specific transition
      const fromMatch = event.fromValue === undefined
        ? previous !== undefined && previous !== event.toValue
        : previous === event.fromValue
      if (fromMatch && current === event.toValue) {
        entryCounter.value++
        entries.value.push({
          index: entryCounter.value,
          eventId: event.id,
          eventLabel: event.label,
          player,
          timestamp: performance.now(),
          addr: event.addr,
          fromValue: previous!,
          toValue: event.toValue,
        })
      }

      prev[event.addr] = current
    }
  }

  function clear() {
    entries.value = []
  }

  const count = computed(() => entries.value.length)

  return {
    entries,
    count,
    poll,
    clear,
    watchedEvents: WATCHED_EVENTS,
  }
}
