<script setup lang="ts">
import { ref } from 'vue'
import type { Waypoint } from '../composables/useWaypoints'

defineProps<{
  waypoints: Waypoint[]
}>()

const emit = defineEmits<{
  add: []
  load: [waypoint: Waypoint]
  remove: [id: string]
}>()

const open = ref(false)

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function handleLoad(wp: Waypoint) {
  emit('load', wp)
  open.value = false
}
</script>

<template>
  <div class="wp-panel">
    <div class="wp-buttons">
      <button class="wp-btn wp-add" @click="emit('add')" title="Save waypoint">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <button
        class="wp-btn wp-list-toggle"
        :class="{ active: open }"
        @click="open = !open"
        title="Waypoints"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span v-if="waypoints.length" class="wp-badge">{{ waypoints.length }}</span>
      </button>
    </div>

    <div v-if="open" class="wp-dropdown">
      <div v-if="!waypoints.length" class="wp-empty">No waypoints saved</div>
      <div v-for="wp in waypoints" :key="wp.id" class="wp-item">
        <button class="wp-load" @click="handleLoad(wp)">
          <span class="wp-label">W{{ wp.world }}-{{ wp.level }}</span>
          <span class="wp-time">{{ formatTime(wp.timestamp) }}</span>
        </button>
        <button class="wp-delete" @click="emit('remove', wp.id)" title="Delete">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="open" class="wp-backdrop" @click="open = false" />
  </div>
</template>

<style scoped>
.wp-panel {
  position: absolute;
  bottom: 8px;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.wp-buttons {
  display: flex;
  gap: 4px;
}

.wp-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: #aaa;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  position: relative;
}

.wp-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
}

.wp-add:hover {
  color: #4caf50;
}

.wp-list-toggle.active {
  background: rgba(255, 180, 0, 0.25);
  color: #ffb400;
}

.wp-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 14px;
  height: 14px;
  border-radius: 7px;
  background: #e53935;
  color: #fff;
  font-size: 0.55rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  line-height: 1;
}

.wp-dropdown {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  min-width: 160px;
  max-height: 200px;
  overflow-y: auto;
  background: rgba(20, 20, 20, 0.95);
  border: 1px solid #444;
  border-radius: 6px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 30;
}

.wp-empty {
  padding: 8px;
  color: #666;
  font-size: 0.7rem;
  text-align: center;
}

.wp-item {
  display: flex;
  align-items: center;
  gap: 2px;
}

.wp-load {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #ccc;
  font-size: 0.72rem;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}

.wp-load:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.wp-label {
  font-weight: 600;
  color: #fff;
}

.wp-time {
  color: #777;
  font-size: 0.6rem;
  margin-left: auto;
}

.wp-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: #666;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.wp-delete:hover {
  background: rgba(255, 68, 68, 0.2);
  color: #ff4444;
}

.wp-backdrop {
  position: fixed;
  inset: 0;
  z-index: 25;
}
</style>
