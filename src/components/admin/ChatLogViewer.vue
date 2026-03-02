<template>
  <div class="chat-log-viewer">
    <div class="header">
      <h2 class="section-title">채팅 기록 관리</h2>
      <button class="export-all-btn" @click="showExportModal = true">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        기간별 내보내기
      </button>
    </div>

    <div class="viewer-layout">
      <!-- 채팅 세션 목록 -->
      <div class="sessions-panel">
        <div class="panel-header">
          <h3>채팅 세션</h3>
          <span class="session-count">{{ total }}개</span>
        </div>

        <!-- 날짜 필터 -->
        <div class="date-filter">
          <div class="date-input-group">
            <label>시작일</label>
            <input type="date" v-model="startDate" @change="handleDateFilter" />
          </div>
          <div class="date-input-group">
            <label>종료일</label>
            <input type="date" v-model="endDate" @change="handleDateFilter" />
          </div>
          <button v-if="startDate || endDate" class="clear-filter-btn" @click="clearDateFilter" title="필터 초기화">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="search-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="제목, 사용자 검색..."
            @input="debouncedSearch"
          />
        </div>

        <div v-if="loadingSessions" class="loading-state">
          <div class="spinner"></div>
        </div>

        <div v-else class="sessions-list">
          <div
            v-for="session in sessions"
            :key="session.id"
            class="session-card"
            :class="{ active: selectedSession?.id === session.id }"
            @click="selectSession(session)"
          >
            <div class="session-info">
              <span class="session-title">{{ session.title || '제목 없음' }}</span>
              <span class="session-meta">
                <span class="user-badge">{{ getUserDisplayName(session) }}</span>
                <span class="message-count">{{ session.message_count }}개 메시지</span>
              </span>
            </div>
            <span class="session-date">{{ formatDate(session.created_at) }}</span>
          </div>

          <div v-if="sessions.length === 0" class="empty-state">
            채팅 세션이 없습니다
          </div>
        </div>

        <!-- 페이지네이션 -->
        <div v-if="totalPages > 1" class="pagination">
          <button :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">이전</button>
          <span>{{ currentPage }} / {{ totalPages }}</span>
          <button :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">다음</button>
        </div>
      </div>

      <!-- 채팅 내용 -->
      <div class="chat-panel">
        <div v-if="selectedSession && chatDetail" class="chat-content">
          <div class="chat-header">
            <div class="chat-info">
              <h3>{{ chatDetail.title || '제목 없음' }}</h3>
              <span class="chat-meta">
                사용자: {{ getUserDisplayName(chatDetail) }}
                <span v-if="chatDetail.user?.email" class="user-email">({{ chatDetail.user.email }})</span>
                <span v-if="chatDetail.created_at"> | 생성: {{ formatDateFull(chatDetail.created_at) }}</span>
              </span>
            </div>
            <div class="chat-actions">
              <button class="action-btn" @click="exportChat" title="내보내기">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
              <button class="action-btn delete" @click="confirmDeleteSession" title="세션 삭제">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>

          <div v-if="loadingMessages" class="loading-state">
            <div class="spinner"></div>
            <span>메시지 로딩 중...</span>
          </div>

          <div v-else class="messages-container">
            <div
              v-for="(message, idx) in chatDetail.messages"
              :key="idx"
              class="message-bubble"
              :class="{ 'user-message': message.is_user, 'ai-message': !message.is_user }"
            >
              <div class="message-header">
                <span class="sender">
                  {{ message.is_user ? '사용자' : 'AI' }}
                  <span v-if="!message.is_user && message.model_name" class="model-badge">
                    {{ getModelDisplayName(message.model_name) }}
                  </span>
                </span>
                <span v-if="message.created_at" class="message-time">
                  {{ formatTime(message.created_at) }}
                </span>
              </div>
              <div class="message-body" v-html="formatMessage(message.message)"></div>
            </div>

            <div v-if="chatDetail.messages.length === 0" class="empty-messages">
              이 세션에 메시지가 없습니다
            </div>
          </div>
        </div>

        <div v-else class="select-prompt">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>왼쪽에서 채팅 세션을 선택하세요</p>
        </div>
      </div>
    </div>

    <!-- 삭제 확인 모달 -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal-content">
        <h3>세션 삭제</h3>
        <p>이 채팅 세션과 모든 메시지를 삭제하시겠습니까?</p>
        <p class="delete-warning">이 작업은 되돌릴 수 없습니다.</p>
        <div class="modal-actions">
          <button class="cancel-btn" @click="showDeleteModal = false">취소</button>
          <button class="confirm-delete-btn" :disabled="deleting" @click="deleteSession">
            {{ deleting ? '삭제 중...' : '삭제' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 기간별 내보내기 모달 -->
    <div v-if="showExportModal" class="modal-overlay" @click.self="showExportModal = false">
      <div class="modal-content export-modal">
        <h3>채팅 기록 내보내기</h3>
        <p class="export-description">선택한 기간의 모든 채팅 기록을 JSON 파일로 내보냅니다.</p>

        <div class="export-form">
          <div class="export-date-row">
            <div class="export-date-group">
              <label>시작일</label>
              <input type="date" v-model="exportStartDate" />
            </div>
            <div class="export-date-group">
              <label>종료일</label>
              <input type="date" v-model="exportEndDate" />
            </div>
          </div>
          <p class="export-note">* 최대 90일까지 내보내기 가능합니다.</p>
        </div>

        <div class="modal-actions">
          <button class="cancel-btn" @click="showExportModal = false">취소</button>
          <button
            class="export-btn"
            :disabled="!exportStartDate || !exportEndDate || exporting"
            @click="handleBulkExport"
          >
            {{ exporting ? '내보내기 중...' : '내보내기' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminAPI, type ChatHistoryListItem, type ChatHistoryDetailAdmin } from '../../services/api'
import { marked } from 'marked'

const sessions = ref<ChatHistoryListItem[]>([])
const selectedSession = ref<ChatHistoryListItem | null>(null)
const chatDetail = ref<ChatHistoryDetailAdmin | null>(null)
const loadingSessions = ref(false)
const loadingMessages = ref(false)
const searchQuery = ref('')
const currentPage = ref(1)
const totalPages = ref(1)
const total = ref(0)
const showDeleteModal = ref(false)
const deleting = ref(false)

// 날짜 필터
const startDate = ref('')
const endDate = ref('')

// 내보내기 모달
const showExportModal = ref(false)
const exportStartDate = ref('')
const exportEndDate = ref('')
const exporting = ref(false)

let searchTimeout: ReturnType<typeof setTimeout> | null = null

const loadSessions = async () => {
  loadingSessions.value = true
  try {
    const response = await adminAPI.getChatHistories({
      page: currentPage.value,
      limit: 20,
      search: searchQuery.value || undefined,
      start_date: startDate.value || undefined,
      end_date: endDate.value || undefined,
    })

    sessions.value = response.items
    totalPages.value = response.total_pages
    total.value = response.total
  } catch (error) {
    console.error('채팅 세션 로드 실패:', error)
  } finally {
    loadingSessions.value = false
  }
}

const handleDateFilter = () => {
  currentPage.value = 1
  loadSessions()
}

const clearDateFilter = () => {
  startDate.value = ''
  endDate.value = ''
  currentPage.value = 1
  loadSessions()
}

const handleBulkExport = async () => {
  if (!exportStartDate.value || !exportEndDate.value) return

  exporting.value = true
  try {
    const response = await adminAPI.exportChatHistories(exportStartDate.value, exportEndDate.value)

    // JSON 파일 다운로드
    const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat_export_${exportStartDate.value}_${exportEndDate.value}.json`
    a.click()
    URL.revokeObjectURL(url)

    showExportModal.value = false
    alert(`내보내기 완료: ${response.total_sessions}개 세션, ${response.total_messages}개 메시지`)
  } catch (error: unknown) {
    console.error('내보내기 실패:', error)
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    alert(`내보내기 실패: ${errorMessage}`)
  } finally {
    exporting.value = false
  }
}

const selectSession = async (session: ChatHistoryListItem) => {
  selectedSession.value = session
  loadingMessages.value = true
  chatDetail.value = null

  try {
    const detail = await adminAPI.getChatHistoryDetail(session.id)
    chatDetail.value = detail
  } catch (error) {
    console.error('채팅 상세 로드 실패:', error)
  } finally {
    loadingMessages.value = false
  }
}

const getUserDisplayName = (item: ChatHistoryListItem | ChatHistoryDetailAdmin): string => {
  if (item.user) {
    return item.user.nickname || item.user.name || `사용자 #${item.user_id}`
  }
  return `사용자 #${item.user_id}`
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '-'

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDay === 0) {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDay < 7) {
      return `${diffDay}일 전`
    } else {
      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    }
  } catch {
    return '-'
  }
}

const formatDateFull = (dateStr: string | null): string => {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleString('ko-KR')
  } catch {
    return '-'
  }
}

const formatTime = (dateStr: string | null): string => {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const getModelDisplayName = (modelName: string | null): string => {
  if (!modelName) return ''

  const displayNames: Record<string, string> = {
    '통합 모델': '💬 일반',
    '깊은 추론 모델': '🧠 CoT',
    '대학 정보 검색 모델': '🔍 RAG',
    'general': '💬 일반',
    'cot': '🧠 CoT',
    'rag': '🔍 RAG',
    'study': '📚 학습',
    'career': '💼 진로',
  }

  return displayNames[modelName] || modelName
}

const formatMessage = (message: string): string => {
  try {
    return marked.parse(message) as string
  } catch {
    return message
  }
}

const debouncedSearch = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    loadSessions()
  }, 300)
}

const goToPage = (page: number) => {
  currentPage.value = page
  loadSessions()
}

const exportChat = () => {
  if (!chatDetail.value || chatDetail.value.messages.length === 0) return

  let content = `채팅 세션: ${chatDetail.value.title}\n`
  content += `사용자: ${getUserDisplayName(chatDetail.value)}`
  if (chatDetail.value.user?.email) {
    content += ` (${chatDetail.value.user.email})`
  }
  content += `\n`
  content += `생성일: ${formatDateFull(chatDetail.value.created_at)}\n`
  content += `${'='.repeat(50)}\n\n`

  for (const msg of chatDetail.value.messages) {
    const sender = msg.is_user ? '[사용자]' : `[AI${msg.model_name ? ` - ${msg.model_name}` : ''}]`
    content += `${sender}\n${msg.message}\n\n`
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `chat_${chatDetail.value.id}_${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

const confirmDeleteSession = () => {
  showDeleteModal.value = true
}

const deleteSession = async () => {
  if (!selectedSession.value) return

  deleting.value = true
  try {
    await adminAPI.deleteChatHistory(selectedSession.value.id)

    showDeleteModal.value = false
    selectedSession.value = null
    chatDetail.value = null

    // 목록 새로고침
    await loadSessions()
  } catch (error) {
    console.error('세션 삭제 실패:', error)
    alert('세션 삭제에 실패했습니다.')
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  await loadSessions()
})
</script>

<style scoped>
.chat-log-viewer {
  max-width: 1400px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.export-all-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #02478A;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.export-all-btn:hover {
  background: #023663;
}

.viewer-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 20px;
  height: calc(100vh - 200px);
  min-height: 500px;
}

/* 날짜 필터 */
.date-filter {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.date-input-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.date-input-group label {
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
}

.date-input-group input {
  padding: 6px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 12px;
  width: 100%;
}

.date-input-group input:focus {
  outline: none;
  border-color: #02478A;
}

.clear-filter-btn {
  display: flex;
  align-items: flex-end;
  padding: 6px;
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-filter-btn:hover {
  background: #fef2f2;
  border-color: #ef4444;
  color: #ef4444;
}

/* 세션 패널 */
.sessions-panel {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.panel-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.session-count {
  font-size: 13px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 4px 10px;
  border-radius: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.search-box svg {
  color: #9ca3af;
  flex-shrink: 0;
}

.search-box input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
}

.session-card {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 14px 16px;
  margin-bottom: 8px;
  background: #f9fafb;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.session-card:hover {
  background: #f3f4f6;
  border-color: #e5e7eb;
}

.session-card.active {
  background: #eff6ff;
  border-color: #02478A;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.session-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
}

.user-badge {
  background: #e5e7eb;
  padding: 2px 8px;
  border-radius: 4px;
}

.session-date {
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
}

/* 채팅 패널 */
.chat-panel {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.chat-info h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 6px 0;
}

.chat-meta {
  font-size: 13px;
  color: #6b7280;
}

.user-email {
  color: #9ca3af;
}

.chat-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.action-btn.delete:hover {
  background: #fef2f2;
  border-color: #ef4444;
  color: #ef4444;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-bubble {
  max-width: 85%;
  padding: 14px 18px;
  border-radius: 16px;
}

.user-message {
  align-self: flex-end;
  background: #02478A;
  color: #fff;
}

.ai-message {
  align-self: flex-start;
  background: #f3f4f6;
  color: #1f2937;
}

.model-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  opacity: 0.9;
}

.user-message .model-badge {
  background: rgba(255, 255, 255, 0.3);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.sender {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.8;
}

.user-message .sender {
  color: rgba(255, 255, 255, 0.8);
}

.message-time {
  font-size: 11px;
  opacity: 0.6;
}

.user-message .message-time {
  color: rgba(255, 255, 255, 0.6);
}

.message-body {
  font-size: 14px;
  line-height: 1.6;
}

.message-body :deep(p) {
  margin: 0 0 8px 0;
}

.message-body :deep(p:last-child) {
  margin-bottom: 0;
}

.message-body :deep(ul),
.message-body :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.message-body :deep(code) {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', monospace;
  font-size: 13px;
}

.user-message .message-body :deep(code) {
  background: rgba(255, 255, 255, 0.2);
}

.message-body :deep(pre) {
  background: #1f2937;
  color: #e5e7eb;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 8px 0;
}

.message-body :deep(pre code) {
  background: transparent;
  padding: 0;
}

.empty-messages {
  text-align: center;
  color: #9ca3af;
  padding: 48px;
}

/* 선택 안내 */
.select-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: #9ca3af;
}

.select-prompt p {
  font-size: 16px;
}

/* 로딩 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: #6b7280;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #02478A;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 페이지네이션 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-top: 1px solid #e5e7eb;
}

.pagination button {
  padding: 6px 14px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
}

.pagination button:hover:not(:disabled) {
  background: #f3f4f6;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination span {
  font-size: 13px;
  color: #6b7280;
}

/* 빈 상태 */
.empty-state {
  text-align: center;
  color: #9ca3af;
  padding: 32px;
  font-size: 14px;
}

/* 모달 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  max-width: 400px;
  width: 90%;
}

.modal-content h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
}

.modal-content p {
  color: #6b7280;
  margin-bottom: 8px;
}

.delete-warning {
  color: #ef4444 !important;
  font-size: 13px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.cancel-btn {
  padding: 10px 20px;
  background: #f3f4f6;
  border: none;
  border-radius: 8px;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
}

.confirm-delete-btn {
  padding: 10px 20px;
  background: #ef4444;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.confirm-delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 내보내기 모달 */
.export-modal {
  max-width: 450px;
}

.export-description {
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 20px;
}

.export-form {
  margin-bottom: 20px;
}

.export-date-row {
  display: flex;
  gap: 16px;
}

.export-date-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.export-date-group label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.export-date-group input {
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
}

.export-date-group input:focus {
  outline: none;
  border-color: #02478A;
  box-shadow: 0 0 0 3px rgba(2, 71, 138, 0.1);
}

.export-note {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 12px;
}

.export-btn {
  padding: 10px 20px;
  background: #02478A;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.export-btn:hover:not(:disabled) {
  background: #023663;
}

.export-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 반응형 */
@media (max-width: 900px) {
  .viewer-layout {
    grid-template-columns: 1fr;
    height: auto;
  }

  .sessions-panel {
    max-height: 300px;
  }

  .chat-panel {
    min-height: 400px;
  }
}
</style>
