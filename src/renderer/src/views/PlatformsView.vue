<template>
  <div class="platforms-view">
    <!-- 登录成功提示 -->
    <div v-if="loginSuccess" class="login-success-toast">
      ✅ 小红书登录成功！
    </div>

    <div class="header">
      <h1>平台管理</h1>
      <button @click="openAddDialog" class="btn-primary">添加平台账号</button>
    </div>

    <div class="platforms-grid">
      <div
        v-for="account in accounts"
        :key="account.id"
        class="platform-card"
        :class="{ connected: account.status === 'connected' }"
      >
        <div class="platform-icon">
          <component :is="getPlatformIcon(account.platform)" :size="24" :stroke-width="2" />
        </div>
        <div class="platform-info">
          <h3>{{ getPlatformName(account.platform) }}</h3>
          <p class="account-name">{{ account.accountName }}</p>
          <span class="status-badge" :class="account.status">
            {{ getStatusText(account.status) }}
          </span>
        </div>
        <div class="platform-actions">
          <button @click="reconnect(account)" v-if="account.status !== 'connected'" class="btn-small">
            重新连接
          </button>
          <button @click="editAccount(account)" class="btn-small">编辑</button>
          <button @click="deleteAccount(account)" class="btn-small btn-danger">删除</button>
        </div>
      </div>

      <div class="platform-card add-card" @click="openAddDialog">
        <div class="add-icon">
          <Plus :size="48" :stroke-width="1.5" />
        </div>
        <p>添加新平台</p>
      </div>
    </div>

    <!-- 添加/编辑对话框 -->
    <div v-if="showAddDialog || showEditDialog" class="dialog-overlay" @click.self="closeDialogs">
      <div class="dialog">
        <h2>{{ showEditDialog ? '编辑平台账号' : '添加平台账号' }}</h2>

        <!-- 编辑模式：只显示表单 -->
        <form v-if="showEditDialog" @submit.prevent="submitForm">
          <div class="form-group">
            <label>平台类型</label>
            <select v-model="formData.platform" required disabled>
              <option value="xiaohongshu">小红书</option>
              <option value="douyin">抖音</option>
              <option value="weixin">微信公众号</option>
              <option value="zhihu">知乎</option>
              <option value="weibo">微博</option>
              <option value="bilibili">B站</option>
            </select>
          </div>

          <div class="form-group">
            <label>账号名称</label>
            <input v-model="formData.accountName" type="text" required placeholder="输入账号名称" />
          </div>

          <div class="form-group">
            <label>账号ID（可选）</label>
            <input v-model="formData.accountId" type="text" placeholder="平台账号ID" />
          </div>

          <div class="form-actions">
            <button type="button" @click="closeDialogs" class="btn-secondary">取消</button>
            <button type="submit" class="btn-primary">保存</button>
          </div>
        </form>

        <!-- 添加模式：显示二维码登录 -->
        <div v-else>
          <div class="form-group">
            <label>选择平台</label>
            <select v-model="formData.platform" required @change="onPlatformChange">
              <option value="xiaohongshu">小红书</option>
              <option value="douyin">抖音</option>
              <option value="weixin">微信公众号</option>
              <option value="zhihu">知乎</option>
              <option value="weibo">微博</option>
              <option value="bilibili">B站</option>
            </select>
          </div>

          <!-- 小红书：显示二维码 -->
          <div v-if="formData.platform === 'xiaohongshu'" class="qrcode-container">
            <div v-if="qrcodeLoading" class="loading">
              <p>正在获取二维码...</p>
            </div>
            <div v-else-if="qrcodeError" class="error">
              <p>{{ qrcodeError }}</p>
              <button @click="loadQRCode" class="btn-small">重试</button>
            </div>
            <div v-else-if="qrcodeData" class="qrcode-display">
              <img :src="`data:image/png;base64,${qrcodeData.qrCode}`" alt="登录二维码" />
              <p class="qrcode-tip">请使用小红书 App 扫码登录</p>
              <div v-if="loginChecking" class="checking">
                <p>等待扫码中...</p>
              </div>
            </div>
          </div>

          <!-- 其他平台：提示开发中 -->
          <div v-else class="platform-unavailable">
            <p>该平台的登录功能开发中...</p>
          </div>

          <div class="form-actions">
            <button type="button" @click="closeDialogs" class="btn-secondary">取消</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { BookOpen, Music, MessageCircle, HelpCircle, Hash, Video, Plus } from 'lucide-vue-next'

interface PlatformAccount {
  id: string
  platform: string
  accountName: string
  accountId?: string
  status: 'connected' | 'disconnected' | 'expired' | 'error'
  credentials?: any
  createdAt: number
  updatedAt: number
}

const accounts = ref<PlatformAccount[]>([])
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const currentAccount = ref<PlatformAccount | null>(null)

const formData = ref({
  platform: 'xiaohongshu',
  accountName: '',
  accountId: ''
})

// 二维码相关状态
const qrcodeLoading = ref(false)
const qrcodeError = ref('')
const qrcodeData = ref<{ qrCode: string; url: string } | null>(null)
const loginChecking = ref(false)
const loginSuccess = ref(false)
let loginCheckInterval: number | null = null

const platformNames: Record<string, string> = {
  xiaohongshu: '小红书',
  douyin: '抖音',
  weixin: '微信公众号',
  zhihu: '知乎',
  weibo: '微博',
  bilibili: 'B站'
}

const platformIcons: Record<string, any> = {
  xiaohongshu: BookOpen,
  douyin: Music,
  weixin: MessageCircle,
  zhihu: HelpCircle,
  weibo: Hash,
  bilibili: Video
}

onMounted(async () => {
  await loadAccounts()
  await checkXhsLoginStatus()
})

// 加载二维码
async function loadQRCode() {
  qrcodeLoading.value = true
  qrcodeError.value = ''
  qrcodeData.value = null

  try {
    const result = await window.api.xhsGetQRCode()
    if (result.success && result.qrCode) {
      qrcodeData.value = {
        qrCode: result.qrCode,
        url: result.url || ''
      }
      // 开始轮询检查登录状态
      startLoginCheck()
    } else if (result.error === 'ALREADY_LOGGED_IN') {
      // 用户已登录，直接创建账号
      await onLoginSuccess()
    } else {
      qrcodeError.value = result.error || '获取二维码失败'
    }
  } catch (error) {
    console.error('获取二维码失败:', error)
    qrcodeError.value = '获取二维码失败，请重试'
  } finally {
    qrcodeLoading.value = false
  }
}

// 开始检查登录状态
function startLoginCheck() {
  loginChecking.value = true
  loginCheckInterval = window.setInterval(async () => {
    try {
      const status = await window.api.xhsLoginStatus()
      if (status.loggedIn) {
        // 登录成功
        stopLoginCheck()
        await onLoginSuccess()
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
    }
  }, 2000) // 每2秒检查一次
}

// 停止检查登录状态
function stopLoginCheck() {
  loginChecking.value = false
  if (loginCheckInterval) {
    clearInterval(loginCheckInterval)
    loginCheckInterval = null
  }
}

// 登录成功后的处理
async function onLoginSuccess() {
  stopLoginCheck()

  // 检查是否已经有小红书账号
  const xhsAccounts = accounts.value.filter(a => a.platform === 'xiaohongshu')

  if (xhsAccounts.length > 0) {
    // 已有账号，更新状态为已连接
    for (const account of xhsAccounts) {
      await window.api.platform.update(account.id, {
        status: 'connected'
      })
    }
  } else {
    // 没有账号，创建新账号（使用默认昵称，用户可以稍后编辑）
    await window.api.platform.add({
      platform: 'xiaohongshu',
      accountName: '小红书账号',
      accountId: '',
      status: 'connected'
    })
  }

  // 关闭弹窗并刷新列表
  closeDialogs()
  await loadAccounts()

  // 显示成功提示
  loginSuccess.value = true
  setTimeout(() => {
    loginSuccess.value = false
  }, 3000)
}

// 平台切换时的处理
function onPlatformChange() {
  qrcodeData.value = null
  qrcodeError.value = ''
  stopLoginCheck()

  if (formData.value.platform === 'xiaohongshu') {
    loadQRCode()
  }
}

// 打开添加对话框
function openAddDialog() {
  showAddDialog.value = true
  // 默认选择小红书，自动加载二维码
  formData.value.platform = 'xiaohongshu'
  loadQRCode()
}

async function loadAccounts() {
  const result = await window.api.platform.list()
  if (result.success && result.data) {
    accounts.value = result.data
  }
}

async function checkXhsLoginStatus() {
  try {
    const status = await window.api.xhsLoginStatus()

    const xhsAccounts = accounts.value.filter(a => a.platform === 'xiaohongshu')

    if (status.loggedIn && xhsAccounts.length === 0) {
      // Cookie 有效但账号记录不存在，自动创建
      await window.api.platform.add({
        platform: 'xiaohongshu',
        accountName: '小红书账号',
        accountId: '',
        status: 'connected'
      })
      await loadAccounts()
      return
    }

    for (const account of xhsAccounts) {
      const newStatus = status.loggedIn ? 'connected' : 'disconnected'
      if (account.status !== newStatus) {
        await window.api.platform.update(account.id, { status: newStatus })
        account.status = newStatus
      }
    }
  } catch (error) {
    console.error('检查小红书登录状态失败:', error)
  }
}

function getPlatformName(platform: string): string {
  return platformNames[platform] || platform
}

function getPlatformIcon(platform: string): any {
  return platformIcons[platform] || HelpCircle
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    connected: '已连接',
    disconnected: '未连接',
    expired: '已过期',
    error: '错误'
  }
  return statusMap[status] || status
}

async function submitForm() {
  try {
    if (showEditDialog.value && currentAccount.value) {
      const result = await window.api.platform.update(currentAccount.value.id, {
        accountName: formData.value.accountName,
        accountId: formData.value.accountId
      })
      if (result.success) {
        await loadAccounts()
        closeDialogs()
      }
    } else {
      const result = await window.api.platform.add({
        platform: formData.value.platform,
        accountName: formData.value.accountName,
        accountId: formData.value.accountId,
        status: 'disconnected'
      })
      if (result.success) {
        await loadAccounts()
        closeDialogs()
      }
    }
  } catch (error) {
    console.error('Failed to submit form:', error)
  }
}

function editAccount(account: PlatformAccount) {
  currentAccount.value = account
  formData.value = {
    platform: account.platform,
    accountName: account.accountName,
    accountId: account.accountId || ''
  }
  showEditDialog.value = true
}

async function deleteAccount(account: PlatformAccount) {
  if (confirm(`确定要删除 ${account.accountName} 吗？`)) {
    const result = await window.api.platform.delete(account.id)
    if (result.success) {
      await loadAccounts()
    }
  }
}

async function reconnect(account: PlatformAccount) {
  if (account.platform === 'xiaohongshu') {
    // 使用二维码登录方式
    currentAccount.value = account
    formData.value.platform = 'xiaohongshu'
    showAddDialog.value = true
    await loadQRCode()
  } else {
    alert('该平台的重新连接功能开发中...')
  }
}

function closeDialogs() {
  showAddDialog.value = false
  showEditDialog.value = false
  currentAccount.value = null
  formData.value = {
    platform: 'xiaohongshu',
    accountName: '',
    accountId: ''
  }
  // 清理二维码状态
  qrcodeData.value = null
  qrcodeError.value = ''
  qrcodeLoading.value = false
  stopLoginCheck()
}
</script>

<style scoped>
.platforms-view {
  padding: 24px;
  position: relative;
}

.login-success-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #10b981;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  z-index: 1001;
  animation: fadeInOut 3s ease-in-out;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  15% { opacity: 1; transform: translateX(-50%) translateY(0); }
  85% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.platforms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.platform-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.2s;
}

.platform-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.platform-card.connected {
  border-color: #10b981;
  background: #f0fdf4;
}

.platform-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: #f3f4f6;
  border-radius: 8px;
  color: #6366f1;
}

.platform-icon .icon {
  font-size: 24px;
}

.platform-info h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.account-name {
  margin: 4px 0;
  color: #6b7280;
  font-size: 14px;
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.connected {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.disconnected {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.expired {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.error {
  background: #fee2e2;
  color: #991b1b;
}

.platform-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}

.add-card {
  border: 2px dashed #d1d5db;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.add-card:hover {
  border-color: #9ca3af;
  background: #f9fafb;
}

.add-icon {
  color: #9ca3af;
}

.add-card p {
  color: #6b7280;
  margin: 0;
}

.dialog-overlay {
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
}

.dialog {
  background: white;
  border-radius: 8px;
  padding: 24px;
  width: 90%;
  max-width: 500px;
}

.dialog h2 {
  margin: 0 0 20px 0;
  font-size: 20px;
  font-weight: 600;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #374151;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.btn-primary,
.btn-secondary,
.btn-small,
.btn-danger {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-small {
  padding: 6px 12px;
  font-size: 13px;
  background: #f3f4f6;
  color: #374151;
}

.btn-small:hover {
  background: #e5e7eb;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.qrcode-container {
  margin: 20px 0;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qrcode-display {
  text-align: center;
}

.qrcode-display img {
  width: 200px;
  height: 200px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  background: white;
}

.qrcode-tip {
  margin-top: 16px;
  color: #6b7280;
  font-size: 14px;
}

.loading,
.error,
.checking {
  text-align: center;
  color: #6b7280;
}

.error {
  color: #ef4444;
}

.checking {
  margin-top: 12px;
  color: #3b82f6;
  font-size: 14px;
}

.platform-unavailable {
  text-align: center;
  padding: 40px;
  color: #9ca3af;
}
</style>
