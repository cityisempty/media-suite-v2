<template>
  <div class="app-login-view">
    <div class="login-container">
      <div class="login-header">
        <h1>媒体自动化套件</h1>
        <p>连接服务器，开始自动化内容发布</p>
      </div>

      <div class="login-tabs">
        <button :class="{ active: loginMethod === 'email' }" @click="loginMethod = 'email'">邮箱登录</button>
        <button :class="{ active: loginMethod === 'wechat' }" @click="loginMethod = 'wechat'">微信登录</button>
      </div>

      <!-- 邮箱登录 -->
      <div v-if="loginMethod === 'email'" class="login-form">
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="email" type="email" placeholder="请输入邮箱地址" :disabled="loading" />
        </div>

        <div class="form-group">
          <label>验证码</label>
          <div class="code-input-group">
            <input v-model="code" type="text" placeholder="请输入验证码" maxlength="6" :disabled="loading" />
            <button class="send-code-btn" :disabled="!canSendCode || loading" @click="sendCode">
              {{ codeButtonText }}
            </button>
          </div>
        </div>

        <button class="login-btn" :disabled="!canLogin || loading" @click="handleEmailLogin">
          {{ loading ? '登录中...' : '登录' }}
        </button>

        <button class="test-login-btn" :disabled="loading" @click="handleTestLogin">
          使用测试账号登录
        </button>
      </div>

      <div v-if="successMessage" class="success-message">{{ successMessage }}</div>

      <!-- 微信登录 -->
      <div v-if="loginMethod === 'wechat'" class="login-form wechat-login">
        <div class="qrcode-container">
          <div v-if="!qrcodeUrl" class="qrcode-loading">
            <div class="spinner"></div>
            <p>正在获取二维码...</p>
          </div>
          <img v-else :src="qrcodeUrl" alt="微信扫码登录" />
        </div>
        <p class="qrcode-tip">请使用微信扫描二维码登录</p>
      </div>

      <div v-if="error" class="error-message">{{ error }}</div>

      <div class="server-settings-toggle" @click="showServerSettings = !showServerSettings">
        服务器设置
      </div>

      <div v-if="showServerSettings" class="server-settings">
        <div class="form-group">
          <label>服务器地址</label>
          <input v-model="serverUrl" type="text" placeholder="http://your-server/api" :disabled="serverSaving" />
        </div>
        <button class="save-server-btn" :disabled="serverSaving" @click="saveServerUrl">
          {{ serverSaved ? '已保存' : '保存' }}
        </button>
        <span class="server-tip">保存后立即生效</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

onMounted(async () => {
  serverUrl.value = await window.api.getServerUrl()
  const user = await window.api.auth.getCurrentUser()
  if (user) {
    await auth.checkStatus()
    router.push('/dashboard')
  }
})

const loginMethod = ref<'email' | 'wechat'>('email')
const email = ref('')
const code = ref('')
const loading = ref(false)
const error = ref('')
const successMessage = ref('')
const countdown = ref(0)
const qrcodeUrl = ref('')
let countdownTimer: number | null = null

const showServerSettings = ref(false)
const serverUrl = ref('')
const serverSaving = ref(false)
const serverSaved = ref(false)

const canSendCode = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value) && countdown.value === 0)
const canLogin = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value) && /^\d{6}$/.test(code.value))
const codeButtonText = computed(() => countdown.value > 0 ? `${countdown.value}秒后重试` : '发送验证码')

async function sendCode() {
  if (!canSendCode.value) return
  try {
    error.value = ''
    successMessage.value = ''
    loading.value = true
    const result = await window.api.auth.sendEmailCode(email.value)
    if (result.success) {
      successMessage.value = '验证码已发送，请检查邮件'
      countdown.value = 60
      countdownTimer = window.setInterval(() => {
        countdown.value--
        if (countdown.value <= 0 && countdownTimer) {
          clearInterval(countdownTimer)
          countdownTimer = null
        }
      }, 1000)
    } else {
      error.value = result.error || '发送验证码失败'
    }
  } catch (err: any) {
    error.value = err.message || '发送验证码失败'
  } finally {
    loading.value = false
  }
}

async function handleEmailLogin() {
  if (!canLogin.value || loading.value) return
  try {
    error.value = ''
    loading.value = true
    const result = await window.api.auth.login(email.value, code.value)
    if (result.success) {
      await auth.checkStatus()
      router.push('/dashboard')
    } else {
      error.value = result.error || '登录失败'
    }
  } catch (err: any) {
    error.value = err.message || '登录失败'
  } finally {
    loading.value = false
  }
}

async function handleTestLogin() {
  if (loading.value) return
  try {
    error.value = ''
    loading.value = true
    const result = await window.api.auth.login('test@example.com', '123456')
    if (result.success) {
      await auth.checkStatus()
      router.push('/dashboard')
    } else {
      error.value = result.error || '登录失败'
    }
  } catch (err: any) {
    error.value = err.message || '登录失败'
  } finally {
    loading.value = false
  }
}

async function saveServerUrl() {
  serverSaving.value = true
  try {
    await window.api.setServerUrl(serverUrl.value)
    serverSaved.value = true
    setTimeout(() => { serverSaved.value = false }, 2000)
  } finally {
    serverSaving.value = false
  }
}

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<style scoped>
.app-login-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-container {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h1 {
  margin: 0 0 8px;
  font-size: 24px;
  color: #1a1a1a;
}

.login-header p {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.login-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  padding: 4px;
  background: #f5f5f5;
  border-radius: 8px;
}

.login-tabs button {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.login-tabs button.active {
  background: white;
  color: #667eea;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.login-form {
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.form-group input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.code-input-group {
  display: flex;
  gap: 8px;
}

.code-input-group input {
  flex: 1;
}

.send-code-btn {
  padding: 12px 16px;
  border: 1px solid #667eea;
  background: white;
  color: #667eea;
  border-radius: 6px;
  font-size: 14px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
}

.send-code-btn:hover:not(:disabled) {
  background: #667eea;
  color: white;
}

.send-code-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-btn {
  width: 100%;
  padding: 14px;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.test-login-btn {
  width: 100%;
  margin-top: 12px;
  padding: 12px;
  border: 1px solid #ddd;
  background: white;
  color: #666;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.test-login-btn:hover:not(:disabled) {
  border-color: #667eea;
  color: #667eea;
  background: #f8f9ff;
}

.test-login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wechat-login {
  text-align: center;
}

.qrcode-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200px;
  height: 200px;
  margin: 0 auto 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.qrcode-loading {
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 12px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.qrcode-loading p {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.qrcode-container img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qrcode-tip {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.error-message {
  padding: 12px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 6px;
  color: #c33;
  font-size: 14px;
  text-align: center;
}

.success-message {
  padding: 12px;
  background: #efe;
  border: 1px solid #cfc;
  border-radius: 6px;
  color: #363;
  font-size: 14px;
  text-align: center;
}

.server-settings-toggle {
  margin-top: 16px;
  text-align: center;
  font-size: 13px;
  color: #999;
  cursor: pointer;
  user-select: none;
}

.server-settings-toggle:hover {
  color: #667eea;
}

.server-settings {
  margin-top: 12px;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 8px;
}

.server-settings .form-group {
  margin-bottom: 12px;
}

.save-server-btn {
  padding: 8px 16px;
  border: 1px solid #667eea;
  background: white;
  color: #667eea;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.save-server-btn:hover:not(:disabled) {
  background: #667eea;
  color: white;
}

.save-server-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.server-tip {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}
</style>
