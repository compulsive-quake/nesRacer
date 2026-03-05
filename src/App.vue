<script setup lang="ts">
import { ref, shallowRef, type Component } from 'vue';
import LobbyScreen from './components/LobbyScreen.vue';
import SinglePlayer from './components/SinglePlayer.vue';
import { getSplitScreenComponent } from './gameRegistry';

type Screen = 'lobby' | 'local-race' | 'single-player'

const currentScreen = ref<Screen>('lobby');
const selectedRomUrl = ref('');
const selectedRomId = ref(0);
const splitScreenComponent = shallowRef<Component | undefined>();

function startLocalRace(romUrl: string, romId: number) {
  selectedRomUrl.value = romUrl;
  selectedRomId.value = romId;
  splitScreenComponent.value = getSplitScreenComponent(romId);
  currentScreen.value = 'local-race';
}

function startSinglePlayer(romUrl: string, romId: number) {
  selectedRomUrl.value = romUrl;
  selectedRomId.value = romId;
  currentScreen.value = 'single-player';
}

function backToLobby() {
  currentScreen.value = 'lobby';
}
</script>

<template>
  <LobbyScreen
    v-if="currentScreen === 'lobby'"
    @start-local="startLocalRace"
    @start-single="startSinglePlayer"
  />
  <component
    v-else-if="currentScreen === 'local-race' && splitScreenComponent"
    :is="splitScreenComponent"
    :rom-url="selectedRomUrl"
    @back-to-lobby="backToLobby"
  />
  <SinglePlayer
    v-else-if="currentScreen === 'single-player'"
    :rom-url="selectedRomUrl"
    :rom-id="selectedRomId"
    @back-to-lobby="backToLobby"
  />
</template>
