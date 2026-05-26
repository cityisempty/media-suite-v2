<template>
  <div class="topics-view">
    <div class="topics-header">
      <div>
        <h1>月度话题</h1>
        <p class="subtitle">查看和编辑系统为您生成的本月内容话题</p>
      </div>
      <div class="month-selector">
        <button class="btn btn-ghost btn-sm" @click="changeMonth(-1)">
          <ChevronLeft :size="16" />
        </button>
        <span class="current-month">{{ displayMonth }}</span>
        <button class="btn btn-ghost btn-sm" @click="changeMonth(1)">
          <ChevronRight :size="16" />
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <p>加载中...</p>
    </div>

    <div v-else-if="topics.length === 0" class="empty-state">
      <CalendarDays :size="48" class="empty-icon" />
      <p>{{ displayMonth }}暂无话题</p>
      <p class="text-muted">请尝试切换到其他月份查看，或等待系统在月初自动生成话题</p>
    </div>

    <div v-else class="topics-list">
      <div v-for="(dayTopics, day) in groupedTopics" :key="day" class="day-group">
        <div class="day-header">
          <span class="day-label">{{ currentYearMonth }}-{{ String(day).padStart(2, '0') }}</span>
          <span class="day-count">{{ dayTopics.length }} 个话题</span>
        </div>
        <div class="day-topics">
          <div
            v-for="topic in dayTopics"
            :key="topic.id"
            class="topic-card"
            :class="{ used: topic.used }"
          >
            <div class="topic-content">
              <div v-if="editingId === topic.id" class="topic-edit">
                <textarea
                  class="input"
                  v-model="editValue"
                  rows="2"
                  @keydown.escape="cancelEdit"
                ></textarea>
                <div class="edit-actions">
                  <button class="btn btn-secondary btn-xs" @click="cancelEdit">取消</button>
                  <button class="btn btn-primary btn-xs" @click="saveEdit(topic.id)" :disabled="saving">
                    {{ saving ? '保存中...' : '保存' }}
                  </button>
                </div>
              </div>
              <div v-else class="topic-display">
                <span class="slot-badge">{{ topic.slot }}</span>
                <span class="topic-text">{{ topic.topic }}</span>
              </div>
            </div>
            <div class="topic-actions">
              <span v-if="topic.used" class="used-badge">已生成</span>
              <button
                v-else-if="editingId !== topic.id"
                class="btn-icon"
                @click="startEdit(topic)"
                title="编辑话题"
              >
                <Edit2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { CalendarDays, ChevronLeft, ChevronRight, Edit2 } from 'lucide-vue-next'

interface Topic {
  id: number
  user_id: number
  year_month: string
  day: number
  slot: number
  topic: string
  used: boolean
}

const topics = ref<Topic[]>([])
const loading = ref(true)
const editingId = ref<number | null>(null)
const editValue = ref('')
const saving = ref(false)

const now = new Date()
const currentYearMonth = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

const displayMonth = computed(() => {
  const [y, m] = currentYearMonth.value.split('-')
  return `${y} 年 ${parseInt(m)} 月`
})

const groupedTopics = computed(() => {
  const groups: Record<number, Topic[]> = {}
  for (const t of topics.value) {
    if (!groups[t.day]) groups[t.day] = []
    groups[t.day].push(t)
  }
  return groups
})

const changeMonth = (delta: number) => {
  const [y, m] = currentYearMonth.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  currentYearMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  loadTopics()
}

const loadTopics = async () => {
  loading.value = true
  try {
    console.log('[MonthlyTopics] 加载话题:', currentYearMonth.value)
    const result = await window.api.monthlyTopics.list(currentYearMonth.value)
    console.log('[MonthlyTopics] 结果:', result)
    if (result.success) {
      topics.value = result.data || []
    }
  } catch (e) {
    console.error('加载话题失败:', e)
  } finally {
    loading.value = false
  }
}

const startEdit = (topic: Topic) => {
  editingId.value = topic.id
  editValue.value = topic.topic
}

const cancelEdit = () => {
  editingId.value = null
  editValue.value = ''
}

const saveEdit = async (id: number) => {
  if (!editValue.value.trim() || saving.value) return
  saving.value = true
  try {
    const result = await window.api.monthlyTopics.update(id, editValue.value.trim())
    if (result.success) {
      const idx = topics.value.findIndex((t) => t.id === id)
      if (idx !== -1) {
        topics.value[idx].topic = editValue.value.trim()
      }
      editingId.value = null
    } else {
      alert(result.error || '保存失败')
    }
  } catch (e: any) {
    alert(`保存失败: ${e.message}`)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadTopics()
})
</script>

<style scoped>
.topics-view {
  padding: var(--spacing-8);
  max-width: 1000px;
  margin: 0 auto;
  animation: fadeIn var(--transition-base) ease-out;
}

.topics-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-8);
}

.topics-header h1 {
  margin: 0 0 var(--spacing-2);
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--neutral-900);
}

.subtitle {
  margin: 0;
  font-size: var(--text-base);
  color: var(--neutral-600);
}

.month-selector {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.current-month {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--neutral-900);
  min-width: 120px;
  text-align: center;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: var(--spacing-16) var(--spacing-6);
  color: var(--neutral-500);
}

.empty-icon {
  color: var(--neutral-400);
  margin-bottom: var(--spacing-4);
}

.text-muted {
  font-size: var(--text-sm);
  color: var(--neutral-500);
  margin-top: var(--spacing-2);
}

.topics-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.day-group {
  background: var(--bg-base);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-4) var(--spacing-6);
  background: var(--neutral-50);
  border-bottom: 1px solid var(--border-light);
}

.day-label {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--neutral-900);
}

.day-count {
  font-size: var(--text-xs);
  color: var(--neutral-500);
}

.day-topics {
  padding: var(--spacing-2);
}

.topic-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-3) var(--spacing-4);
  border-radius: var(--radius-md);
  transition: background var(--transition-base);
}

.topic-card:hover {
  background: var(--neutral-50);
}

.topic-card.used {
  opacity: 0.6;
}

.topic-content {
  flex: 1;
  min-width: 0;
}

.topic-display {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.slot-badge {
  width: 24px;
  height: 24px;
  background: var(--accent-100);
  color: var(--accent-600);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  flex-shrink: 0;
}

.topic-text {
  font-size: var(--text-sm);
  color: var(--neutral-800);
  line-height: var(--leading-relaxed);
}

.topic-edit {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.topic-edit .input {
  font-size: var(--text-sm);
}

.edit-actions {
  display: flex;
  gap: var(--spacing-2);
  justify-content: flex-end;
}

.topic-actions {
  flex-shrink: 0;
  margin-left: var(--spacing-3);
}

.used-badge {
  font-size: var(--text-xs);
  padding: 2px 8px;
  background: var(--neutral-200);
  color: var(--neutral-600);
  border-radius: var(--radius-full);
}

.btn-icon {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--neutral-500);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: var(--neutral-100);
  color: var(--accent-600);
}

.btn-xs {
  padding: 4px 8px;
  font-size: var(--text-xs);
}
</style>
