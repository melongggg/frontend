<!-- Test comment to force re-compilation -->
<template>
  <div class="main-container">
    <div class="mobile-overlay" v-if="showMobileOverlay" @click="toggleSidebar"></div>
    <div class="chatbot-sidebar-wrapper" :class="{ 'mobile-hidden': !sidebarVisible, 'collapsed': isCollapsed }" :style="{ width: !isCollapsed ? sidebarWidth + 'px' : '' }">
      <div class="frame" :class="{'collapsed': isCollapsed }">
        <div class="chatbot-logo-header" :class="{'collapsed': isCollapsed }">
          <div class="frame-1" style="cursor: pointer;">
            <div class="logo-icon" @click.stop="pctoggleSidebar"></div>
            <img :src="eulLogo" alt="EULGPT 로고" @click="goToHome" v-show="showCollapsibleContent"  class="eulgpt-logo-svg" />
          </div>
          <div class="edit-icon" @click="startNewChat" v-show="showCollapsibleContent" ></div>
        </div>
        <div class="frame-2">
          <div class="chatbot-menu-item" :class="{'collapsed': isCollapsed }">
            <div class="frame-3" :class="{'collapsed': isCollapsed }" @click="goToCrew">
              <div class="group-4">
              </div>
              <span class="empty-classroom-check" v-show="showCollapsibleContent" >빈 강의실 확인</span>
            </div>
            <div class="frame-7"  :class="{'collapsed': isCollapsed }" @click="goToCrew">
              <div class="group-8"></div>
              <span class="library-study-room-reservation" v-show="showCollapsibleContent" >도서관 ∙ 열람실 자리 예약</span>
            </div>
            <div class="frame-9" :class="{'collapsed': isCollapsed }" @click="goToCrew">
              <div class="group-a"></div>
              <span class="status" v-show="showCollapsibleContent" >학식당 현황</span>
            </div>
          </div>
          <ChatHistory 
            v-show=showCollapsibleContent
            :chatHistory="chatHistory" 
            :currentChatId="currentChatId" 
            @selectChat="handleSelectChat"
            @startNewChat="startNewChat"
            @deleteChat="deleteChat"
            @updateChatTitle="updateChatTitle"
          />
          <div class="sidebar-toggle-chaticon" @click.stop="pctoggleSidebar" v-show=showFixedContent> <img :src="sidebar_chatlogo" /></div>
        </div>
      </div>
      <div class="side-footer" :class="{'collapsed': !showCollapsibleContent }" @click="toggleMyPageModal" >
        <div class="ellipse" :class="{ 'has-initial': !userProfileImage }">
          <img v-if="userProfileImage" :src="userProfileImage" alt="프로필" class="profile-image" />
          <span v-else class="user-initial">{{ userInitial }}</span>
        </div>
        <div class="frame-12" :class="{'collapsed': isCollapsed }">
          <div class="notification-container" @click="toggleNotificationDropdown">
            <div class="notification"></div>
            <NotificationDropdown :isVisible="showNotificationDropdown" />
          </div>
          <div class="icon-info" @click="toggleInfoPanel">
            <div class="vector"></div>
            <InfoPanel :isVisible="showInfoPanel" />
          </div>
        </div>
      </div>
      <div 
        class="sidebar-resizer"
        v-show="showCollapsibleContent"
        v-if="!isMobile"
        @mousedown="startResize"
        :class="{ 'resizing': isResizing }"
      ></div>
    </div>

    <!-- <div class="sidebar-collapsible-contour"></div> -->
    
    <div class="sidebar-collapsible-ct" v-show=showFixedContent>
      <div>
      <img :src="eulLogo" alt="EULGPT 로고" @click="goToHome" class="eulgpt-logo-svg" />
      <div class="edit-icon" @click="startNewChat"></div>
      </div>
    </div>

    <div class="chat-content-col">
      <div class="mobile-header">
        <button class="mobile-menu-toggle" @click="toggleSidebar">
          <div class="hamburger-icon"></div>
        </button>
        <div class="mobile-logo">
          <span class="eulgpt-mobile">EULGPT</span>
        </div>
        <!-- FR-028: 모바일에서 새 대화 버튼 빠른 접근 -->
        <button class="mobile-new-chat-button" @click="startNewChat" title="새 대화">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Mode selector - chat-content-col 기준 상대 위치 -->
      <div v-if="currentView === 'chat'" class="mode-selector-container">
        <ChatModeSelector
          :currentMode="chatMode"
          :isProUser="isProUser"
          @modeChange="handleModeChange"
        />
      </div>

      <div class="chat-content-wrapper">
        <!-- 일반 채팅 화면 -->
        <div v-if="currentView === 'chat'" class="chat-main-area" @click="handleMessageAreaClick">
          <div class="chat-messages-container">
            <ChatMessageArea
              :messages="messages"
              @feedback="handleMessageFeedback"
              @regenerate="handleMessageRegenerate"
              @openArtifact="handleOpenArtifact"
              @retry="handleRetryMessage"
            />
          </div>
          <div class="chat-input-area">
            <ChatInput
              ref="chatInputRef"
              :isLoading="isLoading"
              :isStreaming="isStreaming"
              @sendMessage="handleSendMessage"
              @stopResponse="stopResponse"
            />
          </div>
        </div>

      </div>
    </div>

    <!-- RAG Source Sidebar -->
    <SourceSidebar
      v-if="showSourceSidebar && currentRagSources"
      :sources="currentRagSources"
      @close="handleCloseSidebar"
    />

    <!-- Artifact Panel -->
    <ArtifactPanel
      v-if="showArtifactPanel && currentArtifact"
      :artifact="currentArtifact"
      @close="handleCloseArtifact"
      @update="handleUpdateArtifact"
      @regenerate="handleRegenerateArtifact"
      @improveSelection="handleImproveSelection"
    />

    <!-- My Page Modal -->
    <MyPageModal
      :isVisible="showMyPageModal"
      @close="toggleMyPageModal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import ChatHistory from './ChatHistory.vue';
import ChatMessageArea from './ChatMessageArea.vue';
import ChatInput from './ChatInput.vue';
import ChatModeSelector from './ChatModeSelector.vue';
import SourceSidebar from './SourceSidebar.vue';
import ArtifactPanel from './ArtifactPanel.vue';
import NotificationDropdown from '../common/NotificationDropdown.vue';
import InfoPanel from '../common/InfoPanel.vue';
import MyPageModal from '../common/MyPageModal.vue';
import { useChat } from '../../composables/useChat';
import type { ChatMode, Artifact, ArtifactVersion } from '../../composables/useChat';
import eulLogo from '../../assets/eul_logo.svg';
import sidebar_chatlogo from '../../components/chat/icon/sidebar-toggle-chatimg.svg'
import { getApiBaseUrl } from '@/utils/ports-config';
import { createLogger } from '../../utils/logger';
const log = createLogger('Chat');

const router = useRouter();
const route = useRoute();

const API_BASE_URL = getApiBaseUrl();


const {
  messages,
  chatHistory,
  currentChatId,
  isLoading,
  isStreaming,
  chatMode,
  startNewChat,
  selectChat,
  deleteChat,
  handleSend,
  stopResponse,
  updateChatTitle,
  setChatMode,
  saveChatHistory
} = useChat();

const handleSendMessage = (message: string, images?: File[]) => {
  const inputValue = { value: message };
  handleSend(inputValue, images);

  // 전송 후 입력창 포커스 유지 (FR-019) - 모바일에서는 키보드 유지
  if (isMobile.value && chatInputRef.value) {
    nextTick(() => {
      chatInputRef.value?.focusInput();
    });
  }
};

// 채팅 선택 핸들러 - 모바일에서는 드로어 자동 닫기 (FR-025)
const handleSelectChat = (chatId: string) => {
  selectChat(chatId);
  // 모바일에서 채팅 선택 후 드로어 닫기
  if (isMobile.value) {
    sidebarVisible.value = false;
  }
};

const handleModeChange = (mode: ChatMode) => {
  setChatMode(mode);
};

// 화면 상태 관리
const currentView = ref<'chat'>('chat');

// 피드백 처리
const handleMessageFeedback = (type: 'good' | 'bad', messageId: string) => {
  log.debug(`Message feedback: ${type}`, messageId);
  // TODO: 피드백 데이터를 서버에 전송하거나 로컬 저장소에 저장
};

// 답변 재생성 처리
const handleMessageRegenerate = (messageId: string) => {
  log.debug('Regenerate answer:', messageId);
  
  try {
    // messageId에서 인덱스 추출 (예: "1-1234567890" -> 1)
    const messageIndex = parseInt(messageId.split('-')[0]);
    const currentChat = chatHistory.value.find(c => c.id === currentChatId.value);
    
    if (!currentChat || !currentChat.messages[messageIndex]) {
      log.error('Message to regenerate not found');
      return;
    }
    
    // 해당 메시지가 봇 메시지인지 확인
    if (currentChat.messages[messageIndex].isUser) {
      log.error('Cannot regenerate user message');
      return;
    }
    
    // 이전 사용자 메시지 찾기 (재생성할 답변의 바로 전 메시지)
    let userMessage = '';
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (currentChat.messages[i].isUser) {
        userMessage = currentChat.messages[i].text;
        break;
      }
    }
    
    if (!userMessage) {
      log.error('User message for regeneration not found');
      return;
    }
    
    log.info('Starting answer regeneration:', userMessage.substring(0, 50) + '...');
    
    // 기존 봇 메시지를 로딩 상태로 변경
    currentChat.messages[messageIndex] = {
      ...currentChat.messages[messageIndex],
      text: '답변을 다시 생성하고 있습니다...',
      isLoading: true,
      isStreaming: false,
      currentStep: '답변 재생성 중...',
      hasError: false
    };
    
    // 기존 메시지 제거 (마지막 봇 응답만)
    currentChat.messages.splice(messageIndex, 1);
    
    // handleSend를 사용하여 재생성
    const inputValue = { value: userMessage };
    handleSend(inputValue);
    
  } catch (error) {
    log.error('Answer regeneration error:', error);
  }
};

// 아티팩트 열기 처리
const handleOpenArtifact = (messageId: string) => {
  log.debug('Open artifact request:', messageId);
  selectedArtifactMessageId.value = messageId;
  showArtifactPanel.value = true;
};

// 메시지 재시도 처리 (에러 발생 시)
const handleRetryMessage = (messageIndex: number) => {
  log.debug('Message retry request:', messageIndex);

  try {
    const currentChat = chatHistory.value.find(c => c.id === currentChatId.value);

    if (!currentChat || !currentChat.messages[messageIndex]) {
      log.error('Message to retry not found');
      return;
    }

    // 해당 메시지 이전의 사용자 메시지 찾기
    let userMessage = '';
    let userMessageIndex = -1;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (currentChat.messages[i].isUser) {
        userMessage = currentChat.messages[i].text;
        userMessageIndex = i;
        break;
      }
    }

    if (!userMessage) {
      log.error('User message for retry not found');
      return;
    }

    log.info('Starting message retry:', userMessage.substring(0, 50) + '...');

    // 에러 상태의 봇 메시지를 로딩 상태로 변경
    currentChat.messages[messageIndex] = {
      ...currentChat.messages[messageIndex],
      text: '다시 시도하고 있습니다...',
      isLoading: true,
      isStreaming: false,
      currentStep: '재시도 중...',
      hasError: false,
      errorDetails: undefined
    };

    // 에러 메시지 제거하고 다시 전송
    currentChat.messages.splice(messageIndex, 1);

    // handleSend를 사용하여 재시도
    const inputValue = { value: userMessage };
    handleSend(inputValue);

  } catch (error) {
    log.error('Message retry error:', error);
  }
};

// 디버깅을 위한 messages 로그
log.debug('Current messages:', messages.value);

const isMobile = ref(false);
const sidebarVisible = ref(true);
const sidebarWidth = ref(Number(localStorage.getItem('sidebarWidth')) || 270);

// 키보드 오버레이 대응을 위한 상태
const keyboardHeight = ref(0);
const isKeyboardOpen = ref(false);

// ChatInput 컴포넌트 ref
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null);

// 메시지 영역 ref (자동 스크롤용)
const messagesContainerRef = ref<HTMLElement | null>(null);

// visualViewport를 사용한 키보드 높이 감지 (iOS/Android)
const handleVisualViewportResize = () => {
  if (!window.visualViewport) return;

  const viewport = window.visualViewport;
  // 뷰포트 높이와 실제 윈도우 높이의 차이가 키보드 높이
  const heightDiff = window.innerHeight - viewport.height;

  // 50px 이상 차이나면 키보드가 열린 것으로 간주
  if (heightDiff > 50) {
    const wasKeyboardOpen = isKeyboardOpen.value;
    keyboardHeight.value = heightDiff;
    isKeyboardOpen.value = true;
    // CSS 변수로 키보드 높이 전달
    document.documentElement.style.setProperty('--keyboard-height', `${heightDiff}px`);

    // 키보드가 처음 열릴 때 메시지 영역 스크롤 (FR-020)
    if (!wasKeyboardOpen) {
      scrollToBottom();
    }
  } else {
    keyboardHeight.value = 0;
    isKeyboardOpen.value = false;
    document.documentElement.style.setProperty('--keyboard-height', '0px');
  }
};

// 메시지 영역을 맨 아래로 스크롤
const scrollToBottom = () => {
  nextTick(() => {
    const container = document.querySelector('.chat-messages-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  });
};

// 외부 영역 클릭 시 키보드 닫기 (FR-018)
const handleMessageAreaClick = (event: Event) => {
  // 모바일에서만 적용
  if (!isMobile.value) return;

  const target = event.target as HTMLElement;
  // 입력 영역이 아닌 곳을 클릭하면 키보드 닫기
  if (!target.closest('.chat-input-area') && chatInputRef.value) {
    chatInputRef.value.blurInput();
  }
};

const isResizing = ref(false);
const minSidebarWidth = 200;
const maxSidebarWidth = 500;
const showNotificationDropdown = ref(false);
const showInfoPanel = ref(false);
const showMyPageModal = ref(false);
const userProfileImage = ref<string | null>(null);
const userName = ref<string>('');
const userEmail = ref<string>('');
const isProUser = ref(false);

// 사용자 이니셜 생성 (프로필 이미지 없을 때 표시)
const userInitial = computed(() => {
  if (userName.value) {
    // 이름의 첫 글자 (한글/영문 모두 지원)
    return userName.value.charAt(0).toUpperCase();
  }
  if (userEmail.value) {
    // 이메일의 첫 글자
    return userEmail.value.charAt(0).toUpperCase();
  }
  return 'U'; // 기본값
});
const showSourceSidebar = ref(true); // RAG 소스 사이드바 표시 여부
const showArtifactPanel = ref(true); // 아티팩트 패널 표시 여부
const selectedArtifactMessageId = ref<string | null>(null); // 선택된 아티팩트의 메시지 ID

const showMobileOverlay = computed(() => isMobile.value && sidebarVisible.value);

// 최신 RAG 소스 가져오기 (가장 마지막 봇 메시지의 소스)
const currentRagSources = computed(() => {
  if (chatMode.value !== 'rag') return undefined;

  // 메시지를 역순으로 탐색하여 가장 최근의 RAG 소스 찾기
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const msg = messages.value[i];
    if (!msg.isUser && msg.ragSources && msg.ragSources.length > 0) {
      return msg.ragSources;
    }
  }
  return undefined;
});

// 선택된 아티팩트 가져오기
const currentArtifact = computed(() => {
  // 선택된 메시지 ID가 있으면 해당 메시지의 아티팩트 찾기
  if (selectedArtifactMessageId.value) {
    // messageId는 "idx-timestamp" 형식으로 구성되어 있음
    // ChatMessageArea.vue의 messageId 생성 로직과 동일하게 매칭
    for (let idx = 0; idx < messages.value.length; idx++) {
      const msg = messages.value[idx];
      const msgId = `${idx}-${msg.timestamp instanceof Date ? msg.timestamp.getTime() : msg.timestamp}`;
      if (msgId === selectedArtifactMessageId.value && msg.artifact) {
        return msg.artifact;
      }
    }
  }

  // 선택된 ID가 없으면 가장 최근의 아티팩트 찾기
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const msg = messages.value[i];
    if (!msg.isUser && msg.artifact) {
      return msg.artifact;
    }
  }
  return undefined;
});

const handleCloseSidebar = () => {
  showSourceSidebar.value = false;
};

const handleCloseArtifact = () => {
  showArtifactPanel.value = false;
  selectedArtifactMessageId.value = null;
};

const handleUpdateArtifact = (updatedArtifact: Artifact) => {
  log.debug('Artifact updated:', updatedArtifact);

  // 가장 최근 아티팩트가 있는 메시지 찾기
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const msg = messages.value[i];
    if (!msg.isUser && msg.artifact) {
      // 아티팩트 업데이트
      msg.artifact = updatedArtifact;

      // 채팅 히스토리 저장
      saveChatHistory();
      log.info('Artifact updated successfully');
      break;
    }
  }
};

const handleRegenerateArtifact = async (artifact: Artifact) => {
  log.info('Artifact regeneration requested');

  // 재생성 요청 메시지 추가
  const regenerateMessage = `"${artifact.title}" 아티팩트를 완전히 새롭게 재작성해주세요. 이전 내용과는 다른 관점이나 추가 정보를 포함하여 더 풍부한 내용으로 작성해주세요.`;

  // 사용자 메시지로 추가 (handleSend 사용)
  const inputValue = { value: regenerateMessage };
  handleSend(inputValue);
};

// [DISABLED] Gemini AI 텍스트 개선 기능 - 비활성화됨
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleImproveSelection = async (_payload: { selectedText: string; fullContent: string }) => {
  console.warn('[DISABLED] Gemini AI text improvement is not available');
  alert('AI 텍스트 개선 기능이 현재 비활성화되어 있습니다.');
  return;
  /* [DISABLED] 기존 Gemini AI 텍스트 개선 코드 시작
  console.log('🤖 텍스트 개선 요청:', _payload.selectedText.substring(0, 50));

  // 현재 채팅 정보 가져오기
  const currentChat = chatHistory.value.find(c => c.id === currentChatId.value);

  if (!currentChat) {
    console.error('현재 채팅을 찾을 수 없습니다.');
    alert('텍스트 개선에 실패했습니다. 다시 시도해주세요.');
    return;
  }

  // 개선 요청 메시지 생성
  const improveMessage = `다음 텍스트를 개선해주세요. 설명이나 추가 코멘트 없이 개선된 텍스트만 출력하세요:

선택된 텍스트: "${payload.selectedText}"

전체 문서 맥락:
${payload.fullContent.substring(0, 500)}...

중요: 개선된 텍스트만 출력하고, "개선된 텍스트:", "주요 개선 사항:" 등의 설명이나 헤더는 포함하지 마세요.`;

  try {
    const response = await fetch(`${import.meta.env.VITE_GEMINI_FASTAPI_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: improveMessage,
        context: "",
        session_id: currentChat.sessionId || null
      })
    });

    if (!response.ok) {
      throw new Error('AI 개선 요청 실패');
    }

    // 스트리밍 응답 처리
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let improvedText = '';
    let chunkCount = 0;

    console.log('📥 스트리밍 응답 처리 시작...');

    // 아티팩트 메시지 찾기
    let artifactMessage = null;
    for (let i = messages.value.length - 1; i >= 0; i--) {
      const msg = messages.value[i];
      if (!msg.isUser && msg.artifact) {
        artifactMessage = msg;
        break;
      }
    }

    if (!artifactMessage || !artifactMessage.artifact) {
      throw new Error('아티팩트를 찾을 수 없습니다');
    }

    // 타입 narrowing을 위해 로컬 변수로 추출
    const artifact = artifactMessage.artifact;
    const originalContent = artifact.content;
    const selectedTextIndex = originalContent.indexOf(payload.selectedText);

    if (selectedTextIndex === -1) {
      console.warn('선택된 텍스트를 원본에서 찾을 수 없습니다');
      // 대신 전체 텍스트를 사용
    }

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('📥 스트리밍 완료, 총', chunkCount, '개 청크 수신');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        chunkCount++;
        console.log('📦 청크 #' + chunkCount + ':', chunk.substring(0, 100));

        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              console.log('📄 파싱된 데이터:', data);
              if (data.type === 'chunk' && data.content) {
                improvedText += data.content;
                console.log('✏️ 개선 텍스트 누적 길이:', improvedText.length);

                // 실시간으로 아티팩트 업데이트
                if (selectedTextIndex !== -1) {
                  const beforeText = originalContent.substring(0, selectedTextIndex);
                  const afterText = originalContent.substring(selectedTextIndex + payload.selectedText.length);
                  const newContent = beforeText + improvedText + afterText;

                  artifactMessage.artifact = {
                    title: artifact.title || '',
                    type: artifact.type || 'document',
                    content: newContent,
                    versions: artifact.versions,
                    currentVersion: artifact.currentVersion
                  };
                }
              }
            } catch (e) {
              console.warn('⚠️ JSON 파싱 실패:', line, e);
            }
          }
        }
      }
    }

    console.log('📝 최종 개선된 텍스트 길이:', improvedText.length);
    console.log('📝 최종 개선된 텍스트:', improvedText.substring(0, 200));

    if (!improvedText) {
      throw new Error('개선된 텍스트를 받지 못했습니다');
    }

    console.log('✅ 텍스트 개선 완료');

    // 최종 버전 저장
    const finalContent = selectedTextIndex !== -1
      ? originalContent.substring(0, selectedTextIndex) + improvedText + originalContent.substring(selectedTextIndex + payload.selectedText.length)
      : originalContent;

    const newVersion: ArtifactVersion = {
      content: finalContent,
      timestamp: Date.now(),
      description: 'AI 부분 개선'
    };

    artifactMessage.artifact = {
      title: artifact.title || '',
      type: artifact.type || 'document',
      content: finalContent,
      versions: [...(artifact.versions || []), newVersion],
      currentVersion: (artifact.versions?.length || 0)
    };

    saveChatHistory();
    console.log('✅ 개선된 텍스트로 아티팩트 업데이트됨');
  } catch (error) {
    console.error('텍스트 개선 실패:', error);
    alert('텍스트 개선에 실패했습니다. 다시 시도해주세요.');
  }
  [DISABLED] 기존 Gemini AI 텍스트 개선 코드 끝 */
};

// PRD Breakpoints: Mobile ~640px, Tablet 641-1024px, Desktop 1025px+
const MOBILE_BREAKPOINT = 640;
const TABLET_BREAKPOINT = 1024;

const checkMobileSize = () => {
  const width = window.innerWidth;
  isMobile.value = width <= MOBILE_BREAKPOINT;

  if (isMobile.value) {
    // 모바일: 사이드바 기본 숨김
    sidebarVisible.value = false;
  } else if (width <= TABLET_BREAKPOINT) {
    // 태블릿: 사이드바 표시 (축소된 상태)
    sidebarVisible.value = true;
    sidebarWidth.value = 220;
  } else {
    // 데스크톱: 사이드바 표시
    sidebarVisible.value = true;
  }
};
// 요소 사라지게
const showCollapsibleContent = ref(true); 

// 요소 나타나게
const showFixedContent = ref(false);

// 요소 없어지거나 나타났을때 css 수정할 수 있도록
const isCollapsed = ref(false); 

// pc 사이드바 토글 함수 설정
const pctoggleSidebar = () => {
  showCollapsibleContent.value = !showCollapsibleContent.value;
  showFixedContent.value = !showFixedContent.value;
  isCollapsed.value = !isCollapsed.value;
};

const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value;
};

const toggleNotificationDropdown = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
  console.log('Notification icon clicked!');
  showNotificationDropdown.value = !showNotificationDropdown.value;
  showInfoPanel.value = false; // 다른 패널 닫기
  console.log('Notification dropdown toggled:', showNotificationDropdown.value);
};

const toggleInfoPanel = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
  console.log('Info icon clicked!');
  showInfoPanel.value = !showInfoPanel.value;
  showNotificationDropdown.value = false; // 다른 패널 닫기
  console.log('Info panel toggled:', showInfoPanel.value);
};

const toggleMyPageModal = () => {
  showMyPageModal.value = !showMyPageModal.value;
};

const startResize = (e: MouseEvent) => {
  if (isMobile.value) return;
  
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = sidebarWidth.value;
  
  const handleMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - startX;
    const newWidth = startWidth + deltaX;
    
    if (newWidth >= minSidebarWidth && newWidth <= maxSidebarWidth) {
      sidebarWidth.value = newWidth;
    }
  };
  
  const handleMouseUp = () => {
    isResizing.value = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // 사이드바 크기를 localStorage에 저장
    localStorage.setItem('sidebarWidth', sidebarWidth.value.toString());
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  
  e.preventDefault();
};

const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.notification-container')) {
    showNotificationDropdown.value = false;
  }
  if (!target.closest('.icon-info')) {
    showInfoPanel.value = false;
  }
};

// 사용자 프로필 정보 가져오기
const fetchUserProfile = async () => {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // 개발 환경에서 Pro 계정 토큰인지 체크
    if (import.meta.env.DEV && token.startsWith('dev-pro-token-')) {
      console.log('🔓 개발 환경 Pro 계정 프로필 로드');
      const devProfile = localStorage.getItem('dev_user_profile');
      if (devProfile) {
        const data = JSON.parse(devProfile);
        if (data.profile_image_url) {
          userProfileImage.value = data.profile_image_url;
        }
        userName.value = data.name || data.nickname || '';
        userEmail.value = data.email || '';
        isProUser.value = data.is_pro || false;
        console.log('✅ Pro 라이센스 활성화:', isProUser.value);
      }
      return;
    }

    const response = await fetch(`${API_BASE_URL}/member/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.profile_image_url) {
        userProfileImage.value = data.profile_image_url;
      }
      userName.value = data.name || data.nickname || '';
      userEmail.value = data.email || '';
      isProUser.value = data.is_pro || false;
    }
  } catch (error) {
    console.error('프로필 정보 로드 오류:', error);
  }
};

onMounted(() => {
  checkMobileSize();
  fetchUserProfile();
  window.addEventListener('resize', checkMobileSize);
  document.addEventListener('click', handleClickOutside);

  // visualViewport API를 사용한 키보드 높이 감지 (모바일)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleVisualViewportResize);
    window.visualViewport.addEventListener('scroll', handleVisualViewportResize);
  }

  // URL 파라미터에서 chatId 읽기 (B: UUID 추가)
  const chatIdFromUrl = route.params.chatId as string | undefined;
  if (chatIdFromUrl) {
    // URL에 chatId가 있으면 해당 채팅 선택
    log.info(`Loading chat from URL: ${chatIdFromUrl}`);
    selectChat(chatIdFromUrl);
  }

  // 카카오 계정 연동 결과 처리
  const kakaoLinkResult = route.query.kakao_link as string;
  if (kakaoLinkResult) {
    if (kakaoLinkResult === 'success') {
      alert('카카오 계정이 성공적으로 연동되었습니다!');
      // 프로필 정보 다시 불러오기
      fetchUserProfile();
    } else if (kakaoLinkResult === 'error') {
      const errorMessage = route.query.message as string || '카카오 연동에 실패했습니다.';
      alert(errorMessage);
    }
    // URL에서 쿼리 파라미터 제거 (chatId는 유지)
    router.replace({ path: `/chat${chatIdFromUrl ? '/' + chatIdFromUrl : ''}`, query: {} });
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobileSize);
  document.removeEventListener('click', handleClickOutside);

  // visualViewport 이벤트 리스너 정리
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
    window.visualViewport.removeEventListener('scroll', handleVisualViewportResize);
  }
});

const goToHome = () => {
  router.push('/');
};

const goToCrew = () => {
  router.push('/crew');
};

// Reserved for future use
// const goToDevelopmentStatus = () => {
//   router.push('/development-status');
// };

// const goBackToChat = () => {
//   currentView.value = 'chat';
// };

</script>

<style scoped>

@import "./index.css";
/* Keep only the styles for the main layout */
.main-container {
  display: flex;
  overflow: hidden;
  width: 100vw;
  height: 100vh;
  position: relative;
  background: var(--color-bg-primary);
}

.chatbot-sidebar-wrapper {
  display: flex;
  flex-direction: column;
  position: relative;
  width: 270px;
  height: 100vh;
  background: var(--color-bg-primary);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-right: 1px solid var(--color-card-border);
  min-width: 200px;
  max-width: 500px;
  border-radius: 20px;
  box-shadow:
    inset 0px 0px 6px 0px rgba(255, 255, 255, 0.15),
    inset 2px 2px 4px 0px rgba(255, 255, 255, 0.96),
    inset -2px -2px 3px 0px rgba(255, 255, 255, 0.7);
}

.chatbot-sidebar-wrapper.collapsed {
  width : 70px;
  min-width : 70px !important;
  border-right : 1px solid var(--color-card-border);
  border-radius: 0px;
  
}

.chat-content-col {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0; /* Important for child flex shrinkage */
  height: 100vh;
  padding: 0;
  box-sizing: border-box;
}

/* Other layout styles from the original file can be kept here */
.frame {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex-wrap: nowrap;
  flex: 1 1 0%;
  min-height: 0;
  position: relative;
  width: 100%;
  padding: 38px 0 0 0;
  z-index: 9;
}

.frame.collapsed {
  width : 70px;
}
.chatbot-logo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  flex-shrink: 0;
  position: relative;
  width: 100%;
  height: 36px;
  padding: 0 20px 0 29px;
  background: var(--color-bg-primary);
  /* border-right removed to prevent double lines */
  z-index: 10;
}

.chatbot-logo-header.collapsed {
  padding : 0px;
  margin : 0 auto;
}
.frame-1 {
  display: flex;
  justify-content: flex-start;
  flex-direction: row;

  flex: none;
  gap: 15px;
  box-sizing: border-box;
  flex-shrink: 1;
  position: relative;
  min-width: 0;
  z-index: 11;
}

.logo-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  background: url('./icon/-three.svg') no-repeat center;
  background-size: cover;
  object-fit: cover;
}

.eulgpt-logo-svg {
  height: 36px;
  width: auto;
  padding : 0px 0px 0px -5px;
  object-fit: contain;
}
.edit-icon {
  flex-shrink: 0;
  position: relative;
  width: 22px;
  height: 22px;
  background: url('./icon/write.svg') no-repeat center;
  background-size: cover;
  z-index: 16;
  overflow: hidden;
  display: none;
}
.frame-2 {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  align-self: stretch;
  flex-wrap: nowrap;
  flex-shrink: 0;
  gap: 40px;
  position: relative;
  min-width: 0;
  height: 681px;
  padding: 20px 0 0 0;
  z-index: 17;
}
.chatbot-menu-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex-wrap: nowrap;
  flex-shrink: 0;
  gap: 24px;
  position: relative;
  width: 100%;
  padding: 0 20px 0 20px;
  background: transparent;
  z-index: 18;
}

.chatbot-menu-item.collapsed {
  padding : 0px;
  align-items: center;
}

.chatbot-menu-item > div {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  flex-shrink: 0;
  gap: 13px;
  position: relative;
  width: 100%;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
  padding: 0px 8px 0px 8px;
  box-sizing: border-box;
}

.frame-3.collapsed, .frame-7.collapsed, .frame-9.collapsed {
  padding : 0px;
  justify-content: center;
}

.chatbot-menu-item > div:hover {
  background-color: var(--color-bg-secondary);
  transform: translateY(-1px);
}
.frame-3 {
  z-index: 19;
}



.group-4 {
  flex-shrink: 0;
  position: relative;
  width: 25px;
  height: 27.004px;
  background: url('./icon/캘린더.svg') no-repeat center;
  background-size: cover;
  z-index: 29;
}

.day {
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  height: 25px;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  color: var(--color-primary);
  font-family: Pretendard, var(--default-font-family);
  font-size: 10px;
  font-weight: 700;
  line-height: 25px;
  text-align: center;
  white-space: nowrap;
  z-index: 23;
}
.empty-classroom-check {
  flex-shrink: 0;
  flex-basis: auto;
  position: relative;
  height: 23px;
  color: var(--color-text-primary);
  font-family: Pretendard, var(--default-font-family);
  font-size: 14px;
  font-weight: 500;
  line-height: 23px;
  text-align: left;
  white-space: nowrap;
  z-index: 24;
}
.frame-7 {
  z-index: 25;
}
.group-8 {
  flex-shrink: 0;
  position: relative;
  width: 25px;
  height: 25px;
  background: url('./icon/도서관.svg') no-repeat center;
  background-size: cover;
  z-index: 26;
}
.library-study-room-reservation {
  flex-shrink: 0;
  flex-basis: auto;
  position: relative;
  height: 23px;
  color: var(--color-text-primary);
  font-family: Pretendard, var(--default-font-family);
  font-size: 14px;
  font-weight: 500;
  line-height: 23px;
  text-align: left;
  white-space: nowrap;
  z-index: 27;
}
.frame-9 {
  z-index: 28;
}
.group-a {
  flex-shrink: 0;
  position: relative;
  width: 25px;
  height: 25px;
  background: url('./icon/학식당.svg') no-repeat center;
  background-size: cover;
  z-index: 29;
}
.status {
  flex-shrink: 0;
  flex-basis: auto;
  position: relative;
  height: 23px;
  color: var(--color-text-primary);
  font-family: Pretendard, var(--default-font-family);
  font-size: 14px;
  font-weight: 500;
  line-height: 23px;
  text-align: left;
  white-space: nowrap;
  z-index: 35;
}
.side-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  flex-shrink: 0;
  position: relative;
  width: 100%;
  height: 59px;
  padding: 20px 10px 20px 20px;
  background: var(--color-bg-primary);
  border-top: 1px solid var(--color-card-border);
  z-index: 42;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.side-footer.collapsed {
  display : flex;
  flex-direction: column-reverse;
  padding : 0px;
  border: 0px;
  width : 70px;
  height : 130px;
  padding-bottom: 18px;
}

.side-footer:hover {
  background: var(--color-bg-secondary);
}
.ellipse {
  flex-shrink: 0;
  position: relative;
  width: 23px;
  height: 23px;
  background: url('./icon/회색원.svg') no-repeat center;
  background-size: cover;
  z-index: 43;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ellipse .profile-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.ellipse.has-initial {
  background: var(--color-button-primary-bg);
}

.user-initial {
  color: var(--color-button-primary-text);
  font-family: Pretendard, var(--default-font-family);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  text-transform: uppercase;
}
.frame-12 {
  display: none;
  align-items: flex-end;
  justify-content: center;
  flex-wrap: nowrap;
  flex-shrink: 0;
  gap: 15px;
  position: relative;
  width: 80px;
  padding: 10px 10px 10px 10px;
  z-index: 44;
}

.frame-12.collapsed {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0px;
}
.notification {
  flex-shrink: 0;
  position: relative;
  width: 23px;
  height: 24px;
  background: url(https://codia-f2c.s3.us-west-1.amazonaws.com/image/2025-07-31/iOezR9XJsU.png)
    no-repeat center;
  background-size: cover;
  z-index: 45;
}
.icon-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  flex-shrink: 0;
  gap: 4px;
  position: relative;
  width: 22px;
  height: 22px;
  padding: 2px 2px 2px 2px;
  z-index: 46;
  overflow: hidden;
}
.vector {
  flex-shrink: 0;
  position: relative;
  width: 18px;
  height: 18px;
  background: url(https://codia-f2c.s3.us-west-1.amazonaws.com/image/2025-07-31/SMBaVrFnBf.png)
    no-repeat center;
  background-size: cover;
  z-index: 47;
}


/* Mobile overlay - v-if로 렌더링 제어, CSS로는 표시만 담당 */
.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  /* display는 v-if로 제어되므로 기본값 유지 */
}

/* Mobile header */
.mobile-header {
  display: none;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-card-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

/* FR-029: 터치 타겟 최소 44px */
.mobile-menu-toggle {
  background: none;
  border: none;
  padding: 12px;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.mobile-menu-toggle:hover {
  background: var(--color-bg-secondary);
}

/* FR-031: 터치 피드백 */
.mobile-menu-toggle:active {
  background: var(--color-bg-tertiary);
  transform: scale(0.95);
}

/* FR-035: 키보드 포커스 표시 */
.mobile-menu-toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.hamburger-icon {
  width: 20px;
  height: 2px;
  background: var(--color-primary);
  position: relative;
}

.hamburger-icon::before,
.hamburger-icon::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 2px;
  background: var(--color-primary);
  left: 0;
}

.hamburger-icon::before {
  top: -6px;
}

.hamburger-icon::after {
  top: 6px;
}

.mobile-logo .eulgpt-mobile {
  color: var(--color-primary);
  font-family: Poppins, var(--default-font-family);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.4px;
}

/* FR-028: 모바일 새 대화 버튼, FR-029: 터치 타겟 최소 44px */
.mobile-new-chat-button {
  display: none; /* 기본적으로 숨김, 모바일에서만 표시 */
  background: none;
  border: none;
  padding: 12px;
  min-width: 44px;
  min-height: 44px;
  cursor: pointer;
  border-radius: 8px;
  color: var(--color-primary);
  transition: background-color 0.2s;
}

.mobile-new-chat-button:hover {
  background: var(--color-primary-light);
}

.mobile-new-chat-button:active {
  background: var(--color-button-primary-bg);
  transform: scale(0.95);
}

/* FR-035: 키보드 포커스 표시 */
.mobile-new-chat-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Mode selector container */
.mode-selector-container {
  position: absolute;
  top: 29px;
  left: 35px;
  display: flex;
  justify-content: flex-start;
  flex-shrink: 0;
  z-index: 100;
}

.chat-main-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  position: relative;
}

.chat-messages-container {
  flex: 1;
  min-height: 0;
  overflow: visible; /* 오른쪽 말풍선이 잘리지 않도록 변경 */
}

.chat-input-area {
  flex-shrink: 0;
  position: relative;
  background: var(--color-bg-primary);
}

/* Sidebar resizer */
.sidebar-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  background: transparent;
  z-index: 1001;
  transition: background-color 0.2s ease;
}

.sidebar-resizer:hover {
  background: var(--color-primary-light);
}

.sidebar-resizer.resizing {
  background: var(--color-primary-light);
}

.sidebar-resizer::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translateX(-50%) translateY(-50%);
  width: 2px;
  height: 40px;
  background: var(--color-card-border);
  border-radius: 1px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.sidebar-resizer:hover::after,
.sidebar-resizer.resizing::after {
  opacity: 1;
}

/* 버그픽스 3번 햄버거 버튼 클릭 관련 css 입니다.*/

.sidebar-collapsible-contour {
  width : 1px;
  background-color: var(--color-card-border);
}
.sidebar-collapsible-ct > div {
  display : flex;
  gap : 15px;
  align-items: center;
  padding-top : 38px;
  margin-left : 18px;
}

.sidebar-toggle-chaticon {
  padding-left: 28px;
  cursor: pointer;
}

/* ========================================
   Keyboard Overlay Support (Story 2.1)
   - CSS 변수를 통해 키보드 높이 대응
   - visualViewport API와 연동
   ======================================== */
:root {
  --keyboard-height: 0px;
}

/* ========================================
   Responsive Breakpoints (PRD Spec):
   - Mobile: ~640px
   - Tablet: 641px ~ 1024px
   - Desktop: 1025px+
   ======================================== */

/* Mobile styles (640px and below) */
@media (max-width: 640px) {
  .main-container {
    position: relative;
  }

  /* .mobile-overlay는 v-if로 제어됨 */

  .mobile-header {
    display: flex;
  }

  .mobile-new-chat-button {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .chatbot-sidebar-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    width: 280px !important;
    min-width: unset !important;
    max-width: unset !important;
    height: 100vh;
    z-index: 1000;
    transform: translateX(0);
    transition: transform 0.3s ease-in-out;
  }

  .chatbot-sidebar-wrapper.mobile-hidden {
    transform: translateX(-100%);
  }

  .sidebar-resizer {
    display: none;
  }

  .chat-content-col {
    width: 100%;
    margin-left: 0;
    padding: 0;
  }

  .mode-selector-container {
    position: relative;
    top: 0;
    left: 0;
    padding: 20px 24px 12px 24px;
  }

  /* 키보드 오버레이 대응 */
  .chat-input-area {
    position: sticky;
    bottom: 0;
    background: var(--color-bg-primary);
    padding-bottom: max(env(safe-area-inset-bottom), var(--keyboard-height, 0px));
    transition: padding-bottom 0.15s ease-out;
    z-index: 100;
  }

  /* 키보드가 열렸을 때 메시지 영역 조정 + FR-032: 부드러운 스크롤 */
  .chat-messages-container {
    padding-bottom: calc(var(--keyboard-height, 0px) + 8px);
    transition: padding-bottom 0.15s ease-out;
    -webkit-overflow-scrolling: touch; /* iOS 부드러운 스크롤 */
    scroll-behavior: smooth;
    overscroll-behavior: contain; /* 스크롤 체이닝 방지 */
  }
}

/* Small mobile (480px and below) */
@media (max-width: 480px) {
  .chatbot-sidebar-wrapper {
    width: 100% !important;
  }

  .chatbot-logo-header {
    padding: 0 12px;
    height: auto;
    min-height: 36px;
  }

  .eulgpt-logo-svg {
    height: 30px;
  }

  .logo-icon {
    width: 20px;
    height: 20px;
  }

  .edit-icon {
    width: 20px;
    height: 20px;
    display: none;
  }

  .chatbot-menu-item {
    padding: 0 12px;
  }

  .empty-classroom-check,
  .library-study-room-reservation,
  .status {
    font-size: 13px;
  }

  .mobile-logo .eulgpt-mobile {
    font-size: 18px;
  }

  .chat-content-col {
    padding: 0;
  }

  /* 480px 이하에서도 키보드 대응 유지 */
  .chat-input-area {
    padding-bottom: max(env(safe-area-inset-bottom), var(--keyboard-height, 0px));
  }
}

/* Extra small mobile (320px and below) */
@media (max-width: 320px) {
  .chatbot-logo-header {
    padding: 0 8px;
  }

  .eulgpt-logo-svg {
    height: 26px;
  }

  .logo-icon {
    width: 18px;
    height: 18px;
  }

  .edit-icon {
    width: 18px;
    height: 18px;
    display: none;
  }

  .chat-content-col {
    padding: 0;
  }
}

/* Tablet styles (641px ~ 1024px) */
@media (min-width: 641px) and (max-width: 1024px) {
  .chatbot-sidebar-wrapper {
    width: 220px;
    min-width: 200px;
    max-width: 260px;
  }

  .chatbot-logo-header {
    padding: 0 16px;
  }

  .chatbot-menu-item {
    padding: 0 16px;
  }

  .chat-content-col {
    padding: 0;
  }

  .mode-selector-container {
    left: 20px;
  }
}

</style>
