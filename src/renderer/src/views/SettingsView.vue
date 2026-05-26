<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const appInfo = ref<{ version: string; platform: string; arch: string; dataDir: string } | null>(null)
const autoPublishConfig = ref<{ enabled: boolean; autoApprove: boolean; platforms: string[] } | null>(null)
const savingConfig = ref(false)
const serverUrl = ref('')
const serverUrlSaving = ref(false)
const serverUrlSaved = ref(false)

onMounted(async () => {
  appInfo.value = await window.api.getAppInfo()
  autoPublishConfig.value = await window.autoPublish.getConfig()
  serverUrl.value = await window.api.getServerUrl()
})

async function saveServerUrl() {
  serverUrlSaving.value = true
  try {
    await window.api.setServerUrl(serverUrl.value)
    serverUrlSaved.value = true
    setTimeout(() => { serverUrlSaved.value = false }, 2000)
  } finally {
    serverUrlSaving.value = false
  }
}

async function toggleAutoPublish() {
  if (!autoPublishConfig.value) return
  savingConfig.value = true
  try {
    autoPublishConfig.value.enabled = !autoPublishConfig.value.enabled

    // 启用自动发布时，自动添加小红书平台（如果还没有）
    if (autoPublishConfig.value.enabled && !autoPublishConfig.value.platforms.includes('xiaohongshu')) {
      autoPublishConfig.value.platforms = ['xiaohongshu']
    }

    await window.autoPublish.updateConfig(autoPublishConfig.value)
  } catch (error) {
    console.error('更新配置失败:', error)
  } finally {
    savingConfig.value = false
  }
}

async function toggleAutoApprove() {
  if (!autoPublishConfig.value) return
  savingConfig.value = true
  try {
    autoPublishConfig.value.autoApprove = !autoPublishConfig.value.autoApprove

    // 启用自动审批时，确保自动发布也启用，并添加小红书平台
    if (autoPublishConfig.value.autoApprove) {
      autoPublishConfig.value.enabled = true
      if (!autoPublishConfig.value.platforms.includes('xiaohongshu')) {
        autoPublishConfig.value.platforms = ['xiaohongshu']
      }
    }

    await window.autoPublish.updateConfig(autoPublishConfig.value)
  } catch (error) {
    console.error('更新配置失败:', error)
  } finally {
    savingConfig.value = false
  }
}
</script>

<template>
  <div class="settings-page">
    <div class="card">
      <h2 style="margin-bottom: 16px;">设置</h2>

      <div v-if="appInfo" class="settings-list">
        <div class="settings-row">
          <span class="settings-label">应用版本</span>
          <span>{{ appInfo.version }}</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">运行平台</span>
          <span>{{ appInfo.platform }}-{{ appInfo.arch }}</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">数据目录</span>
          <span class="settings-path">{{ appInfo.dataDir }}</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">登录状态</span>
          <span :style="{ color: auth.loggedIn ? 'var(--success)' : 'var(--error)' }">
            {{ auth.loggedIn ? '已登录' : '未登录' }}
          </span>
        </div>
      </div>

      <div style="margin-top: 20px;">
        <button
          v-if="auth.loggedIn"
          class="btn btn-danger"
          @click="auth.clearLogin()"
        >
          退出小红书登录
        </button>
      </div>
    </div>

    <div class="card">
      <h2 style="margin-bottom: 16px;">服务器设置</h2>
      <div class="settings-list">
        <div class="settings-row" style="flex-direction: column; align-items: flex-start; gap: 8px;">
          <span class="settings-label">服务器地址</span>
          <div style="display: flex; gap: 8px; width: 100%;">
            <input
              v-model="serverUrl"
              type="text"
              placeholder="http://your-server/api"
              style="flex: 1; padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;"
            />
            <button class="btn btn-primary" :disabled="serverUrlSaving" @click="saveServerUrl">
              {{ serverUrlSaved ? '已保存' : '保存' }}
            </button>
          </div>
          <span style="font-size: 12px; color: #999;">保存后立即生效</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h2 style="margin-bottom: 16px;">自动发布设置</h2>

      <div v-if="autoPublishConfig" class="settings-list">
        <div class="settings-row">
          <span class="settings-label">自动发布</span>
          <label class="switch">
            <input
              type="checkbox"
              :checked="autoPublishConfig.enabled"
              :disabled="savingConfig"
              @change="toggleAutoPublish"
            >
            <span class="slider"></span>
          </label>
          <span style="font-size: 12px; color: var(--text-secondary);">
            {{ autoPublishConfig.enabled ? '已启用' : '已禁用' }}
          </span>
        </div>
        <div class="settings-row">
          <span class="settings-label">自动审批</span>
          <label class="switch">
            <input
              type="checkbox"
              :checked="autoPublishConfig.autoApprove"
              :disabled="savingConfig"
              @change="toggleAutoApprove"
            >
            <span class="slider"></span>
          </label>
          <span style="font-size: 12px; color: var(--text-secondary);">
            {{ autoPublishConfig.autoApprove ? '新内容自动审批并发布' : '需要手动审批后发布' }}
          </span>
        </div>

        <div v-if="!autoPublishConfig.enabled || !autoPublishConfig.autoApprove" style="margin-top: 12px; padding: 12px; background: #fef3c7; border-radius: 8px; font-size: 13px; color: #92400e;">
          <strong>提示：</strong>要实现全自动发布，请同时启用"自动发布"和"自动审批"。
        </div>
        <div class="settings-row">
          <span class="settings-label">发布平台</span>
          <span>{{ autoPublishConfig.platforms.length > 0 ? autoPublishConfig.platforms.join(', ') : '未设置' }}</span>
        </div>
      </div>
    </div>

    <div class="card" style="color: var(--text-secondary); font-size: 13px;">
      <p>媒体发布助手 v0.1.0</p>
      <p style="margin-top: 4px;">支持小红书等内容平台的一键发布</p>
    </div>
  </div>
</template>

<style scoped>
.settings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
}

.settings-label {
  color: var(--text-secondary);
  min-width: 80px;
}

.settings-path {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border);
  transition: 0.3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--primary);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

input:disabled + .slider {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
