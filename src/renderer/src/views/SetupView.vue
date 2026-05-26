<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { User, CheckCircle, Loader2 } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()

const step = ref(1)
const saving = ref(false)
const personaSaved = ref(false)

// 人设表单
const personaForm = ref({
  personality: '专业、温暖、有亲和力',
  age: 25,
  languageStyle: '轻松活泼，适当使用 emoji',
  expertiseFields: '心理学, 情感',
  creativeFields: '小红书图文',
  postingFrequency: 1
})

// 小红书登录状态
const qrcodeLoading = ref(false)
const qrcodeError = ref('')
const qrcodeData = ref<{ qrCode: string; url: string } | null>(null)
const loginChecking = ref(false)
const xhsLoginDone = ref(false)
let loginCheckInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  // 检查小红书登录状态
  try {
    const xhsStatus = await window.api.xhsLoginStatus()
    if (xhsStatus.loggedIn) {
      xhsLoginDone.value = true
      auth.xhsConnected = true
    }
  } catch {}

  // 加载已有人设数据（用于预填表单）
  try {
    const personaRes = await window.api.persona.getActive()
    const persona = personaRes?.data ?? personaRes
    if (persona && persona.personality) {
      personaForm.value.personality = persona.personality || personaForm.value.personality
      personaForm.value.age = persona.age || personaForm.value.age
      personaForm.value.languageStyle = persona.languageStyle || personaForm.value.languageStyle
      personaForm.value.expertiseFields = (persona.expertiseFields || []).join(', ')
      personaForm.value.creativeFields = (persona.creativeFields || []).join(', ')
      personaForm.value.postingFrequency = persona.publishSchedule?.frequency || 1
    }
  } catch {}

  // 如果小红书已连接且人设有内容，进入 step 2
  if (xhsLoginDone.value) {
    step.value = 2
  }
})

onUnmounted(() => {
  stopLoginCheck()
})

async function savePersona() {
  saving.value = true
  try {
    const data = {
      personality: personaForm.value.personality,
      age: personaForm.value.age,
      languageStyle: personaForm.value.languageStyle,
      expertiseFields: personaForm.value.expertiseFields.split(',').map(s => s.trim()).filter(Boolean),
      creativeFields: personaForm.value.creativeFields.split(',').map(s => s.trim()).filter(Boolean),
      publishSchedule: {
        timeSlots: ['09:00', '12:00', '18:00'],
        frequency: personaForm.value.postingFrequency,
        style: ''
      }
    }
    const result = await window.api.persona.create(data)
    if (result?.success === false) {
      throw new Error(result.error || '保存失败')
    }
    console.log('[Setup] 人设保存成功，auth.hasValidPersona 设为 true')
    personaSaved.value = true
    auth.hasValidPersona = true
    step.value = 2
    // 人设保存后，检查小红书是否已连接
    await checkXhsAndProceed()
  } catch (err: any) {
    if (err?.message?.includes('OFFLINE_SAVE')) {
      personaSaved.value = true
      auth.hasValidPersona = true
      step.value = 2
      await checkXhsAndProceed()
    } else {
      alert('保存人设失败：' + (err?.message || '未知错误'))
    }
  } finally {
    saving.value = false
  }
}

// 检查小红书状态，决定显示二维码还是直接完成
async function checkXhsAndProceed() {
  try {
    const status = await window.api.xhsLoginStatus()
    if (status.loggedIn) {
      xhsLoginDone.value = true
      auth.xhsConnected = true
    } else {
      loadQRCode()
    }
  } catch {
    loadQRCode()
  }
}

async function loadQRCode() {
  qrcodeLoading.value = true
  qrcodeError.value = ''
  try {
    const result = await window.api.xhsGetQRCode()
    if (result.success) {
      qrcodeData.value = result
      startLoginCheck()
    } else if (result.error?.includes('ALREADY_LOGGED_IN')) {
      xhsLoginDone.value = true
      auth.xhsConnected = true
    } else {
      qrcodeError.value = result.error || '获取二维码失败'
    }
  } catch (err: any) {
    if (err?.message?.includes('ALREADY_LOGGED_IN')) {
      xhsLoginDone.value = true
      auth.xhsConnected = true
    } else {
      qrcodeError.value = '获取二维码失败，请重试'
    }
  } finally {
    qrcodeLoading.value = false
  }
}

function startLoginCheck() {
  loginChecking.value = true
  loginCheckInterval = setInterval(async () => {
    try {
      const status = await window.api.xhsLoginStatus()
      if (status.loggedIn) {
        stopLoginCheck()
        xhsLoginDone.value = true
        auth.xhsConnected = true
        console.log('[Setup] 小红书登录成功，auth.xhsConnected 设为 true，isSetupComplete:', auth.isSetupComplete)
        alert('✅ 登录成功！')
      }
    } catch {}
  }, 2000)
}

function stopLoginCheck() {
  loginChecking.value = false
  if (loginCheckInterval) {
    clearInterval(loginCheckInterval)
    loginCheckInterval = null
  }
}

function goToDashboard() {
  console.log('[Setup] goToDashboard, isSetupComplete:', auth.isSetupComplete)
  router.push('/dashboard').catch((err) => {
    console.error('[Setup] router.push 失败:', err)
    window.location.hash = '#/dashboard'
  })
}
</script>

<template>
  <div class="setup-page">
    <div class="setup-card">
      <div class="setup-header">
        <h1>欢迎使用媒体助手</h1>
        <p class="subtitle">完成以下设置即可开始使用</p>
      </div>

      <!-- 步骤指示器 -->
      <div class="steps">
        <div class="step-item" :class="{ active: step === 1, done: step > 1 }">
          <span class="step-num">1</span>
          <span class="step-label">设置人设</span>
        </div>
        <div class="step-line" :class="{ done: step > 1 }"></div>
        <div class="step-item" :class="{ active: step === 2, done: xhsLoginDone }">
          <span class="step-num">2</span>
          <span class="step-label">连接小红书</span>
        </div>
      </div>

      <!-- Step 1: 设置人设 -->
      <div v-if="step === 1" class="step-content">
        <div class="form-group">
          <label>人设性格</label>
          <input v-model="personaForm.personality" placeholder="例如：专业、温暖、有亲和力" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>年龄</label>
            <input v-model.number="personaForm.age" type="number" min="18" max="60" />
          </div>
          <div class="form-group">
            <label>发布频率（篇/天）</label>
            <select v-model.number="personaForm.postingFrequency">
              <option :value="1">1 篇/天</option>
              <option :value="2">2 篇/天</option>
              <option :value="3">3 篇/天</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>语言风格</label>
          <input v-model="personaForm.languageStyle" placeholder="例如：轻松活泼，适当使用 emoji" />
        </div>
        <div class="form-group">
          <label>擅长领域（逗号分隔）</label>
          <input v-model="personaForm.expertiseFields" placeholder="例如：心理学, 情感" />
        </div>
        <div class="form-group">
          <label>创作领域（逗号分隔）</label>
          <input v-model="personaForm.creativeFields" placeholder="例如：小红书图文" />
        </div>
        <button class="btn-primary" @click="savePersona" :disabled="saving">
          <Loader2 v-if="saving" :size="16" class="spin" />
          <span>{{ saving ? '保存中...' : '下一步' }}</span>
        </button>
      </div>

      <!-- Step 2: 连接小红书 -->
      <div v-if="step === 2" class="step-content">
        <div v-if="xhsLoginDone" class="success-state">
          <CheckCircle :size="48" class="success-icon" />
          <h3>小红书已连接</h3>
          <button class="btn-primary" @click="goToDashboard">进入仪表盘</button>
        </div>
        <div v-else class="qrcode-section">
          <div v-if="qrcodeLoading" class="loading">
            <Loader2 :size="24" class="spin" />
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
              <Loader2 :size="16" class="spin" />
              <span>等待扫码中...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.setup-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 100%;
  background: var(--bg-subtle);
  padding: var(--spacing-4);
  box-sizing: border-box;
}

.setup-card {
  background: var(--bg-base);
  border-radius: var(--radius-xl);
  padding: var(--spacing-8);
  width: 100%;
  max-width: 520px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.setup-header {
  text-align: center;
  margin-bottom: var(--spacing-6);
}

.setup-header h1 {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--neutral-900);
  margin: 0 0 var(--spacing-2);
}

.subtitle {
  color: var(--neutral-500);
  font-size: var(--text-sm);
  margin: 0;
}

.steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-6);
}

.step-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  color: var(--neutral-400);
  font-size: var(--text-sm);
}

.step-item.active {
  color: var(--accent-600);
}

.step-item.done {
  color: var(--success);
}

.step-num {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  border: 2px solid currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
}

.step-item.active .step-num {
  background: var(--accent-500);
  border-color: var(--accent-500);
  color: white;
}

.step-item.done .step-num {
  background: var(--success);
  border-color: var(--success);
  color: white;
}

.step-line {
  width: 40px;
  height: 2px;
  background: var(--neutral-200);
}

.step-line.done {
  background: var(--success);
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.form-group label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--neutral-700);
}

.form-group input,
.form-group select {
  padding: 10px 12px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: var(--bg-base);
  color: var(--neutral-900);
  transition: border-color var(--transition-base);
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent-500);
  box-shadow: 0 0 0 3px var(--accent-100);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-3);
}

.btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  padding: 12px 24px;
  background: var(--accent-500);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: background var(--transition-base);
  margin-top: var(--spacing-2);
}

.btn-primary:hover {
  background: var(--accent-600);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-small {
  padding: 6px 16px;
  background: var(--accent-500);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  cursor: pointer;
}

.qrcode-section {
  display: flex;
  justify-content: center;
}

.loading,
.error {
  text-align: center;
  color: var(--neutral-500);
  padding: var(--spacing-6);
}

.error {
  color: var(--error);
}

.qrcode-display {
  text-align: center;
}

.qrcode-display img {
  width: 200px;
  height: 200px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--spacing-2);
  background: white;
}

.qrcode-tip {
  color: var(--neutral-600);
  font-size: var(--text-sm);
  margin: var(--spacing-3) 0 var(--spacing-2);
}

.checking {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  color: var(--accent-600);
  font-size: var(--text-sm);
}

.success-state {
  text-align: center;
  padding: var(--spacing-6);
}

.success-icon {
  color: var(--success);
  margin-bottom: var(--spacing-3);
}

.success-state h3 {
  font-size: var(--text-lg);
  color: var(--neutral-900);
  margin: 0 0 var(--spacing-4);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
