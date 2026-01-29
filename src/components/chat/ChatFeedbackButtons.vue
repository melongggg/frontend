<template>
  <div class="feedback-buttons-wrapper" v-if="showButtons">
    <div class="feedback-buttons">
      <button class="feedback-btn copy-btn" @click="copyToClipboard" :title="copySuccess ? '복사됨!' : '복사'">
        <svg v-if="!copySuccess" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
        </svg>
        <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20,6 9,17 4,12"></polyline>
        </svg>
      </button>

      <button class="feedback-btn good-btn" @click="sendFeedback('good')" :class="{ active: feedback === 'good' }" title="좋아요">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
        </svg>
      </button>

      <button class="feedback-btn bad-btn" @click="handleBadFeedback" :class="{ active: feedback === 'bad' }" title="싫어요">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
        </svg>
      </button>

      <button class="feedback-btn bookmark-btn" @click="toggleBookmark" :class="{ active: isBookmarked }" :title="isBookmarked ? '북마크 해제' : '북마크 추가'">
        <svg width="15" height="15" viewBox="0 0 24 24" :fill="isBookmarked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>

      <button class="feedback-btn regenerate-btn" @click="regenerateAnswer" title="다시 생성">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23,4 23,10 17,10"></polyline>
          <polyline points="1,20 1,14 7,14"></polyline>
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
        </svg>
      </button>
    </div>

    <transition name="toast-fade">
      <div v-if="showToast" class="feedback-toast">
        <div class="toast-content">
          <div class="check-circle">✓</div>
          <span class="toast-text">{{ toastMessage }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const props = defineProps<{
  content: string;
  messageId?: string;
  isBot?: boolean;
  hasArtifact?: boolean;
}>();

const emit = defineEmits(['feedback', 'regenerate', 'openArtifact', 'bookmark', 'openDetailedFeedback']);

const feedback = ref<'good' | 'bad' | null>(null);
const copySuccess = ref(false);
const isBookmarked = ref(false);
const showToast = ref(false);
const toastMessage = ref('');

onMounted(() => {
  try {
    const feedbackData = JSON.parse(localStorage.getItem('messageFeedback') || '{}');
    const existingFeedback = feedbackData[props.messageId || ''];
    if (existingFeedback) feedback.value = existingFeedback.type;

    const bookmarks = JSON.parse(localStorage.getItem('messageBookmarks') || '[]');
    isBookmarked.value = bookmarks.includes(props.messageId);
  } catch (error) {
    console.error('데이터 로드 실패:', error);
  }
});

const showButtons = computed(() => props.isBot && props.content.trim().length > 0);

const sendFeedback = (type: 'good' | 'bad') => {
  feedback.value = type;
  
  // 📌 토스트 알림 로직 추가
  toastMessage.value = '피드백을 보내주셔서 감사합니다';
  showToast.value = true;
  setTimeout(() => { showToast.value = false; }, 2500);

  try {
    const feedbackData = JSON.parse(localStorage.getItem('messageFeedback') || '{}');
    feedbackData[props.messageId || 'unknown'] = { type: type, timestamp: new Date().toISOString() };
    localStorage.setItem('messageFeedback', JSON.stringify(feedbackData));
  } catch (e) { console.error(e); }
  
  emit('feedback', type, props.messageId);
};

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(props.content);
    copySuccess.value = true;
    setTimeout(() => { copySuccess.value = false; }, 2000);
  } catch (err) { console.error(err); }
};

const toggleBookmark = () => {
  try {
    const bookmarks = JSON.parse(localStorage.getItem('messageBookmarks') || '[]');
    const messageId = props.messageId || '';
    if (isBookmarked.value) {
      const index = bookmarks.indexOf(messageId);
      if (index > -1) bookmarks.splice(index, 1);
      isBookmarked.value = false;
    } else {
      bookmarks.push(messageId);
      isBookmarked.value = true;
    }
    localStorage.setItem('messageBookmarks', JSON.stringify(bookmarks));
    emit('bookmark', messageId, isBookmarked.value);
  } catch (e) { console.error(e); }
};

const regenerateAnswer = () => emit('regenerate', props.messageId);
const handleBadFeedback = () => { sendFeedback('bad'); emit('openDetailedFeedback', props.messageId); };
</script>

<style scoped>
.feedback-buttons-wrapper {
  position: relative;
}

.feedback-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
}

.feedback-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.feedback-btn:hover,
.feedback-btn.active {
  color: #02478A;
}

.feedback-toast {
  position: fixed;
  bottom: 680px; /* 입력창보다 위로 배치 */
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
}

.toast-content {
  background-color: #EEF2FF;
  border: 1px solid #DBEAFE;
  padding: 8px 18px;
  border-radius: 50px; /* 캡슐 모양 */
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.check-circle {
  background-color: #10B981;
  color: white;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-text {
  color: #1E40AF;
  font-size: 13px;
  font-weight: 600;
}

/* 토스트 애니메이션 */
.toast-fade-enter-active, .toast-fade-leave-active {
  transition: all 0.3s ease;
}
.toast-fade-enter-from, .toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>