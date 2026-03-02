<template>
  <div class="user-table-container">
    <table class="user-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>이름</th>
          <th>이메일</th>
          <th>닉네임</th>
          <th>가입일</th>
          <th>상태</th>
          <th>작업</th>
        </tr>
      </thead>
      <tbody>
        <template v-if="loading">
          <tr v-for="i in 5" :key="i" class="skeleton-row">
            <td><div class="skeleton"></div></td>
            <td><div class="skeleton"></div></td>
            <td><div class="skeleton"></div></td>
            <td><div class="skeleton"></div></td>
            <td><div class="skeleton"></div></td>
            <td><div class="skeleton"></div></td>
            <td><div class="skeleton"></div></td>
          </tr>
        </template>
        <template v-else-if="users.length === 0">
          <tr>
            <td colspan="7" class="empty-row">
              검색 결과가 없습니다.
            </td>
          </tr>
        </template>
        <template v-else>
          <tr v-for="user in users" :key="user.id">
            <td class="id-cell">{{ user.id }}</td>
            <td>{{ user.name }}</td>
            <td class="email-cell">{{ user.email }}</td>
            <td>{{ user.nickname }}</td>
            <td class="date-cell">{{ formatDate(user.created_at) }}</td>
            <td class="status-cell">
              <span v-if="user.admin_role === 'admin'" class="badge badge-admin">Admin</span>
              <span v-else-if="user.admin_role === 'dev'" class="badge badge-dev">Dev</span>
              <span v-if="user.is_pro" class="badge badge-pro">Pro</span>
              <span v-if="!user.admin_role && !user.is_pro" class="badge badge-normal">일반</span>
              <span v-if="user.oauth_provider === 'kakao'" class="badge badge-kakao">카카오</span>
            </td>
            <td class="action-cell">
              <button class="action-btn view-btn" @click="$emit('viewDetail', user.id)" title="상세보기">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button class="action-btn delete-btn" @click="$emit('deleteUser', user)" title="삭제">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { UserListItem } from '../../services/api'

defineProps<{
  users: UserListItem[]
  loading: boolean
}>()

defineEmits<{
  (e: 'viewDetail', userId: number): void
  (e: 'deleteUser', user: UserListItem): void
}>()

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
</script>

<style scoped>
.user-table-container {
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.user-table {
  width: 100%;
  border-collapse: collapse;
}

.user-table th,
.user-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.user-table th {
  background-color: #f9fafb;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.user-table td {
  font-size: 14px;
  color: #1f2937;
}

.user-table tbody tr:hover {
  background-color: #f9fafb;
}

.id-cell {
  font-family: monospace;
  color: #6b7280;
}

.email-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-cell {
  color: #6b7280;
  white-space: nowrap;
}

.status-cell {
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

.badge-normal {
  background-color: #f3f4f6;
  color: #6b7280;
}

.badge-kakao {
  background-color: #fef3c7;
  color: #92400e;
}

.action-cell {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background-color: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.view-btn {
  color: #6b7280;
}

.view-btn:hover {
  background-color: #02478A;
  border-color: #02478A;
  color: #ffffff;
}

.delete-btn {
  color: #6b7280;
}

.delete-btn:hover {
  background-color: #ef4444;
  border-color: #ef4444;
  color: #ffffff;
}

.empty-row {
  text-align: center;
  padding: 48px 16px !important;
  color: #9ca3af;
}

.skeleton-row td {
  padding: 16px !important;
}

.skeleton {
  height: 16px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@media (max-width: 768px) {
  .user-table-container {
    overflow-x: auto;
  }

  .user-table {
    min-width: 800px;
  }
}
</style>
