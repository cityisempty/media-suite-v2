<script setup lang="ts">
import type { PublishProgress } from '../stores/publish'

defineProps<{
  progress: PublishProgress[]
  result: { success: boolean; summary?: string; error?: string } | null
}>()
</script>

<template>
  <div class="card">
    <label class="form-label">发布进度</label>

    <div v-if="progress.length > 0" class="progress-log">
      <div
        v-for="(item, i) in progress"
        :key="i"
        :class="[
          item.level === 'error' ? 'log-error' :
          item.event === 'mcp.finish' ? 'log-success' :
          'log-info'
        ]"
      >
        [{{ item.level.toUpperCase() }}] {{ item.event }}
        <span v-if="item.data && Object.keys(item.data).length">
          {{ JSON.stringify(item.data) }}
        </span>
      </div>
    </div>

    <div v-if="result" style="margin-top: 12px;">
      <div v-if="result.success" style="color: var(--success); font-weight: 500;">
        发布成功！{{ result.summary || '' }}
      </div>
      <div v-else style="color: var(--error);">
        发布失败：{{ result.error || '未知错误' }}
      </div>
    </div>
  </div>
</template>
