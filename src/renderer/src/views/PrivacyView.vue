<template>
  <div class="privacy-view">
    <div class="privacy-container">
      <h1>隐私政策</h1>
      <p class="updated">最后更新：2026年1月1日</p>

      <div class="section" v-for="item in sections" :key="item.title">
        <h2>{{ item.title }}</h2>
        <p v-for="p in item.content" :key="p">{{ p }}</p>
      </div>

      <div class="back-btn-wrap">
        <button class="btn-secondary" @click="router.back()">返回</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()

const sections = [
  {
    title: '信息收集',
    content: [
      '本应用仅收集提供服务所必需的信息，包括：您的账号信息（邮箱）、内容发布记录、平台账号 Cookie。',
      '我们不会收集您的设备标识符、位置信息或其他与服务无关的个人数据。',
    ]
  },
  {
    title: 'Cookie 使用',
    content: [
      '本应用需要存储您的小红书账号 Cookie，用于代替您执行内容发布操作。',
      'Cookie 仅存储在您的本地设备上，不会上传至第三方服务器。',
      '您可以随时在「平台账号」页面断开连接并清除 Cookie。',
    ]
  },
  {
    title: '数据存储',
    content: [
      '您的内容数据、人设配置和统计数据存储在我们的服务器上，用于跨设备同步。',
      '我们采用行业标准的加密措施保护您的数据安全。',
      '您可以随时申请删除账号及所有相关数据，请联系 support@psycenter.app。',
    ]
  },
  {
    title: '第三方服务',
    content: [
      '本应用通过小红书官方接口与小红书平台交互，受小红书平台服务条款约束。',
      '内容生成使用 AI 服务，生成的内容不会被用于训练 AI 模型。',
    ]
  },
  {
    title: '联系我们',
    content: [
      '如有隐私相关问题，请联系：support@psycenter.app',
    ]
  },
]
</script>

<style scoped>
.privacy-view { padding: 40px 24px; max-width: 720px; margin: 0 auto; }
.privacy-container h1 { font-size: 24px; font-weight: 600; margin-bottom: 4px; }
.updated { color: #999; font-size: 13px; margin-bottom: 32px; }
.section { margin-bottom: 28px; }
.section h2 { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #eee; }
.section p { font-size: 14px; color: #555; line-height: 1.8; margin: 4px 0; }
.back-btn-wrap { margin-top: 40px; }
.btn-secondary { padding: 8px 20px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer; font-size: 14px; }
</style>
