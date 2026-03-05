<script setup lang="ts">
import type { NesButton } from '../types'

const props = defineProps<{
  pressed: Set<NesButton>
  label: string
}>()

function isPressed(btn: NesButton): boolean {
  return props.pressed.has(btn)
}
</script>

<template>
  <div class="nes-ctrl-wrap">
    <div class="nes-ctrl-label">{{ label }}</div>
    <svg viewBox="0 0 340 140" class="nes-ctrl-svg" xmlns="http://www.w3.org/2000/svg">
      <!-- Outer light-gray shell -->
      <rect x="1" y="1" width="338" height="138" rx="12" ry="12"
            fill="#b8b8b8" stroke="#999" stroke-width="1"/>

      <!-- Dark face panel (top ~75%) -->
      <rect x="10" y="8" width="320" height="100" rx="6" ry="6"
            fill="#3a3a3a"/>

      <!-- Two horizontal gray ridges on upper-right -->
      <rect x="125" y="16" width="185" height="11" rx="2" ry="2" fill="#666"/>
      <rect x="125" y="34" width="185" height="11" rx="2" ry="2" fill="#666"/>

      <!-- D-PAD -->
      <!-- Vertical bar -->
      <rect x="44" y="34" width="24" height="54" rx="2" ry="2"
            fill="#1a1a1a" stroke="#333" stroke-width="0.6"/>
      <!-- Horizontal bar -->
      <rect x="31" y="46" width="50" height="30" rx="2" ry="2"
            fill="#1a1a1a" stroke="#333" stroke-width="0.6"/>

      <!-- D-pad direction highlights -->
      <!-- Up -->
      <rect x="48" y="36" width="16" height="18" rx="2" ry="2"
            :fill="isPressed('up') ? '#e53935' : '#222'" class="nes-btn-hit"/>
      <!-- Down -->
      <rect x="48" y="68" width="16" height="18" rx="2" ry="2"
            :fill="isPressed('down') ? '#e53935' : '#222'" class="nes-btn-hit"/>
      <!-- Left -->
      <rect x="33" y="50" width="18" height="22" rx="2" ry="2"
            :fill="isPressed('left') ? '#e53935' : '#222'" class="nes-btn-hit"/>
      <!-- Right -->
      <rect x="61" y="50" width="18" height="22" rx="2" ry="2"
            :fill="isPressed('right') ? '#e53935' : '#222'" class="nes-btn-hit"/>
      <!-- Center nub -->
      <circle cx="56" cy="61" r="4" fill="#111"/>

      <!-- D-pad directional arrows (subtle) -->
      <polygon points="56,39 52,44 60,44" fill="#444"/>
      <polygon points="56,83 52,78 60,78" fill="#444"/>
      <polygon points="36,61 41,57 41,65" fill="#444"/>
      <polygon points="76,61 71,57 71,65" fill="#444"/>

      <!-- SELECT / START recessed tray -->
      <rect x="119" y="74" width="82" height="20" rx="10" ry="10"
            fill="#aaa" stroke="#999" stroke-width="0.5"/>

      <!-- SELECT label -->
      <text x="140" y="70" text-anchor="middle" fill="#c62828" font-size="7"
            font-weight="bold" font-family="inherit" letter-spacing="0.5">SELECT</text>
      <!-- START label -->
      <text x="180" y="70" text-anchor="middle" fill="#c62828" font-size="7"
            font-weight="bold" font-family="inherit" letter-spacing="0.5">START</text>

      <!-- Select button (angled pill) -->
      <g :transform="'translate(140, 84) rotate(-25)'">
        <rect x="-14" y="-5" width="28" height="10" rx="5" ry="5"
              :fill="isPressed('select') ? '#e53935' : '#555'"
              :stroke="isPressed('select') ? '#ff6659' : '#777'" stroke-width="0.6"
              class="nes-btn-hit"/>
      </g>

      <!-- Start button (angled pill) -->
      <g :transform="'translate(180, 84) rotate(-25)'">
        <rect x="-14" y="-5" width="28" height="10" rx="5" ry="5"
              :fill="isPressed('start') ? '#e53935' : '#555'"
              :stroke="isPressed('start') ? '#ff6659' : '#777'" stroke-width="0.6"
              class="nes-btn-hit"/>
      </g>

      <!-- B button well -->
      <circle cx="248" cy="72" r="17" fill="#aaa" stroke="#999" stroke-width="0.5"/>
      <!-- B button -->
      <circle cx="248" cy="72" r="14"
              :fill="isPressed('b') ? '#555' : '#e53935'"
              :stroke="isPressed('b') ? '#777' : '#c62828'" stroke-width="1"
              class="nes-btn-hit"/>
      <!-- B label -->
      <text x="248" y="98" text-anchor="middle" fill="#c62828" font-size="7"
            font-weight="bold" font-family="inherit">B</text>

      <!-- A button well -->
      <circle cx="294" cy="72" r="17" fill="#aaa" stroke="#999" stroke-width="0.5"/>
      <!-- A button -->
      <circle cx="294" cy="72" r="14"
              :fill="isPressed('a') ? '#555' : '#e53935'"
              :stroke="isPressed('a') ? '#777' : '#c62828'" stroke-width="1"
              class="nes-btn-hit"/>
      <!-- A label -->
      <text x="294" y="98" text-anchor="middle" fill="#c62828" font-size="7"
            font-weight="bold" font-family="inherit">A</text>
    </svg>
  </div>
</template>

<style scoped>
.nes-ctrl-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.nes-ctrl-label {
  font-size: 0.65rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #888;
}

.nes-ctrl-svg {
  width: 210px;
  height: auto;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
}

.nes-btn-hit {
  transition: fill 0.06s, stroke 0.06s;
}
</style>
