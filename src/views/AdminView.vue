<template>
  <div class="admin-container">
    <!-- 로딩 중 -->
    <div v-if="isLoading" class="auth-loading">
      <div class="spinner"></div>
      <p>인증 확인 중...</p>
    </div>

    <!-- 로그인 필요 -->
    <div v-else-if="!isAuthenticated" class="auth-required">
      <div class="auth-card">
        <div class="auth-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h2>관리자 로그인</h2>
        <p>관리자 페이지에 접근하려면 로그인이 필요합니다.</p>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label for="email">이메일</label>
            <input
              id="email"
              v-model="loginEmail"
              type="email"
              placeholder="admin@euljigpt.com"
              required
            />
          </div>
          <div class="form-group">
            <label for="password">비밀번호</label>
            <input
              id="password"
              v-model="loginPassword"
              type="password"
              placeholder="비밀번호 입력"
              required
            />
          </div>
          <p v-if="loginError" class="error-message">{{ loginError }}</p>
          <button type="submit" class="login-btn" :disabled="isLoggingIn">
            {{ isLoggingIn ? '로그인 중...' : '로그인' }}
          </button>
        </form>
      </div>
    </div>

    <!-- 권한 없음 (dev, admin 아님) -->
    <div v-else-if="!hasAdminAccess" class="access-denied">
      <div class="auth-card">
        <div class="auth-icon denied">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
        </div>
        <h2>접근 권한 없음</h2>
        <p>개발자 또는 관리자 권한이 필요합니다.</p>
        <p class="sub-text">현재 계정: {{ currentUser?.email }}</p>
        <div class="action-buttons">
          <button @click="handleLogout" class="logout-btn">다른 계정으로 로그인</button>
          <button @click="goToHome" class="home-btn">홈으로 이동</button>
        </div>
      </div>
    </div>

    <!-- 관리자 대시보드 -->
    <template v-else>
      <AdminHeader @logout="handleLogout" />
      <div class="admin-body">
        <AdminSidebar
          :activeMenu="activeMenu"
          :adminRole="adminRole"
          :permissions="permissions"
          @menuChange="handleMenuChange"
        />
        <main class="admin-main">
          <!-- admin 전용 메뉴 -->
          <UserManagement v-if="activeMenu === 'users' && permissions.user_management" />
          <DatabaseBrowser v-else-if="activeMenu === 'database' && permissions.db_browser" />
          <ChatLogViewer v-else-if="activeMenu === 'chat-history' && permissions.chat_history" />
          <DatabaseBackup v-else-if="activeMenu === 'backup' && permissions.backup" />
          <!-- dev/admin 공용 메뉴 -->
          <ContentManager v-else-if="activeMenu === 'content' && permissions.content_management" />
          <KnowledgeManager v-else-if="activeMenu === 'knowledge' && permissions.knowledge_management" />
          <div v-else-if="activeMenu === 'dashboard' && permissions.dashboard" class="dashboard-content">
            <h2 class="section-title">대시보드</h2>
            <div class="stats-grid">
              <StatsCard
                title="전체 회원"
                :value="stats.total_users"
                icon="users"
                color="#02478A"
              />
              <StatsCard
                title="Pro 회원"
                :value="stats.pro_users"
                icon="star"
                color="#4f6edb"
              />
              <StatsCard
                title="관리자"
                :value="stats.admin_users"
                icon="shield"
                color="#10b981"
              />
              <StatsCard
                title="카카오 가입"
                :value="stats.kakao_users"
                icon="kakao"
                color="#FEE500"
              />
              <StatsCard
                title="오늘 가입"
                :value="stats.today_signups"
                icon="calendar"
                color="#f59e0b"
              />
            </div>
          </div>
        </main>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminHeader from '../components/admin/AdminHeader.vue'
import AdminSidebar from '../components/admin/AdminSidebar.vue'
import UserManagement from '../components/admin/UserManagement.vue'
import DatabaseBrowser from '../components/admin/DatabaseBrowser.vue'
import ContentManager from '../components/admin/ContentManager.vue'
import KnowledgeManager from '../components/admin/KnowledgeManager.vue'
import ChatLogViewer from '../components/admin/ChatLogViewer.vue'
import DatabaseBackup from '../components/admin/DatabaseBackup.vue'
import StatsCard from '../components/admin/StatsCard.vue'
import { adminAPI, type PlatformStats } from '../services/api'
import {
  getAccessToken,
  setAccessToken,
  removeAccessToken,
  getUserInfo,
  setUserInfo,
  removeUserInfo,
  type UserInfo
} from '../utils/auth'
import { getApiBaseUrl } from '../utils/ports-config'

// API 기본 URL (프로덕션에서는 Railway 백엔드 URL 사용)
const API_BASE_URL = getApiBaseUrl()

// Permissions 타입 정의
interface Permissions {
  dashboard: boolean
  content_management: boolean
  knowledge_management: boolean
  user_management: boolean
  db_browser: boolean
  role_management: boolean
  chat_history: boolean
  backup: boolean
}

const router = useRouter()
const activeMenu = ref('dashboard')

// 인증 상태
const isLoading = ref(true)
const isAuthenticated = ref(false)
const adminRole = ref<'dev' | 'admin' | null>(null)
const permissions = ref<Permissions>({
  dashboard: false,
  content_management: false,
  knowledge_management: false,
  user_management: false,
  db_browser: false,
  role_management: false,
  chat_history: false,
  backup: false,
})
const currentUser = ref<UserInfo | null>(null)

// dev 또는 admin 권한이 있는지 체크
const hasAdminAccess = computed(() => adminRole.value === 'dev' || adminRole.value === 'admin')

// 로그인 폼
const loginEmail = ref('')
const loginPassword = ref('')
const loginError = ref('')
const isLoggingIn = ref(false)

const stats = ref<PlatformStats>({
  total_users: 0,
  pro_users: 0,
  admin_users: 0,
  kakao_users: 0,
  today_signups: 0,
})

const handleMenuChange = (menu: string) => {
  activeMenu.value = menu
}

// 관리자 인증 확인
const checkAdminAuth = async () => {
  isLoading.value = true

  const token = getAccessToken()
  if (!token) {
    isAuthenticated.value = false
    isLoading.value = false
    return
  }

  try {
    // 백엔드에서 현재 사용자 정보 확인
    const response = await fetch(`${API_BASE_URL}/member/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      // 토큰이 유효하지 않음
      isAuthenticated.value = false
      removeAccessToken()
      removeUserInfo()
      isLoading.value = false
      return
    }

    const userData = await response.json()
    currentUser.value = userData
    isAuthenticated.value = true

    // 로컬 스토리지 업데이트
    setUserInfo(userData)

    // 관리자 권한 정보 조회 (dev 또는 admin)
    const roleResponse = await fetch(`${API_BASE_URL}/admin/me/role`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (roleResponse.ok) {
      const roleData = await roleResponse.json()
      adminRole.value = roleData.admin_role
      permissions.value = roleData.permissions

      // dev/admin 권한이 있으면 통계 로드
      if (roleData.admin_role === 'dev' || roleData.admin_role === 'admin') {
        await loadStats()
      }
    } else {
      // 권한 조회 실패 시 기본값 유지 (일반 사용자)
      adminRole.value = null
      permissions.value = {
        dashboard: false,
        content_management: false,
        knowledge_management: false,
        user_management: false,
        db_browser: false,
        role_management: false,
        chat_history: false,
        backup: false,
      }
    }
  } catch (error) {
    console.error('인증 확인 실패:', error)
    isAuthenticated.value = false
  } finally {
    isLoading.value = false
  }
}

// 로그인 처리
const handleLogin = async () => {
  loginError.value = ''
  isLoggingIn.value = true

  try {
    const response = await fetch(`${API_BASE_URL}/member/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: loginEmail.value,
        password: loginPassword.value,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || '로그인에 실패했습니다.')
    }

    const data = await response.json()

    // 토큰 저장
    setAccessToken(data.access_token)

    // 인증 상태 재확인
    await checkAdminAuth()

    // 관리자가 아닌 경우 에러 표시
    if (!hasAdminAccess.value) {
      loginError.value = '개발자 또는 관리자 권한이 없는 계정입니다.'
    }
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : '로그인에 실패했습니다.'
  } finally {
    isLoggingIn.value = false
  }
}

const handleLogout = async () => {
  try {
    await fetch(`${API_BASE_URL}/member/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    })
  } catch (error) {
    console.error('로그아웃 API 호출 실패:', error)
  }

  removeAccessToken()
  removeUserInfo()
  isAuthenticated.value = false
  adminRole.value = null
  permissions.value = {
    dashboard: false,
    content_management: false,
    knowledge_management: false,
    user_management: false,
    db_browser: false,
    role_management: false,
    chat_history: false,
    backup: false,
  }
  currentUser.value = null
  loginEmail.value = ''
  loginPassword.value = ''
}

const goToHome = () => {
  router.push('/')
}

const loadStats = async () => {
  try {
    stats.value = await adminAPI.getStats()
  } catch (error) {
    console.error('통계 로드 실패:', error)
  }
}

onMounted(() => {
  checkAdminAuth()
})
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  background-color: #f8fafc;
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
}

.admin-body {
  display: flex;
  min-height: calc(100vh - 64px);
}

.admin-main {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.dashboard-content {
  max-width: 1200px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

/* 인증 관련 스타일 */
.auth-loading,
.auth-required,
.access-denied {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
}

.auth-loading {
  flex-direction: column;
  gap: 16px;
  color: #6b7280;
}

.auth-loading .spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #02478A;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.auth-card {
  background: white;
  border-radius: 16px;
  padding: 40px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.auth-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  background: #eff6ff;
  border-radius: 50%;
  color: #02478A;
}

.auth-icon.denied {
  background: #fef2f2;
  color: #ef4444;
}

.auth-card h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 12px;
}

.auth-card p {
  color: #6b7280;
  margin-bottom: 8px;
}

.auth-card .sub-text {
  font-size: 13px;
  color: #9ca3af;
}

/* 로그인 폼 */
.login-form {
  margin-top: 24px;
  text-align: left;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 15px;
  transition: all 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #02478A;
  box-shadow: 0 0 0 3px rgba(2, 71, 138, 0.1);
}

.error-message {
  color: #ef4444;
  font-size: 13px;
  margin-bottom: 16px;
  text-align: center;
}

.login-btn {
  width: 100%;
  padding: 14px;
  background: #02478A;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.login-btn:hover:not(:disabled) {
  background: #023663;
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 액션 버튼 */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}

.logout-btn {
  padding: 12px 24px;
  background: #02478A;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: #023663;
}

.home-btn {
  padding: 12px 24px;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.home-btn:hover {
  background: #e5e7eb;
}

@media (max-width: 768px) {
  .admin-body {
    flex-direction: column;
  }

  .admin-main {
    padding: 16px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .auth-card {
    padding: 24px;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
