<template>
  <div class="about-view">
    <div class="about-container">
      <div class="app-icon">
        <div class="icon-fallback">心</div>
      </div>
      <h1>心理学媒体助手</h1>
      <p class="version">版本 {{ version }}</p>
      <p class="tagline">专为心理学内容创作者设计的自媒体自动化发布工具</p>

      <div class="info-section">
        <div class="info-row">
          <span class="label">开发者</span>
          <span>PsyCenter</span>
        </div>
        <div class="info-row">
          <span class="label">平台支持</span>
          <span>小红书</span>
        </div>
        <div class="info-row">
          <span class="label">运行环境</span>
          <span>{{ platform }}</span>
        </div>
      </div>

      <div class="links">
        <button class="link-btn" @click="openPrivacy">隐私政策</button>
        <span class="divider">·</span>
        <button class="link-btn" @click="openHelp">使用帮助</button>
      </div>

      <p class="copyright">© 2026 PsyCenter. 保留所有权利。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const showFallback = ref(false)
const version = ref('1.0.0')
const platform = ref('')

try {
  version.value = window.api?.getAppVersion?.() || '1.0.0'
} catch {}

platform.value = navigator.platform.includes('Win') ? 'Windows' : 'macOS'

function openPrivacy() { router.push('/privacy') }
function openHelp() { router.push('/help') }
</script>

<style scoped>
.about-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f5f5f7;
}
.about-container {
  text-align: center;
  padding: 48px 40px;
  background: white;
  border-radius: 16px;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
}
.app-icon img, .icon-fallback {
  width: 80px;
  height: 80px;
  border-radius: 18px;
  margin: 0 auto 16px;
  display: block;
}
.icon-fallback {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-size: 36px;
  line-height: 80px;
}
h1 { font-size: 22px; font-weight: 600; margin: 0 0 4px; }
.version { color: #999; font-size: 13px; margin: 0 0 12px; }
.tagline { color: #555; font-size: 14px; margin: 0 0 24px; }
.info-section { background: #f9f9f9; border-radius: 10px; padding: 16px; margin-bottom: 24px; }
.info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
.label { color: #999; }
.links { margin-bottom: 20px; }
.link-btn { background: none; border: none; color: #667eea; cursor: pointer; font-size: 14px; }
.divider { color: #ccc; margin: 0 8px; }
.copyright { color: #bbb; font-size: 12px; margin: 0; }
</style>
