<script setup lang="ts">
import { ref } from 'vue'
import LobbyScreen from './components/LobbyScreen.vue'
import SplitScreen from './components/SplitScreen.vue'

type Screen = 'lobby' | 'local-race'

const currentScreen = ref<Screen>('lobby')

function startLocalRace() {
  currentScreen.value = 'local-race'
}

function backToLobby() {
  currentScreen.value = 'lobby'
}
</script>

<template>
  <LobbyScreen
    v-if="currentScreen === 'lobby'"
    @start-local="startLocalRace"
  />
  <SplitScreen
    v-else-if="currentScreen === 'local-race'"
    @back-to-lobby="backToLobby"
  />
</template>
