<script setup lang="ts">
defineProps<{
  images: { path: string; base64: string }[]
  disabled: boolean
}>()

const emit = defineEmits<{
  add: []
  remove: [index: number]
}>()
</script>

<template>
  <div class="image-uploader">
    <div class="image-grid">
      <div
        v-for="(img, index) in images"
        :key="img.path"
        class="image-item"
      >
        <img :src="`data:image/jpeg;base64,${img.base64}`" alt="" />
        <span v-if="index === 0" class="cover-badge">封面</span>
        <button
          class="remove-btn"
          :disabled="disabled"
          @click="emit('remove', index)"
        >&times;</button>
      </div>
      <button
        v-if="images.length < 9"
        class="add-btn"
        :disabled="disabled"
        @click="emit('add')"
      >
        <span class="add-icon">+</span>
        <span>添加图片</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.image-item {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--border);
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-badge {
  position: absolute;
  top: 0;
  left: 0;
  background: var(--primary);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 0 0 4px 0;
}

.remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 50%;
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.remove-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.add-btn {
  width: 100px;
  height: 100px;
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  transition: border-color 0.2s;
}

.add-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.add-icon {
  font-size: 24px;
  line-height: 1;
}
</style>
