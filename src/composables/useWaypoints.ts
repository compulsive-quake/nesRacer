import { ref, computed } from 'vue';

export interface Waypoint {
  id: string
  player: 1 | 2
  label: string
  world: number
  level: number
  timestamp: number
  state: object
}

const STORAGE_KEY = 'nesRacer-waypoints';

function loadFromStorage(): Waypoint[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Shared reactive state (singleton across all consumers)
const waypoints = ref<Waypoint[]>(loadFromStorage());

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(waypoints.value));
  } catch (e) {
    console.warn('Failed to save waypoints:', e);
  }
}

export function useWaypoints() {
  function addWaypoint(player: 1 | 2, world: number, level: number, state: object): Waypoint {
    const wp: Waypoint = {
      id: crypto.randomUUID(),
      player,
      label: `${world}-${level}`,
      world,
      level,
      timestamp: Date.now(),
      state,
    };
    waypoints.value.push(wp);
    persist();
    return wp;
  }

  function removeWaypoint(id: string) {
    const idx = waypoints.value.findIndex(w => w.id === id);
    if (idx !== -1) {
      waypoints.value.splice(idx, 1);
      persist();
    }
  }

  function clearPlayer(player: 1 | 2) {
    waypoints.value = waypoints.value.filter(w => w.player !== player);
    persist();
  }

  const p1Waypoints = computed(() => waypoints.value.filter(w => w.player === 1));
  const p2Waypoints = computed(() => waypoints.value.filter(w => w.player === 2));

  return {
    waypoints,
    p1Waypoints,
    p2Waypoints,
    addWaypoint,
    removeWaypoint,
    clearPlayer,
  };
}
