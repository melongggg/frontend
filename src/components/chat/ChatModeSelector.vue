<template>
  <div class="mode-selector-header">
    <div class="header-content">
      <span class="current-mode">대학 정보 모델</span>
      <div class="mode-icon-indicator">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.3-4.3"></path>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMode } from '../../composables/useChat'

defineProps<{
  currentMode: ChatMode
  isProUser: boolean
}>()

defineEmits<{
  (e: 'modeChange', mode: ChatMode): void
}>()
</script>

<style scoped>
.mode-selector-header {
  display: flex;
  justify-content: flex-start;
  flex-direction: row;
  align-items: center;
  flex: none;
  gap: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: solid 1px var(--color-card-border);
  border-radius: 15px;
  background-color: var(--color-bg-primary);
  box-sizing: border-box;
  padding: 8px 16px;
  position: relative;
  overflow: visible;
  min-width: 160px;
  width: auto;
}

.header-content {
  display: flex;
  justify-content: flex-start;
  flex-direction: row;
  align-items: center;
  flex: 1;
  gap: 8px;
  box-sizing: border-box;
  min-width: 120px;
}

.current-mode {
  color: var(--color-text-primary);
  font-size: 14px;
  font-family: Pretendard, sans-serif;
  font-weight: 600;
  line-height: 23px;
  text-align: left;
  white-space: nowrap;
  flex: 1;
  min-width: max-content;
}

.mode-icon-indicator {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-primary);
}

.mode-icon-indicator svg {
  width: 18px;
  height: 18px;
  object-fit: cover;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .mode-selector-header {
    padding: 10px 14px;
    min-width: 140px;
  }

  .header-content {
    min-width: 100px;
  }

  .current-mode {
    font-size: 13px;
  }
}

/* 모바일 반응형: 모드 선택 버튼 중앙 정렬 */
@media (max-width: 640px) {
  .mode-selector-header {
    justify-content: center;
    width: 100%;
    max-width: 100%;
  }
}
</style>
