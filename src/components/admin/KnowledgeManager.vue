<template>
  <div class="knowledge-manager">
    <!-- 헤더 -->
    <div class="header">
      <div class="header-left">
        <h2 class="section-title">지식 관리</h2>
        <span v-if="lastIndexedTime" class="last-indexed">
          마지막 인덱싱: {{ formatLastIndexed(lastIndexedTime) }}
        </span>
      </div>
      <div class="header-actions">
        <button
          class="import-btn"
          @click="handleImport"
          :disabled="isImporting"
        >
          <svg v-if="!isImporting" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <span v-if="isImporting" class="spinner-small"></span>
          {{ isImporting ? 'JSON 임포트 중...' : 'JSON 임포트' }}
        </button>
        <button
          class="reindex-btn"
          :class="{ indexing: isReindexing }"
          @click="handleReindex"
          :disabled="isReindexing"
        >
          <svg v-if="!isReindexing" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span v-if="isReindexing" class="spinner-small"></span>
          {{ isReindexing ? `재인덱싱 중... ${reindexProgress}%` : '재인덱싱' }}
        </button>
      </div>
    </div>

    <!-- 재인덱싱 상태 표시 -->
    <div v-if="reindexStatus && ['running', 'pending'].includes(reindexStatus.status)" class="reindex-status">
      <div class="status-bar">
        <div class="status-progress" :style="{ width: `${reindexProgress}%` }"></div>
      </div>
      <span class="status-message">{{ reindexStatus.message || '처리 중...' }}</span>
    </div>

    <!-- 파일 탭 -->
    <div class="file-tabs">
      <button
        v-for="file in files"
        :key="file.name"
        class="file-tab"
        :class="{ active: selectedFile === file.name }"
        @click="selectFile(file.name)"
      >
        <span class="tab-name">{{ file.display_name }}</span>
        <span class="tab-count">{{ file.entry_count.toLocaleString() }}</span>
      </button>
    </div>

    <!-- 검색 및 필터 -->
    <div v-if="selectedFile" class="controls">
      <div class="search-box">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="검색..."
          @input="debouncedSearch"
        />
      </div>

      <select v-if="categories.length > 0" v-model="selectedCategory" class="filter-select" @change="loadEntries">
        <option value="">전체 카테고리</option>
        <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
      </select>

      <select v-if="campuses.length > 0" v-model="selectedCampus" class="filter-select" @change="loadEntries">
        <option value="">전체 캠퍼스</option>
        <option v-for="campus in campuses" :key="campus" :value="campus">{{ campus }}</option>
      </select>

      <button v-if="canCreate" class="add-btn" @click="openCreateModal">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        새 항목
      </button>
    </div>

    <!-- 로딩 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>데이터를 불러오는 중...</span>
    </div>

    <!-- 데이터 테이블 -->
    <div v-else-if="entries.length > 0" class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-title">제목</th>
            <th class="col-category">카테고리</th>
            <th v-if="showCampusColumn" class="col-campus">캠퍼스</th>
            <th class="col-content">내용 미리보기</th>
            <th class="col-uploader">작성자</th>
            <th class="col-actions">작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.id">
            <td class="col-title">
              <span class="entry-title" @click="openViewModal(entry)">{{ entry.title }}</span>
            </td>
            <td class="col-category">
              <span v-if="entry.category" class="category-badge">{{ truncate(entry.category, 20) }}</span>
            </td>
            <td v-if="showCampusColumn" class="col-campus">
              <span v-if="entry.campus" class="campus-badge">{{ entry.campus }}</span>
            </td>
            <td class="col-content">
              <span class="content-preview">{{ truncate(entry.content, 100) }}</span>
            </td>
            <td class="col-uploader">
              <div v-if="entry.uploaded_by || entry.updated_by" class="uploader-info">
                <span v-if="entry.updated_by" class="uploader-name" :title="`수정: ${entry.updated_by}`">
                  {{ entry.updated_by_name || entry.updated_by.split('@')[0] }}
                </span>
                <span v-else-if="entry.uploaded_by" class="uploader-name" :title="`등록: ${entry.uploaded_by}`">
                  {{ entry.uploaded_by_name || entry.uploaded_by.split('@')[0] }}
                </span>
                <span v-if="entry.updated_at" class="uploader-date">{{ formatDate(entry.updated_at) }}</span>
                <span v-else-if="entry.uploaded_at" class="uploader-date">{{ formatDate(entry.uploaded_at) }}</span>
              </div>
              <span v-else class="no-uploader">-</span>
            </td>
            <td class="col-actions">
              <button class="action-btn view" @click="openViewModal(entry)" title="보기">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button v-if="canEdit" class="action-btn edit" @click="openEditModal(entry)" title="수정">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button v-if="canDelete" class="action-btn delete" @click="confirmDelete(entry)" title="삭제">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 빈 상태 -->
    <div v-else-if="selectedFile && !loading" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
      <p>데이터가 없습니다</p>
    </div>

    <!-- 파일 선택 안내 -->
    <div v-else class="select-prompt">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
      <p>위에서 파일을 선택하세요</p>
    </div>

    <!-- 페이지네이션 -->
    <div v-if="totalPages > 1" class="pagination">
      <button class="page-btn" :disabled="currentPage === 1" @click="goToPage(1)">처음</button>
      <button class="page-btn" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">이전</button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }} (총 {{ total.toLocaleString() }}건)</span>
      <button class="page-btn" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">다음</button>
      <button class="page-btn" :disabled="currentPage === totalPages" @click="goToPage(totalPages)">마지막</button>
    </div>

    <!-- 보기/수정 모달 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content large">
        <div class="modal-header">
          <h3>{{ modalMode === 'view' ? '항목 상세' : modalMode === 'create' ? '새 항목 추가' : '항목 수정' }}</h3>
          <button class="close-btn" @click="closeModal">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <!-- 보기 모드 -->
          <div v-if="modalMode === 'view'" class="view-content">
            <div class="field-group">
              <label>제목</label>
              <div class="field-value">{{ selectedEntry?.title }}</div>
            </div>
            <div v-if="selectedEntry?.category" class="field-group">
              <label>카테고리</label>
              <div class="field-value">{{ selectedEntry.category }}</div>
            </div>
            <div v-if="selectedEntry?.campus" class="field-group">
              <label>캠퍼스</label>
              <div class="field-value">{{ selectedEntry.campus }}</div>
            </div>
            <div class="field-group">
              <label>내용</label>
              <div class="field-value content-full">{{ selectedEntry?.content }}</div>
            </div>
            <!-- 업로더 정보 -->
            <div v-if="selectedEntry?.uploaded_by || selectedEntry?.updated_by" class="uploader-section">
              <div v-if="selectedEntry?.uploaded_by" class="field-group">
                <label>등록자</label>
                <div class="field-value uploader-detail">
                  <span class="uploader-email">{{ selectedEntry.uploaded_by }}</span>
                  <span v-if="selectedEntry.uploaded_by_name" class="uploader-name-detail">({{ selectedEntry.uploaded_by_name }})</span>
                  <span v-if="selectedEntry.uploaded_at" class="uploader-time">{{ formatDateTime(selectedEntry.uploaded_at) }}</span>
                </div>
              </div>
              <div v-if="selectedEntry?.updated_by" class="field-group">
                <label>최근 수정자</label>
                <div class="field-value uploader-detail">
                  <span class="uploader-email">{{ selectedEntry.updated_by }}</span>
                  <span v-if="selectedEntry.updated_by_name" class="uploader-name-detail">({{ selectedEntry.updated_by_name }})</span>
                  <span v-if="selectedEntry.updated_at" class="uploader-time">{{ formatDateTime(selectedEntry.updated_at) }}</span>
                </div>
              </div>
            </div>
            <div class="field-group">
              <label>원본 데이터</label>
              <pre class="raw-data">{{ JSON.stringify(selectedEntry?.raw_data, null, 2) }}</pre>
            </div>
          </div>

          <!-- 편집 모드 -->
          <form v-else @submit.prevent="handleSubmit" class="edit-form">
            <!-- static_info 필드 -->
            <template v-if="selectedFile === 'static_info'">
              <div class="field-group">
                <label for="title">제목 *</label>
                <input id="title" v-model="formData['제목']" type="text" required />
              </div>
              <div class="field-group">
                <label for="content">내용 *</label>
                <textarea id="content" v-model="formData['내용']" rows="8" required></textarea>
              </div>
              <div class="field-group">
                <label for="category">카테고리 *</label>
                <input id="category" v-model="formData['카테고리']" type="text" required />
              </div>
              <div class="field-group">
                <label for="subcategory">서브카테고리</label>
                <input id="subcategory" v-model="formData['서브카테고리']" type="text" />
              </div>
              <div class="field-group">
                <label for="campus">캠퍼스</label>
                <select id="campus" v-model="formData['캠퍼스']">
                  <option value="">선택 안함</option>
                  <option value="성남">성남</option>
                  <option value="대전">대전</option>
                  <option value="의정부">의정부</option>
                  <option value="전체">전체</option>
                </select>
              </div>
            </template>

            <!-- calendar 필드 -->
            <template v-else-if="selectedFile === 'calendar'">
              <div class="field-group">
                <label for="schedule_name">일정명 *</label>
                <input id="schedule_name" v-model="formData['일정명']" type="text" required />
              </div>
              <div class="field-group">
                <label for="description">설명</label>
                <textarea id="description" v-model="formData['설명']" rows="4"></textarea>
              </div>
              <div class="field-row">
                <div class="field-group">
                  <label for="start_date">시작일 *</label>
                  <input id="start_date" v-model="formData['시작일']" type="date" required />
                </div>
                <div class="field-group">
                  <label for="end_date">종료일</label>
                  <input id="end_date" v-model="formData['종료일']" type="date" />
                </div>
              </div>
              <div class="field-row">
                <div class="field-group">
                  <label for="year">학년도</label>
                  <input id="year" v-model="formData['학년도']" type="text" placeholder="2025" />
                </div>
                <div class="field-group">
                  <label for="semester">학기</label>
                  <input id="semester" v-model="formData['학기']" type="text" placeholder="1학기" />
                </div>
              </div>
              <div class="field-group">
                <label for="campus">캠퍼스</label>
                <select id="campus" v-model="formData['캠퍼스']">
                  <option value="">선택 안함</option>
                  <option value="성남">성남</option>
                  <option value="대전">대전</option>
                  <option value="의정부">의정부</option>
                  <option value="전체">전체</option>
                </select>
              </div>
            </template>

            <!-- lecture_reviews 필드 -->
            <template v-else-if="selectedFile === 'lecture_reviews'">
              <div class="field-group">
                <label for="lecture_name">강의명 *</label>
                <input id="lecture_name" v-model="formData['강의명']" type="text" required />
              </div>
              <div class="field-group">
                <label for="rating">평점 평균</label>
                <input id="rating" v-model.number="formData['평점_평균']" type="number" step="0.01" min="0" max="5" />
              </div>
              <div class="field-group">
                <label for="summary">요약총평 *</label>
                <textarea id="summary" v-model="formData['요약총평']" rows="10" required></textarea>
              </div>
            </template>

            <div class="form-actions">
              <button type="button" class="cancel-btn" @click="closeModal">취소</button>
              <button type="submit" class="submit-btn" :disabled="submitting">
                {{ submitting ? '저장 중...' : '저장' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 삭제 확인 모달 -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal-content small">
        <h3>삭제 확인</h3>
        <p>정말로 이 항목을 삭제하시겠습니까?</p>
        <p class="delete-warning">이 작업은 되돌릴 수 없습니다.</p>
        <div class="modal-actions">
          <button class="cancel-btn" @click="showDeleteModal = false">취소</button>
          <button class="confirm-delete-btn" @click="handleDelete" :disabled="submitting">
            {{ submitting ? '삭제 중...' : '삭제' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 토스트 알림 -->
    <div v-if="toast.show" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { knowledgeAPI, type KnowledgeFile, type KnowledgeEntry } from '../../services/api'

// 상태
const files = ref<KnowledgeFile[]>([])
const selectedFile = ref<string | null>(null)
const entries = ref<KnowledgeEntry[]>([])
const loading = ref(false)
const currentPage = ref(1)
const total = ref(0)
const totalPages = ref(0)
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedCampus = ref('')
const categories = ref<string[]>([])
const campuses = ref<string[]>([])

// 모달 상태
const showModal = ref(false)
const modalMode = ref<'view' | 'create' | 'edit'>('view')
const selectedEntry = ref<KnowledgeEntry | null>(null)
const formData = ref<Record<string, unknown>>({})
const submitting = ref(false)

// 삭제 모달
const showDeleteModal = ref(false)
const entryToDelete = ref<KnowledgeEntry | null>(null)

// 재인덱싱 상태
const isReindexing = ref(false)
const reindexProgress = ref(0)
const reindexStatus = ref<{ status: string; progress: number; message: string | null } | null>(null)
const lastIndexedTime = ref<string | null>(null)

// JSON 임포트 상태
const isImporting = ref(false)

// 토스트
const toast = ref({ show: false, type: 'success', message: '' })

let searchTimeout: ReturnType<typeof setTimeout> | null = null

// 계산된 속성
const showCampusColumn = computed(() => {
  return ['static_info', 'calendar'].includes(selectedFile.value || '')
})

const canCreate = computed(() => {
  return ['static_info', 'calendar', 'lecture_reviews'].includes(selectedFile.value || '')
})

const canEdit = computed(() => {
  return ['static_info', 'calendar', 'lecture_reviews'].includes(selectedFile.value || '')
})

const canDelete = computed(() => {
  return ['static_info', 'calendar', 'lecture_reviews'].includes(selectedFile.value || '')
})

// 함수
const truncate = (text: string, length: number): string => {
  if (!text) return ''
  return text.length > length ? text.slice(0, length) + '...' : text
}

const formatDate = (dateString: string): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric'
  })
}

const formatDateTime = (dateString: string): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatLastIndexed = (dateString: string | null): string => {
  if (!dateString) return '알 수 없음'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '알 수 없음'

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`

    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '알 수 없음'
  }
}

const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  toast.value = { show: true, type, message }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

const loadFiles = async () => {
  try {
    files.value = await knowledgeAPI.getFiles()
  } catch (error) {
    console.error('파일 목록 로드 실패:', error)
    showToast('파일 목록을 불러올 수 없습니다.', 'error')
  }
}

const selectFile = async (fileName: string) => {
  selectedFile.value = fileName
  currentPage.value = 1
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedCampus.value = ''
  await Promise.all([loadEntries(), loadFilters()])
}

const loadEntries = async () => {
  if (!selectedFile.value) return

  loading.value = true
  try {
    const response = await knowledgeAPI.getEntries(selectedFile.value, {
      page: currentPage.value,
      limit: 20,
      search: searchQuery.value || undefined,
      category: selectedCategory.value || undefined,
      campus: selectedCampus.value || undefined,
    })
    entries.value = response.items
    total.value = response.total
    totalPages.value = response.total_pages
  } catch (error) {
    console.error('항목 로드 실패:', error)
    showToast('데이터를 불러올 수 없습니다.', 'error')
  } finally {
    loading.value = false
  }
}

const loadFilters = async () => {
  if (!selectedFile.value) return

  try {
    const [catResponse, campusResponse] = await Promise.all([
      knowledgeAPI.getCategories(selectedFile.value),
      knowledgeAPI.getCampuses(selectedFile.value),
    ])
    categories.value = catResponse.categories
    campuses.value = campusResponse.campuses
  } catch (error) {
    console.error('필터 로드 실패:', error)
  }
}

const debouncedSearch = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    loadEntries()
  }, 300)
}

const goToPage = (page: number) => {
  currentPage.value = page
  loadEntries()
}

// 모달 함수
const openViewModal = (entry: KnowledgeEntry) => {
  selectedEntry.value = entry
  modalMode.value = 'view'
  showModal.value = true
}

const openCreateModal = () => {
  selectedEntry.value = null
  formData.value = {}
  modalMode.value = 'create'
  showModal.value = true
}

const openEditModal = (entry: KnowledgeEntry) => {
  selectedEntry.value = entry
  formData.value = { ...entry.raw_data }
  modalMode.value = 'edit'
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  selectedEntry.value = null
  formData.value = {}
}

const handleSubmit = async () => {
  if (!selectedFile.value) return

  submitting.value = true
  try {
    if (modalMode.value === 'create') {
      await knowledgeAPI.createEntry(selectedFile.value, formData.value)
      showToast('항목이 생성되었습니다.')
    } else if (modalMode.value === 'edit' && selectedEntry.value) {
      await knowledgeAPI.updateEntry(selectedFile.value, selectedEntry.value.id, formData.value)
      showToast('항목이 수정되었습니다.')
    }
    closeModal()
    await Promise.all([loadEntries(), loadFiles()])
  } catch (error) {
    console.error('저장 실패:', error)
    showToast('저장에 실패했습니다.', 'error')
  } finally {
    submitting.value = false
  }
}

const confirmDelete = (entry: KnowledgeEntry) => {
  entryToDelete.value = entry
  showDeleteModal.value = true
}

const handleDelete = async () => {
  if (!selectedFile.value || !entryToDelete.value) return

  submitting.value = true
  try {
    await knowledgeAPI.deleteEntry(selectedFile.value, entryToDelete.value.id)
    showToast('항목이 삭제되었습니다.')
    showDeleteModal.value = false
    entryToDelete.value = null
    await Promise.all([loadEntries(), loadFiles()])
  } catch (error) {
    console.error('삭제 실패:', error)
    showToast('삭제에 실패했습니다.', 'error')
  } finally {
    submitting.value = false
  }
}

// JSON 임포트
const handleImport = async () => {
  if (isImporting.value) return

  isImporting.value = true
  try {
    const result = await knowledgeAPI.importJsonFiles()
    if (result.success) {
      const counts = Object.entries(result.results)
        .filter(([, value]) => typeof value === 'number')
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
      showToast(`JSON 임포트 완료 (${counts})`)
      await loadFiles()
      if (selectedFile.value) {
        await loadEntries()
      }
    } else {
      showToast('JSON 임포트 실패', 'error')
    }
  } catch (error) {
    console.error('JSON 임포트 실패:', error)
    showToast('JSON 임포트에 실패했습니다.', 'error')
  } finally {
    isImporting.value = false
  }
}

// 재인덱싱
const handleReindex = async () => {
  if (isReindexing.value) return

  isReindexing.value = true
  reindexProgress.value = 0
  reindexStatus.value = { status: 'running', progress: 0, message: '시작 중...' }

  try {
    // 상태 폴링 시작
    const pollInterval = setInterval(async () => {
      try {
        const status = await knowledgeAPI.getReindexStatus()
        reindexStatus.value = status
        reindexProgress.value = status.progress

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(pollInterval)
          isReindexing.value = false

          if (status.status === 'completed') {
            showToast(`재인덱싱 완료: ${status.document_count}개 문서`)
            lastIndexedTime.value = status.last_indexed
          } else {
            showToast(`재인덱싱 실패: ${status.error}`, 'error')
          }

          // 파일 목록 새로고침
          await loadFiles()
        }
      } catch (error) {
        console.error('상태 조회 실패:', error)
      }
    }, 1000)

    // 재인덱싱 시작
    await knowledgeAPI.reindex()
  } catch (error) {
    console.error('재인덱싱 실패:', error)
    showToast('재인덱싱 시작에 실패했습니다.', 'error')
    isReindexing.value = false
  }
}

// 마지막 인덱싱 시간 로드
const loadLastIndexedTime = async () => {
  try {
    const status = await knowledgeAPI.getReindexStatus()
    lastIndexedTime.value = status.last_indexed
  } catch (error) {
    console.error('마지막 인덱싱 시간 로드 실패:', error)
  }
}

// 초기화
onMounted(() => {
  loadFiles()
  loadLastIndexedTime()
})
</script>

<style scoped>
.knowledge-manager {
  max-width: 1400px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.last-indexed {
  font-size: 13px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 6px 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.last-indexed::before {
  content: '🕐';
  font-size: 12px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.import-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.import-btn:hover:not(:disabled) {
  background: #059669;
}

.import-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.reindex-btn {
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

.reindex-btn:hover:not(:disabled) {
  background: #023663;
}

.reindex-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.reindex-btn.indexing {
  background: #059669;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 재인덱싱 상태 */
.reindex-status {
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.status-bar {
  height: 6px;
  background: #dbeafe;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.status-progress {
  height: 100%;
  background: #02478A;
  transition: width 0.3s;
}

.status-message {
  font-size: 13px;
  color: #1e40af;
}

/* 파일 탭 */
.file-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.file-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.file-tab:hover {
  border-color: #02478A;
  color: #02478A;
}

.file-tab.active {
  background: #02478A;
  border-color: #02478A;
  color: white;
}

.tab-name {
  font-weight: 500;
}

.tab-count {
  font-size: 12px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}

.file-tab.active .tab-count {
  background: rgba(255, 255, 255, 0.2);
}

/* 컨트롤 */
.controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  flex: 1;
  min-width: 200px;
}

.search-box svg {
  color: #9ca3af;
}

.search-box input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  width: 100%;
}

.filter-select {
  padding: 8px 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover {
  background: #059669;
}

/* 로딩 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
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

/* 테이블 */
.table-container {
  overflow-x: auto;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th,
.data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.data-table th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
}

.data-table tbody tr:hover {
  background: #f9fafb;
}

.col-title {
  min-width: 200px;
}

.col-category,
.col-campus {
  width: 120px;
}

.col-content {
  min-width: 300px;
}

.col-actions {
  width: 100px;
  text-align: center;
}

.entry-title {
  color: #02478A;
  cursor: pointer;
  font-weight: 500;
}

.entry-title:hover {
  text-decoration: underline;
}

.category-badge {
  display: inline-block;
  padding: 2px 8px;
  background: #eff6ff;
  color: #1e40af;
  border-radius: 4px;
  font-size: 12px;
}

.campus-badge {
  display: inline-block;
  padding: 2px 8px;
  background: #f0fdf4;
  color: #166534;
  border-radius: 4px;
  font-size: 12px;
}

.content-preview {
  color: #6b7280;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.col-uploader {
  width: 120px;
  white-space: nowrap;
}

.uploader-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.uploader-name {
  font-size: 12px;
  color: #374151;
  font-weight: 500;
}

.uploader-date {
  font-size: 11px;
  color: #9ca3af;
}

.no-uploader {
  color: #d1d5db;
  font-size: 12px;
}

.uploader-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.uploader-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.uploader-email {
  color: #374151;
}

.uploader-name-detail {
  color: #6b7280;
}

.uploader-time {
  font-size: 12px;
  color: #9ca3af;
  margin-left: auto;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  margin: 0 2px;
}

.action-btn.view:hover {
  background: #eff6ff;
  border-color: #02478A;
  color: #02478A;
}

.action-btn.edit:hover {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #f59e0b;
}

.action-btn.delete:hover {
  background: #fef2f2;
  border-color: #ef4444;
  color: #ef4444;
}

/* 빈 상태 */
.empty-state,
.select-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 64px;
  background: #fff;
  border: 1px dashed #e5e7eb;
  border-radius: 12px;
  color: #9ca3af;
}

/* 페이지네이션 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 16px;
  margin-top: 16px;
}

.page-btn {
  padding: 8px 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f3f4f6;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  padding: 0 16px;
  color: #6b7280;
  font-size: 13px;
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
  padding: 20px;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-content.large {
  width: 100%;
  max-width: 800px;
}

.modal-content.small {
  width: 100%;
  max-width: 400px;
  padding: 24px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.modal-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

/* 보기 모드 */
.view-content .field-group {
  margin-bottom: 16px;
}

.view-content label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.field-value {
  font-size: 14px;
  color: #1f2937;
  line-height: 1.6;
}

.content-full {
  white-space: pre-wrap;
  background: #f9fafb;
  padding: 12px;
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.raw-data {
  background: #1f2937;
  color: #e5e7eb;
  padding: 12px;
  border-radius: 8px;
  font-family: 'Consolas', monospace;
  font-size: 12px;
  overflow-x: auto;
  max-height: 200px;
}

/* 편집 폼 */
.edit-form .field-group {
  margin-bottom: 16px;
}

.edit-form label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}

.edit-form input,
.edit-form textarea,
.edit-form select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
}

.edit-form input:focus,
.edit-form textarea:focus,
.edit-form select:focus {
  outline: none;
  border-color: #02478A;
  box-shadow: 0 0 0 3px rgba(2, 71, 138, 0.1);
}

.edit-form textarea {
  resize: vertical;
  min-height: 100px;
}

.field-row {
  display: flex;
  gap: 16px;
}

.field-row .field-group {
  flex: 1;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.cancel-btn {
  padding: 10px 20px;
  background: #f3f4f6;
  border: none;
  border-radius: 8px;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #e5e7eb;
}

.submit-btn {
  padding: 10px 20px;
  background: #02478A;
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: #023663;
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 삭제 모달 */
.modal-content.small h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
}

.modal-content.small p {
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

.confirm-delete-btn {
  padding: 10px 20px;
  background: #ef4444;
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-delete-btn:hover:not(:disabled) {
  background: #dc2626;
}

.confirm-delete-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 토스트 */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  z-index: 2000;
  animation: slideIn 0.3s ease;
}

.toast.success {
  background: #10b981;
  color: white;
}

.toast.error {
  background: #ef4444;
  color: white;
}

@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 반응형 */
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .controls {
    flex-direction: column;
  }

  .search-box {
    width: 100%;
  }

  .filter-select {
    width: 100%;
  }

  .field-row {
    flex-direction: column;
    gap: 0;
  }

  .modal-content.large {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }
}
</style>
