<script setup lang="ts">
const emit = defineEmits<{
  startLocal: []
}>()
</script>

<template>
  <div class="lobby">
    <div class="logo">
      <h1>NES<span class="accent">Racer</span></h1>
      <p class="subtitle">Split-Screen NES Racing</p>
    </div>

    <div class="game-info">
      <div class="rom-badge">Super Mario Bros.</div>
    </div>

    <div class="modes">
      <button class="mode-btn local" @click="emit('startLocal')">
        <div class="mode-icon">&#x1F3AE;</div>
        <div class="mode-label">Local Race</div>
        <div class="mode-desc">Two players, one screen</div>
      </button>

      <button class="mode-btn online" disabled>
        <div class="mode-icon">&#x1F310;</div>
        <div class="mode-label">Online Race</div>
        <div class="mode-desc">Coming soon</div>
      </button>
    </div>

    <div class="controls-info">
      <div class="player-controls">
        <h3>Player 1</h3>
        <div class="keys">
          <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move
        </div>
        <div class="keys">
          <kbd>J</kbd> Run &middot; <kbd>K</kbd> Jump
        </div>
        <div class="keys">
          <kbd>Enter</kbd> Start
        </div>
      </div>
      <div class="player-controls">
        <h3>Player 2</h3>
        <div class="keys">
          <kbd>&uarr;</kbd><kbd>&larr;</kbd><kbd>&darr;</kbd><kbd>&rarr;</kbd> Move
        </div>
        <div class="keys">
          <kbd>Num1</kbd> Run &middot; <kbd>Num2</kbd> Jump
        </div>
        <div class="keys">
          <kbd>Num3</kbd> Start
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding: 2rem;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);
}

.logo h1 {
  font-size: 3.5rem;
  margin: 0;
  color: #fff;
  letter-spacing: 0.1em;
}

.accent {
  color: #e63946;
}

.subtitle {
  color: #666;
  margin: 0.25rem 0 0;
  font-size: 1rem;
  text-align: center;
}

.game-info {
  display: flex;
  gap: 0.5rem;
}

.rom-badge {
  background: #1a1a2e;
  color: #4dabf7;
  padding: 0.4rem 1rem;
  border-radius: 20px;
  font-size: 0.85rem;
  border: 1px solid #333;
}

.modes {
  display: flex;
  gap: 1.5rem;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem 3rem;
  border: 2px solid #333;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 180px;
}

.mode-btn:hover:not(:disabled) {
  border-color: #e63946;
  background: rgba(230, 57, 70, 0.1);
  transform: translateY(-2px);
}

.mode-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mode-icon {
  font-size: 2.5rem;
}

.mode-label {
  font-size: 1.2rem;
  font-weight: bold;
}

.mode-desc {
  font-size: 0.8rem;
  color: #666;
}

.controls-info {
  display: flex;
  gap: 3rem;
  margin-top: 1rem;
}

.player-controls {
  text-align: center;
}

.player-controls h3 {
  color: #aaa;
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
}

.keys {
  color: #666;
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}

kbd {
  background: #222;
  border: 1px solid #444;
  border-radius: 3px;
  padding: 0.1rem 0.4rem;
  font-size: 0.75rem;
  color: #ccc;
  margin: 0 0.1rem;
}
</style>
