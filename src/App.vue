<script setup lang="ts">
import { ref } from 'vue';
import LobbyScreen from './components/LobbyScreen.vue';
import SplitScreen from './components/SplitScreen.vue';
import SinglePlayer from './components/SinglePlayer.vue';

type Screen = 'lobby' | 'local-race' | 'single-player'

const currentScreen = ref<Screen>('lobby');

function startLocalRace() {
  currentScreen.value = 'local-race';
}

function startSinglePlayer() {
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
  <SplitScreen
    v-else-if="currentScreen === 'local-race'"
    @back-to-lobby="backToLobby"
  />
  <SinglePlayer
    v-else-if="currentScreen === 'single-player'"
    @back-to-lobby="backToLobby"
  />
</template>
