<template>
  <div class="user-management">
    <div class="page-header">
      <h2 class="section-title">회원 관리</h2>
      <div class="header-stats">
        <span class="stats-text">전체 {{ totalUsers }}명</span>
      </div>
    </div>

    <!-- 검색 및 필터 -->
    <div class="search-filter-bar">
      <div class="search-box">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="이름, 이메일, 닉네임 검색..."
          @input="debouncedSearch"
        />
      </div>
      <div class="filter-buttons">
        <button
          class="filter-btn"
          :class="{ active: filterPro === null }"
          @click="setFilterPro(null)"
        >
          전체
        </button>
        <button
          class="filter-btn"
          :class="{ active: filterPro === true }"
          @click="setFilterPro(true)"
        >
          Pro
        </button>
        <button
          class="filter-btn"
          :class="{ active: filterPro === false }"
          @click="setFilterPro(false)"
        >
          일반
        </button>
      </div>
    </div>

    <!-- 회원 테이블 -->
    <UserTable
      :users="users"
      :loading="loading"
      @viewDetail="openDetailModal"
      @deleteUser="confirmDelete"
    />

    <!-- 페이지네이션 -->
    <div v-if="totalPages > 1" class="pagination">
      <button
        class="page-btn"
        :disabled="currentPage === 1"
        @click="goToPage(currentPage - 1)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <template v-for="page in displayedPages" :key="page">
        <button
          v-if="page !== '...'"
          class="page-btn"
          :class="{ active: page === currentPage }"
          @click="goToPage(page as number)"
        >
          {{ page }}
        </button>
        <span v-else class="page-ellipsis">...</span>
      </template>
      <button
        class="page-btn"
        :disabled="currentPage === totalPages"
        @click="goToPage(currentPage + 1)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>

    <!-- 회원 상세 모달 -->
    <UserDetailModal
      v-if="showDetailModal"
      :user="selectedUser"
      :loading="modalLoading"
      @close="closeDetailModal"
      @update="updateUserPermissions"
    />

    <!-- 삭제 확인 다이얼로그 -->
    <ConfirmDialog
      v-if="showDeleteConfirm"
      title="회원 삭제"
      :message="`'${userToDelete?.nickname}'님을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`"
      confirmText="삭제"
      confirmColor="#ef4444"
      @confirm="deleteUser"
      @cancel="cancelDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import UserTable from './UserTable.vue'
import UserDetailModal from './UserDetailModal.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { adminAPI, type UserListItem, type UserDetail, type AdminRole } from '../../services/api'

const users = ref<UserListItem[]>([])
const loading = ref(false)
const modalLoading = ref(false)
const currentPage = ref(1)
const totalPages = ref(1)
const totalUsers = ref(0)
const limit = 20

const searchQuery = ref('')
const filterPro = ref<boolean | null>(null)

const showDetailModal = ref(false)
const selectedUser = ref<UserDetail | null>(null)

const showDeleteConfirm = ref(false)
const userToDelete = ref<UserListItem | null>(null)

// 디바운스 타이머
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const debouncedSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    loadUsers()
  }, 300)
}

const setFilterPro = (value: boolean | null) => {
  filterPro.value = value
  currentPage.value = 1
  loadUsers()
}

const loadUsers = async () => {
  loading.value = true
  try {
    const response = await adminAPI.getUsers({
      page: currentPage.value,
      limit,
      search: searchQuery.value || undefined,
      filter_pro: filterPro.value ?? undefined,
    })
    users.value = response.items
    totalPages.value = response.total_pages
    totalUsers.value = response.total
  } catch (error) {
    console.error('회원 목록 로드 실패:', error)
  } finally {
    loading.value = false
  }
}

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    loadUsers()
  }
}

const displayedPages = computed(() => {
  const pages: (number | string)[] = []
  const total = totalPages.value
  const current = currentPage.value

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    pages.push(1)
    if (current > 3) {
      pages.push('...')
    }
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    if (current < total - 2) {
      pages.push('...')
    }
    pages.push(total)
  }

  return pages
})

const openDetailModal = async (userId: number) => {
  showDetailModal.value = true
  modalLoading.value = true
  try {
    selectedUser.value = await adminAPI.getUserDetail(userId)
  } catch (error) {
    console.error('회원 상세 로드 실패:', error)
    showDetailModal.value = false
  } finally {
    modalLoading.value = false
  }
}

const closeDetailModal = () => {
  showDetailModal.value = false
  selectedUser.value = null
}

const updateUserPermissions = async (data: { is_pro?: boolean; admin_role?: AdminRole }) => {
  if (!selectedUser.value) return

  modalLoading.value = true
  try {
    const updated = await adminAPI.updateUser(selectedUser.value.id, data)
    selectedUser.value = updated

    // 테이블 업데이트
    const index = users.value.findIndex(u => u.id === updated.id)
    if (index !== -1) {
      users.value[index] = {
        ...users.value[index],
        is_pro: updated.is_pro,
        is_admin: updated.is_admin,
        admin_role: updated.admin_role,
      }
    }
  } catch (error) {
    console.error('회원 권한 수정 실패:', error)
    alert('권한 수정에 실패했습니다.')
  } finally {
    modalLoading.value = false
  }
}

const confirmDelete = (user: UserListItem) => {
  userToDelete.value = user
  showDeleteConfirm.value = true
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
  userToDelete.value = null
}

const deleteUser = async () => {
  if (!userToDelete.value) return

  try {
    await adminAPI.deleteUser(userToDelete.value.id)
    users.value = users.value.filter(u => u.id !== userToDelete.value!.id)
    totalUsers.value -= 1
    showDeleteConfirm.value = false
    userToDelete.value = null
  } catch (error) {
    console.error('회원 삭제 실패:', error)
    alert('회원 삭제에 실패했습니다.')
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.user-management {
  max-width: 1200px;
}

.page-header {
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

.stats-text {
  font-size: 14px;
  color: #6b7280;
}

.search-filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 200px;
  max-width: 400px;
  padding: 10px 16px;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: border-color 0.2s;
}

.search-box:focus-within {
  border-color: #02478A;
}

.search-box svg {
  color: #9ca3af;
  flex-shrink: 0;
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  color: #1f2937;
  background: transparent;
}

.search-box input::placeholder {
  color: #9ca3af;
}

.filter-buttons {
  display: flex;
  gap: 8px;
}

.filter-btn {
  padding: 8px 16px;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover {
  border-color: #02478A;
  color: #02478A;
}

.filter-btn.active {
  background-color: #02478A;
  border-color: #02478A;
  color: #ffffff;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  margin-top: 24px;
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 8px;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  border-color: #02478A;
  color: #02478A;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-btn.active {
  background-color: #02478A;
  border-color: #02478A;
  color: #ffffff;
}

.page-ellipsis {
  padding: 0 8px;
  color: #9ca3af;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .search-filter-bar {
    flex-direction: column;
  }

  .search-box {
    max-width: none;
  }
}
</style>
