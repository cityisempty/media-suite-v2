<template>
  <div class="persona-view">
    <div class="persona-header">
      <h1>IP 人设管理</h1>
      <button class="btn-primary" @click="showCreateDialog = true">
        + 创建人设
      </button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="personas.length === 0" class="empty-state">
      <div class="empty-icon">🎭</div>
      <p>还没有创建人设</p>
      <button class="btn-primary" @click="showCreateDialog = true">
        创建第一个人设
      </button>
    </div>

    <div v-else class="persona-grid">
      <div
        v-for="persona in personas"
        :key="persona.id"
        class="persona-card"
        :class="{ active: persona.isActive }"
      >
        <div class="persona-card-header">
          <h3>{{ persona.name || '我的人设' }}</h3>
          <div class="persona-actions">
            <button class="btn-icon" @click="editPersona(persona)" title="编辑">
              ✏️
            </button>
            <button class="btn-icon" @click="confirmDelete(persona)" title="删除">
              🗑️
            </button>
          </div>
        </div>

        <div class="persona-info">
          <div class="info-item">
            <span class="label">性格：</span>
            <span>{{ persona.personality }}</span>
          </div>
          <div class="info-item">
            <span class="label">年龄：</span>
            <span>{{ persona.age }}岁</span>
          </div>
          <div class="info-item">
            <span class="label">语言风格：</span>
            <span>{{ persona.languageStyle }}</span>
          </div>
          <div class="info-item">
            <span class="label">擅长领域：</span>
            <span>{{ persona.expertiseFields.join('、') }}</span>
          </div>
        </div>

        <div class="persona-footer">
          <button
            v-if="!persona.isActive"
            class="btn-secondary"
            @click="setActive(persona.id)"
          >
            设为当前人设
          </button>
          <span v-else class="active-badge">当前使用</span>
        </div>
      </div>
    </div>

    <!-- 创建/编辑对话框 -->
    <div v-if="showCreateDialog || editingPersona" class="dialog-overlay" @click.self="closeDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h2>{{ editingPersona ? '编辑人设' : '创建人设' }}</h2>
          <button class="btn-close" @click="closeDialog">×</button>
        </div>

        <div class="dialog-body">
          <div class="form-group">
            <label>人设名称 *</label>
            <input v-model="formData.name" type="text" placeholder="例如：心理学博主" />
          </div>

          <div class="form-group">
            <label>性格特点 *</label>
            <input v-model="formData.personality" type="text" placeholder="例如：温和、专业、有同理心" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>年龄 *</label>
              <input v-model.number="formData.age" type="number" min="18" max="100" />
            </div>

            <div class="form-group">
              <label>语言风格 *</label>
              <input v-model="formData.languageStyle" type="text" placeholder="例如：亲切、专业" />
            </div>
          </div>

          <div class="form-group">
            <label>擅长领域 *（用逗号分隔）</label>
            <input
              v-model="expertiseInput"
              type="text"
              placeholder="例如：心理学、情绪管理、人际关系"
            />
          </div>

          <div class="form-group">
            <label>内容偏好</label>
            <textarea
              v-model="formData.contentPreferences"
              rows="3"
              placeholder="描述希望生成的内容类型、风格等..."
            ></textarea>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn-secondary" @click="closeDialog">取消</button>
          <button class="btn-primary" @click="savePersona" :disabled="!isFormValid">
            {{ editingPersona ? '保存' : '创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <div v-if="deletingPersona" class="dialog-overlay" @click.self="deletingPersona = null">
      <div class="dialog dialog-small">
        <div class="dialog-header">
          <h2>确认删除</h2>
        </div>
        <div class="dialog-body">
          <p>确定要删除人设「{{ deletingPersona.name || '我的人设' }}」吗？此操作无法撤销。</p>
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" @click="deletingPersona = null">取消</button>
          <button class="btn-danger" @click="deletePersona">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Persona {
  id: string
  userId: string
  personality: string
  age: number
  languageStyle: string
  gender?: string
  expertiseFields: string[]
  creativeFields: string[]
  publishSchedule: {
    timeSlots: string[]
    frequency: number
    style: string
  }
  serverGenerated?: {
    track: string
    imagePosition: string
    catchphrase: string
    growthPlan: string
  }
  updatedAt: string
  syncedAt?: string
  // 前端扩展字段
  name?: string
  isActive?: boolean
}

const personas = ref<Persona[]>([])
const loading = ref(true)
const showCreateDialog = ref(false)
const editingPersona = ref<Persona | null>(null)
const deletingPersona = ref<Persona | null>(null)

const formData = ref({
  name: '',
  personality: '',
  age: 30,
  languageStyle: '',
  contentPreferences: ''
})

const expertiseInput = ref('')

const isFormValid = computed(() => {
  return (
    formData.value.name.trim() &&
    formData.value.personality.trim() &&
    formData.value.age >= 18 &&
    formData.value.languageStyle.trim() &&
    expertiseInput.value.trim()
  )
})

async function loadPersonas() {
  try {
    loading.value = true
    const result = await window.api.persona.list()
    personas.value = result.data || []
  } catch (error) {
    console.error('Failed to load personas:', error)
  } finally {
    loading.value = false
  }
}

function editPersona(persona: Persona) {
  editingPersona.value = persona
  formData.value = {
    name: persona.name || '',
    personality: persona.personality,
    age: persona.age,
    languageStyle: persona.languageStyle,
    contentPreferences: persona.publishSchedule.style || ''
  }
  expertiseInput.value = persona.expertiseFields.join('、')
}

function closeDialog() {
  showCreateDialog.value = false
  editingPersona.value = null
  formData.value = {
    name: '',
    personality: '',
    age: 30,
    languageStyle: '',
    contentPreferences: ''
  }
  expertiseInput.value = ''
}

async function savePersona() {
  if (!isFormValid.value) return

  // 映射到后端字段
  const data = {
    name: formData.value.name,
    personality: formData.value.personality,
    age: formData.value.age,
    languageStyle: formData.value.languageStyle,
    expertiseFields: expertiseInput.value.split(/[、,，]/).map(s => s.trim()).filter(Boolean),
    creativeFields: [],
    publishSchedule: {
      timeSlots: [],
      frequency: 1, // 默认值，实际由订阅套餐决定
      style: formData.value.contentPreferences || ''
    },
    isActive: personas.value.length === 0 // 第一个人设自动激活
  }

  console.log('[PersonaView] 准备保存人设:', data)

  try {
    if (editingPersona.value) {
      console.log('[PersonaView] 更新人设 ID:', editingPersona.value.id)
      const result = await window.api.persona.update(editingPersona.value.id, data)
      console.log('[PersonaView] 更新结果:', result)
      if (!result.success) {
        // 检查是否是离线保存
        if (result.error?.includes('OFFLINE_SAVE')) {
          await loadPersonas()
          closeDialog()
          alert('⚠️ 当前离线，人设已保存到本地\n\n联网后将自动同步到云端')
          return
        }
        throw new Error(result.error || '更新失败')
      }
      await loadPersonas()
      closeDialog()
      alert('✅ 更新成功！')
    } else {
      console.log('[PersonaView] 创建新人设')
      const result = await window.api.persona.create(data)
      console.log('[PersonaView] 创建结果:', result)
      if (!result.success) {
        // 检查是否是离线保存
        if (result.error?.includes('OFFLINE_SAVE')) {
          await loadPersonas()
          closeDialog()
          alert('⚠️ 当前离线，人设已保存到本地\n\n联网后将自动同步到云端')
          return
        }
        throw new Error(result.error || '创建失败')
      }
      await loadPersonas()
      closeDialog()
      alert('✅ 创建成功！')
    }
  } catch (error: any) {
    console.error('[PersonaView] 保存人设失败:', error)
    console.error('[PersonaView] 错误详情:', {
      message: error.message,
      stack: error.stack,
      response: error.response
    })
    alert(`❌ 保存失败：${error.message || '未知错误'}`)
  }
}

function confirmDelete(persona: Persona) {
  deletingPersona.value = persona
}

async function deletePersona() {
  if (!deletingPersona.value) return

  try {
    await window.api.persona.delete(deletingPersona.value.id)
    await loadPersonas()
    deletingPersona.value = null
  } catch (error: any) {
    alert(error.message || '删除失败')
  }
}

async function setActive(id: string) {
  try {
    // TODO: 调用 setActive API
    await loadPersonas()
  } catch (error: any) {
    alert(error.message || '设置失败')
  }
}

onMounted(() => {
  loadPersonas()
})
</script>

<style scoped>
.persona-view {
  padding: var(--spacing-2xl);
  max-width: 1400px;
  margin: 0 auto;
  animation: fadeIn var(--transition-base) ease-out;
}

.persona-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-2xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--gray-200);
}

.persona-header h1 {
  margin: 0;
  font-size: var(--text-4xl);
  font-weight: 700;
  color: var(--gray-900);
}

.loading {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--gray-600);
  font-size: var(--text-base);
}

.empty-state {
  text-align: center;
  padding: var(--spacing-2xl) var(--spacing-lg);
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
}

.empty-icon {
  font-size: 80px;
  margin-bottom: var(--spacing-lg);
  opacity: 0.8;
}

.empty-state p {
  margin: 0 0 var(--spacing-lg);
  font-size: var(--text-lg);
  color: var(--gray-600);
}

.persona-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: var(--spacing-lg);
}

.persona-card {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
  border: 2px solid transparent;
  position: relative;
  overflow: hidden;
}

.persona-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--gradient-primary);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--transition-base);
}

.persona-card:hover::before {
  transform: scaleX(1);
}

.persona-card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-4px);
}

.persona-card.active {
  border-color: var(--primary-500);
  box-shadow: var(--shadow-lg);
}

.persona-card.active::before {
  transform: scaleX(1);
}

.persona-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.persona-card-header h3 {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--gray-900);
}

.persona-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: var(--gray-100);
  cursor: pointer;
  font-size: var(--text-base);
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: var(--primary-100);
  transform: scale(1.1);
}

.persona-info {
  margin-bottom: var(--spacing-md);
}

.info-item {
  margin-bottom: var(--spacing-sm);
  font-size: var(--text-sm);
  line-height: 1.6;
  display: flex;
  gap: var(--spacing-sm);
}

.info-item .label {
  color: var(--gray-600);
  font-weight: 600;
  min-width: 80px;
}

.info-item span:last-child {
  color: var(--gray-900);
  flex: 1;
}

.persona-footer {
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--gray-100);
}

.active-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 8px 16px;
  background: var(--gradient-primary);
  color: white;
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

.active-badge::before {
  content: '✓';
  font-size: var(--text-base);
}

.btn-primary {
  padding: 12px 24px;
  border: none;
  background: var(--gradient-primary);
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
  box-shadow: var(--shadow-sm);
}

.btn-primary:hover:not(:disabled) {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 10px 20px;
  border: 1px solid var(--gray-300);
  background: var(--bg-primary);
  color: var(--gray-700);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-secondary:hover {
  border-color: var(--primary-500);
  color: var(--primary-600);
  background: var(--primary-50);
}

.btn-danger {
  padding: 10px 20px;
  border: none;
  background: var(--error);
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-danger:hover {
  background: #dc2626;
  box-shadow: var(--shadow-md);
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn var(--transition-fast) ease-out;
}

.dialog {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-2xl);
  animation: slideIn var(--transition-base) ease-out;
}

.dialog-small {
  max-width: 400px;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg) var(--spacing-xl);
  border-bottom: 1px solid var(--gray-200);
  background: var(--gray-50);
}

.dialog-header h2 {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--gray-900);
}

.btn-close {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: var(--gray-200);
  font-size: var(--text-2xl);
  cursor: pointer;
  color: var(--gray-600);
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.btn-close:hover {
  background: var(--error);
  color: white;
  transform: rotate(90deg);
}

.dialog-body {
  padding: var(--spacing-xl);
  overflow-y: auto;
}

.form-group {
  margin-bottom: var(--spacing-lg);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.form-group label {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--gray-700);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-family: inherit;
  transition: all var(--transition-base);
  background: var(--bg-primary);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) var(--spacing-xl);
  border-top: 1px solid var(--gray-200);
  background: var(--gray-50);
}

/* 响应式 */
@media (max-width: 768px) {
  .persona-view {
    padding: var(--spacing-lg);
  }

  .persona-header h1 {
    font-size: var(--text-2xl);
  }

  .persona-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
