<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePublishStore } from '../stores/publish'
import { useAuthStore } from '../stores/auth'
import ImageUploader from '../components/ImageUploader.vue'
import TagInput from '../components/TagInput.vue'
import PublishProgress from '../components/PublishProgress.vue'

const publish = usePublishStore()
const auth = useAuthStore()
const xhsLoggedIn = ref(true)

onMounted(async () => {
  try {
    const status = await window.api.xhsLoginStatus()
    xhsLoggedIn.value = status.loggedIn
  } catch {
    // 检查失败时默认显示表单，服务端也会检查
  }
})
</script>

<template>
  <div class="publish-page">
    <div v-if="!auth.loggedIn" class="card" style="text-align: center;">
      <p style="font-size: 16px; margin-bottom: 12px;">请先登录账号</p>
      <router-link to="/login">
        <button class="btn btn-primary">去登录</button>
      </router-link>
    </div>

    <div v-else-if="!xhsLoggedIn" class="card" style="text-align: center;">
      <p style="font-size: 16px; margin-bottom: 12px;">请先登录小红书</p>
      <router-link to="/platforms">
        <button class="btn btn-primary">去登录</button>
      </router-link>
    </div>

    <template v-else>
      <!-- 标题 -->
      <div class="card">
        <div class="form-group">
          <label class="form-label">
            标题 <span style="color: var(--text-secondary); font-weight: normal;">
              ({{ publish.title.length }}/20)
            </span>
          </label>
          <input
            v-model="publish.title"
            class="form-input"
            placeholder="请输入笔记标题"
            maxlength="20"
            :disabled="publish.publishing"
          />
        </div>

        <div class="form-group">
          <label class="form-label">
            正文 <span style="color: var(--text-secondary); font-weight: normal;">
              ({{ publish.body.length }}/1000)
            </span>
          </label>
          <textarea
            v-model="publish.body"
            class="form-input"
            placeholder="分享你的见解..."
            maxlength="1000"
            :disabled="publish.publishing"
          ></textarea>
        </div>
      </div>

      <!-- 图片 -->
      <div class="card">
        <label class="form-label">图片</label>
        <ImageUploader
          :images="publish.images"
          :disabled="publish.publishing"
          @add="publish.addImages()"
          @remove="publish.removeImage($event)"
        />
        <p class="form-hint">第一张图片将作为封面，最多 9 张</p>
      </div>

      <!-- 标签 -->
      <div class="card">
        <TagInput
          :tags="publish.tags"
          :disabled="publish.publishing"
          @add="publish.addTag($event)"
          @remove="publish.removeTag($event)"
        />
      </div>

      <!-- 可见性 -->
      <div class="card">
        <div class="form-group">
          <label class="form-label">可见性</label>
          <div style="display: flex; gap: 16px;">
            <label class="radio-label">
              <input
                type="radio"
                v-model="publish.visibility"
                value="公开可见"
                :disabled="publish.publishing"
              />
              公开可见
            </label>
            <label class="radio-label">
              <input
                type="radio"
                v-model="publish.visibility"
                value="仅自己可见"
                :disabled="publish.publishing"
              />
              仅自己可见
            </label>
          </div>
        </div>
      </div>

      <!-- 发布进度 -->
      <PublishProgress
        v-if="publish.publishing || publish.result"
        :progress="publish.progress"
        :result="publish.result"
      />

      <!-- 操作按钮 -->
      <div style="display: flex; gap: 12px; margin-top: 8px;">
        <button
          class="btn btn-primary"
          :disabled="publish.publishing || !publish.title || publish.images.length === 0"
          @click="publish.publish()"
        >
          {{ publish.publishing ? '发布中...' : '发布笔记' }}
        </button>
        <button
          v-if="publish.result"
          class="btn btn-secondary"
          @click="publish.reset()"
        >
          继续发布
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.radio-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  cursor: pointer;
}

.radio-label input[type="radio"] {
  accent-color: var(--primary);
}
</style>
