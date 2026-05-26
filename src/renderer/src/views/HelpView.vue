<template>
  <div class="help-view">
    <div class="help-container">
      <h1>使用帮助</h1>

      <div class="section" v-for="item in helpItems" :key="item.title">
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

const helpItems = [
  {
    title: '快速开始',
    content: [
      '1. 使用邮箱验证码登录账号。',
      '2. 在「个人主页」配置您的 IP 人设，包括性格、语言风格和专业领域。',
      '3. 在「平台账号」页面扫码连接小红书账号。',
      '4. 系统将在每天凌晨自动生成当日物料包，并按计划时间自动发布。',
    ]
  },
  {
    title: '物料包',
    content: [
      '物料包由服务器每日凌晨 3 点自动生成，包含标题、正文、标签和配图。',
      '您可以在「内容管理」中查看、编辑或手动发布物料包。',
      '每个物料包的发布时间已根据小红书用户活跃规律自动分配，无需手动设置。',
    ]
  },
  {
    title: '自动发布',
    content: [
      '连接小红书账号后，系统将在计划时间自动发布内容。',
      '请确保应用保持运行状态，否则计划发布将在下次启动时重新调度。',
      '发布记录可在「内容管理」中查看。',
    ]
  },
  {
    title: '数据统计',
    content: [
      '「数据面板」展示粉丝数、发帖数、浏览量和点赞数等核心指标。',
      '数据每小时自动从小红书同步一次（需保持账号连接状态）。',
    ]
  },
  {
    title: '常见问题',
    content: [
      'Q：登录后看不到物料包？\nA：物料包在凌晨生成，当天首次登录请等待同步完成。',
      'Q：自动发布没有执行？\nA：请检查小红书账号是否已连接，Cookie 是否过期。',
      'Q：如何联系支持？\nA：请发送邮件至 support@psycenter.app',
    ]
  },
]
</script>

<style scoped>
.help-view { padding: 40px 24px; max-width: 720px; margin: 0 auto; }
.help-container h1 { font-size: 24px; font-weight: 600; margin-bottom: 32px; }
.section { margin-bottom: 32px; }
.section h2 { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee; }
.section p { font-size: 14px; color: #555; line-height: 1.8; margin: 4px 0; white-space: pre-line; }
.back-btn-wrap { margin-top: 40px; }
.btn-secondary { padding: 8px 20px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer; font-size: 14px; }
</style>
