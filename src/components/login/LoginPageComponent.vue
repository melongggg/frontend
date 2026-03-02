<template>
  <div class="root-wrapper">
    <!-- Toast Notification -->
    <ToastNotification 
      :show="showToast" 
      :message="toastMessage" 
      @hide="showToast = false" 
    />

    <!-- Header -->
    <HeaderSection />

    <!-- Footer -->
    <div class="common-footer-notice">
      <span class="footer-text">개인정보 처리방침</span>
      <span class="footer-separator">|</span>
      <span class="footer-copyright">Copyright ⓒ EULGPT. All Rights Reserved</span>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <div class="login-container">
        <div class="title-section">
          <span class="login-title">
            내가 찾던 정보, 이제 쉽게 만나요.
          </span>
          <!-- 이메일 로그인 폼 완전 제거 (카카오 로그인 전용) -->
        </div>

        <!-- 이메일 로그인 버튼 완전 제거 -->

        <!-- 개발 환경 전용: 이메일 로그인 폼 -->
        <div v-if="isDevelopment" class="form-container">
          <div class="input-group">
            <input
              v-model="email"
              type="email"
              class="input-field"
              placeholder="이메일 ID"
              @keyup.enter="handleLogin"
            />
          </div>
          <div class="password-group">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="input-field"
              placeholder="비밀번호"
              @keyup.enter="handleLogin"
            />
            <button type="button" class="eye-button" @click="togglePassword">
              {{ showPassword ? '👁️' : '👁️‍🗨️' }}
            </button>
          </div>
          <button
            class="login-button"
            @click="handleLogin"
            :disabled="isLoading"
          >
            <span class="button-text">{{ isLoading ? '로그인 중...' : '로그인' }}</span>
          </button>

          <!-- Mock 로그인: 백엔드 없이 개발할 때 사용 -->
          <button
            class="mock-login-button"
            @click="handleMockLogin"
          >
            <span class="mock-button-text">개발자 로그인 (백엔드 불필요)</span>
          </button>
        </div>

        <div class="divider-section">
          <!-- 구분선 제거 (카카오 로그인만 있으므로 불필요) -->
          <div class="alternative-login">
            <button class="kakao-button" @click="handleKakaoLogin">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 2C5.13 2 2 4.58 2 7.75c0 2.03 1.33 3.82 3.35 4.85l-.89 3.27c-.08.3.26.54.51.36L8.66 14c.11 0 .22.01.34.01 3.87 0 7-2.58 7-5.75S12.87 2 9 2z" fill="currentColor"/>
              </svg>
              <span class="kakao-text">카카오 계정으로 로그인</span>
            </button>
            <!-- 하단 링크 완전 제거 (카카오 로그인 전용) -->
          </div>
          <div class="login-footer-link">
            <span class="question-text">이미 계정이 있으신가요?</span>
            <span class="login-link" @click="handleKakaoLogin" style="cursor: pointer;">로그인</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ToastNotification from '../common/ToastNotification.vue'
import HeaderSection from '../main/HeaderSection.vue'
import { setAccessToken, setUserInfo } from '../../utils/auth'
import { getApiBaseUrl } from '@/utils/ports-config'

const router = useRouter()

const API_BASE_URL = getApiBaseUrl()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const showToast = ref(false)
const toastMessage = ref('')
const isLoading = ref(false)

const togglePassword = () => {
  showPassword.value = !showPassword.value
}

const handleLogin = async () => {
  if (!email.value || !password.value) {
    showToastMessage('이메일과 비밀번호를 입력해주세요.')
    return
  }

  isLoading.value = true

  try {
    console.log('로그인 시도:', { email: email.value })

    const response = await fetch(`${API_BASE_URL}/member/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 쿠키 포함
      body: JSON.stringify({
        email: email.value,
        password: password.value
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || '로그인에 실패했습니다.')
    }

    const result = await response.json()
    console.log('로그인 성공:', result)

    // 액세스 토큰을 localStorage에 저장
    setAccessToken(result.access_token)

    // 사용자 정보 조회 및 저장
    try {
      const meResponse = await fetch(`${API_BASE_URL}/member/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${result.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      if (meResponse.ok) {
        const userInfo = await meResponse.json()
        setUserInfo(userInfo)
      }
    } catch (e) {
      console.error('Failed to fetch user info:', e)
    }

    // redirect 쿼리 파라미터가 있으면 그 경로로, 없으면 메인 페이지로 이동
    const redirect = (router.currentRoute.value.query.redirect as string) || '/'
    router.push(redirect)

  } catch (error: any) {
    console.error('로그인 오류:', error)
    if (error.message.includes('이메일 또는 비밀번호가 올바르지 않습니다')) {
      showToastMessage('이메일 ID 또는 비밀번호가 일치하지 않아요')
    } else {
      showToastMessage(error.message || '로그인 중 오류가 발생했습니다.')
    }
  } finally {
    isLoading.value = false
  }
}

const showToastMessage = (message: string) => {
  toastMessage.value = message
  showToast.value = true
}

const handleKakaoLogin = () => {
  console.log('카카오 로그인 시도')
  // 백엔드 카카오 로그인 엔드포인트로 리다이렉트
  window.location.href = `${API_BASE_URL}/member/kakao/login`
}

// Mock 로그인: 백엔드 없이 프론트엔드만 개발할 때 사용
const handleMockLogin = async () => {
  console.log('[Mock Login] 개발자 로그인 실행')

  // 가짜 토큰 생성
  const mockToken = 'dev_mock_token_' + Date.now()

  // 가짜 사용자 정보
  const mockUser = {
    id: 999,
    name: '개발자',
    email: 'dev@eulgpt.local',
    nickname: '개발자',
    is_pro: true,
    is_admin: true
  }

  // localStorage에 저장
  setAccessToken(mockToken)
  setUserInfo(mockUser)

  console.log('[Mock Login] 로그인 성공:', mockUser)
  showToastMessage('개발자 모드로 로그인되었습니다.')

  // 즉시 채팅 페이지로 이동
  const redirect = (router.currentRoute.value.query.redirect as string) || '/chat'
  await router.push(redirect)
}
</script>

<style scoped>
.root-wrapper {
  min-height: 100vh;
  background-color: var(--color-bg-primary);
  position: relative;
  font-family: 'Pretendard', -apple-system, Roboto, Helvetica, sans-serif;
}

/* Footer Styles */
.common-footer-notice {
  display: flex;
  justify-content: flex-start;
  flex-direction: row;
  align-items: center;
  gap: 5px;
  width: 277px;
  height: 12px;
  box-sizing: border-box;
  position: absolute;
  left: calc(50% - 138px);
  top: 710px;
}

.footer-text {
  color: var(--color-text-tertiary);
  text-overflow: ellipsis;
  font-size: 10px;
  font-family: Pretendard, sans-serif;
  font-weight: 500;
  text-align: left;
}

.footer-separator {
  color: var(--color-text-tertiary);
  text-overflow: ellipsis;
  font-size: 10px;
  font-family: Pretendard, sans-serif;
  font-weight: 500;
  text-align: left;
  width: 4px;
}

.footer-copyright {
  color: var(--color-text-tertiary);
  text-overflow: ellipsis;
  font-size: 10px;
  font-family: Pretendard, sans-serif;
  font-weight: 500;
  text-align: left;
  width: 191px;
}

/* Main Content */
.main-content {
  display: flex;
  justify-content: center;
  align-items: center;
  flex:1;
  width:100%;
  min-height: calc(100vh - 150px);
  box-sizing: border-box;
  /* padding: 50px 20px 20px 20px; 수동으로 패딩 조정 가능: top right bottom left */
}

.login-container {
  display: flex;
  justify-content: flex-start;
  flex-direction: column;
  align-items: center;
  gap: 30px;
  width: 408px;
  height: 200px; /* 수동으로 높이 조정 가능 */
  background-color: var(--color-bg-primary);
  box-sizing: border-box;
  margin: 0 auto; /* 중앙 정렬 추가 */
}

.title-section {
  display: flex;
  justify-content: flex-start;
  flex-direction: column;
  align-items: flex-start;
  gap: 30px;
  align-self: stretch;
  box-sizing: border-box;
}

.login-title {
  color: var(--color-text-primary);
  text-overflow: ellipsis;
  font-size: 24px;
  font-family: Pretendard, sans-serif;
  font-weight: 700;
  line-height: 140%;
  text-align: center;
  align-self: stretch;
  align-items: center;
  margin-bottom: -10px;
}

.form-container {
  display: flex;
  justify-content: flex-start;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  align-self: stretch;
  box-sizing: border-box;
}

.input-group {
  display: flex;
  justify-content: flex-start;
  flex-direction: row;
  align-items: center;
  border: solid 1px var(--color-card-border);
  border-radius: 10px;
  align-self: stretch;
  box-sizing: border-box;
  padding: 14px 20px;
}

.password-group {
  display: flex;
  justify-content: space-between;
  flex-direction: row;
  align-items: center;
  border: solid 1px var(--color-card-border);
  border-radius: 10px;
  align-self: stretch;
  box-sizing: border-box;
  padding: 14px 20px;
}

.input-field {
  color: var(--color-text-tertiary);
  font-size: 16px;
  font-family: Pretendard, sans-serif;
  font-weight: 500;
  line-height: 25px;
  border: none;
  outline: none;
  background: transparent;
  flex: 1;
}

.input-field:focus {
  color: var(--color-text-primary);
}

.eye-button {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-tertiary);
  padding: 0;
  display: flex;
  align-items: center;
}

.login-button {
  display: flex;
  justify-content: center;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  border-radius: 12px;
  align-self: stretch;
  background-color: var(--color-primary-light);
  box-sizing: border-box;
  padding: 14px 60px;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.login-button:hover:not(:disabled) {
  background-color: var(--color-button-primary-bg);
}

.login-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.mock-login-button {
  display: flex;
  justify-content: center;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  border-radius: 12px;
  align-self: stretch;
  background-color: #6b7280;
  box-sizing: border-box;
  padding: 14px 60px;
  border: 2px dashed #9ca3af;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-top: 10px;
}

.mock-login-button:hover {
  background-color: #4b5563;
}

.mock-button-text {
  color: #ffffff;
  font-size: 14px;
  font-family: Pretendard, sans-serif;
  font-weight: 600;
  text-align: center;
}

.button-text {
  color: var(--color-primary);
  text-overflow: ellipsis;
  font-size: 18px;
  font-family: Pretendard, sans-serif;
  font-weight: 700;
  text-align: left;
}

.divider-section {
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: flex-start;
  gap: 30px;
  align-self: stretch;
  box-sizing: border-box;
}

.divider-line {
  height: 0px;
  border-top: solid 1px var(--color-card-border);
  align-self: stretch;
}

.alternative-login {
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  align-self: stretch;
  box-sizing: border-box;
}

.kakao-button {
  display: flex;
  justify-content: center;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  border-radius: 40px;
  align-self: stretch;
  height: 46px;
  background-color: rgb(254, 229, 2);
  box-sizing: border-box;
  padding: 15px 60px;
  border: none;
  cursor: pointer;
  margin-bottom: -2px;
}

.kakao-text {
  color: black;
  text-overflow: ellipsis;
  font-size: 16px;
  font-family: Pretendard, sans-serif;
  font-weight: 600;
  line-height: 25px;
  text-align: center;
}

.bottom-links {
  display: flex;
  justify-content: center;
  flex-direction: row;
  align-items: center;
  gap: 15px;
  align-self: stretch;
  box-sizing: border-box;
  padding: 0px 10px;
}

.link-text {
  color: var(--color-text-tertiary);
  text-overflow: ellipsis;
  font-size: 14px;
  font-family: Pretendard, sans-serif;
  font-weight: 500;
  line-height: 23px;
  text-align: left;
  cursor: pointer;
}

.separator {
  color: rgb(229, 231, 235);
  text-overflow: ellipsis;
  font-size: 14px;
  font-family: Pretendard, sans-serif;
  font-weight: 500;
  line-height: 23px;
  text-align: left;
}
.login-footer-link {
  font-size: 14px;
  color: #9CA3AF;      /* 질문 문구는 흐린 회색 */
  display: flex;
  gap: 8px;            /* "있으신가요?"와 "로그인" 사이 간격 */
  border-top: 2px solid #E5E7EB; /* 연한 가로선 추가 */
  padding-top: 10px;             /* 선과 글자 사이 여백 */
  width: 100%;                   /* 선이 길게 늘어나도록 설정 */
  justify-content: center;
}

.login-link {
  color: #02478A;      /* "로그인" 글자는 이미지처럼 파란색 */
  text-decoration: none;
  font-weight: 600;
}

.login-link:hover {
  text-decoration: underline; /* 마우스 올렸을 때 밑줄 효과 */
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .login-container {
    width: 90%;
    max-width: 407px;
  }
  
  .main-content {
    padding: 84px 20px 20px;
  }
}
</style>
