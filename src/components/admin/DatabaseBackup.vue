<template>
  <div class="db-backup">
    <h2 class="section-title">데이터베이스 백업</h2>
    <p class="section-description">
      PostgreSQL 데이터베이스의 전체 또는 개별 테이블을 JSON 형식으로 백업합니다.
    </p>

    <!-- 전체 백업 카드 -->
    <div class="backup-card full-backup">
      <div class="card-header">
        <div class="card-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
          </svg>
        </div>
        <div class="card-info">
          <h3>전체 데이터베이스 백업</h3>
          <p>모든 테이블 데이터를 하나의 JSON 파일로 백업합니다.</p>
        </div>
      </div>
      <button
        class="backup-btn primary"
        @click="downloadFullBackup"
        :disabled="isDownloading"
      >
        <svg v-if="!isDownloading" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span v-if="isDownloading" class="spinner-small"></span>
        {{ isDownloading ? '다운로드 중...' : '전체 백업 다운로드' }}
      </button>
    </div>

    <!-- 테이블별 백업 -->
    <div class="table-backup-section">
      <h3 class="subsection-title">테이블별 백업</h3>
      <div class="tables-grid">
        <div
          v-for="table in tables"
          :key="table.name"
          class="table-card"
        >
          <div class="table-info">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="3" y1="15" x2="21" y2="15"></line>
              <line x1="9" y1="9" x2="9" y2="21"></line>
            </svg>
            <div>
              <span class="table-name">{{ table.displayName }}</span>
              <span class="table-count">{{ table.rowCount?.toLocaleString() || '-' }} rows</span>
            </div>
          </div>
          <button
            class="backup-btn small"
            @click="downloadTableBackup(table.name)"
            :disabled="downloadingTable === table.name"
          >
            <span v-if="downloadingTable === table.name" class="spinner-small"></span>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 백업 안내 -->
    <div class="backup-notice">
      <div class="notice-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      </div>
      <div class="notice-content">
        <strong>백업 안내</strong>
        <ul>
          <li>백업 파일은 JSON 형식으로 다운로드됩니다.</li>
          <li>비밀번호 해시는 보안을 위해 백업에서 제외됩니다.</li>
          <li>정기적으로 백업하여 데이터를 안전하게 보관하세요.</li>
        </ul>
      </div>
    </div>

    <!-- 성공/에러 메시지 -->
    <div v-if="message" :class="['message', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminAPI } from '../../services/api'

interface TableInfo {
  name: string
  displayName: string
  rowCount?: number
}

const tables = ref<TableInfo[]>([
  { name: 'member', displayName: '회원' },
  { name: 'chathistory', displayName: '채팅 세션' },
  { name: 'chatmessage', displayName: '채팅 메시지' },
  { name: 'feedback', displayName: '피드백' },
  { name: 'classroom', displayName: '강의실' },
  { name: 'classroomreservation', displayName: '강의실 예약' },
  { name: 'aisettings', displayName: 'AI 설정' },
  { name: 'qualitylog', displayName: '품질 로그' },
  { name: 'knowledgeentry', displayName: '지식 베이스' },
])

const isDownloading = ref(false)
const downloadingTable = ref<string | null>(null)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

// 테이블 정보 로드
const loadTableInfo = async () => {
  try {
    const response = await adminAPI.getTables()
    // 테이블 정보 업데이트 (row count 추가)
    for (const table of tables.value) {
      const info = response.tables.find(t => t.name === table.name)
      if (info) {
        table.rowCount = info.row_count
      }
    }
  } catch (error) {
    console.error('테이블 정보 로드 실패:', error)
  }
}

// 파일 다운로드 헬퍼
const downloadJson = (data: unknown, filename: string) => {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 타임스탬프 생성
const getTimestamp = () => {
  const now = new Date()
  return now.toISOString().slice(0, 19).replace(/[T:]/g, '-')
}

// 전체 백업 다운로드
const downloadFullBackup = async () => {
  isDownloading.value = true
  message.value = ''

  try {
    const data = await adminAPI.createFullBackup()
    const filename = `eulgpt_backup_full_${getTimestamp()}.json`
    downloadJson(data, filename)

    message.value = '전체 백업이 완료되었습니다.'
    messageType.value = 'success'
  } catch (error) {
    console.error('전체 백업 실패:', error)
    message.value = '백업 중 오류가 발생했습니다.'
    messageType.value = 'error'
  } finally {
    isDownloading.value = false
    setTimeout(() => { message.value = '' }, 5000)
  }
}

// 개별 테이블 백업 다운로드
const downloadTableBackup = async (tableName: string) => {
  downloadingTable.value = tableName
  message.value = ''

  try {
    const data = await adminAPI.backupTable(tableName)
    const filename = `eulgpt_backup_${tableName}_${getTimestamp()}.json`
    downloadJson(data, filename)

    const tableDisplayName = tables.value.find(t => t.name === tableName)?.displayName || tableName
    message.value = `${tableDisplayName} 테이블 백업이 완료되었습니다.`
    messageType.value = 'success'
  } catch (error) {
    console.error(`${tableName} 백업 실패:`, error)
    message.value = '백업 중 오류가 발생했습니다.'
    messageType.value = 'error'
  } finally {
    downloadingTable.value = null
    setTimeout(() => { message.value = '' }, 5000)
  }
}

onMounted(() => {
  loadTableInfo()
})
</script>

<style scoped>
.db-backup {
  max-width: 1000px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 8px;
}

.section-description {
  color: #6b7280;
  margin-bottom: 24px;
}

/* 전체 백업 카드 */
.backup-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.backup-card.full-backup {
  background: linear-gradient(135deg, #eff6ff 0%, #fff 100%);
  border-color: #bfdbfe;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: #02478A;
  border-radius: 12px;
  color: #fff;
}

.card-info h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
}

.card-info p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

/* 백업 버튼 */
.backup-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: #02478A;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.backup-btn:hover:not(:disabled) {
  background: #023663;
}

.backup-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.backup-btn.small {
  padding: 8px 12px;
  font-size: 13px;
}

.backup-btn.primary {
  padding: 14px 28px;
}

/* 테이블별 백업 */
.subsection-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16px;
}

.tables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 32px;
}

.table-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  transition: all 0.2s;
}

.table-card:hover {
  border-color: #02478A;
  box-shadow: 0 2px 8px rgba(2, 71, 138, 0.1);
}

.table-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.table-info svg {
  color: #6b7280;
}

.table-info > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.table-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.table-count {
  font-size: 12px;
  color: #9ca3af;
}

/* 백업 안내 */
.backup-notice {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: #fefce8;
  border: 1px solid #fef08a;
  border-radius: 10px;
  margin-bottom: 24px;
}

.notice-icon {
  flex-shrink: 0;
  color: #ca8a04;
}

.notice-content strong {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #854d0e;
  margin-bottom: 8px;
}

.notice-content ul {
  margin: 0;
  padding-left: 20px;
  color: #a16207;
  font-size: 13px;
  line-height: 1.8;
}

/* 메시지 */
.message {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  margin-top: 16px;
}

.message.success {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
}

.message.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

/* 스피너 */
.spinner-small {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 반응형 */
@media (max-width: 768px) {
  .backup-card {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .card-header {
    flex-direction: column;
  }

  .tables-grid {
    grid-template-columns: 1fr;
  }

  .backup-notice {
    flex-direction: column;
    text-align: center;
  }
}
</style>
