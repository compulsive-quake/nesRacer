import { ref } from 'vue'
import type { InputBinding, BindingPreset } from '../types'
import { DEFAULT_P1, DEFAULT_P2, DEFAULT_P1_GAMEPAD, DEFAULT_P2_GAMEPAD } from './useInputManager'

const STORAGE_KEY = 'nesRacer:bindingPresets'

const DEFAULT_PRESET: BindingPreset = {
  id: '__default__',
  name: 'Default',
  p1: { ...DEFAULT_P1 },
  p2: { ...DEFAULT_P2 },
  p1Gamepad: { ...DEFAULT_P1_GAMEPAD },
  p2Gamepad: { ...DEFAULT_P2_GAMEPAD },
  builtIn: true,
}

function loadPresets(): BindingPreset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    const userPresets: BindingPreset[] = data ? JSON.parse(data) : []
    // Migrate legacy presets missing gamepad fields
    for (const p of userPresets) {
      if (!p.p1Gamepad) p.p1Gamepad = { ...DEFAULT_P1_GAMEPAD }
      if (!p.p2Gamepad) p.p2Gamepad = { ...DEFAULT_P2_GAMEPAD }
    }
    return [DEFAULT_PRESET, ...userPresets.filter(p => p.id !== '__default__')]
  } catch {
    return [DEFAULT_PRESET]
  }
}

function persistPresets(presets: BindingPreset[]) {
  const userOnly = presets.filter(p => !p.builtIn)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly))
}

const presets = ref<BindingPreset[]>(loadPresets())

export function useBindingPresets() {
  function addPreset(name: string, p1: InputBinding, p2: InputBinding, p1Gp: InputBinding, p2Gp: InputBinding): BindingPreset {
    const preset: BindingPreset = {
      id: crypto.randomUUID(),
      name,
      p1: { ...p1 },
      p2: { ...p2 },
      p1Gamepad: { ...p1Gp },
      p2Gamepad: { ...p2Gp },
    }
    presets.value = [...presets.value, preset]
    persistPresets(presets.value)
    return preset
  }

  function removePreset(id: string) {
    const target = presets.value.find(p => p.id === id)
    if (!target || target.builtIn) return
    presets.value = presets.value.filter(p => p.id !== id)
    persistPresets(presets.value)
  }

  function getPreset(id: string): BindingPreset | undefined {
    return presets.value.find(p => p.id === id)
  }

  return { presets, addPreset, removePreset, getPreset }
}
