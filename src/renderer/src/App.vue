<script setup lang="ts">
import { useAuthStore } from './stores/auth'
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  LayoutDashboard,
  FileText,
  Share2,
  BarChart3,
  Send,
  User,
  LogOut,
  CalendarDays
} from 'lucide-vue-next'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const showSidebar = computed(() => route.name !== 'app-login' && route.name !== 'setup')

onMounted(() => {
  auth.checkStatus()
  // 监听主进程菜单导航
  window.electron?.ipcRenderer?.on('navigate', (_e: any, path: string) => {
    router.push(path)
  })

  // 监听强制登出（refresh_token 过期）
  window.api.auth.onForceLogout(() => {
    console.log('[App] 收到强制登出事件')
    auth.user = null
    auth.loggedIn = false
    auth.expiresAt = null
    auth.hasValidPersona = false
    auth.xhsConnected = false
    auth.setupChecked = false
    auth.checked = false
    router.push('/app-login')
  })
})

const handleLogout = async () => {
  await auth.logout()
  router.push('/app-login')
}
</script>

<template>
  <div class="app-layout">
    <aside v-if="showSidebar" class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <div class="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="logo-text">
            <div class="logo-title">媒体助手</div>
            <div class="logo-subtitle">AI 自动化</div>
          </div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <router-link to="/dashboard" class="nav-item">
          <LayoutDashboard :size="20" :stroke-width="2" />
          <span class="nav-label">仪表盘</span>
        </router-link>
        <router-link to="/content" class="nav-item">
          <FileText :size="20" :stroke-width="2" />
          <span class="nav-label">内容管理</span>
        </router-link>
        <router-link to="/monthly-topics" class="nav-item">
          <CalendarDays :size="20" :stroke-width="2" />
          <span class="nav-label">月度话题</span>
        </router-link>
        <router-link to="/platforms" class="nav-item">
          <Share2 :size="20" :stroke-width="2" />
          <span class="nav-label">平台管理</span>
        </router-link>
        <router-link to="/analytics" class="nav-item">
          <BarChart3 :size="20" :stroke-width="2" />
          <span class="nav-label">数据分析</span>
        </router-link>
        <router-link to="/publish" class="nav-item">
          <Send :size="20" :stroke-width="2" />
          <span class="nav-label">发布管理</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <router-link to="/profile" class="user-card">
          <div class="user-avatar">
            <img v-if="auth.user?.avatarUrl" :src="auth.user.avatarUrl" class="avatar-img" />
            <User v-else :size="20" />
            <span class="status-indicator" :class="auth.loggedIn ? 'online' : 'offline'"></span>
          </div>
          <div class="user-info">
            <div class="user-name">{{ auth.user?.nickname || '用户' }}</div>
            <div class="user-status">{{ auth.loggedIn ? '在线' : '离线' }}</div>
          </div>
        </router-link>
        <button v-if="auth.loggedIn" class="logout-btn" @click="handleLogout">
          <LogOut :size="16" />
          <span>退出登录</span>
        </button>
      </div>
    </aside>

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-subtle);
}

.sidebar {
  width: 240px;
  background: var(--bg-base);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-default);
  flex-shrink: 0;
}

.sidebar-header {
  padding: var(--spacing-6);
  border-bottom: 1px solid var(--border-light);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: var(--accent-500);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.logo-text {
  flex: 1;
  min-width: 0;
}

.logo-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--neutral-900);
  line-height: var(--leading-tight);
}

.logo-subtitle {
  font-size: var(--text-xs);
  color: var(--neutral-500);
  font-weight: var(--font-medium);
  margin-top: 2px;
}

.sidebar-nav {
  flex: 1;
  padding: var(--spacing-4);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: 10px 12px;
  color: var(--neutral-600);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  position: relative;
}

.nav-item:hover {
  background: var(--neutral-100);
  color: var(--neutral-900);
}

.nav-item.router-link-active {
  background: var(--accent-50);
  color: var(--accent-600);
}

.nav-item.router-link-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: var(--accent-500);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.nav-label {
  flex: 1;
}

.sidebar-footer {
  padding: var(--spacing-4);
  border-top: 1px solid var(--border-light);
  background: var(--bg-subtle);
}

.user-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2);
  margin-bottom: var(--spacing-2);
  border-radius: var(--radius-md);
  text-decoration: none;
  transition: all var(--transition-base);
}

.user-card:hover {
  background: var(--neutral-100);
}

.user-avatar {
  width: 36px;
  height: 36px;
  background: var(--accent-100);
  color: var(--accent-600);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-full);
}

.status-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  border: 2px solid var(--bg-base);
  background: var(--neutral-400);
}

.status-indicator.online {
  background: var(--success);
}

.status-indicator.offline {
  background: var(--neutral-400);
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--neutral-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-status {
  font-size: var(--text-xs);
  color: var(--neutral-500);
}

.logout-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  padding: 8px 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-base);
  color: var(--neutral-700);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-base);
}

.logout-btn:hover {
  background: var(--error);
  color: white;
  border-color: var(--error);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-subtle);
}

/* 滚动条样式 */
.sidebar-nav::-webkit-scrollbar {
  width: 6px;
}

.sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: var(--neutral-300);
  border-radius: var(--radius-full);
}

.sidebar-nav::-webkit-scrollbar-thumb:hover {
  background: var(--neutral-400);
}
</style>
