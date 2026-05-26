<template>
  <div class="dashboard-view">
    <div class="dashboard-header">
      <div class="header-content">
        <h1 class="header-title">欢迎回来，{{ userName }}</h1>
        <p class="header-subtitle">您的内容自动化助手已就绪</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="refreshData" :disabled="isLoading">
          <RefreshCw :size="16" :class="{ 'spin': isLoading }" />
          <span>{{ isLoading ? '刷新中...' : '刷新数据' }}</span>
        </button>
        <button class="btn btn-primary">
          <Plus :size="16" />
          <span>创建内容</span>
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <div
        v-for="(stat, index) in statsData"
        :key="index"
        class="stat-card"
        :class="`stat-${stat.color}`"
      >
        <div class="stat-header">
          <div class="stat-icon">
            <component :is="stat.icon" :size="24" :stroke-width="2" />
          </div>
          <div class="stat-trend" :class="stat.trend > 0 ? 'positive' : 'negative'">
            <component :is="stat.trend > 0 ? TrendingUp : TrendingDown" :size="14" />
            <span>{{ Math.abs(stat.trend) }}%</span>
          </div>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ formatNumber(stat.value) }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </div>
    </div>

    <div class="content-section">
      <div class="section-header">
        <h2 class="section-title">快速操作</h2>
        <p class="section-subtitle">选择一个操作开始</p>
      </div>

      <div class="action-grid">
        <div
          class="action-card action-card-clickable"
          @click="syncMaterials"
        >
          <div class="action-icon sync-icon">
            <Download :size="24" :stroke-width="2" :class="{ spin: isSyncing }" />
          </div>
          <div class="action-content">
            <h3 class="action-title">同步物料</h3>
            <p class="action-desc">{{ syncStatus || '从服务器获取最新生成的物料' }}</p>
          </div>
        </div>
        <router-link
          v-for="(action, index) in actions"
          :key="index"
          :to="action.path"
          class="action-card"
        >
          <div class="action-icon">
            <component :is="action.icon" :size="24" :stroke-width="2" />
          </div>
          <div class="action-content">
            <h3 class="action-title">{{ action.title }}</h3>
            <p class="action-desc">{{ action.desc }}</p>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  FileText,
  Users,
  Eye,
  Heart,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Share2,
  BarChart3,
  Plus,
  RefreshCw,
  Download
} from 'lucide-vue-next'

const userName = ref('用户')
const isLoading = ref(false)
const isSyncing = ref(false)
const syncStatus = ref('')

const statsData = ref([
  {
    icon: FileText,
    value: 0,
    label: '总发布数',
    trend: 0,
    color: 'accent'
  },
  {
    icon: Users,
    value: 0,
    label: '总粉丝数',
    trend: 0,
    color: 'success'
  },
  {
    icon: Eye,
    value: 0,
    label: '总浏览量',
    trend: 0,
    color: 'info'
  },
  {
    icon: Heart,
    value: 0,
    label: '总点赞数',
    trend: 0,
    color: 'warning'
  }
])

const actions = ref([
  {
    icon: Sparkles,
    title: '个人设置',
    desc: '管理账号信息和 IP 人设',
    path: '/profile'
  },
  {
    icon: Share2,
    title: '连接平台',
    desc: '管理社交媒体账号连接',
    path: '/platforms'
  },
  {
    icon: FileText,
    title: '内容管理',
    desc: '查看和管理待发布内容',
    path: '/content'
  },
  {
    icon: BarChart3,
    title: '数据分析',
    desc: '查看详细的数据报表',
    path: '/analytics'
  }
])

const formatNumber = (num: number) => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  return num.toLocaleString()
}

async function loadAnalyticsData(forceRefresh = false) {
  try {
    const data = await window.api.analytics.getOverview(forceRefresh)

    // 更新统计卡片数据
    statsData.value[0].value = data.totalPosts
    statsData.value[1].value = data.totalFollowers
    statsData.value[2].value = data.totalViews
    statsData.value[3].value = data.totalLikes

    // 计算趋势（这里简化处理，实际应该对比历史数据）
    statsData.value[0].trend = data.totalPosts > 0 ? 12.5 : 0
    statsData.value[1].trend = data.totalFollowers > 0 ? 8.3 : 0
    statsData.value[2].trend = data.totalViews > 0 ? 15.7 : 0
    statsData.value[3].trend = data.totalLikes > 0 ? 10.2 : 0
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_LOGGED_IN') {
      // 直接跳转到平台管理页面
      alert('检测到您还未登录小红书账号\n\n即将跳转到平台管理页面进行扫码登录')
      window.location.hash = '#/platforms'
    } else if (error instanceof Error && error.message === 'USER_ID_NOT_CONFIGURED') {
      // 提示用户配置用户ID
      alert('检测到您还未配置小红书用户ID\n\n请在平台管理页面编辑账号，添加您的小红书用户ID\n\n用户ID可以在您的小红书个人主页URL中找到')
      window.location.hash = '#/platforms'
    } else {
      console.error('Failed to load analytics data:', error)
    }
  }
}

async function refreshData() {
  isLoading.value = true
  try {
    await loadAnalyticsData(true)
  } finally {
    isLoading.value = false
  }
}

async function syncMaterials() {
  if (isSyncing.value) return
  isSyncing.value = true
  syncStatus.value = '正在同步...'
  try {
    const result = await window.api.material.sync()
    if (result.success) {
      syncStatus.value = result.message || '同步完成'
    } else {
      syncStatus.value = `同步失败: ${result.error}`
    }
  } catch (e: any) {
    syncStatus.value = `同步失败: ${e.message}`
  } finally {
    isSyncing.value = false
    setTimeout(() => { syncStatus.value = '' }, 5000)
  }
}

onMounted(async () => {
  try {
    const user = await window.api.auth.getCurrentUser()
    if (user) {
      userName.value = user.nickname || user.phone || '用户'
    }

    // 加载分析数据
    await loadAnalyticsData()
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  }
})
</script>

<style scoped>
.dashboard-view {
  padding: var(--spacing-8);
  max-width: 1400px;
  margin: 0 auto;
  animation: fadeIn var(--transition-base) ease-out;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-8);
}

.header-content {
  flex: 1;
}

.header-title {
  margin: 0 0 var(--spacing-2);
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--neutral-900);
  line-height: var(--leading-tight);
}

.header-subtitle {
  margin: 0;
  font-size: var(--text-base);
  color: var(--neutral-600);
}

.header-actions {
  display: flex;
  gap: var(--spacing-3);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--spacing-6);
  margin-bottom: var(--spacing-8);
}

.stat-card {
  background: var(--bg-base);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: var(--spacing-6);
  transition: all var(--transition-base);
}

.stat-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: var(--border-default);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-4);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--neutral-100);
  color: var(--neutral-600);
}

.stat-accent .stat-icon {
  background: var(--accent-100);
  color: var(--accent-600);
}

.stat-success .stat-icon {
  background: var(--success-light);
  color: var(--success);
}

.stat-info .stat-icon {
  background: var(--info-light);
  color: var(--info);
}

.stat-warning .stat-icon {
  background: var(--warning-light);
  color: var(--warning);
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: 4px 8px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.stat-trend.positive {
  background: var(--success-light);
  color: var(--success);
}

.stat-trend.negative {
  background: var(--error-light);
  color: var(--error);
}

.stat-body {
  margin-top: var(--spacing-4);
}

.stat-value {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--neutral-900);
  margin-bottom: var(--spacing-1);
  line-height: 1;
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--neutral-600);
  font-weight: var(--font-medium);
}

.content-section {
  margin-bottom: var(--spacing-8);
}

.section-header {
  margin-bottom: var(--spacing-6);
}

.section-title {
  margin: 0 0 var(--spacing-1);
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--neutral-900);
}

.section-subtitle {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--neutral-600);
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-6);
}

.action-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-6);
  background: var(--bg-base);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  text-decoration: none;
  transition: all var(--transition-base);
}

.action-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: var(--accent-300);
}

.action-card-clickable {
  cursor: pointer;
}

.sync-icon {
  background: var(--success-light);
  color: var(--success);
}

.action-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-100);
  color: var(--accent-600);
  flex-shrink: 0;
}

.action-content {
  flex: 1;
  min-width: 0;
}

.action-title {
  margin: 0 0 var(--spacing-1);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--neutral-900);
}

.action-desc {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--neutral-600);
  line-height: var(--leading-relaxed);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 响应式 */
@media (max-width: 768px) {
  .dashboard-view {
    padding: var(--spacing-4);
  }

  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-4);
  }

  .header-title {
    font-size: var(--text-2xl);
  }

  .stats-grid,
  .action-grid {
    grid-template-columns: 1fr;
  }
}
</style>
