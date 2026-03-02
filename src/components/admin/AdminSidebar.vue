<template>
  <aside class="admin-sidebar">
    <nav class="sidebar-nav">
      <!-- 대시보드: dev, admin 모두 접근 가능 -->
      <button
        v-if="permissions.dashboard"
        class="nav-item"
        :class="{ active: activeMenu === 'dashboard' }"
        @click="$emit('menuChange', 'dashboard')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        <span>대시보드</span>
      </button>

      <!-- 회원 관리: admin만 접근 가능 -->
      <button
        v-if="permissions.user_management"
        class="nav-item"
        :class="{ active: activeMenu === 'users' }"
        @click="$emit('menuChange', 'users')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <span>회원 관리</span>
      </button>

      <!-- DB 브라우저: admin만 접근 가능 -->
      <button
        v-if="permissions.db_browser"
        class="nav-item"
        :class="{ active: activeMenu === 'database' }"
        @click="$emit('menuChange', 'database')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
        </svg>
        <span>DB 브라우저</span>
      </button>

      <!-- 콘텐츠 관리: dev, admin 모두 접근 가능 -->
      <button
        v-if="permissions.content_management"
        class="nav-item"
        :class="{ active: activeMenu === 'content' }"
        @click="$emit('menuChange', 'content')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <span>콘텐츠 관리</span>
      </button>

      <!-- 지식 관리: dev, admin 모두 접근 가능 -->
      <button
        v-if="permissions.knowledge_management"
        class="nav-item"
        :class="{ active: activeMenu === 'knowledge' }"
        @click="$emit('menuChange', 'knowledge')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          <line x1="12" y1="6" x2="12" y2="12"></line>
          <line x1="9" y1="9" x2="15" y2="9"></line>
        </svg>
        <span>지식 관리</span>
      </button>

      <!-- 채팅 기록: admin만 접근 가능 -->
      <button
        v-if="permissions.chat_history"
        class="nav-item"
        :class="{ active: activeMenu === 'chat-history' }"
        @click="$emit('menuChange', 'chat-history')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>채팅 기록</span>
      </button>

      <!-- 백업: admin만 접근 가능 -->
      <button
        v-if="permissions.backup"
        class="nav-item"
        :class="{ active: activeMenu === 'backup' }"
        @click="$emit('menuChange', 'backup')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>백업</span>
      </button>
    </nav>

    <!-- 권한 레벨 표시 -->
    <div class="role-badge" :class="adminRole">
      <span v-if="adminRole === 'admin'">Admin</span>
      <span v-else-if="adminRole === 'dev'">Developer</span>
    </div>
  </aside>
</template>

<script setup lang="ts">
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

defineProps<{
  activeMenu: string
  adminRole: 'dev' | 'admin' | null
  permissions: Permissions
}>()

defineEmits<{
  (e: 'menuChange', menu: string): void
}>()
</script>

<style scoped>
.admin-sidebar {
  width: 240px;
  min-height: calc(100vh - 64px);
  background-color: #ffffff;
  border-right: 1px solid #e5e7eb;
  padding: 16px 0;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 12px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  background-color: transparent;
  border: none;
  border-radius: 8px;
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.nav-item:hover {
  background-color: #f3f4f6;
  color: #1f2937;
}

.nav-item.active {
  background-color: #eff6ff;
  color: #02478A;
}

.nav-item.active svg {
  color: #02478A;
}

@media (max-width: 768px) {
  .admin-sidebar {
    width: 100%;
    min-height: auto;
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
    padding: 8px 0;
  }

  .sidebar-nav {
    flex-direction: row;
    justify-content: center;
    gap: 8px;
  }

  .nav-item {
    flex-direction: column;
    gap: 4px;
    padding: 8px 16px;
    font-size: 12px;
  }

  .nav-item svg {
    width: 18px;
    height: 18px;
  }

  .role-badge {
    display: none;
  }
}

/* Role Badge 스타일 */
.role-badge {
  position: absolute;
  bottom: 24px;
  left: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.role-badge.admin {
  background-color: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.role-badge.dev {
  background-color: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

/* Sidebar position relative for role badge */
.admin-sidebar {
  position: relative;
}
</style>
