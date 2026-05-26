<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const qrCodeUrl = ref('')
const loading = ref(false)
const error = ref('')
const successMessage = ref('')
const polling = ref(false)
let pollTimer: number | null = null

onMounted(async () => {
  await auth.checkStatus()
})

onUnmounted(() => {
  stopPolling()
})

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  polling.value = false
}

async function startQrcodeLogin() {
  try {
    loading.value = true
    error.value = ''
    successMessage.value = ''
    qrCodeUrl.value = ''

    const result = await window.api.xhsGetQRCode()
    if (result.success) {
      qrCodeUrl.value = `data:image/png;base64,${result.qrCode}`
      startPollingLoginStatus()
    } else {
      if (result.error === 'ALREADY_LOGGED_IN') {
        successMessage.value = '已处于登录状态'
        await auth.checkStatus()
      } else {
        error.value = result.error || '获取二维码失败'
      }
    }
  } catch (err: any) {
    error.value = err.message || '获取二维码失败'
  } finally {
    loading.value = false
  }
}

function startPollingLoginStatus() {
  polling.value = true
  pollTimer = window.setInterval(async () => {
    try {
      const status = await window.api.xhsLoginStatus()
      if (status.loggedIn) {
        stopPolling()
        successMessage.value = '登录成功！'
        qrCodeUrl.value = ''
        await auth.checkStatus()
      }
    } catch (err) {
      console.error('轮询登录状态失败:', err)
    }
  }, 2000)
}
</script>

<template>
  <div class="login-page">
    <div class="card" style="max-width: 400px; margin: 40px auto;">
      <h2 style="margin-bottom: 8px;">小红书登录</h2>
      <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 20px;">
        登录后即可发布笔记到小红书
      </p>

      <div v-if="auth.loggedIn" class="login-success">
        <div class="success-icon">&#x2705;</div>
        <p>已登录小红书</p>
        <p v-if="auth.expiresAt" class="form-hint">
          登录有效期至 {{ new Date(auth.expiresAt * 1000).toLocaleString() }}
        </p>
        <button class="btn btn-danger" style="margin-top: 12px;" @click="auth.clearLogin()">
          退出登录
        </button>
      </div>

      <div v-else>
        <!-- 二维码显示区域 -->
        <div v-if="qrCodeUrl" class="qrcode-section">
          <div class="qrcode-container">
            <img :src="qrCodeUrl" alt="扫码登录" />
          </div>
          <p class="qrcode-tip">请使用小红书 APP 扫描二维码登录</p>
          <p v-if="polling" class="polling-status">等待扫码中...</p>
        </div>

        <!-- 未显示二维码时的提示 -->
        <div v-else>
          <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px;">
            点击下方按钮获取二维码，使用小红书 APP 扫码登录。
          </p>
          <button
            class="btn btn-primary"
            style="width: 100%;"
            :disabled="loading"
            @click="startQrcodeLogin"
          >
            {{ loading ? '获取二维码中...' : '获取登录二维码' }}
          </button>
        </div>

        <!-- 成功提示 -->
        <div v-if="successMessage" class="success-message">
          {{ successMessage }}
        </div>

        <!-- 错误提示 -->
        <p v-if="error" style="color: var(--error); font-size: 13px; margin-top: 12px;">
          {{ error }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-success {
  text-align: center;
  padding: 20px 0;
}

.success-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.qrcode-section {
  text-align: center;
}

.qrcode-container {
  display: inline-block;
  padding: 16px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 16px;
}

.qrcode-container img {
  width: 200px;
  height: 200px;
  display: block;
}

.qrcode-tip {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.polling-status {
  font-size: 13px;
  color: var(--primary);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.success-message {
  padding: 12px;
  background: #efe;
  border: 1px solid #cfc;
  border-radius: 6px;
  color: #363;
  font-size: 14px;
  text-align: center;
  margin-top: 12px;
}
</style>
