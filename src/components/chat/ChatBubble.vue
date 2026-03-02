<template>
  <div :class="['chat-bubble-wrapper', align]">
    <div :class="['chat-bubble', align, { 'streaming': isStreaming }]">
      <!-- 모델 이름 배지 (AI 응답 상단) -->
      <div v-if="align === 'left' && modelName" :class="['model-badge-header', modelBadgeClass]">
        <span class="model-badge-icon">
          <svg v-if="modelBadgeClass === 'badge-rag'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <svg v-else-if="modelBadgeClass === 'badge-study'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          <svg v-else-if="modelBadgeClass === 'badge-cot'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6v6l4 2"></path>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 8V4H8"></path>
            <rect width="16" height="12" x="4" y="8" rx="2"></rect>
            <path d="M2 14h2"></path>
            <path d="M20 14h2"></path>
            <path d="M15 13v2"></path>
            <path d="M9 13v2"></path>
          </svg>
        </span>
        <span class="model-badge-text">{{ modelName }}</span>
      </div>
      <div class="message-content">
        <!-- 파일 미리보기 (사용자 메시지에서만) -->
        <div v-if="images && Array.isArray(images) && images.length > 0 && align === 'right'" class="message-files">
          <div
            v-for="(file, index) in images"
            :key="index"
            class="message-file"
          >
            <img v-if="file.type && file.type.startsWith('image/')" :src="getFilePreview(file)" :alt="file.name || '이미지'" class="message-image" />
            <div v-else class="message-pdf">
              <span class="pdf-icon">📄</span>
              <span class="pdf-name">{{ file.name || '파일' }}</span>
            </div>
          </div>
        </div>

        <!-- CoT 단계별 번호 표시 -->
        <div v-if="parsedCotContent && parsedCotContent.length > 0" class="cot-content">
          <div v-for="step in parsedCotContent" :key="step.number" class="cot-step-block">
            <div class="cot-step-number">
              <span class="step-circle">{{ step.number }}</span>
            </div>
            <div class="cot-step-text">
              <div class="cot-question">{{ step.question }}</div>
              <div v-html="marked.parse(step.answer)" class="cot-answer markdown-content"></div>
            </div>
          </div>
        </div>

        <!-- 일반 콘텐츠 -->
        <div v-else-if="displayContent && displayContent.trim()">
          <div v-if="useMarkdown" v-html="streamingRenderedContent" class="markdown-content"></div>
          <div v-else v-text="displayContent"></div>
        </div>
        <div v-else-if="!displayContent || !displayContent.trim()">
          <slot />
        </div>
        <div v-if="isStreaming" class="loading-indicator">
          <LottieLoader />
          <span class="loading-text">Searching...</span>
        </div>
      </div>

      <!-- 아티팩트 생성 알림 카드 (챗봇 메시지에 아티팩트가 있을 때) -->
      <div v-if="hasArtifact && align === 'left' && !isStreaming" class="artifact-notification-card" @click="handleOpenArtifact">
        <div class="artifact-icon-wrapper">
          <svg class="artifact-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10,9 9,9 8,9"></polyline>
          </svg>
        </div>
        <div class="artifact-notification-content">
          <div class="artifact-notification-title">📄 상세 보고서가 생성되었습니다</div>
          <div class="artifact-notification-subtitle">클릭하여 전체 내용 보기</div>
        </div>
        <div class="artifact-notification-arrow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"></polyline>
          </svg>
        </div>
      </div>
    </div>

    <!-- 피드백 버튼 (챗봇 메시지에만 표시) -->
    <div v-if="align === 'left' && content && content.trim() && !isStreaming" class="feedback-container">
      <ChatFeedbackButtons
        :content="content"
        :messageId="messageId"
        :isBot="true"
        :hasArtifact="hasArtifact"
        @feedback="handleFeedback"
        @regenerate="handleRegenerate"
        @openArtifact="handleOpenArtifact"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots, onMounted, onUpdated, nextTick, watch, ref } from 'vue';
import ChatFeedbackButtons from './ChatFeedbackButtons.vue';
import LottieLoader from './LottieLoader.vue';
import { createEnhancedMarked, createStreamingHighlighter } from '@/utils/markdown-extensions';

// 향상된 마크다운 렌더러 초기화 (Prism.js + KaTeX 포함)
const { marked, parse: enhancedParse, highlightCode } = createEnhancedMarked();

// 스트리밍 하이라이터 (디바운스 적용)
const streamingHighlighter = createStreamingHighlighter();


const props = defineProps({
  align: {
    type: String,
    default: 'right',
  },
  isStreaming: {
    type: Boolean,
    default: false,
  },
  useMarkdown: {
    type: Boolean,
    default: true,
  },
  content: {
    type: String,
    default: '',
  },
  images: {
    type: Array as () => File[],
    default: () => []
  },
  messageId: {
    type: String,
    default: ''
  },
  cotSteps: {
    type: Array,
    default: () => []
  },
  showCotNumbers: {
    type: Boolean,
    default: false
  },
  hasArtifact: {
    type: Boolean,
    default: false
  },
  modelName: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['feedback', 'regenerate', 'openArtifact']);

const slots = useSlots();

// 파일 미리보기를 위한 함수
const getFilePreview = (file: File) => {
  try {
    if (file && file instanceof File) {
      return URL.createObjectURL(file);
    }
    return '';
  } catch (error) {
    console.error('File preview generation failed:', error);
    return '';
  }
};

// 모델 배지 클래스 결정 (모드에 따라 다른 색상)
const modelBadgeClass = computed(() => {
  const name = props.modelName?.toLowerCase() || '';
  if (name.includes('검색') || name.includes('rag')) {
    return 'badge-rag';
  } else if (name.includes('학습') || name.includes('study')) {
    return 'badge-study';
  } else if (name.includes('추론') || name.includes('cot')) {
    return 'badge-cot';
  } else {
    return 'badge-default';
  }
});

// 마크다운 렌더링
const renderedContent = computed(() => {
  if (props.content) {
    // 마크다운 변환 전에 연속 개행 정규화
    const normalizedContent = normalizeLineBreaks(props.content);
    const result = props.useMarkdown ? marked.parse(normalizedContent) : normalizedContent;
    // 마크다운 렌더링 결과에서 끝부분의 공백과 개행 제거
    return typeof result === 'string' ? result.trim() : result;
  }
  // slot 내용 처리 (기본 폴백)
  const slotContent = slots.default?.()?.[0]?.children || '';
  const textContent = slotContent.toString();
  const normalizedSlot = normalizeLineBreaks(textContent);
  const result = props.useMarkdown ? marked.parse(normalizedSlot) : normalizedSlot;
  return typeof result === 'string' ? result.trim() : result;
});

// 스트리밍 상태에서 실시간 업데이트를 위한 computed
const displayContent = computed(() => {
  return props.content || '';
});

// CoT 단계별 content 파싱
const parsedCotContent = computed(() => {
  if (!props.showCotNumbers || !props.content) return null;

  // content를 줄바꿈으로 분리
  const lines = props.content.split('\n\n');
  const steps = [];
  let stepNumber = 1;

  for (const line of lines) {
    // **질문** 형태를 찾아서 단계로 인식
    if (line.trim().startsWith('**') && line.includes('**')) {
      const parts = line.split('\n');
      if (parts.length >= 2) {
        const question = parts[0].replace(/\*\*/g, '').trim();
        const answer = parts.slice(1).join('\n').trim();
        steps.push({
          number: stepNumber++,
          question,
          answer
        });
      }
    }
  }

  return steps.length > 0 ? steps : null;
});

// tool_call 태그 및 함수 호출 표시 제거
const stripToolCallTags = (text: string): string => {
  if (!text) return text;

  // <tool_call>...</tool_call> 태그 전체 제거
  let cleaned = text.replace(/<tool_call>\s*\[.*?\]\s*<\/tool_call>/gs, '');

  // 개별 함수 호출 패턴 제거
  cleaned = cleaned.replace(/\[get_current_datetime\(\)\]/g, '');
  cleaned = cleaned.replace(/\[search_university_rag\([^\]]*\)\]/g, '');
  cleaned = cleaned.replace(/\[get_academic_calendar\([^\]]*\)\]/g, '');
  cleaned = cleaned.replace(/\[scrape_notices\([^\]]*\)\]/g, '');
  cleaned = cleaned.replace(/\[scrape_[a-z_]+\([^\]]*\)\]/g, '');
  cleaned = cleaned.replace(/\[get_news\([^\]]*\)\]/g, '');
  cleaned = cleaned.replace(/\[get_faq\([^\]]*\)\]/g, '');

  // 코드 블록 내 tool_call도 제거
  cleaned = cleaned.replace(/`<tool_call>.*?<\/tool_call>`/gs, '');

  // 빈 코드 블록/백틱 제거 (`: `` ` 또는 `:`뒤에 빈 백틱)
  cleaned = cleaned.replace(/:\s*``\s*/g, ' ');
  cleaned = cleaned.replace(/``/g, '');

  // 연속된 빈 줄 정리
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
};

// 연속된 개행을 정규화하는 함수
const normalizeLineBreaks = (text: string): string => {
  if (!text) return text;

  // 먼저 tool_call 태그 제거
  let normalized = stripToolCallTags(text);

  // 시간 범위의 물결표(~) 이스케이프 (예: 09:00~17:00, 12:00~13:00)
  // 마크다운 취소선으로 잘못 해석되는 것 방지
  normalized = normalized.replace(/(\d{1,2}:\d{2})~(\d{1,2}:\d{2})/g, '$1\u223C$2');

  // 3개 이상 연속 개행을 2개로 줄임
  normalized = normalized.replace(/\n{3,}/g, '\n\n');

  // [중요] 볼드 섹션 헤더 앞에 빈 줄 추가
  // 리스트 안에 잘못 들어가는 것을 방지

  // 1. 번호 있는 볼드 헤더 (예: **2. 제목**)
  normalized = normalized.replace(/([^\n])\n(\*\*\d+\.\s+[^*]+\*\*)/g, '$1\n\n$2');

  // 2. 번호 없는 볼드 헤더 (예: **비용**, **운행 시간**)
  // 리스트 아이템(•, -, 숫자.) 뒤에 오는 볼드 텍스트
  normalized = normalized.replace(/(•\s+[^\n]+)\n(\*\*[^*\n]+\*\*)/g, '$1\n\n$2');
  normalized = normalized.replace(/([-]\s+[^\n]+)\n(\*\*[^*\n]+\*\*)/g, '$1\n\n$2');
  normalized = normalized.replace(/(\d+\.\s+[^\n]+)\n(\*\*[^*\n]+\*\*)/g, '$1\n\n$2');

  // 목록 항목 사이의 과도한 빈 줄 제거 (숫자 목록) - 단, 볼드 섹션은 제외
  normalized = normalized.replace(/(\d+\.\s+[^\n*]+)\n{2,}(?=\d+\.)/g, '$1\n');

  // 불릿 목록 사이의 과도한 빈 줄 제거
  normalized = normalized.replace(/([-*]\s+[^\n]+)\n{2,}(?=[-*]\s)/g, '$1\n');

  // 제목 다음의 과도한 빈 줄 제거 (최대 1개만 유지)
  normalized = normalized.replace(/(#{1,6}\s+[^\n]+)\n{3,}/g, '$1\n\n');

  // 제목 바로 다음에 오는 내용 앞의 빈 줄 최소화
  normalized = normalized.replace(/(#{1,6}\s+[^\n]+)\n{2,}(?=\d+\.)/g, '$1\n');
  normalized = normalized.replace(/(#{1,6}\s+[^\n]+)\n{2,}(?=[-*]\s)/g, '$1\n');

  // 목록 항목 뒤 제목 앞의 빈 줄 정규화
  normalized = normalized.replace(/(\d+\.\s+[^\n]+)\n{2,}(?=#{1,6}\s)/g, '$1\n\n');
  normalized = normalized.replace(/([-*]\s+[^\n]+)\n{2,}(?=#{1,6}\s)/g, '$1\n\n');

  // 연속된 빈 줄 최종 정리 (2개로 제한)
  normalized = normalized.replace(/\n{3,}/g, '\n\n');

  return normalized;
};

// marked가 처리하지 못한 **bold** 패턴을 수동으로 변환
// (한글 + 괄호 조합에서 marked 버그 발생)
const fixUnparsedBold = (html: string): string => {
  if (!html) return html;

  // 코드 블록 안의 ** 는 보호 (임시 플레이스홀더로 대체)
  const codeBlocks: string[] = [];
  let protected_html = html.replace(/<code[^>]*>[\s\S]*?<\/code>/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // pre 블록도 보호
  const preBlocks: string[] = [];
  protected_html = protected_html.replace(/<pre[^>]*>[\s\S]*?<\/pre>/g, (match) => {
    preBlocks.push(match);
    return `__PRE_BLOCK_${preBlocks.length - 1}__`;
  });

  // 남아있는 **text** 패턴을 <strong>text</strong>로 변환
  // (?!<) 는 이미 태그 안에 있는 경우를 제외
  protected_html = protected_html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 코드 블록 복원
  protected_html = protected_html.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => {
    return codeBlocks[parseInt(index)];
  });

  // pre 블록 복원
  protected_html = protected_html.replace(/__PRE_BLOCK_(\d+)__/g, (_, index) => {
    return preBlocks[parseInt(index)];
  });

  return protected_html;
};

// 렌더링된 마크다운 콘텐츠 (스트리밍 실시간 반영)
const streamingRenderedContent = computed(() => {
  const content = displayContent.value;
  if (content && props.useMarkdown) {
    try {
      // 마크다운 변환 전에 연속 개행 정규화
      const normalizedContent = normalizeLineBreaks(content);
      let result = marked.parse(normalizedContent);

      // marked가 처리하지 못한 **bold** 패턴 수동 변환
      if (typeof result === 'string') {
        result = fixUnparsedBold(result);
      }

      return typeof result === 'string' ? result.trim() : result;
    } catch (error) {
      console.error('Markdown conversion error:', error);
      return content;
    }
  }
  return content;
});

// 피드백 처리 함수
const handleFeedback = (type: string, messageId: string) => {
  console.log(`Feedback received: ${type}`, messageId);
  emit('feedback', type, messageId);
};

// 답변 재생성 처리 함수
const handleRegenerate = (messageId: string) => {
  console.log('Regenerate request:', messageId);
  emit('regenerate', messageId);
};

// 아티팩트 열기 처리 함수
const handleOpenArtifact = () => {
  console.log('Open artifact request:', props.messageId);
  emit('openArtifact', props.messageId);
};

// 테이블에 복사 버튼 추가하는 함수
const addTableCopyButtons = () => {
  nextTick(() => {
    const tables = document.querySelectorAll('.markdown-content table:not(.table-enhanced)');
    tables.forEach(table => {
      // 이미 처리된 테이블은 건너뛰기
      table.classList.add('table-enhanced');

      // 테이블을 래퍼로 감싸기
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';

      // 헤더 생성
      const header = document.createElement('div');
      header.className = 'table-header';
      header.innerHTML = `
        <span class="table-title">표</span>
        <button class="table-copy-btn">복사</button>
      `;

      // 복사 버튼 클릭 이벤트
      const copyBtn = header.querySelector('.table-copy-btn') as HTMLButtonElement | null;
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const rows = Array.from(table.querySelectorAll('tr'));
          const text = rows.map(row => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            return cells.map(cell => (cell.textContent || '').trim()).join('\t');
          }).join('\n');

          navigator.clipboard.writeText(text).then(() => {
            copyBtn.textContent = '✓ 복사됨';
            setTimeout(() => copyBtn.textContent = '복사', 2000);
          });
        });
      }

      // 테이블을 래퍼로 감싸기
      if (table.parentNode) {
        table.parentNode.insertBefore(wrapper, table);
      }
      wrapper.appendChild(header);
      wrapper.appendChild(table);
    });
  });
};

// 코드 블록 하이라이팅 적용
const applyCodeHighlighting = () => {
  nextTick(() => {
    const codeBlocks = document.querySelectorAll('.markdown-content pre code:not(.prism-highlighted)');
    codeBlocks.forEach((block) => {
      block.classList.add('prism-highlighted');
      if (props.isStreaming) {
        // 스트리밍 중에는 디바운스 적용
        streamingHighlighter.queueHighlight(block as HTMLElement);
      }
    });
  });
};

// 스트리밍 종료 시 하이라이팅 플러시
watch(() => props.isStreaming, (newVal, oldVal) => {
  if (oldVal && !newVal) {
    // 스트리밍 완료 - 즉시 하이라이팅 적용
    streamingHighlighter.flushHighlight();
    applyCodeHighlighting();
  }
});

// 컴포넌트 마운트 및 업데이트 시 테이블 복사 버튼 추가 및 코드 하이라이팅
onMounted(() => {
  addTableCopyButtons();
  applyCodeHighlighting();
});

onUpdated(() => {
  addTableCopyButtons();
  applyCodeHighlighting();
});
</script>

<style scoped>
.chat-bubble-wrapper {
  display: flex;
  flex-direction: column;
  width: fit-content;
  max-width: calc(100% - 20px); /* 오른쪽 여유 공간 확보 */
  overflow: visible;
  margin-top: 5px;
}

.chat-bubble-wrapper:first-child{
  margin-top:80px;
}

.chat-bubble-wrapper.right {
  align-items: flex-end;
  margin-right: 10px; /* 오른쪽 말풍선 꼬리를 위한 여유 공간 */
}

.chat-bubble-wrapper.left {
  align-items: flex-start;
  margin-left: 0;
}

.feedback-container {
  width: 100%;
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  /* 데스크톱에서 기본적으로 숨김 */
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s ease;
}

/* 모델 배지 헤더 (메시지 상단) - 모던 칩 스타일 */
.model-badge-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  padding: 6px 12px 6px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: all 0.2s ease;
  cursor: default;
  width: fit-content;
}

/* 기본 스타일 (통합 모델) */
.model-badge-header.badge-default {
  background: linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-bg-tertiary) 100%);
  color: var(--color-primary);
  border: 1px solid rgba(59, 130, 246, 0.2);
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.1);
}

.model-badge-header.badge-default:hover {
  background: linear-gradient(135deg, var(--color-bg-tertiary) 0%, var(--color-primary-light) 100%);
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.15);
}

/* RAG (대학 정보 검색) - 그린 계열 */
.model-badge-header.badge-rag {
  background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
  color: var(--color-success);
  border: 1px solid rgba(16, 185, 129, 0.2);
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.1);
}

.model-badge-header.badge-rag:hover {
  background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%);
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.15);
}

/* 학습 도우미 - 퍼플 계열 */
.model-badge-header.badge-study {
  background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%);
  color: #5B21B6;
  border: 1px solid rgba(139, 92, 246, 0.2);
  box-shadow: 0 1px 3px rgba(139, 92, 246, 0.1);
}

.model-badge-header.badge-study:hover {
  background: linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%);
  box-shadow: 0 2px 6px rgba(139, 92, 246, 0.15);
}

/* CoT (단계별 추론) - 오렌지 계열 */
.model-badge-header.badge-cot {
  background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%);
  color: var(--color-warning);
  border: 1px solid rgba(249, 115, 22, 0.2);
  box-shadow: 0 1px 3px rgba(249, 115, 22, 0.1);
}

.model-badge-header.badge-cot:hover {
  background: linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%);
  box-shadow: 0 2px 6px rgba(249, 115, 22, 0.15);
}

.model-badge-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.model-badge-icon svg {
  stroke-width: 2.5;
}

.model-badge-text {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

/* 호버 시 표시 (데스크톱) */
.chat-bubble-wrapper.left:hover .feedback-container,
.chat-bubble-wrapper.left:focus-within .feedback-container {
  opacity: 1;
  visibility: visible;
}

.chat-bubble {
  display: inline-block;
  max-width: 70%; /* 화면 너비의 70%로 제한 */
  padding: 12px 20px;
  border-radius: 25px;
  border: 1px solid var(--color-card-border);
  background: var(--color-chat-user-bg);
  font-size: 16px;
  color: var(--color-text-primary);
  word-break: break-word;
  font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", Helvetica, Arial, sans-serif;
  margin: 8px 0;
  line-height: 1.5;
  position: relative;
  transition: all 0.3s ease;
  transform: translateY(0);
  opacity: 1;
  animation: bubbleAppear 0.4s ease-out;
  box-sizing: border-box; /* 패딩을 포함한 크기 계산 */
  overflow: visible; /* 스크롤을 상위 컨테이너에 위임 */
}

@keyframes bubbleAppear {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.chat-bubble.right {
  /* 유저 메시지 - 우측 정렬 */
  display: inline-flex;
  max-width: 550px;
  padding: 10px 20px;
  justify-content: center;
  align-items: center;
  border-radius: 30px;
  border: 1px solid var(--color-card-border);
  background: var(--color-chat-user-bg);
  color: var(--color-text-primary);
  position: relative;
  font-weight: 500;
}



/* 유저 메시지 말풍선 꼬리 */
.chat-bubble.right::after {
  content: '';
  position: absolute;
  top: 15px;
  right: -8px;
  width: 0;
  height: 0;
  border: 8px solid transparent;
  border-left-color: var(--color-chat-user-bg);
  border-right: 0;
  border-top: 0;
  margin-top: -4px;
  margin-right: -8px;
}

.chat-bubble.left {
  /* 챗봇 메시지 - 좌측 정렬 */
  display: block;
  width: 100%;
  max-width: 770px;
  padding: 16px 20px;
  background: transparent;
  border: none;
  box-shadow: none;
  border-radius: 0;
}

/* 챗봇 메시지 말풍선 꼬리 - 제거됨 */
.chat-bubble.left::after {
  display: none;
}

/* Lottie 로딩 애니메이션 - 스트리밍 중 */
.loading-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 4px;
}

:deep(.lottie-container) {
  display: inline-block;
  width: 24px !important;
  height: 24px !important;
  vertical-align: middle;
}

.loading-text {
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 500;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 기존 스트리밍 커서 애니메이션 (폴백용) */
.streaming-cursor {
  display: inline-block;
  margin-left: 2px;
  color: var(--color-info);
  font-weight: bold;
  font-size: 1.1em;
  animation: blink 1s steps(1) infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}

/* 스트리밍 상태 스타일링 */
.streaming-text {
  position: relative;
}

.streaming-content {
  transition: all 0.1s ease;
}

/* 디버그 스트리밍 정보 스타일링 */
.debug-streaming {
  background: rgba(37, 99, 235, 0.1);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 8px;
  padding: 8px;
  margin-top: 8px;
  font-family: monospace;
  line-height: 1.4;
}

/* 마크다운 스타일링 - PDF 참조 디자인 적용 */
:deep(.markdown-content) {
  line-height: 1.9;  /* PDF 스타일: 넉넉한 줄 간격 */
  white-space: normal;
  letter-spacing: 0.01em;  /* 한글 가독성: 약간의 자간 */
  font-size: 15px;  /* 기본 글씨 크기 */
}

/* 제목 스타일 - 깔끔한 섹션 구분 */
:deep(.markdown-content h1),
:deep(.markdown-content h2),
:deep(.markdown-content h3),
:deep(.markdown-content h4),
:deep(.markdown-content h5),
:deep(.markdown-content h6) {
  margin: 16px 0 8px 0;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text-primary);
}

/* 대제목 - 섹션 카드 스타일 */
:deep(.markdown-content h1) {
  font-size: 1.1em !important;
  font-weight: 600 !important;
  color: var(--color-text-primary) !important;
  margin: 20px 0 12px 0 !important;
  padding: 10px 14px !important;
  background: var(--color-bg-secondary) !important;
  border-radius: 8px !important;
  display: block !important;
}

/* 중제목 - 섹션 카드 스타일 */
:deep(.markdown-content h2) {
  font-size: 1em !important;
  font-weight: 600 !important;
  color: var(--color-text-primary) !important;
  margin: 18px 0 10px 0 !important;
  padding: 8px 12px !important;
  background: var(--color-bg-secondary) !important;
  border-radius: 6px !important;
  display: block !important;
}

/* 소제목 */
:deep(.markdown-content h3) {
  font-size: 0.95em !important;
  font-weight: 600 !important;
  color: var(--color-text-primary) !important;
  margin: 14px 0 6px 0 !important;
  display: block !important;
}

/* 세부 제목들 */
:deep(.markdown-content h4) {
  font-size: 0.95em !important;
  font-weight: 600 !important;
  color: var(--color-text-primary) !important;
  margin: 10px 0 4px 0 !important;
  display: block !important;
}

:deep(.markdown-content h5) {
  font-size: 0.9em !important;
  font-weight: 600 !important;
  color: var(--color-text-primary) !important;
  margin: 8px 0 4px 0 !important;
  display: block !important;
}

:deep(.markdown-content h6) {
  font-size: 0.9em !important;
  font-weight: 500 !important;
  color: var(--color-text-secondary) !important;
  margin: 6px 0 4px 0 !important;
  display: block !important;
}

/* 제목 바로 다음에 오는 목록/단락의 상단 마진 제거 */
:deep(.markdown-content h1 + p),
:deep(.markdown-content h2 + p),
:deep(.markdown-content h3 + p),
:deep(.markdown-content h4 + p),
:deep(.markdown-content h1 + ul),
:deep(.markdown-content h2 + ul),
:deep(.markdown-content h3 + ul),
:deep(.markdown-content h4 + ul),
:deep(.markdown-content h1 + ol),
:deep(.markdown-content h2 + ol),
:deep(.markdown-content h3 + ol),
:deep(.markdown-content h4 + ol) {
  margin-top: 2px !important;
}

:deep(.markdown-content p) {
  margin: 0 0 1.2em 0;  /* PDF 스타일: 단락 간 여백 */
  line-height: 1.9;
}

:deep(.markdown-content p:last-child) {
  margin-bottom: 0;
}

/* 빈 단락 숨김 */
:deep(.markdown-content p:empty) {
  display: none;
  margin: 0;
  padding: 0;
  height: 0;
}

/* 공백만 있는 단락 규칙 제거 - greeting 응답에서 오작동 발생 */
/* :deep(.markdown-content p:has(> br:only-child)) {
  display: none;
  margin: 0;
} */

/* br 태그는 마크다운에서 줄바꿈을 위해 필요 */
:deep(.markdown-content br) {
  display: block;
  content: "";
  margin-top: 0.6em;  /* 0.3em → 0.6em: 줄바꿈 시 더 명확한 간격 */
}

/* 강조 스타일 - PDF 참조: 섹션 제목용 볼드 */
:deep(.markdown-content strong) {
  font-weight: 700;
  font-size: 1.1em;  /* 볼드 텍스트는 약간 크게 */
  color: var(--color-text-primary);
  display: inline;
}

/* 단락 시작의 볼드는 섹션 제목으로 처리 */
:deep(.markdown-content p > strong:first-child:last-child),
:deep(.markdown-content p > strong:only-child) {
  display: block;
  font-size: 1.15em;
  margin: 1.8em 0 0.8em 0;  /* 상단 여백 증가: 1.5em → 1.8em */
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--color-card-border);
}

/* 목록 다음에 오는 섹션 제목 - 더 큰 여백 */
:deep(.markdown-content ul + p > strong:first-child),
:deep(.markdown-content ol + p > strong:first-child) {
  margin-top: 2em;  /* 목록 후 섹션 헤더는 더 큰 여백 */
}

/* 리스트 아이템 내부의 볼드 - 인라인 스타일 유지 */
/* 채팅 기능, 업무 관리 기능 같은 하위 항목 */
:deep(.markdown-content li strong) {
  display: inline;
  font-size: 1em;
  font-weight: 700;
  color: var(--color-text-primary);
}

:deep(.markdown-content em) {
  font-style: italic;
  color: var(--color-text-primary);
}

:deep(.markdown-content ul),
:deep(.markdown-content ol) {
  margin: 1em 0;  /* PDF 스타일: 목록 전후 여백 */
  padding-left: 1.5em;
}

/* 연속된 목록 사이 간격 */
:deep(.markdown-content ul + ul),
:deep(.markdown-content ol + ol),
:deep(.markdown-content ul + ol) {
  margin-top: 2px;
}

/* 순서 목록 다음의 불릿 목록은 들여쓰기 (계층 구조 표현) */
:deep(.markdown-content ol + ul) {
  margin-top: 4px;
  margin-left: 1.5em;
  margin-bottom: 0.75em;
}

:deep(.markdown-content ul) {
  list-style-type: none;
}

:deep(.markdown-content ul li) {
  position: relative;
  margin: 0.7em 0;  /* PDF 스타일: 불릿 항목 간 넉넉한 여백 */
  padding-left: 1.2em;
  line-height: 1.8;  /* 줄간격 */
}

/* 불릿 리스트 - PDF 스타일 점 */
:deep(.markdown-content ul li::before) {
  content: '•';
  position: absolute;
  left: 0;
  color: #666;
  font-weight: normal;
  font-size: 0.9em;
}

:deep(.markdown-content ol) {
  counter-reset: item;
  padding-left: 1.8em;
}

:deep(.markdown-content ol li) {
  display: block;
  position: relative;
  margin: 1.2em 0;  /* PDF 스타일: 번호 항목 간 큰 여백 */
  padding-left: 0.5em;
  line-height: 1.8;
  font-weight: 600;  /* 번호 항목은 볼드 */
}

/* 번호 리스트 - PDF 스타일 */
:deep(.markdown-content ol li::before) {
  content: counter(item) ".";
  counter-increment: item;
  position: absolute;
  left: -1.6em;
  color: var(--color-text-primary);
  font-weight: 700;
  font-size: 1em;
  min-width: 1.2em;
  text-align: left;
}

/* 순서 목록 다음 불릿은 일반 굵기 (세부 내용) */
:deep(.markdown-content ol + ul li) {
  font-weight: 400;  /* 불릿 항목은 일반 굵기 */
}

/* 중첩된 순서 있는 목록 스타일 */
:deep(.markdown-content ol ol) {
  counter-reset: subitem;
  margin-top: 4px;
  padding-left: 2.5em;
}

:deep(.markdown-content ol ol li::before) {
  content: counter(subitem) ")";
  counter-increment: subitem;
  left: -1.5em;
  font-size: 0.95em;
  font-weight: 500;
}

/* 3단계 중첩 목록 */
:deep(.markdown-content ol ol ol) {
  counter-reset: subsubitem;
  padding-left: 2.5em;
}

:deep(.markdown-content ol ol ol li::before) {
  content: "- ";
  counter-increment: subsubitem;
  left: -1em;
  font-size: 0.9em;
  font-weight: normal;
}

/* 인용 블록 - 단순화 */
:deep(.markdown-content blockquote) {
  border-left: 3px solid var(--color-card-border);
  background: var(--color-bg-secondary);
  margin: 1em 0;
  padding: 0.75em 1em;
  font-style: normal;
  border-radius: 0 8px 8px 0;
}

:deep(.markdown-content blockquote::before) {
  display: none;
}

:deep(.markdown-content blockquote p) {
  margin: 0;
  font-weight: 400;
  color: var(--color-text-primary);
}

:deep(.markdown-content code) {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 0.9em;
  font-family: 'Courier New', monospace;
}

:deep(.markdown-content pre) {
  background: #1e293b;
  color: #e2e8f0;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 6px 0;
}

:deep(.markdown-content pre code) {
  background: none;
  color: inherit;
  padding: 0;
  font-size: 0.85em;
}

:deep(.markdown-content hr) {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 1.5em 0;  /* PDF 스타일: 구분선 상하 여백 */
  background: linear-gradient(to right, var(--color-primary), var(--color-card-border), var(--color-primary));
  height: 1px;
}

/* 코드 블록 래퍼 스타일 */
:deep(.code-block-wrapper) {
  margin: 10px 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--color-card-border);
}

:deep(.code-header) {
  background: var(--color-bg-primary);
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-card-border);
}

:deep(.code-language) {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: 'Courier New', monospace;
}

:deep(.code-copy-btn) {
  background: var(--color-info);
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: Pretendard, sans-serif;
}

:deep(.code-copy-btn:hover) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

:deep(.code-copy-btn:active) {
  transform: translateY(0);
  box-shadow: none;
}

:deep(.code-block-wrapper pre) {
  margin: 0;
  background: #1e293b;
  padding: 12px;
  overflow-x: auto;
}

:deep(.code-block-wrapper pre code) {
  background: none;
  color: #e2e8f0;
  padding: 0;
  font-size: 0.85em;
  line-height: 1.6;
}

/* 테이블 래퍼 스타일 (복사 버튼 포함) */
:deep(.table-wrapper) {
  margin: 12px 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--color-card-border);
}

:deep(.table-header) {
  background: var(--color-bg-secondary);
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-card-border);
}

:deep(.table-title) {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: 'Courier New', monospace;
}

:deep(.table-copy-btn) {
  background: var(--color-info);
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: Pretendard, sans-serif;
}

:deep(.table-copy-btn:hover) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

:deep(.table-copy-btn:active) {
  transform: translateY(0);
  box-shadow: none;
}

/* 테이블 스타일 */
:deep(.table-wrapper table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0;
  font-size: 0.9em;
  border: none;
}

:deep(.table-wrapper table thead) {
  background: var(--color-bg-secondary);
}

:deep(.table-wrapper table th) {
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: var(--color-text-primary);
  border-bottom: 2px solid var(--color-card-border);
}

:deep(.table-wrapper table td) {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-card-border);
  color: var(--color-text-secondary);
}

:deep(.table-wrapper table tbody tr:last-child td) {
  border-bottom: none;
}

:deep(.table-wrapper table tbody tr:hover) {
  background: var(--color-bg-secondary);
}

/* 기존 마크다운 테이블 스타일 (폴백용) */
:deep(.markdown-content table:not(.table-wrapper table)) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 0.9em;
  border: 1px solid var(--color-card-border);
  border-radius: 6px;
  overflow: hidden;
}

/* CoT 단계별 번호 스타일 */
.cot-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cot-step-block {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.cot-step-number {
  flex-shrink: 0;
}

.step-circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-success);
  color: white;
  font-weight: 700;
  font-size: 16px;
  font-family: Pretendard, sans-serif;
}

.cot-step-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cot-question {
  font-weight: 700;
  font-size: 16px;
  color: var(--color-primary);
  line-height: 1.4;
}

.cot-answer {
  color: var(--color-text-primary);
  line-height: 1.6;
}

/* 파일 미리보기 스타일 */
.message-files {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.message-file {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--color-card-border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.message-pdf {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4px;
  height: 100%;
  background-color: var(--color-bg-secondary);
}

.message-pdf .pdf-icon {
  font-size: 20px;
  margin-bottom: 4px;
}

.message-pdf .pdf-name {
  font-size: 8px;
  font-family: Pretendard, sans-serif;
  color: var(--color-text-secondary);
  word-break: break-all;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.2;
}

/* 아티팩트 알림 카드 스타일 */
.artifact-notification-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  margin-top: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
  animation: artifactSlideIn 0.5s ease-out, artifactPulse 2s ease-in-out infinite;
  position: relative;
  overflow: hidden;
}

.artifact-notification-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.artifact-notification-card:hover::before {
  left: 100%;
}

.artifact-notification-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.35);
}

.artifact-notification-card:active {
  transform: translateY(0);
}

@keyframes artifactSlideIn {
  0% {
    opacity: 0;
    transform: translateX(-20px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes artifactPulse {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
  }
  50% {
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
  }
}

.artifact-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  flex-shrink: 0;
  backdrop-filter: blur(10px);
}

.artifact-icon {
  color: white;
  animation: artifactIconBounce 1s ease-in-out infinite;
}

@keyframes artifactIconBounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

.artifact-notification-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.artifact-notification-title {
  font-size: 16px;
  font-weight: 600;
  color: white;
  font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.3;
}

.artifact-notification-subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.artifact-notification-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  opacity: 0.8;
  transition: all 0.3s ease;
}

.artifact-notification-card:hover .artifact-notification-arrow {
  opacity: 1;
  transform: translateX(4px);
}

/* ===========================================
   모바일 반응형 스타일 (PRD Breakpoints)
   - Mobile: ~640px
   - Tablet: 641-1024px
   - Desktop: 1025px+
   =========================================== */

/* 모바일 (640px 이하) */
@media (max-width: 640px) {
  /* 모바일에서는 피드백 버튼 항상 표시 (터치 환경) */
  .feedback-container {
    opacity: 1;
    visibility: visible;
  }

  .chat-bubble-wrapper {
    max-width: calc(100% - 12px);
    margin-top: 20px;
  }

  .chat-bubble-wrapper.right {
    margin-right: 6px;
  }

  .chat-bubble {
    max-width: 88%;
    padding: 10px 14px;
    font-size: 14px;
    border-radius: 20px;
  }

  .chat-bubble.right {
    max-width: 85%;
    padding: 8px 14px;
    border-radius: 22px;
  }

  .chat-bubble.left {
    max-width: 100%;
    padding: 12px 14px;
  }

  /* 모델 배지 모바일 */
  .model-badge-header {
    padding: 5px 10px 5px 8px;
    margin-bottom: 10px;
    gap: 5px;
  }

  .model-badge-icon svg {
    width: 12px;
    height: 12px;
  }

  .model-badge-text {
    font-size: 10px;
  }

  /* 아티팩트 알림 카드 */
  .artifact-notification-card {
    padding: 12px 14px;
    gap: 10px;
    border-radius: 12px;
  }

  .artifact-icon-wrapper {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .artifact-icon {
    width: 22px;
    height: 22px;
  }

  .artifact-notification-title {
    font-size: 13px;
  }

  .artifact-notification-subtitle {
    font-size: 11px;
  }

  .artifact-notification-arrow svg {
    width: 16px;
    height: 16px;
  }

  /* 파일 미리보기 */
  .message-files {
    gap: 6px;
  }

  .message-file {
    width: 60px;
    height: 60px;
    border-radius: 8px;
  }

  .message-pdf .pdf-icon {
    font-size: 16px;
  }

  .message-pdf .pdf-name {
    font-size: 7px;
  }

  /* CoT 단계별 스타일 */
  .cot-content {
    gap: 14px;
  }

  .cot-step-block {
    gap: 10px;
  }

  .step-circle {
    width: 26px;
    height: 26px;
    font-size: 13px;
  }

  .cot-question {
    font-size: 14px;
  }

  .cot-answer {
    font-size: 14px;
  }

  /* 로딩 인디케이터 */
  .loading-text {
    font-size: 12px;
  }

  :deep(.lottie-container) {
    width: 20px !important;
    height: 20px !important;
  }

  /* 마크다운 콘텐츠 모바일 조정 */
  :deep(.markdown-content h1) {
    font-size: 1.6em !important;
    margin: 12px 0 6px 0 !important;
  }

  :deep(.markdown-content h2) {
    font-size: 1.35em !important;
    margin: 10px 0 5px 0 !important;
  }

  :deep(.markdown-content h3) {
    font-size: 1.15em !important;
    margin: 8px 0 4px 0 !important;
  }

  :deep(.markdown-content) {
    font-size: 14px;
  }

  :deep(.markdown-content ul),
  :deep(.markdown-content ol) {
    padding-left: 1em;
  }

  :deep(.markdown-content pre) {
    padding: 8px;
    font-size: 12px;
    border-radius: 6px;
  }

  :deep(.markdown-content code) {
    font-size: 0.85em;
    padding: 1px 4px;
  }

  :deep(.markdown-content blockquote) {
    padding: 10px 12px;
    margin: 8px 0;
  }

  /* 코드 블록 래퍼 */
  :deep(.code-block-wrapper) {
    margin: 8px 0;
  }

  :deep(.code-header) {
    padding: 6px 10px;
  }

  :deep(.code-language) {
    font-size: 10px;
  }

  :deep(.code-copy-btn) {
    padding: 3px 8px;
    font-size: 10px;
  }

  :deep(.code-block-wrapper pre code) {
    font-size: 0.8em;
    line-height: 1.5;
  }

  /* 테이블 모바일 조정 */
  :deep(.table-wrapper) {
    margin: 8px 0;
    overflow-x: auto;
  }

  :deep(.table-header) {
    padding: 6px 10px;
  }

  :deep(.table-wrapper table th),
  :deep(.table-wrapper table td) {
    padding: 6px 8px;
    font-size: 12px;
  }
}

/* 초소형 모바일 (480px 이하) */
@media (max-width: 480px) {
  .chat-bubble {
    max-width: 92%;
    padding: 8px 12px;
    font-size: 13px;
    border-radius: 18px;
  }

  .chat-bubble.right {
    max-width: 88%;
    padding: 7px 12px;
    border-radius: 18px;
  }

  .chat-bubble.left {
    padding: 10px 12px;
  }

  /* 모델 배지 초소형 모바일 */
  .model-badge-header {
    padding: 4px 8px 4px 6px;
    margin-bottom: 8px;
    gap: 4px;
    border-radius: 16px;
  }

  .model-badge-icon svg {
    width: 10px;
    height: 10px;
  }

  .model-badge-text {
    font-size: 9px;
  }

  .artifact-notification-card {
    padding: 10px 12px;
    gap: 8px;
  }

  .artifact-icon-wrapper {
    width: 32px;
    height: 32px;
  }

  .artifact-notification-title {
    font-size: 12px;
  }

  .artifact-notification-subtitle {
    font-size: 10px;
  }

  .message-file {
    width: 50px;
    height: 50px;
  }

  :deep(.markdown-content) {
    font-size: 13px;
  }

  :deep(.markdown-content h1) {
    font-size: 1.4em !important;
  }

  :deep(.markdown-content h2) {
    font-size: 1.2em !important;
  }

  :deep(.markdown-content h3) {
    font-size: 1.1em !important;
  }
}

/* 태블릿 (641px - 1024px) */
@media (min-width: 641px) and (max-width: 1024px) {
  .chat-bubble {
    max-width: 80%;
  }

  .chat-bubble.right {
    max-width: 500px;
  }

  .chat-bubble.left {
    max-width: 700px;
  }
}
</style>
