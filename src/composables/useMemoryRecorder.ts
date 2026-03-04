import { ref } from 'vue';

export interface MemorySnapshot {
  tick: number
  timestampMs: number
  values: Record<number, number>
}

export interface MemoryChange {
  tick: number
  timestampMs: number
  addr: number
  label: string
  oldValue: number
  newValue: number
}

export interface MemoryRecording {
  id: string
  label: string
  player: 1 | 2
  startedAt: number
  sampleIntervalMs: number
  durationMs: number
  addresses: Array<{ addr: number; label: string }>
  snapshots: MemorySnapshot[]
  changes: MemoryChange[]
}

export interface TriggerStep {
  delayMs: number
  addr: number
  label: string
  value: number
}

export interface TriggerSequence {
  id: string
  label: string
  createdAt: number
  player: 1 | 2
  steps: TriggerStep[]
}

// Singleton state
const isRecording = ref(false);
const currentRecording = ref<MemoryRecording | null>(null);
const recordings = ref<MemoryRecording[]>([]);

// Internal (non-reactive) recording state
let sampleInterval: ReturnType<typeof setInterval> | null = null;
let readMemoryFn: ((addr: number) => number) | null = null;
let addressMap: Array<{ addr: number; label: string }> = [];
let recordingStartTime = 0;
let tickCounter = 0;

function deriveChanges(
  snapshots: MemorySnapshot[],
  addresses: Array<{ addr: number; label: string }>,
): MemoryChange[] {
  const changes: MemoryChange[] = [];
  const labelMap = new Map(addresses.map(a => [a.addr, a.label]));

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    for (const key of Object.keys(curr.values)) {
      const addr = Number(key);
      if (prev.values[addr] !== curr.values[addr]) {
        changes.push({
          tick: curr.tick,
          timestampMs: curr.timestampMs,
          addr,
          label: labelMap.get(addr) || `$${addr.toString(16).toUpperCase().padStart(4, '0')}`,
          oldValue: prev.values[addr],
          newValue: curr.values[addr],
        });
      }
    }
  }

  return changes;
}

export function useMemoryRecorder() {
  function startRecording(
    player: 1 | 2,
    readMemory: (addr: number) => number,
    addrMap: Array<{ addr: number; label: string }>,
    intervalMs = 100,
  ) {
    if (isRecording.value) return;

    readMemoryFn = readMemory;
    addressMap = addrMap;
    tickCounter = 0;
    recordingStartTime = performance.now();

    currentRecording.value = {
      id: crypto.randomUUID(),
      label: `Recording ${new Date().toLocaleString()}`,
      player,
      startedAt: Date.now(),
      sampleIntervalMs: intervalMs,
      durationMs: 0,
      addresses: [...addrMap],
      snapshots: [],
      changes: [],
    };

    isRecording.value = true;

    // Immediate first sample
    takeSample();

    // Periodic sampling
    sampleInterval = setInterval(takeSample, intervalMs);
  }

  function takeSample() {
    if (!isRecording.value || !currentRecording.value || !readMemoryFn) return;

    const snapshot: MemorySnapshot = {
      tick: tickCounter,
      timestampMs: performance.now() - recordingStartTime,
      values: {},
    };

    for (const entry of addressMap) {
      snapshot.values[entry.addr] = readMemoryFn(entry.addr);
    }

    currentRecording.value.snapshots.push(snapshot);
    tickCounter++;
  }

  function stopRecording(): MemoryRecording | null {
    if (!isRecording.value || !currentRecording.value) return null;

    if (sampleInterval) {
      clearInterval(sampleInterval);
      sampleInterval = null;
    }

    isRecording.value = false;

    const rec = currentRecording.value;
    rec.durationMs = performance.now() - recordingStartTime;
    rec.changes = deriveChanges(rec.snapshots, rec.addresses);

    recordings.value.push(rec);

    const result = rec;
    currentRecording.value = null;
    readMemoryFn = null;

    return result;
  }

  function recordingToTrigger(recording: MemoryRecording): TriggerSequence {
    const steps: TriggerStep[] = [];
    let lastTimestamp = 0;

    for (const change of recording.changes) {
      steps.push({
        delayMs: Math.round(change.timestampMs - lastTimestamp),
        addr: change.addr,
        label: change.label,
        value: change.newValue,
      });
      lastTimestamp = change.timestampMs;
    }

    return {
      id: crypto.randomUUID(),
      label: `Trigger from ${recording.label}`,
      createdAt: Date.now(),
      player: recording.player,
      steps,
    };
  }

  function exportRecordingJson(recording: MemoryRecording): string {
    return JSON.stringify({
      version: 1,
      type: 'nesRacer-memory-recording',
      ...recording,
    }, null, 2);
  }

  function exportTriggerJson(trigger: TriggerSequence): string {
    return JSON.stringify({
      version: 1,
      type: 'nesRacer-trigger',
      ...trigger,
    }, null, 2);
  }

  function importTrigger(jsonStr: string): TriggerSequence | null {
    try {
      const data = JSON.parse(jsonStr);
      if (data.type !== 'nesRacer-trigger' || !Array.isArray(data.steps)) return null;
      return {
        id: data.id || crypto.randomUUID(),
        label: data.label || 'Imported Trigger',
        createdAt: data.createdAt || Date.now(),
        player: data.player || 1,
        steps: data.steps,
      };
    } catch {
      return null;
    }
  }

  function executeTrigger(
    trigger: TriggerSequence,
    writeMemory: (addr: number, value: number) => void,
  ): { cancel: () => void } {
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    let cumulativeDelay = 0;
    for (const step of trigger.steps) {
      cumulativeDelay += step.delayMs;
      const delay = cumulativeDelay;
      const t = setTimeout(() => {
        if (cancelled) return;
        writeMemory(step.addr, step.value);
      }, delay);
      timeouts.push(t);
    }

    return {
      cancel() {
        cancelled = true;
        timeouts.forEach(clearTimeout);
      },
    };
  }

  function deleteRecording(id: string) {
    recordings.value = recordings.value.filter(r => r.id !== id);
  }

  function getRecordingStartTime() {
    return recordingStartTime;
  }

  return {
    isRecording,
    currentRecording,
    recordings,
    startRecording,
    stopRecording,
    recordingToTrigger,
    exportRecordingJson,
    exportTriggerJson,
    importTrigger,
    executeTrigger,
    deleteRecording,
    getRecordingStartTime,
  };
}
