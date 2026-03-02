import { ref, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { createLogger } from '../utils/logger';
const log = createLogger('useChat');
import { isAuthenticated, apiRequest } from '../utils/auth';

export interface RagSource {
  title: string;
  content: string;
  domain: string;
  category?: string;
  score?: number;
}

export interface ArtifactVersion {
  content: string;
  timestamp: number;
  description?: string;
}

export interface Artifact {
  title: string;
  content: string;
  type: string;
  versions?: ArtifactVersion[];
  currentVersion?: number;
}

export interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
  isLoading?: boolean;
  isStreaming?: boolean;
  images?: File[];
  currentStep?: string;
  cotSteps?: string[];
  currentPhase?: string;
  progressPercent?: number;
  totalSteps?: number;
  currentStepNumber?: number;
  hasError?: boolean;
  errorDetails?: {
    step?: string;
    reason?: string;
    phase?: string;
  };
  ragSources?: RagSource[];
  artifact?: Artifact | null;
  modelName?: string;  // 응답을 생성한 모델 이름
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  sessionId?: string; // 백엔드 세션 ID
}

export type ChatMode = 'rag';

export function useChat() {
  const router = useRouter();
  const messages = ref<ChatMessage[]>([]);
  const chatHistory = ref<ChatSession[]>([]);
  const currentChatId = ref<string | null>(null);
  const isLoading = ref(false);
  const isStreaming = ref(false);
  // 기본 모드: 'rag' (대학 정보 검색)
  const chatMode = ref<ChatMode>('rag');
  let currentController: AbortController | null = null;
  // 중복 전송 방지 플래그
  let isSendingLock = false;
  
  // RAG 시스템 상태
  const ragStatus = ref({
    initialized: false,
    isInitializing: false,
    error: null as string | null,
    systemInfo: null as any
  });

  // 과도한 개행/공백 정규화 함수
  const normalizeWhitespace = (text: string): string => {
    if (!text) return text;
    return text
      // 2개 이상의 연속 개행을 1개로 축소 (문단 구분은 마크다운이 처리)
      .replace(/\n{2,}/g, '\n')
      // 줄 끝의 공백 제거
      .replace(/[ \t]+$/gm, '')
      // 리스트 항목/헤더 뒤의 불필요한 개행 제거
      .replace(/^([-*#▶•]\s*.+)\n+(?=[-*#▶•])/gm, '$1\n')
      // 코드 블록 외부의 과도한 빈 줄 제거
      .replace(/\n\s*\n/g, '\n')
      // 앞뒤 공백 제거
      .trim();
  };

  // 모드별 모델 이름 반환
  const getModelName = (_mode: ChatMode): string => {
    return '대학 정보 모델';
  };

  // 메시지 업데이트를 위한 헬퍼 함수 (Vue 반응성 보장)
  const updateMessage = (chatId: string, messageIndex: number, updates: Partial<ChatMessage>) => {
    const chat = chatHistory.value.find(c => c.id === chatId);
    if (!chat || !chat.messages[messageIndex]) return;

    // 기존 메시지를 직접 업데이트
    Object.assign(chat.messages[messageIndex], updates);

    // 현재 활성 채팅인 경우 messages ref를 강제로 업데이트하여 Vue 반응성 트리거
    if (currentChatId.value === chatId) {
      messages.value = [...chat.messages];
    }
  };

  // Railway 내부 URL(.railway.internal)은 브라우저에서 접근 불가하므로 외부 URL로 대체
  const getGeminiApiBaseUrl = () => {
    const envUrl = import.meta.env.VITE_GEMINI_FASTAPI_URL;

    // Railway 내부 URL 감지 및 외부 URL로 대체
    if (envUrl && envUrl.includes('.railway.internal')) {
      return 'https://ai-rag-production.up.railway.app';
    }

    // 프로덕션 환경에서 /gemini-api 프록시 경로 사용 시 외부 URL로 대체
    if (!envUrl || envUrl === '/gemini-api') {
      // 브라우저에서 프로덕션 호스트인지 확인 (Railway 또는 커스텀 도메인)
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname.includes('railway.app') ||
            hostname.includes('euljigpt.com') ||
            hostname === 'www.euljigpt.com') {
          return 'https://ai-rag-production.up.railway.app';
        }
      }
    }

    return envUrl || '/gemini-api';
  };

  const getBackendApiBaseUrl = () => {
    const envUrl = import.meta.env.VITE_FASTAPI_URL;

    // Railway 내부 URL 감지 및 외부 URL로 대체
    if (envUrl && envUrl.includes('.railway.internal')) {
      return 'https://fastapi-backend-production-2cd0.up.railway.app';
    }

    // 프로덕션 환경에서 /api 프록시 경로 사용 시 외부 URL로 대체
    if (!envUrl || envUrl === '/api') {
      // 브라우저에서 프로덕션 호스트인지 확인 (Railway 또는 커스텀 도메인)
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname.includes('railway.app') ||
            hostname.includes('euljigpt.com') ||
            hostname === 'www.euljigpt.com') {
          return 'https://fastapi-backend-production-2cd0.up.railway.app';
        }
      }
    }

    return envUrl || 'http://localhost:8000';
  };

  const FASTAPI_BASE_URL = getGeminiApiBaseUrl(); // AI-RAG API URL
  const BACKEND_BASE_URL = getBackendApiBaseUrl(); // 백엔드 API URL
  const getAPIUrl = (_mode: ChatMode): string => {
    // RAG 시스템만 지원
    return `${FASTAPI_BASE_URL}/rag/query`;
  };

  // 자동 스크롤 함수
  const scrollToBottom = () => {
    nextTick(() => {
      const container = document.querySelector('.chat-messages-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  };

  // 긴 답변을 아티팩트로 변환할지 판단하는 함수
  const shouldConvertToArtifact = (text: string): boolean => {
    // 조건 1: 2000자 이상 (기존 3000자에서 완화)
    if (text.length < 2000) return false;

    // 조건 2: 여러 섹션 포함 (## 또는 ### 또는 숫자. 로 시작하는 제목이 3개 이상)
    const sectionPatterns = [
      /^#{1,3}\s+/gm,  // 마크다운 제목
      /^\d+\.\s+/gm,    // 숫자로 시작하는 항목
      /^[IⅡⅢ]+\.\s+/gm  // 로마 숫자로 시작하는 항목
    ];

    let sectionCount = 0;
    for (const pattern of sectionPatterns) {
      const matches = text.match(pattern);
      if (matches) sectionCount += matches.length;
    }

    return sectionCount >= 3;
  };

  // 아티팩트 제목 추출 함수
  const extractArtifactTitle = (text: string): string => {
    // 첫 번째 제목을 찾기
    const titlePatterns = [
      /^#\s+(.+)$/m,      // # 제목
      /^##\s+(.+)$/m,     // ## 제목
      /^(.+)\n={3,}$/m,   // 밑줄 제목
      /^(\d+\.\s+.+)$/m   // 1. 제목
    ];

    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim().substring(0, 50); // 최대 50자
      }
    }

    // 제목을 찾지 못하면 첫 100자 사용
    return text.substring(0, 100).replace(/\n/g, ' ') + '...';
  };

  // AI 인삿말 제거하여 순수 보고서만 추출하는 함수
  const extractReportContent = (text: string): string => {
    // AI 인삿말 패턴들 (보고서 작성 전에 나오는 인사/확인 멘트)
    const greetingPatterns = [
      /^안녕하세요[!,.\s]*.{0,100}?(?=\n|$)/i,
      /^네[!,.\s]*.{0,100}?(?=\n|$)/i,
      /^알겠습니다[!,.\s]*.{0,100}?(?=\n|$)/i,
      /^좋습니다[!,.\s]*.{0,100}?(?=\n|$)/i,
      /^물론입니다[!,.\s]*.{0,100}?(?=\n|$)/i,
      /^(작성|정리|분석|설명).{0,50}?드리겠습니다[!,.\s]*/i,
      /^(보고서|레포트|자료).{0,50}?작성.{0,50}?(?=\n|$)/i,
      /^.{0,50}?대해.{0,30}?(설명|정리|분석|작성).{0,30}?(?=\n|$)/i
    ];

    let cleanedText = text;

    // 각 패턴을 순서대로 제거
    for (const pattern of greetingPatterns) {
      cleanedText = cleanedText.replace(pattern, '');
    }

    // 시작 부분의 공백 및 개행 제거
    cleanedText = cleanedText.trim();

    // 첫 번째 마크다운 제목(# 또는 ##)이 나오기 전까지의 내용 제거
    // 보고서는 보통 제목으로 시작하므로
    const firstHeadingMatch = cleanedText.match(/^(.*?)(^#+ .+$)/ms);
    if (firstHeadingMatch && firstHeadingMatch[1].length < 200) {
      // 제목 전 내용이 200자 미만이면 인삿말로 간주하고 제거
      cleanedText = firstHeadingMatch[2] + cleanedText.substring(firstHeadingMatch[0].length);
    }

    return cleanedText.trim();
  };

  // 상세한 답변이 필요한 질문인지 감지하는 함수
  const requiresDetailedResponse = (message: string): boolean => {
    const detailedIndicators = [
      /설명해.*주세요|설명.*해줘|설명해|설명.*드려/i,     // explain
      /분석.*주세요|분석.*해줘|분석해|분석.*드려/i,       // analyze
      /알려.*주세요|알려.*줘|알려주|알려.*드려/i,         // tell me
      /작성.*주세요|작성.*해줘|작성해|작성.*드려/i,       // write
      /정리.*주세요|정리.*해줘|정리해|정리.*드려/i,       // summarize/organize
      /비교.*주세요|비교.*해줘|비교해|비교.*드려/i,       // compare
      /검토.*주세요|검토.*해줘|검토해|검토.*드려/i,       // review
      /평가.*주세요|평가.*해줘|평가해|평가.*드려/i,       // evaluate
      /조사.*주세요|조사.*해줘|조사해|조사.*드려/i,       // research
      /연구.*주세요|연구.*해줘|연구해/i,                  // research
      /보고서/i,                                          // report
      /논문/i,                                            // thesis
      /레포트/i,                                          // report (english)
      /자세히|상세히|자세하게|상세하게/i,                 // in detail
      /전체적|전반적/i,                                   // comprehensive
      /체계적|구조적/i,                                   // systematic/structured
      /종합적/i,                                          // comprehensive
      /요약.*주세요|요약.*해줘|요약해|요약.*드려/i,       // summarize
      /리스트.*주세요|리스트.*해줘|목록.*주세요/i,       // list
      /단계별|순서대로/i,                                 // step by step
      /방법.*알려|방법.*설명|방법.*정리/i,               // methods
      /차이.*설명|차이.*알려|차이점|차이가/i,            // differences
      /장단점|장점.*단점|pros.*cons/i,                   // pros and cons
      /특징.*설명|특징.*알려|특징.*정리/i,               // characteristics
      /과정.*설명|과정.*알려|과정.*정리/i,               // process
      /원리.*설명|원리.*알려|원리.*정리/i,               // principles
      /개념.*설명|개념.*알려|개념.*정리/i,               // concepts
      /이론.*설명|이론.*알려|이론.*정리/i,               // theory
      /역사.*설명|역사.*알려|역사.*정리/i,               // history
      /배경.*설명|배경.*알려|배경.*정리/i,               // background
      /구조.*설명|구조.*알려|구조.*정리/i,               // structure
      /시스템.*설명|시스템.*알려|시스템.*정리/i,         // system
      /어떻게|어떤|무엇|왜|언제|누가/i,                   // what/how/why/when/who question words
    ];

    // 조건 완화: 15자 이상이거나, 또는 특정 키워드 포함 시 보고서 모드
    // "~에 대해", "관련", "대한" 등의 표현도 체크
    const hasKeyPhrase = /에\s*대해|에\s*관해|관련|대한/i.test(message);

    return (message.length >= 15 && detailedIndicators.some(pattern => pattern.test(message)))
           || (message.length >= 30 && hasKeyPhrase);
  };

  // 메시지 전처리 (RAG 모드는 그대로 전달)
  const prepareMessageForAI = (message: string, _mode: ChatMode): string => {
    return message;
  };

  const FASTAPI_HEALTH_URL = `${FASTAPI_BASE_URL}/health`;

  onMounted(async () => {
    // 채팅 히스토리 로드 완료 대기
    await loadChatHistory();

    // FastAPI 서버 상태 확인
    await checkServerStatus();

    // 히스토리가 있으면 첫 번째 선택, 없으면 새 대화 시작
    if (chatHistory.value.length > 0) {
      selectChat(chatHistory.value[0].id);
    } else {
      startNewChat();
    }
  });

  async function loadChatHistory() {
    // 로그인된 사용자인 경우 백엔드에서 로드
    if (isAuthenticated()) {
      try {
        log.info("Loading chat history from backend...");
        const response = await apiRequest(`${BACKEND_BASE_URL}/chat/history`, {
          method: 'GET'
        });

        if (response.ok) {
          const histories = await response.json();
          log.info("Chat history loaded successfully:", histories.length, '개');

          // 백엔드 데이터를 프론트엔드 형식으로 변환 (UUID는 이미 string)
          chatHistory.value = histories.map((h: any) => ({
            id: h.id, // UUID (이미 string)
            title: h.title,
            messages: [], // 메시지는 개별 히스토리 조회 시 로드
            sessionId: undefined // AI-RAG 세션은 첫 메시지 전송 시 생성됨
          }));
          return;
        }
      } catch (error) {
        log.error("Failed to load chat history:", error);
        // 에러 발생 시 로컬스토리지로 fallback
      }
    }

    // 비로그인 사용자 또는 백엔드 로드 실패 시 로컬스토리지에서 로드
    const history = localStorage.getItem('chatHistory');
    if (history) {
      const parsedHistory = JSON.parse(history);
      chatHistory.value = parsedHistory.map((chat: ChatSession) => ({
        ...chat,
        messages: chat.messages.map((msg: ChatMessage) => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          hasError: msg.hasError || false,
          isLoading: msg.isLoading || false,
          isStreaming: msg.isStreaming || false
        }))
      }));
    }
  }

  function saveChatHistory() {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory.value));
  }

  // 백엔드에서 새 세션 생성
  async function createBackendSession(): Promise<string | null> {
    try {
      const response = await fetch(`${FASTAPI_BASE_URL}/session/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      if (response.ok) {
        const data = await response.json();
        return data.session_id;
      }
    } catch (error) {
      log.error("Failed to create backend session:", error);
    }
    return null;
  }

  async function startNewChat() {
    // 로그인된 사용자인 경우 백엔드에 채팅 히스토리 생성
    if (isAuthenticated()) {
      try {
        log.info("Creating new chat history in backend...");
        const response = await apiRequest(`${BACKEND_BASE_URL}/chat/history`, {
          method: 'POST',
          body: JSON.stringify({ title: '새 대화' })
        });

        if (response.ok) {
          const chatHistoryData = await response.json();
          log.info("Chat history created:", chatHistoryData);

          const backendSessionId = await createBackendSession();

          const newChat: ChatSession = {
            id: chatHistoryData.id, // UUID (이미 string)
            title: chatHistoryData.title,
            messages: [],
            sessionId: backendSessionId || undefined
          };
          chatHistory.value.unshift(newChat);
          currentChatId.value = newChat.id;
          messages.value = newChat.messages;

          // URL 업데이트 (UUID 포함)
          router.push(`/chat/${newChat.id}`);

          log.info("New chat created (UUID):", newChat.id);
          return;
        }
      } catch (error) {
        log.error("Failed to create chat history:", error);
        // 에러 발생 시 로컬 방식으로 fallback
      }
    }

    // 비로그인 사용자 또는 백엔드 생성 실패 시 로컬 방식
    currentChatId.value = `chat-${Date.now()}`;
    const backendSessionId = await createBackendSession();

    const newChat: ChatSession = {
      id: currentChatId.value,
      title: '새 대화',
      messages: [],
      sessionId: backendSessionId || undefined
    };
    chatHistory.value.unshift(newChat);
    messages.value = newChat.messages;

    // URL 업데이트 (UUID 포함)
    router.push(`/chat/${newChat.id}`);

    if (backendSessionId) {
      log.info("New backend session created:", backendSessionId);
    }
  }

  async function selectChat(id: string) {
    const chat = chatHistory.value.find(c => c.id === id);
    if (chat) {
      currentChatId.value = id;

      // URL 업데이트 (UUID 포함)
      if (router.currentRoute.value.params.chatId !== id) {
        router.push(`/chat/${id}`);
      }

      // 🔧 세션 ID 복원 또는 생성 (Option 3: 맥락 유지)
      if (!chat.sessionId) {
        const backendSessionId = await createBackendSession();
        if (backendSessionId) {
          chat.sessionId = backendSessionId;
          log.info(`Session created for existing chat ${id}: ${backendSessionId}`);
          saveChatHistory(); // localStorage 업데이트
        }
      } else {
        log.debug(`Using existing session for chat ${id}: ${chat.sessionId}`);
      }

      // 로그인된 사용자인 경우 항상 백엔드에서 최신 메시지 로드
      if (isAuthenticated()) {
        try {
          log.info(`Loading chat messages... (ID: ${id})`);
          const response = await apiRequest(`${BACKEND_BASE_URL}/chat/history/${id}`, {
            method: 'GET'
          });

          if (response.ok) {
            const chatDetail = await response.json();
            log.info("Chat messages loaded:", chatDetail.chatmessage?.length || 0, '개');

            // 백엔드 메시지를 프론트엔드 형식으로 변환
            chat.messages = (chatDetail.chatmessage || []).map((msg: any) => ({
              text: msg.message,
              isUser: msg.is_user,
              timestamp: new Date(msg.created_at),
              isLoading: false,
              isStreaming: false,
              hasError: false
            }));

            // messages.value를 반드시 업데이트 (Vue 반응성)
            messages.value = [...chat.messages];
            log.debug("messages.value updated:", messages.value.length, '개');
          }
        } catch (error) {
          log.error("Failed to load chat messages:", error);
          // 실패 시에도 빈 배열로 초기화
          chat.messages = [];
          messages.value = [];
        }
      } else {
        // 비로그인 사용자는 로컬 메시지 사용
        messages.value = [...chat.messages];
      }
    }
  }

  async function deleteChat(id: string) {
    // 로그인된 사용자인 경우 백엔드에서 삭제
    if (isAuthenticated()) {
      try {
        log.info(`Deleting chat history... (ID: ${id})`);
        const response = await apiRequest(`${BACKEND_BASE_URL}/chat/history/${id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          log.info("Chat history deleted successfully");
        }
      } catch (error) {
        log.error("Failed to delete chat history:", error);
        // 에러가 나도 로컬에서는 삭제 진행
      }
    }

    // 로컬 상태에서 삭제
    const index = chatHistory.value.findIndex(c => c.id === id);
    if (index !== -1) {
      chatHistory.value.splice(index, 1);
      saveChatHistory();
      if (currentChatId.value === id) {
        if (chatHistory.value.length > 0) {
          selectChat(chatHistory.value[0].id);
        } else {
          startNewChat();
        }
      }
    }
  }

  async function checkServerStatus() {
    const maxRetries = 3;
    const retryDelay = 2000; // 2초
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log.debug(`Checking AI service status... (attempt ${attempt}/${maxRetries})`, FASTAPI_HEALTH_URL);
        const response = await fetch(FASTAPI_HEALTH_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          log.info('AI service connected:', data);
          return; // 성공하면 함수 종료
        } else {
          log.warn(`AI service status abnormal (attempt ${attempt}/${maxRetries}):`, response.status);
        }
      } catch (error) {
        log.error(`AI service connection failed (attempt ${attempt}/${maxRetries}):`, error);
        
        if (attempt < maxRetries) {
          log.debug(`Retrying in ${retryDelay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          log.info('AI service may not be started yet. Please try again later.');
        }
      }
    }
  }

  // 백엔드에 메시지 저장 (단일 저장 - 중복 저장 버그 수정됨)
  async function saveMessageToBackend(
    chatId: string,
    isUser: boolean,
    message: string,
    modelName?: string
  ) {
    if (!isAuthenticated()) return;

    try {
      const chat = chatHistory.value.find(c => c.id === chatId);
      if (!chat) {
        log.warn('Chat not found:', chatId);
        return;
      }

      // chat.id가 Backend 채팅 히스토리 ID (숫자)
      // chat.sessionId는 AI-RAG 세션 ID (UUID) - 여기서 사용하지 않음
      const backendChatId = chat.id;

      // 숫자 형식이 아닌 경우 (로컬 채팅) 저장하지 않음
      if (backendChatId.startsWith('chat-')) {
        log.debug('Local chat, skipping backend save:', backendChatId);
        return;
      }

      await apiRequest(`${BACKEND_BASE_URL}/chat/history/${backendChatId}/message`, {
        method: 'POST',
        body: JSON.stringify({
          is_user: isUser,
          message: message,
          model_name: modelName || null
        })
      });

      log.debug('Message saved to backend:', { chatId: backendChatId, isUser, modelName });
    } catch (error) {
      log.error('Failed to save message to backend:', error);
      // 실패해도 사용자 경험에 영향 없도록 에러 무시
    }
  }

  async function generateChatTitle(message: string): Promise<string> {
    try {
      const response = await fetch(`${FASTAPI_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `다음 메시지를 5-8단어로 간단히 요약해주세요. 한국어로 답변하고, 요약 제목만 응답하세요: "${message}"`
        })
      });

      if (response.ok) {
        // 스트리밍 응답 처리
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim() || !line.startsWith('data: ')) continue;

              try {
                const jsonStr = line.slice(6);
                const data = JSON.parse(jsonStr);

                if (data.type === 'chunk') {
                  fullText += data.content;
                } else if (data.type === 'done') {
                  // 스트리밍 완료
                  break;
                }
              } catch (parseError) {
                log.warn("Failed to parse title generation JSON:", line, parseError);
              }
            }
          }
        }

        if (fullText.trim()) {
          // 인용부호 제거, 최대 30자로 제한
          return fullText.trim().replace(/['"]/g, '').substring(0, 30);
        }
      }
    } catch (error) {
      log.error("Failed to generate title:", error);
    }

    // AI 요약 실패 시 기본값 반환: 메시지의 첫 20자 사용
    return message.substring(0, 20) + (message.length > 20 ? '...' : '');
  }

  async function callFastAPICotChat(message: string, messageIndex: number) {
    const apiUrl = getAPIUrl('cot');
    console.log("🧠 CoT FastAPI 스트리밍 호출 시작:", apiUrl);
    log.debug("CoT message to send:", message);
    
    // 새로운 AbortController 생성
    currentController = new AbortController();
    
    const currentChat = chatHistory.value.find(c => c.id === currentChatId.value);
    if (!currentChat) return;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: currentController.signal,
        body: JSON.stringify({ 
          question: message, 
          context: null,
          session_id: currentChat.sessionId
        })
      });

      log.debug("CoT streaming response status:", response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        log.error("CoT HTTP error response:", errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      if (currentChat.messages[messageIndex]) {
        updateMessage(currentChat.id, messageIndex, {
          text: '',
          isLoading: false,
          isStreaming: true,
          currentStep: "CoT 추론 시작...",
          cotSteps: [],
          currentPhase: 'initialization',
          progressPercent: 0,
          totalSteps: 0,
          currentStepNumber: 0
        });
      }
      
      isStreaming.value = true;

      // 스트리밍 응답 처리
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // 완전한 라인들을 찾기 위해 버퍼 처리
          let lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 마지막 불완전한 라인은 버퍼에 보관

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6).trim(); // 'data: ' 제거 및 공백 제거
                if (jsonStr) {
                  const data = JSON.parse(jsonStr);
                  log.debug('Streaming data received:', {
                    type: data.type,
                    phase: data.phase,
                    chunk_length: data.final_answer_chunk?.length
                  });
                  
                  if (data.type === 'start' && currentChat.messages[messageIndex]) {
                    updateMessage(currentChat.id, messageIndex, {
                      currentStep: data.step,
                      currentPhase: data.phase,
                      progressPercent: 0
                    });
                  }
                  else if (data.type === 'status' && currentChat.messages[messageIndex]) {
                    const updates: Partial<ChatMessage> = {
                      currentStep: data.step,
                      currentPhase: data.phase
                    };
                    if (data.progress_percent !== undefined) {
                      updates.progressPercent = data.progress_percent;
                    }
                    if (data.current_step !== undefined) {
                      updates.currentStepNumber = data.current_step;
                    }
                    if (data.total_steps !== undefined) {
                      updates.totalSteps = data.total_steps;
                    }
                    updateMessage(currentChat.id, messageIndex, updates);
                  }
                  else if (data.type === 'sub_questions' && currentChat.messages[messageIndex]) {
                    updateMessage(currentChat.id, messageIndex, {
                      cotSteps: data.sub_questions,
                      totalSteps: data.total_steps,
                      currentPhase: data.phase
                    });
                  }
                  else if (data.type === 'step_completed' && currentChat.messages[messageIndex]) {
                    // 단계별 답변을 누적해서 표시
                    accumulatedText += `\n\n**${data.step_answer.question}**\n${data.step_answer.answer}`;
                    updateMessage(currentChat.id, messageIndex, {
                      text: accumulatedText,
                      currentStepNumber: data.step_number,
                      progressPercent: data.progress_percent,
                      currentPhase: data.phase
                    });
                    log.debug(`Step ${data.step_number} completed, accumulated text length: ${accumulatedText.length}`);
                    
                    // 단계 완료 시 자동 스크롤
                    scrollToBottom();
                  }
                  else if (data.type === 'warning' && currentChat.messages[messageIndex]) {
                    updateMessage(currentChat.id, messageIndex, {
                      currentStep: data.step,
                      currentPhase: data.phase
                    });
                    // 경고 정보 저장 (오류는 아니지만 알림 목적)
                    if (data.warning_details) {
                      log.warn('CoT step warning:', data.warning_details);
                    }
                  }
                  else if (data.type === 'final_streaming_start' && currentChat.messages[messageIndex]) {
                    // 최종 답변 스트리밍 시작 - 기존 텍스트 초기화
                    log.debug('Final answer streaming started - resetting text');
                    updateMessage(currentChat.id, messageIndex, {
                      text: '',
                      currentStep: "최종 답변 출력 중...",
                      currentPhase: data.phase,
                      progressPercent: 100,
                      isStreaming: true
                    });
                    isStreaming.value = true; // 전역 스트리밍 상태 활성화
                  }
                  else if (data.type === 'final_answer_chunk' && currentChat.messages[messageIndex]) {
                    // 스트리밍 청크를 실시간으로 누적
                    const chunk = data.final_answer_chunk;

                    if (chunk && chunk.length > 0) {
                      const currentMessage = currentChat.messages[messageIndex];
                      const beforeLength = currentMessage.text.length;
                      const newText = currentMessage.text + chunk;

                      // 새 메시지 객체를 생성하여 Vue 반응성 확실히 트리거
                      currentChat.messages[messageIndex] = {
                        ...currentMessage,
                        text: newText,
                        isStreaming: true,
                        currentStep: "최종 답변 출력 중..."
                      };

                      // messages ref도 새 배열로 업데이트
                      messages.value = [...currentChat.messages];

                      log.debug('Streaming chunk accumulated:', {
                        chunk_length: chunk.length,
                        total_length: newText.length
                      });

                      // 스크롤
                      nextTick(() => scrollToBottom());
                    }

                    // 마지막 청크인 경우
                    if (data.is_last_chunk) {
                      log.debug("Streaming: Last chunk processed");
                    }
                  }
                  else if (data.type === 'final_answer_complete' && currentChat.messages[messageIndex]) {
                    // 최종 답변 스트리밍 완료 - 텍스트 정규화 적용
                    const rawText = currentChat.messages[messageIndex].text;
                    const finalText = normalizeWhitespace(rawText);

                    updateMessage(currentChat.id, messageIndex, {
                      text: finalText,
                      isStreaming: false,
                      currentStep: undefined,
                      cotSteps: undefined,
                      currentPhase: undefined,
                      progressPercent: undefined,
                      totalSteps: undefined,
                      currentStepNumber: undefined
                    });

                    isStreaming.value = false;

                    log.debug('CoT streaming completed:', {
                      final_text_length: currentChat.messages[messageIndex].text.length
                    });

                    // AI 메시지를 백엔드에 저장
                    await saveMessageToBackend(currentChat.id, false, finalText, getModelName(chatMode.value));

                    // 최종 스크롤
                    setTimeout(() => {
                      scrollToBottom();
                      saveChatHistory();
                    }, 100);
                  }
                  else if (data.type === 'error') {
                    // 오류 발생 시 즉시 스트리밍 중단하고 오류 메시지 표시
                    log.error("CoT processing error:", data.error_details || data.error);
                    
                    if (currentChat.messages[messageIndex]) {
                      currentChat.messages[messageIndex].isStreaming = false;
                      currentChat.messages[messageIndex].hasError = true;
                      currentChat.messages[messageIndex].currentStep = undefined;
                      currentChat.messages[messageIndex].cotSteps = undefined;
                      currentChat.messages[messageIndex].currentPhase = data.phase || 'error';
                      currentChat.messages[messageIndex].progressPercent = undefined;
                      currentChat.messages[messageIndex].totalSteps = undefined;
                      currentChat.messages[messageIndex].currentStepNumber = undefined;
                      currentChat.messages[messageIndex].errorDetails = data.error_details;
                      
                      // 사용자 친화적인 오류 메시지 설정
                      let friendlyErrorMessage = '';
                      if (data.phase === 'sub_questions_error') {
                        friendlyErrorMessage = '🚫 질문을 분석하는 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.';
                      } else if (data.phase === 'step_critical_error') {
                        friendlyErrorMessage = '🚫 단계별 처리 중 치명적인 오류가 발생했습니다.\n질문을 다시 입력해주세요.';
                      } else if (data.phase === 'synthesis_error') {
                        friendlyErrorMessage = '🚫 최종 답변을 생성하는 중 오류가 발생했습니다.\n다시 시도해주세요.';
                      } else {
                        friendlyErrorMessage = '🚫 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.';
                      }
                      
                      if (data.error_details?.reason) {
                        friendlyErrorMessage += `\n\n세부 정보: ${data.error_details.reason}`;
                      }
                      
                      currentChat.messages[messageIndex].text = friendlyErrorMessage;
                    }
                    
                    isStreaming.value = false;
                    saveChatHistory();
                    return; // 오류 발생 시 더 이상 처리하지 않음
                  }
                  else if (data.type === 'done') {
                    log.debug("CoT streaming finished");
                    break;
                  }
                }
              } catch (parseError) {
                log.warn("JSON parsing error:", parseError, "line:", line);
              }
            }
          }
        }
      }

    } catch (error: any) {
      let errorMessage = '죄송합니다. CoT 추론 중 오류가 발생했습니다.';
      
      if (error.name === 'AbortError') {
        errorMessage = 'CoT 추론이 취소되었습니다.';
        log.info("CoT request was cancelled");
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'CoT 서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
        log.error("CoT server connection failed");
      } else {
        log.error("CoT streaming error:", error.message);
        
        // 오류 발생시 일반 모드로 폴백
        log.info("Falling back to general mode due to CoT failure...");
        
        if (currentChat.messages[messageIndex]) {
          currentChat.messages[messageIndex].text = '🔄 CoT 모드에서 오류가 발생했습니다. RAG 모드로 자동 전환합니다...';
          currentChat.messages[messageIndex].currentStep = 'RAG 모드로 전환 중...';
        }

        try {
          const originalMode = chatMode.value;
          chatMode.value = 'rag';
          await callFastAPIChat(message, messageIndex);
          chatMode.value = originalMode;
          return;
        } catch (fallbackError) {
          log.error("RAG mode fallback also failed:", fallbackError);
          errorMessage = '🚫 CoT와 RAG 모드 모두 실패했습니다. 잠시 후 다시 시도해주세요.';
        }
      }

      if (currentChat.messages[messageIndex]) {
        currentChat.messages[messageIndex] = {
          text: errorMessage,
          isUser: false,
          timestamp: new Date(),
          isLoading: false,
          isStreaming: false,
          currentStep: undefined,
          cotSteps: undefined,
          modelName: getModelName(chatMode.value)  // 모델 이름 설정
        };
      }
      
      isStreaming.value = false;
    } finally {
      currentController = null;
    }
  }

  async function callFastAPIChat(message: string, messageIndex: number) {
    const apiUrl = getAPIUrl(chatMode.value);
    log.debug("FastAPI call started:", apiUrl, "mode:", chatMode.value);
    log.debug("Original message:", message);

    // 메시지 전처리: 상세 답변이 필요한 경우 보고서 스타일 지침 추가
    const preparedMessage = prepareMessageForAI(message, chatMode.value);
    if (preparedMessage !== message) {
      log.debug("Report style instruction added");
      log.debug("Preprocessed message length:", preparedMessage.length, "chars");
    } else {
      log.debug("Normal mode message");
    }

    // 새로운 AbortController 생성
    currentController = new AbortController();

    const currentChat = chatHistory.value.find(c => c.id === currentChatId.value);
    if (!currentChat) {
      log.error("Current chat not found");
      return;
    }

    try {
      log.debug("Starting fetch request...");
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: currentController.signal, // AbortController 신호 추가
        body: JSON.stringify({
          question: preparedMessage,
          session_id: currentChat.sessionId
        })
      });

      log.debug("Response status:", response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        log.error("HTTP error response:", errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 스트리밍 응답 처리
      if (currentChat.messages[messageIndex]) {
        const existingMessage = currentChat.messages[messageIndex];
        existingMessage.text = '';
        existingMessage.isLoading = false;
        existingMessage.isStreaming = true;
        existingMessage.currentStep = undefined;
        existingMessage.hasError = false;
      }

      isStreaming.value = true;

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponseText = '';

      if (!reader) {
        throw new Error("응답 스트림을 읽을 수 없습니다.");
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const jsonStr = line.slice(6);
            const data = JSON.parse(jsonStr);

            if (data.type === 'start') {
              // 세션 ID 저장 (항상 백엔드에서 반환된 session_id 사용)
              if (data.session_id) {
                currentChat.sessionId = data.session_id;
                log.debug("Session ID saved/updated");
              }
              // 모델 이름 저장
              if (data.model_name && currentChat.messages[messageIndex]) {
                currentChat.messages[messageIndex].modelName = data.model_name;
                log.debug("Model name saved:", data.model_name);
              }
            } else if (data.type === 'chunk') {
              // 실시간 스트리밍 청크 추가
              fullResponseText += data.content;
              if (currentChat.messages[messageIndex]) {
                // Vue 반응성을 보장하기 위해 직접 할당
                const msg = currentChat.messages[messageIndex];
                msg.text = fullResponseText;
                // 강제로 messages ref 업데이트
                messages.value = [...currentChat.messages];
              }
              setTimeout(() => scrollToBottom(), 10);
            } else if (data.type === 'done') {
              log.debug("Streaming completed");
              // done에서도 model_name 확인 (fallback)
              if (data.model_name && currentChat.messages[messageIndex] && !currentChat.messages[messageIndex].modelName) {
                currentChat.messages[messageIndex].modelName = data.model_name;
                log.debug("Model name saved (done):", data.model_name);
              }
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          } catch (parseError) {
            log.warn("JSON parsing failed:", line, parseError);
          }
        }
      }

      // 스트리밍 완료 후 처리
      if (currentChat.messages[messageIndex]) {
        const responseText = fullResponseText;

        // 긴 답변 체크: 아티팩트로 변환할지 판단
        if (shouldConvertToArtifact(responseText)) {
          // 아티팩트로 변환
          const artifactTitle = extractArtifactTitle(responseText);

          // AI 인삿말 제거하고 순수 보고서 내용만 추출
          const reportContent = extractReportContent(responseText);

          const initialVersion: ArtifactVersion = {
            content: reportContent,  // 인삿말 제거된 순수 보고서 내용
            timestamp: Date.now(),
            description: '초기 생성'
          };

          // 보고서 스타일 아티팩트임을 명확히 표시
          const wordCount = Math.floor(reportContent.length / 2);
          const artifactMessage = `📄 체계적인 보고서를 아티팩트로 생성하였습니다.\n\n**${artifactTitle}**\n\n오른쪽 패널에서 전문 보고서 형식의 상세 내용을 확인하실 수 있습니다. (약 ${wordCount.toLocaleString()}자)`;
          currentChat.messages[messageIndex].text = artifactMessage;
          currentChat.messages[messageIndex].artifact = {
            title: artifactTitle,
            content: reportContent,  // 인삿말 제거된 순수 보고서 내용
            type: 'document',
            versions: [initialVersion],
            currentVersion: 0
          };
          currentChat.messages[messageIndex].isLoading = false;
          currentChat.messages[messageIndex].isStreaming = false;
          currentChat.messages[messageIndex].currentStep = undefined;

          // AI 메시지를 백엔드에 저장 (아티팩트 전체 내용 저장)
          await saveMessageToBackend(currentChat.id, false, reportContent, getModelName(chatMode.value));

          isStreaming.value = false;
          saveChatHistory();
          log.debug('Report artifact created:', artifactTitle, `(${wordCount} characters)`);
        } else {
          // 일반 답변 완료 - 텍스트 정규화 적용
          const normalizedText = normalizeWhitespace(responseText);
          currentChat.messages[messageIndex].text = normalizedText;
          currentChat.messages[messageIndex].isStreaming = false;
          currentChat.messages[messageIndex].currentStep = undefined;

          // AI 메시지를 백엔드에 저장
          await saveMessageToBackend(currentChat.id, false, normalizedText, getModelName(chatMode.value));

          isStreaming.value = false;
          saveChatHistory();
        }
      } else {
        // 에러 처리
        const errorMsg = currentChat.messages[messageIndex] as ChatMessage | undefined;
        if (errorMsg) {
          errorMsg.text = '응답을 받지 못했습니다. 다시 시도해주세요.';
          errorMsg.isStreaming = false;
          errorMsg.currentStep = undefined;
          errorMsg.hasError = true;
          isStreaming.value = false;
          saveChatHistory();
        }
      }

    } catch (error) {
      log.error("FastAPI call error:", error);
      
      let errorMessage = '죄송합니다. 오류가 발생했습니다.';
      
      // 사용자가 중지한 경우
      if ((error as Error).name === 'AbortError') {
        errorMessage = '답변이 중지되었습니다.';
        log.debug('Response stopped by user');
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = '서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
        log.error('Server connection failed: AI service may not be running.');
      } else if (error instanceof Error) {
        if (error.message.includes('CORS')) {
          errorMessage = '일시적인 연결 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message.includes('500')) {
          errorMessage = '서비스에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else {
          errorMessage = '연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
      }
      
      if (currentChat.messages[messageIndex]) {
        // 직접 속성 업데이트로 불필요한 리렌더링 방지
        currentChat.messages[messageIndex].text = errorMessage;
        currentChat.messages[messageIndex].isLoading = false;
        currentChat.messages[messageIndex].isStreaming = false;
        currentChat.messages[messageIndex].currentStep = undefined;
        currentChat.messages[messageIndex].hasError = true;
      }
      
      isStreaming.value = false;
    } finally {
      currentController = null; // controller 초기화
    }
  }

  async function callFastAPIRagChat(message: string, messageIndex: number) {
    // 스트리밍 엔드포인트 사용
    const apiUrl = `${FASTAPI_BASE_URL}/chat/stream`;
    log.debug("RAG FastAPI streaming call started:", apiUrl);
    log.debug("Query:", message);

    // 새로운 AbortController 생성
    currentController = new AbortController();

    const currentChat = chatHistory.value.find(c => c.id === currentChatId.value);
    if (!currentChat) {
      log.error("Current chat not found");
      return;
    }

    try {
      log.debug("RAG streaming fetch request started");
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: currentController.signal,
        body: JSON.stringify({
          message: message,
          session_id: currentChat.sessionId,
          mode: 'rag'
        })
      });

      log.debug("RAG streaming response status:", response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        log.error("RAG HTTP error response:", errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 스트리밍 모드 초기화
      if (currentChat.messages[messageIndex]) {
        currentChat.messages[messageIndex].text = '';
        currentChat.messages[messageIndex].isLoading = false;
        currentChat.messages[messageIndex].isStreaming = true;
        currentChat.messages[messageIndex].currentStep = '답변 생성 중...';
        currentChat.messages[messageIndex].hasError = false;
        currentChat.messages[messageIndex].modelName = "대학 정보 모델";
        currentChat.messages[messageIndex].ragSources = [];
      }

      isStreaming.value = true;
      messages.value = [...currentChat.messages];

      // SSE 스트리밍 처리
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponseText = '';

      if (!reader) {
        throw new Error("응답 스트림을 읽을 수 없습니다.");
      }

      // SSE 라인 처리 함수
      const processSSELine = (line: string) => {
        if (!line.trim() || !line.startsWith('data: ')) return;

        try {
          const jsonStr = line.slice(6);
          const data = JSON.parse(jsonStr);

          if (data.type === 'start') {
            // 세션 ID 저장
            if (data.session_id && currentChat) {
              currentChat.sessionId = data.session_id;
              log.debug("Session ID saved");
            }
          } else if (data.type === 'sources') {
            // RAG 소스 정보 저장
            if (currentChat.messages[messageIndex] && data.sources) {
              currentChat.messages[messageIndex].ragSources = data.sources.map((source: any) => ({
                title: source.title || '제목 없음',
                content: source.content || '',
                domain: 'eulji.ac.kr',
                category: source.category || '기타',
                score: source.score || 0
              }));
              log.debug("RAG sources received:", data.sources.length);
            }
          } else if (data.type === 'chunk') {
            // 실시간 스트리밍 청크 추가
            fullResponseText += data.content;
            if (currentChat.messages[messageIndex]) {
              currentChat.messages[messageIndex].text = fullResponseText;
              currentChat.messages[messageIndex].currentStep = undefined;
              messages.value = [...currentChat.messages];
            }
            setTimeout(() => scrollToBottom(), 10);
          } else if (data.type === 'done') {
            log.debug("RAG streaming completed");
          } else if (data.type === 'error') {
            throw new Error(data.error);
          }
        } catch (parseError) {
          log.warn("JSON parsing failed:", line, parseError);
        }
      };

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // 스트리밍 종료 시 버퍼에 남은 데이터 처리
          if (buffer.trim()) {
            log.debug("Processing remaining buffer:", buffer.substring(0, 100));
            processSSELine(buffer);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          processSSELine(line);
        }
      }

      // 스트리밍 완료 후 처리
      if (currentChat.messages[messageIndex]) {
        const normalizedAnswer = normalizeWhitespace(fullResponseText);

        // 빈 응답 처리
        if (!normalizedAnswer.trim()) {
          log.warn("RAG returned empty response");
          currentChat.messages[messageIndex].text = '관련 정보를 찾지 못했습니다. 다른 질문을 해보세요.';
          currentChat.messages[messageIndex].hasError = true;
        } else {
          currentChat.messages[messageIndex].text = normalizedAnswer;
        }

        currentChat.messages[messageIndex].isStreaming = false;
        currentChat.messages[messageIndex].currentStep = undefined;

        messages.value = [...currentChat.messages];

        // AI 메시지를 백엔드에 저장 (빈 응답이 아닌 경우만)
        if (normalizedAnswer.trim()) {
          await saveMessageToBackend(currentChat.id, false, normalizedAnswer, getModelName(chatMode.value));
        }
      }

      isStreaming.value = false;
      saveChatHistory();

    } catch (error: any) {
      log.error("RAG FastAPI call error:", error);

      let errorMessage = '을지대 정보검색에 문제가 발생했습니다.';

      if (error.name === 'AbortError') {
        log.debug("RAG search stopped by user");
        isStreaming.value = false;
        return;
      } else {
        if (error.message.includes('503')) {
          errorMessage = '을지대 정보검색 시스템이 초기화되지 않았습니다. 위의 초기화 버튼을 눌러주세요.';
        } else if (error.message.includes('404')) {
          errorMessage = '관련 정보를 찾을 수 없습니다. 다른 질문을 해보세요.';
        } else if (error.message.includes('500')) {
          errorMessage = '을지대 정보검색 서비스에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else {
          errorMessage = '을지대 정보검색 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
      }

      if (currentChat.messages[messageIndex]) {
        currentChat.messages[messageIndex].text = errorMessage;
        currentChat.messages[messageIndex].isLoading = false;
        currentChat.messages[messageIndex].isStreaming = false;
        currentChat.messages[messageIndex].currentStep = undefined;
        currentChat.messages[messageIndex].hasError = true;

        messages.value = [...currentChat.messages];
      }

      isStreaming.value = false;
    } finally {
      currentController = null;
    }
  }

  async function callFastAPIChatWithImages(message: string, images: File[], messageIndex: number) {
    log.debug("FastAPI call with files started:", message, "file count:", images.length);

    // 파일 타입 확인 로그
    images.forEach((file, idx) => {
      log.debug(`File ${idx + 1}: ${file.name}, type: ${file.type}, size: ${(file.size / 1024).toFixed(1)}KB`);
    });

    // 메시지 전처리: 상세 답변이 필요한 경우 보고서 스타일 지침 추가
    const preparedMessage = prepareMessageForAI(message, chatMode.value);
    if (preparedMessage !== message) {
      log.debug("Report style instruction added for image analysis");
      log.debug("Preprocessed message length:", preparedMessage.length, "chars");
    } else {
      log.debug("Normal mode message");
    }

    // 새로운 AbortController 생성
    currentController = new AbortController();

    const currentChat = chatHistory.value.find(c => c.id === currentChatId.value);
    if (!currentChat) {
      log.error("Current chat not found");
      return;
    }

    try {
      // FormData 생성
      const formData = new FormData();
      formData.append('message', preparedMessage);
      
      // 이미지들을 FormData에 추가
      images.forEach((image, _) => {
        formData.append('images', image);
      });

      const response = await fetch(`${FASTAPI_BASE_URL}/chat-with-images`, {
        method: 'POST',
        signal: currentController.signal,
        body: formData
      });

      log.debug("Image response status:", response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        log.error("HTTP error response:", errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      log.debug("Image FastAPI response received");
      
      if (currentChat.messages[messageIndex]) {
        currentChat.messages[messageIndex] = {
          ...currentChat.messages[messageIndex],
          text: '',
          isLoading: false,
          isStreaming: true,
          currentStep: undefined
        };
      }
      
      isStreaming.value = true;

      // 응답을 타이핑 효과로 표시 (이미지 채팅)
      if (data.success && data.response && data.response.trim()) {
        // 텍스트 정규화 적용
        const responseText = normalizeWhitespace(data.response.trim());
        let currentIndex = 0;

        const typeWriter = () => {
          if (!isStreaming.value) {
            if (currentChat.messages[messageIndex]) {
              currentChat.messages[messageIndex].isStreaming = false;
              saveChatHistory();
            }
            return;
          }

          if (currentIndex < responseText.length && currentChat.messages[messageIndex]) {
            currentChat.messages[messageIndex].text = responseText.substring(0, currentIndex + 1);
            currentIndex++;
            setTimeout(typeWriter, 20);
          } else if (currentChat.messages[messageIndex]) {
            currentChat.messages[messageIndex].isStreaming = false;
            isStreaming.value = false;

            // AI 메시지를 백엔드에 저장
            saveMessageToBackend(currentChat.id, false, responseText, getModelName(chatMode.value));

            saveChatHistory();
          }
        };

        typeWriter();
      } else {
        if (currentChat.messages[messageIndex]) {
          currentChat.messages[messageIndex].text = data.error || '이미지 분석 응답을 받지 못했습니다.';
          currentChat.messages[messageIndex].isStreaming = false;
          isStreaming.value = false;
          saveChatHistory();
        }
      }

    } catch (error) {
      log.error('Image FastAPI call error:', error);

      let errorMessage = '죄송합니다. 오류가 발생했습니다.';

      if ((error as Error).name === 'AbortError') {
        errorMessage = '답변이 중지되었습니다.';
        log.debug('Response stopped by user');
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = '서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
        log.error('Server connection failed: AI service may not be running.');
      } else if (error instanceof Error) {
        if (error.message.includes('413')) {
          errorMessage = '파일이 너무 큽니다. 20MB 이하의 파일을 업로드해주세요.';
        } else if (error.message.includes('400')) {
          errorMessage = '지원하지 않는 파일 형식입니다. 이미지(jpg, png, gif, webp) 또는 PDF 파일만 업로드 가능합니다.';
        } else if (error.message.includes('500')) {
          errorMessage = '파일 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else {
          errorMessage = '파일 처리에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
      }
      
      if (currentChat.messages[messageIndex]) {
        currentChat.messages[messageIndex].text = errorMessage;
        currentChat.messages[messageIndex].isLoading = false;
        currentChat.messages[messageIndex].isStreaming = false;
      }
      
      isStreaming.value = false;
    } finally {
      currentController = null;
    }
  }

  async function handleSend(inputValue: { value: string }, images?: File[]) {
    // 중복 전송 방지: 이미 전송 중이면 무시
    if (isSendingLock) {
      log.debug('handleSend blocked: already sending');
      return;
    }
    if ((!inputValue.value.trim() && !images?.length) || isLoading.value) return;

    // 락 설정 (가장 먼저)
    isSendingLock = true;

    const userMessageText = inputValue.value.trim();
    const currentChat = chatHistory.value.find(c => c.id === currentChatId.value);

    if (!currentChat) return;

    const isFirstMessage = currentChat.messages.length === 0;

    // 사용자 메시지 추가
    currentChat.messages.push({
      text: userMessageText,
      isUser: true,
      timestamp: new Date(),
      images: images,
      isLoading: false,
      isStreaming: false,
      hasError: false
    });

    // Vue 반응성을 위해 messages.value 즉시 업데이트 (사용자 메시지가 바로 보이도록)
    messages.value = [...currentChat.messages];

    // 사용자 메시지를 백엔드에 저장
    await saveMessageToBackend(currentChat.id, true, userMessageText, undefined);

    inputValue.value = '';
    // scrollToBottom will be called from the component

    isLoading.value = true;

    const loadingMessageIndex = currentChat.messages.length;

    // 다양한 로딩 메시지 (사용자가 대기 시간을 덜 느끼도록)
    const ragLoadingMessages = [
      "학교 데이터베이스를 검색하고 있어요...",
      "관련 정보를 찾고 있어요...",
      "최신 학교 자료를 확인하고 있어요...",
      "을지대 정보를 분석하고 있어요...",
      "공식 자료에서 답을 찾고 있어요...",
      "학교 문서를 꼼꼼히 살펴보고 있어요...",
      "정확한 정보를 준비하고 있어요...",
      "관련 공지사항을 확인하고 있어요...",
      "학교 시스템에서 검색 중이에요...",
      "필요한 정보를 수집하고 있어요..."
    ];

    const getRandomMessage = (messages: string[]) => {
      return messages[Math.floor(Math.random() * messages.length)];
    };

    const modeMessages: Record<ChatMode, string> = {
      rag: getRandomMessage(ragLoadingMessages)
    };

    // AI 로딩 메시지 추가
    currentChat.messages.push({
      text: modeMessages[chatMode.value] || "답변을 생성하고 있습니다...",
      isUser: false,
      timestamp: new Date(),
      isLoading: true,
      isStreaming: false,
      hasError: false,
      currentStep: modeMessages[chatMode.value] || "답변을 생성하고 있습니다...",
      modelName: getModelName(chatMode.value)  // 모델 이름 설정
    });

    // Vue 반응성을 위해 messages.value 즉시 업데이트 (로딩 메시지가 바로 보이도록)
    messages.value = [...currentChat.messages];

    // 로딩 메시지 로테이션 (RAG 모드에서 대기 시간을 덜 느끼도록)
    let loadingMessageInterval: ReturnType<typeof setInterval> | null = null;
    if (chatMode.value === 'rag') {
      const loadingMessages = ragLoadingMessages;
      let messageIndex = 0;

      loadingMessageInterval = setInterval(() => {
        if (currentChat.messages[loadingMessageIndex]?.isLoading) {
          messageIndex = (messageIndex + 1) % loadingMessages.length;
          const newMessage = loadingMessages[messageIndex];
          currentChat.messages[loadingMessageIndex].text = newMessage;
          currentChat.messages[loadingMessageIndex].currentStep = newMessage;
          messages.value = [...currentChat.messages];
        } else {
          // 로딩 완료 시 인터벌 정리
          if (loadingMessageInterval) {
            clearInterval(loadingMessageInterval);
            loadingMessageInterval = null;
          }
        }
      }, 2500); // 2.5초마다 메시지 변경
    }

    try {
      if (images && images.length > 0) {
        await callFastAPIChatWithImages(userMessageText, images, loadingMessageIndex);
      } else {
        // RAG 모드만 지원
        // RAG 모드: 초기화 상태 확인 및 필요시 자동 초기화
        if (!ragStatus.value.initialized && !ragStatus.value.isInitializing) {
          log.debug('RAG not initialized - starting auto-initialization');

          // 사용자에게 초기화 중임을 알림
          if (currentChat.messages[loadingMessageIndex]) {
            currentChat.messages[loadingMessageIndex].text = '을지대 정보검색 시스템을 초기화하고 있습니다...\n최초 실행 시 몇 분이 소요될 수 있습니다.';
            currentChat.messages[loadingMessageIndex].currentStep = 'RAG 시스템 초기화 중...';
          }

          const initSuccess = await initializeRag();

          if (!initSuccess) {
            throw new Error('RAG 시스템 초기화에 실패했습니다.\n\n현재 RAG 시스템이 올바르게 구성되지 않았습니다.\n관리자에게 문의하거나 다른 채팅 모드를 사용해주세요.');
          }

          log.debug('RAG auto-initialization completed');
        }

        await callFastAPIRagChat(userMessageText, loadingMessageIndex);
      }
      
      // 첫 번째 메시지인 경우 AI로 제목 생성 (비동기)
      if (isFirstMessage) {
        // 즉시 기본 제목 설정 (UI 블로킹 방지)
        const defaultTitle = userMessageText.substring(0, 20) + (userMessageText.length > 20 ? '...' : '');
        currentChat.title = defaultTitle;

        // 로그인된 사용자인 경우 기본 제목을 백엔드에 즉시 업데이트
        if (isAuthenticated() && currentChat.id) {
          updateChatTitle(currentChat.id, defaultTitle).catch(error => {
            log.error('Failed to update default title:', error);
          });
        }

        // 백그라운드에서 AI 제목 생성 (await 제거)
        generateChatTitle(userMessageText)
          .then(aiTitle => {
            // AI 제목으로 업데이트
            currentChat.title = aiTitle;

            // 로그인된 사용자인 경우 백엔드에도 업데이트
            if (isAuthenticated() && currentChat.id) {
              return updateChatTitle(currentChat.id, aiTitle);
            }
          })
          .then(() => {
            log.debug('AI-generated chat title applied');
            saveChatHistory(); // AI 제목 적용 후 로컬 스토리지 업데이트
          })
          .catch(error => {
            log.error('Failed to generate AI title, keeping default:', error);
            // 에러 발생 시 기본 제목 유지 (이미 설정됨)
          });
      }
    } catch (error) {
      log.error('FastAPI communication error:', error);
      if (currentChat.messages[loadingMessageIndex]) {
        currentChat.messages[loadingMessageIndex] = {
          text: "죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.",
          isUser: false,
          timestamp: new Date(),
          isLoading: false,
          isStreaming: false,
          hasError: true,
          modelName: getModelName(chatMode.value)  // 모델 이름 설정
        };
      }
    } finally {
      // 로딩 메시지 로테이션 인터벌 정리
      if (loadingMessageInterval) {
        clearInterval(loadingMessageInterval);
        loadingMessageInterval = null;
      }
      isLoading.value = false;
      isSendingLock = false; // 전송 락 해제
      saveChatHistory();
      // scrollToBottom will be called from the component
    }
  }

  async function setChatMode(mode: ChatMode) {
    // 같은 모드면 아무것도 하지 않음
    if (chatMode.value === mode) {
      return;
    }

    const previousMode = chatMode.value;
    chatMode.value = mode;

    // localStorage에 chatMode 저장
    localStorage.setItem('chatMode', mode);

    log.debug("Chat mode changed:", previousMode, "to", mode);

    // 현재 채팅에 메시지가 있으면 새 채팅 세션 시작
    const currentChat = chatHistory.value.find(c => c.id === currentChatId.value);
    if (currentChat && currentChat.messages && currentChat.messages.length > 0) {
      log.debug("Starting new chat session due to mode change");
      await startNewChat();
    }
  }

  function getChatModeInfo() {
    return { name: '대학 정보 모델', description: '을지대학교 공식 자료 기반 정보 검색' };
  }

  function stopResponse() {
    if (currentController) {
      currentController.abort(); // API 요청 중단
    }
    isStreaming.value = false; // 스트리밍 중단
    log.debug('Response stopped');
  }

  async function updateChatTitle(chatId: string, newTitle: string) {
    const chat = chatHistory.value.find(c => c.id === chatId);
    if (!chat) return;

    // 로그인된 사용자인 경우 백엔드에 업데이트
    if (isAuthenticated()) {
      try {
        log.debug(`Updating chat title (ID: ${chatId})`);
        const response = await apiRequest(`${BACKEND_BASE_URL}/chat/history/${chatId}`, {
          method: 'PUT',
          body: JSON.stringify({ title: newTitle })
        });

        if (response.ok) {
          log.debug('Chat title updated successfully');
        }
      } catch (error) {
        log.error('Failed to update chat title:', error);
        // 에러가 나도 로컬에서는 수정 진행
      }
    }

    // 로컬 상태 업데이트
    chat.title = newTitle;
    saveChatHistory();
    log.debug('Chat title updated locally:', newTitle);
  }

  // RAG 시스템 상태 확인
  async function checkRagStatus() {
    try {
      const response = await fetch(`${FASTAPI_BASE_URL}/rag/status`);
      if (response.ok) {
        const data = await response.json();
        ragStatus.value.initialized = data.initialized;
        ragStatus.value.systemInfo = data;
        ragStatus.value.error = null;
        log.debug("RAG status checked:", data.initialized);
        return data;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      log.error("RAG status check failed:", error);
      ragStatus.value.error = error.message;
      ragStatus.value.initialized = false;
      return null;
    }
  }

  // RAG 시스템 초기화
  async function initializeRag() {
    ragStatus.value.isInitializing = true;
    ragStatus.value.error = null;
    
    try {
      const response = await fetch(`${FASTAPI_BASE_URL}/rag/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        log.debug("RAG initialization successful");
        ragStatus.value.initialized = true;
        ragStatus.value.error = null;
        await checkRagStatus(); // 상태 업데이트
        return true;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      log.error("RAG initialization failed:", error);
      ragStatus.value.error = error.message;
      ragStatus.value.initialized = false;
      return false;
    } finally {
      ragStatus.value.isInitializing = false;
    }
  }

  return {
    messages,
    chatHistory,
    currentChatId,
    isLoading,
    isStreaming,
    chatMode,
    loadChatHistory,
    saveChatHistory,
    startNewChat,
    selectChat,
    deleteChat,
    handleSend,
    setChatMode,
    getChatModeInfo,
    stopResponse,
    updateChatTitle,
    // RAG 시스템 관련
    ragStatus,
    checkRagStatus,
    initializeRag,
  };
}
