<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  tags: string[]
  disabled: boolean
}>()

const emit = defineEmits<{
  add: [tag: string]
  remove: [index: number]
}>()

const input = ref('')

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    const val = input.value.trim()
    if (val) {
      emit('add', val)
      input.value = ''
    }
  }
}
</script>

<template>
  <div class="tag-input">
    <label class="form-label">
      标签 <span style="color: var(--text-secondary); font-weight: normal;">
        ({{ tags.length }}/10)
      </span>
    </label>
    <div class="tags-area">
      <span
        v-for="(tag, index) in tags"
        :key="tag"
        class="tag-chip"
      >
        #{{ tag }}
        <button
          class="tag-remove"
          :disabled="disabled"
          @click="emit('remove', index)"
        >&times;</button>
      </span>
      <input
        v-model="input"
        class="tag-field"
        placeholder="输入标签后回车"
        :disabled="disabled || tags.length >= 10"
        @keydown="handleKeydown"
      />
    </div>
  </div>
</template>

<style scoped>
.tags-area {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  min-height: 40px;
}

.tags-area:focus-within {
  border-color: var(--primary);
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #fff1f0;
  color: var(--primary);
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 13px;
}

.tag-remove {
  background: none;
  color: var(--primary);
  font-size: 14px;
  line-height: 1;
  padding: 0;
  cursor: pointer;
}

.tag-remove:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.tag-field {
  border: none;
  outline: none;
  font-size: 14px;
  min-width: 100px;
  flex: 1;
  background: transparent;
}

.tag-field::placeholder {
  color: var(--text-secondary);
}
</style>
