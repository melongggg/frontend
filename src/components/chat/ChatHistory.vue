<template>
  <div class="frame-10">
    <div class="chat-list-link">
      <span class="conversation-list">대화 리스트</span>
      <button
        @click="$emit('startNewChat')"
        class="new-chat-button"
        type="button"
        aria-label="새 대화"
        title="새 대화">
        <span class="edit-icon"></span>
      </button>
    </div>
    <div class="frame-11">
      <div v-if="chatHistory.length === 0" class="chat-list-container">
        <span class="start-chat">지금 바로 대화를 시작해보세요</span>
      </div>
      <div v-else class="chat-list-container-history">
        <div v-for="chat in chatHistory" :key="chat.id" @click="$emit('selectChat', chat.id)" @dblclick="startEditing(chat.id)" @contextmenu="showContextMenu($event, chat.id)" class="chat-history-item" :class="{ active: currentChatId === chat.id }">
          <input 
            v-if="editingChatId === chat.id"
            v-model="editingTitle"
            @blur="finishEditing"
            @keydown.enter="finishEditing"
            @keydown.escape="cancelEditing"
            @click.stop
            ref="editInput"
            class="title-edit-input"
            maxlength="50"
          />
          <span v-else class="chat-title">{{ stripMarkdown(chat.title) }}</span>
          <button @click.stop="showDeleteModalForChat(chat.id)" class="delete-chat-button">x</button>
        </div>
      </div>
    </div>
    <ChatContextMenu 
      :isVisible="contextMenuVisible" 
      :position="contextMenuPosition"
      @editTitle="handleEditTitle"
      @deleteChat="showDeleteModal"
    />
    <CommonDeleteModal 
      :isVisible="deleteModalVisible" 
      @cancel="hideDeleteModal"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import type { ChatSession } from '../../composables/useChat';
import ChatContextMenu from './ChatContextMenu.vue';
import CommonDeleteModal from '../common/CommonDeleteModal.vue';

const props = defineProps<{
  chatHistory: ChatSession[];
  currentChatId: string | null;
}>();

const emit = defineEmits<{
  (e: 'startNewChat'): void;
  (e: 'selectChat', id: string): void;
  (e: 'deleteChat', id: string): void;
  (e: 'updateChatTitle', id: string, newTitle: string): void;
}>();

const editingChatId = ref<string | null>(null);
const editingTitle = ref<string>('');
const editInput = ref<HTMLInputElement[]>([]);
const contextMenuVisible = ref(false);
const contextMenuPosition = ref({ top: '0px', left: '0px' });
const contextMenuChatId = ref<string | null>(null);
const deleteModalVisible = ref(false);

// 마크다운 기호 제거 함수
const stripMarkdown = (text: string): string => {
  if (!text) return text;
  return text
    // 헤더 기호 제거 (# ## ### 등)
    .replace(/^#{1,6}\s*/gm, '')
    // 굵은 글씨 (**text** 또는 __text__)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // 기울임 (*text* 또는 _text_)
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // 취소선 (~~text~~)
    .replace(/~~([^~]+)~~/g, '$1')
    // 인라인 코드 (`code`)
    .replace(/`([^`]+)`/g, '$1')
    // 링크 [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 이미지 ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // 인용구 (> text)
    .replace(/^>\s*/gm, '')
    // 불릿 포인트 (- * +)
    .replace(/^[\-\*\+]\s+/gm, '')
    // 숫자 리스트 (1. 2. 등)
    .replace(/^\d+\.\s+/gm, '')
    // 남은 * 기호 정리
    .replace(/\*+/g, '')
    // 연속 공백 정리
    .replace(/\s+/g, ' ')
    .trim();
};

const startEditing = (chatId: string) => {
  const chat = props.chatHistory.find(c => c.id === chatId);
  if (chat) {
    editingChatId.value = chatId;
    editingTitle.value = chat.title;
    nextTick(() => {
      const input = editInput.value[0];
      if (input) {
        input.focus();
        input.select();
      }
    });
  }
};

const finishEditing = () => {
  if (editingChatId.value && editingTitle.value.trim()) {
    emit('updateChatTitle', editingChatId.value, editingTitle.value.trim());
  }
  editingChatId.value = null;
  editingTitle.value = '';
};

const cancelEditing = () => {
  editingChatId.value = null;
  editingTitle.value = '';
};

const showContextMenu = (event: MouseEvent, chatId: string) => {
  event.preventDefault();
  contextMenuChatId.value = chatId;
  contextMenuPosition.value = {
    top: `${event.clientY}px`,
    left: `${event.clientX}px`
  };
  contextMenuVisible.value = true;
};

const hideContextMenu = () => {
  contextMenuVisible.value = false;
  contextMenuChatId.value = null;
};

const handleEditTitle = () => {
  if (contextMenuChatId.value) {
    startEditing(contextMenuChatId.value);
  }
  hideContextMenu();
};

const showDeleteModal = () => {
  deleteModalVisible.value = true;
  hideContextMenu();
};

const hideDeleteModal = () => {
  deleteModalVisible.value = false;
};

const showDeleteModalForChat = (chatId: string) => {
  contextMenuChatId.value = chatId;
  deleteModalVisible.value = true;
};

const confirmDelete = () => {
  if (contextMenuChatId.value) {
    emit('deleteChat', contextMenuChatId.value);
  }
  hideDeleteModal();
  contextMenuChatId.value = null;
};

onMounted(() => {
  document.addEventListener('click', hideContextMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', hideContextMenu);
});
</script>

<style scoped>
/* Styles from index.vue that are relevant to the chat history list */
.frame-10 {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex-wrap: nowrap;
  flex-shrink: 0;
  gap: 10px;
  position: relative;
  width: 100%;
  flex:1;
  padding: 0 clamp(10px, 5%, 20px);
  z-index: 36;
  min-width: 0;
}
.chat-list-link {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0;
  width: 100%;
  flex-shrink: 0;
  overflow: visible;
  gap: 8px;
  background: var(--color-bg-primary);
  min-width: 0;
}

.conversation-list {
  font-size: 14px;
  font-weight: 600;
  line-height: 23px;
  color: var(--color-text-tertiary);
  font-family: Pretendard, var(--default-font-family);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.new-chat-button {
  background-color: var(#ffffff);
  border: 1px solid var(#ffffff);
  border-radius: 6px;

  /* 아이콘 버튼 크기/정렬 */
  width: 32px;
  height: 32px;
  padding: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  min-width: fit-content;
}

.new-chat-button:hover {
  background-color: #ffffff;
  transform: translateY(-2px);
}

.new-chat-button .edit-icon {
  width: 20px;
  height: 20px;
  display: block;
  background: url(https://codia-f2c.s3.us-west-1.amazonaws.com/image/2025-07-31/SLV8Hf7yf3.png)
    no-repeat center;
  background-size: cover;
}



.chat-list-container-history {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  overflow-y:scroll;
}

.chat-list-container-history::-webkit-scrollbar{
  display:none;
}


.chat-history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  width: 100%;
  box-sizing: border-box;
  transition: all 0.2s ease;
  position: relative;
}

.chat-history-item:hover {
  background-color: var(--color-sidebar-item-hover);
}

.chat-history-item.active {
  display: flex;
  justify-content: flex-start;
  flex-direction: row;
  align-items: center;
  flex: none;
  gap: 4px;
  border-radius: 10px;
  width: 100%;
  height: auto;
  min-height: 37px;
  background-color: var(--color-primary-light);
  box-sizing: border-box;
  padding: 10px 15px;
  /* 개선: 왼쪽 테두리 강조 */
  border-left: 3px solid var(--color-sidebar-active);
  /* 개선: 미세한 그림자 효과 */
  box-shadow: 0 1px 3px rgba(2, 71, 138, 0.1);
  /* 개선: 더 진한 테두리 */
  border: 1px solid rgba(2, 71, 138, 0.2);
  border-left: 3px solid var(--color-sidebar-active);
}

.chat-history-item.active .chat-title {
  color: var(--color-sidebar-active);
  font-weight: 600;
}

.chat-title {
  color: var(--color-text-primary);
  text-overflow: ellipsis;
  font-size: 14px;
  font-family: Pretendard, sans-serif;
  font-weight: 500;
  line-height: 23px;
  text-align: left;
}

.delete-chat-button {
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  visibility: hidden;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  font-size: 16px;
  line-height: 1;
  position: absolute;
  right: 15px;
}

.chat-history-item:hover .delete-chat-button {
  visibility: visible;
}

.title-edit-input {
  background: var(--color-input-bg);
  border: 1px solid var(--color-primary);
  border-radius: 3px;
  padding: 4px 8px;
  font-size: 14px;
  font-family: Pretendard, var(--default-font-family);
  width: 100%;
  outline: none;
}
.frame-11 {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex-wrap: nowrap;
  flex: 1;            
  min-height: 0;
  gap: 5px;
  position: relative;
  width: 100%;
  z-index: 39;
  
}
.chat-list-container {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  flex-shrink: 0;
  gap: 4px;
  position: relative;
  width: 100%;
  padding: 10px 15px;
  z-index: 40;
}
.start-chat {
  flex-shrink: 0;
  flex-basis: auto;
  position: relative;
  height: 17px;
  color: var(--color-text-tertiary);
  font-family: Pretendard, var(--default-font-family);
  font-size: 14px;
  font-weight: 500;
  line-height: 17px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  z-index: 41;
  overflow: hidden;
  width: 100%;
  max-height: 17px;
}

/* Responsive styles for small sidebars */
@media (max-width: 1200px) {
  .frame-10 {
    padding: 0 16px;
  }
  
  .chat-history-item {
    padding: 6px 10px;
  }
  
  .chat-title {
    font-size: 13px;
  }
  
  .conversation-list {
    font-size: 15px;
  }
}

@media (max-width: 768px) {
  .frame-10 {
    padding: 0 12px;
  }

  .chat-history-item {
    padding: 8px 12px;
  }
}

/* 모바일 드로어 스타일 (640px 이하) */
@media (max-width: 640px) {
  .frame-10 {
    padding: 0 16px;
    height: auto;
    flex: 1;
    overflow-y: auto;
    /* iOS 스크롤 부드럽게 */
    -webkit-overflow-scrolling: touch;
  }

  .chat-list-link {
    position: sticky;
    top: 0;
    background: var(--color-bg-primary);
    padding: 8px 0;
    z-index: 10;
  }

  .conversation-list {
    font-size: 15px;
  }

  .new-chat-button {
    padding: 8px 16px;
    font-size: 13px;
    /* 터치 친화적 크기 (최소 44px) */
    min-height: 36px;
  }

  .chat-list-container-history {
    gap: 8px;
    overflow-y: auto;
    padding-bottom: 20px;
  }

  .chat-history-item {
    /* 터치 친화적 높이 */
    min-height: 48px;
    padding: 12px 16px;
    border-radius: 10px;
    background: var(--color-bg-secondary);
  }

  .chat-history-item:active {
    background-color: var(--color-bg-tertiary);
  }

  .chat-history-item.active {
    width: 100%;
    height: auto;
    min-height: 48px;
    background-color: var(--color-primary-light);
    border: 1px solid rgba(2, 71, 138, 0.2);
    border-left: 3px solid var(--color-sidebar-active);
    box-shadow: 0 1px 3px rgba(2, 71, 138, 0.1);
  }

  .chat-history-item.active .chat-title {
    color: var(--color-sidebar-active);
    font-weight: 600;
  }

  .chat-title {
    font-size: 14px;
    line-height: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: calc(100% - 30px);
  }

  .delete-chat-button {
    /* 모바일에서 항상 표시 */
    visibility: visible;
    width: 28px;
    height: 28px;
    font-size: 18px;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 50%;
  }

  .delete-chat-button:active {
    background: rgba(0, 0, 0, 0.1);
  }

  .title-edit-input {
    font-size: 14px;
    padding: 8px 12px;
    min-height: 40px;
  }

  .frame-11 {
    gap: 8px;
  }

  .chat-list-container {
    padding: 16px;
  }

  .start-chat {
    font-size: 14px;
    line-height: 20px;
  }
}

/* 초소형 모바일 (480px 이하) */
@media (max-width: 480px) {
  .frame-10 {
    padding: 0 12px;
  }

  .chat-history-item {
    padding: 10px 12px;
    min-height: 44px;
  }

  .chat-title {
    font-size: 13px;
  }

  .delete-chat-button {
    width: 24px;
    height: 24px;
    font-size: 16px;
  }
}
</style>
