import { defineStore } from 'pinia'

export interface PublishProgress {
  level: string
  event: string
  data: any
}

export const usePublishStore = defineStore('publish', {
  state: () => ({
    title: '',
    body: '',
    tags: [] as string[],
    images: [] as { path: string; base64: string }[],
    visibility: '公开可见',
    publishing: false,
    progress: [] as PublishProgress[],
    result: null as { success: boolean; summary?: string; error?: string } | null
  }),
  actions: {
    async addImages() {
      const paths = await window.api.selectImages()
      if (!paths) return
      for (const p of paths) {
        const base64 = await window.api.readImageAsBase64(p)
        this.images.push({ path: p, base64 })
      }
    },
    removeImage(index: number) {
      this.images.splice(index, 1)
    },
    addTag(tag: string) {
      const trimmed = tag.trim()
      if (trimmed && !this.tags.includes(trimmed) && this.tags.length < 10) {
        this.tags.push(trimmed)
      }
    },
    removeTag(index: number) {
      this.tags.splice(index, 1)
    },
    async publish() {
      // 检查小红书登录状态
      try {
        const loginStatus = await window.api.xhsLoginStatus()
        if (!loginStatus.loggedIn) {
          const goToLogin = confirm('小红书未登录或登录已过期，是否前往平台管理页面登录？')
          if (goToLogin) {
            window.location.hash = '#/platforms'
          }
          return
        }
      } catch {
        // 检查失败时继续，服务端也会检查
      }

      this.publishing = true
      this.progress = []
      this.result = null

      const unsub = window.api.onPublishProgress((p) => {
        this.progress.push(p)
      })

      try {
        this.result = await window.api.xhsPublish({
          title: this.title,
          body: this.body,
          tags: this.tags,
          images: this.images.map((i) => i.path),
          visibility: this.visibility
        })
      } finally {
        unsub()
        this.publishing = false
      }
    },
    reset() {
      this.title = ''
      this.body = ''
      this.tags = []
      this.images = []
      this.visibility = '公开可见'
      this.publishing = false
      this.progress = []
      this.result = null
    }
  }
})
