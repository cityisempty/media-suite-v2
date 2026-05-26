import { join } from 'node:path'
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import { materialPackageService } from './material-package-service'
import type { MaterialMetadata } from './material-package-service'

/**
 * 创建测试物料包
 */
export async function createTestMaterials(): Promise<void> {
  const materialsDir = materialPackageService.getMaterialsDir()

  console.log('[CreateTestMaterials] 开始创建测试物料包...')
  console.log('[CreateTestMaterials] 物料包目录:', materialsDir)

  // 测试物料包数据
  const testMaterials = [
    {
      date: '2026-04-20',
      postId: 'post-001',
      metadata: {
        title: '如何提升自信心？心理学视角解析',
        body: '今天想和大家聊聊自信心这个话题。\n\n很多人觉得自信是天生的，其实不然。心理学研究表明，自信是可以通过练习培养的。\n\n💡 三个提升自信的小技巧：\n1. 每天记录3件做得好的事\n2. 用积极的语言和自己对话\n3. 设定小目标并完成它们\n\n记住，自信不是从不失败，而是失败后依然相信自己！\n\n你有什么提升自信的方法吗？评论区分享一下吧～',
        tags: ['心理学', '自我成长', '自信'],
        platform: 'xiaohongshu',
        scheduledAt: Date.now() + 1 * 60 * 60 * 1000, // 1小时后
        images: ['./image-1.jpg'],
        visibility: '公开可见'
      },
      imageNote: '需要一张关于自信、成长的配图'
    },
    {
      date: '2026-04-20',
      postId: 'post-002',
      metadata: {
        title: '焦虑时该怎么办？5个实用方法',
        body: '感到焦虑是很正常的情绪反应，关键是如何应对。\n\n🌟 5个缓解焦虑的方法：\n\n1️⃣ 深呼吸：4秒吸气，7秒憋气，8秒呼气\n2️⃣ 写下来：把担心的事情写在纸上\n3️⃣ 运动：哪怕只是散步10分钟\n4️⃣ 和朋友聊天：说出来就好多了\n5️⃣ 专注当下：做一件需要集中注意力的事\n\n记住，焦虑不可怕，可怕的是逃避它。\n\n你平时是怎么应对焦虑的？',
        tags: ['心理健康', '焦虑', '情绪管理'],
        platform: 'xiaohongshu',
        scheduledAt: Date.now() + 3 * 60 * 60 * 1000, // 3小时后
        images: ['./image-1.jpg', './image-2.jpg'],
        visibility: '公开可见'
      },
      imageNote: '需要两张关于放松、平静的配图'
    },
    {
      date: '2026-04-21',
      postId: 'post-001',
      metadata: {
        title: '人际关系中的边界感有多重要？',
        body: '最近发现很多人在人际关系中感到疲惫，往往是因为缺乏边界感。\n\n什么是边界感？\n简单说，就是知道什么是"我的事"，什么是"别人的事"。\n\n🔸 没有边界感的表现：\n• 总是为别人的情绪负责\n• 不好意思拒绝别人\n• 过度关心他人的评价\n• 把别人的问题当成自己的\n\n🔹 如何建立边界感：\n• 学会说"不"\n• 区分帮助和讨好\n• 尊重自己的感受\n• 不过度解读他人行为\n\n健康的关系，需要适当的距离。\n\n你在人际关系中有边界感吗？',
        tags: ['人际关系', '心理学', '边界感'],
        platform: 'xiaohongshu',
        scheduledAt: Date.now() + 24 * 60 * 60 * 1000, // 1天后
        images: ['./image-1.jpg'],
        visibility: '公开可见'
      },
      imageNote: '需要一张关于人际关系、边界的配图'
    }
  ]

  // 创建物料包
  for (const material of testMaterials) {
    const packageDir = join(materialsDir, material.date, material.postId)

    try {
      // 创建目录
      await mkdir(packageDir, { recursive: true })

      // 写入 metadata.json
      const metadataPath = join(packageDir, 'metadata.json')
      await writeFile(metadataPath, JSON.stringify(material.metadata, null, 2), 'utf-8')

      // 创建占位图片文件说明
      const readmePath = join(packageDir, 'README.txt')
      await writeFile(
        readmePath,
        `物料包: ${material.metadata.title}\n\n` +
          `图片说明: ${material.imageNote}\n\n` +
          `请将图片文件放在此目录下，命名为:\n` +
          material.metadata.images.map((img) => `  - ${img.replace('./', '')}`).join('\n') +
          `\n\n图片要求:\n` +
          `  - 格式: JPG/PNG\n` +
          `  - 尺寸: 建议 800x600 或更高\n` +
          `  - 内容: ${material.imageNote}`,
        'utf-8'
      )

      console.log(`✓ 创建物料包: ${material.date}/${material.postId}`)
    } catch (error) {
      console.error(`✗ 创建物料包失败 ${material.date}/${material.postId}:`, error)
    }
  }

  console.log('[CreateTestMaterials] 测试物料包创建完成！')
  console.log('[CreateTestMaterials] 请在以下目录中添加图片文件:')
  console.log(`  ${materialsDir}`)
}
