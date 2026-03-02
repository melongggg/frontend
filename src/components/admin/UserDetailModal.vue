<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>회원 상세 정보</h3>
        <button class="close-btn" @click="$emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div v-if="loading" class="modal-loading">
        <div class="spinner"></div>
        <span>로딩 중...</span>
      </div>

      <template v-else-if="user">
        <div class="modal-body">
          <!-- 프로필 정보 -->
          <div class="profile-section">
            <div class="profile-avatar">
              <img
                v-if="user.profile_image_url"
                :src="user.profile_image_url"
                :alt="user.nickname"
              />
              <div v-else class="avatar-placeholder">
                {{ user.nickname.charAt(0) }}
              </div>
            </div>
            <div class="profile-info">
              <h4 class="profile-name">{{ user.name }}</h4>
              <p class="profile-nickname">@{{ user.nickname }}</p>
              <div class="profile-badges">
                <span v-if="user.admin_role === 'admin'" class="badge badge-admin">Admin</span>
                <span v-else-if="user.admin_role === 'dev'" class="badge badge-dev">Developer</span>
                <span v-if="user.is_pro" class="badge badge-pro">Pro</span>
                <span v-if="user.oauth_provider" class="badge badge-oauth">{{ user.oauth_provider }}</span>
              </div>
            </div>
          </div>

          <!-- 상세 정보 -->
          <div class="info-grid">
            <div class="info-item">
              <label>이메일</label>
              <span>{{ user.email }}</span>
            </div>
            <div class="info-item">
              <label>전화번호</label>
              <span>{{ user.phone_number || '-' }}</span>
            </div>
            <div class="info-item">
              <label>생년월일</label>
              <span>{{ user.birth_date || '-' }}</span>
            </div>
            <div class="info-item">
              <label>인증 이메일</label>
              <span>{{ user.verified_email || '-' }}</span>
            </div>
            <div class="info-item">
              <label>가입일</label>
              <span>{{ formatDateTime(user.created_at) }}</span>
            </div>
            <div class="info-item">
              <label>최근 수정</label>
              <span>{{ user.updated_at ? formatDateTime(user.updated_at) : '-' }}</span>
            </div>
          </div>

          <!-- 권한 설정 -->
          <div class="permissions-section">
            <h4>권한 설정</h4>
            <div class="permission-toggles">
              <div class="toggle-item">
                <div class="toggle-info">
                  <span class="toggle-label">Pro 회원</span>
                  <span class="toggle-desc">Pro 기능 이용 가능</span>
                </div>
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    :checked="user.is_pro"
                    @change="togglePro"
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="select-item">
                <div class="select-info">
                  <span class="select-label">관리자 권한</span>
                  <span class="select-desc">관리자 페이지 접근 레벨</span>
                </div>
                <select
                  class="role-select"
                  :value="user.admin_role || ''"
                  @change="changeAdminRole"
                >
                  <option value="">일반 사용자</option>
                  <option value="dev">Developer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UserDetail, AdminRole } from '../../services/api'

const props = defineProps<{
  user: UserDetail | null
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update', data: { is_pro?: boolean; admin_role?: AdminRole }): void
}>()

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const togglePro = () => {
  if (props.user) {
    emit('update', { is_pro: !props.user.is_pro })
  }
}

const changeAdminRole = (event: Event) => {
  if (props.user) {
    const target = event.target as HTMLSelectElement
    const value = target.value as AdminRole | ''
    emit('update', { admin_role: value === '' ? null : value as AdminRole })
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-content {
  background-color: #ffffff;
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background-color: #f3f4f6;
  color: #1f2937;
}

.modal-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  gap: 16px;
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
  to {
    transform: rotate(360deg);
  }
}

.modal-body {
  padding: 24px;
}

.profile-section {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.profile-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #02478A;
  color: #ffffff;
  font-size: 24px;
  font-weight: 700;
}

.profile-info {
  flex: 1;
}

.profile-name {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 4px 0;
}

.profile-nickname {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 8px 0;
}

.profile-badges {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 9999px;
}

.badge-admin {
  background-color: #fef2f2;
  color: #dc2626;
}

.badge-dev {
  background-color: #eff6ff;
  color: #2563eb;
}

.badge-pro {
  background-color: #dcfce7;
  color: #166534;
}

.badge-oauth {
  background-color: #fef3c7;
  color: #92400e;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
}

.info-item span {
  font-size: 14px;
  color: #1f2937;
}

.permissions-section {
  border-top: 1px solid #e5e7eb;
  padding-top: 24px;
}

.permissions-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 16px 0;
}

.permission-toggles {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toggle-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background-color: #f9fafb;
  border-radius: 8px;
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-label {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.toggle-desc {
  font-size: 12px;
  color: #6b7280;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #d1d5db;
  border-radius: 24px;
  transition: 0.3s;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: 0.3s;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #02478A;
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

/* Select Item (admin_role dropdown) */
.select-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background-color: #f9fafb;
  border-radius: 8px;
}

.select-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.select-label {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.select-desc {
  font-size: 12px;
  color: #6b7280;
}

.role-select {
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  background-color: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  outline: none;
  transition: all 0.2s;
  min-width: 130px;
}

.role-select:hover {
  border-color: #9ca3af;
}

.role-select:focus {
  border-color: #02478A;
  box-shadow: 0 0 0 2px rgba(2, 71, 138, 0.1);
}

@media (max-width: 480px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
