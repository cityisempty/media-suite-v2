import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('=== 清理重复内容 ===\n')

const contentsPath = join(__dirname, 'contents.json')
const contents = JSON.parse(readFileSync(contentsPath, 'utf-8'))

console.log(`当前内容总数: ${contents.length}`)

// 按标题去重，保留最新的
const uniqueContents = []
const seenTitles = new Map()

for (const content of contents) {
  const existing = seenTitles.get(content.title)

  if (!existing || content.createdAt > existing.createdAt) {
    if (existing) {
      // 移除旧的
      const oldIndex = uniqueContents.findIndex(c => c.id === existing.id)
      if (oldIndex >= 0) {
        uniqueContents.splice(oldIndex, 1)
      }
    }
    uniqueContents.push(content)
    seenTitles.set(content.title, content)
  }
}

console.log(`去重后内容数: ${uniqueContents.length}`)
console.log(`删除重复数: ${contents.length - uniqueContents.length}`)

// 备份原文件
const backupPath = join(__dirname, 'contents.json.backup')
writeFileSync(backupPath, JSON.stringify(contents, null, 2))
console.log(`\n已备份原文件到: contents.json.backup`)

// 写入去重后的数据
writeFileSync(contentsPath, JSON.stringify(uniqueContents, null, 2))
console.log(`已保存去重后的数据`)

console.log('\n=== 清理完成 ===')
console.log('\n保留的内容:')
uniqueContents.forEach((c, i) => {
  console.log(`${i + 1}. ${c.title}`)
  console.log(`   状态: ${c.status}`)
  console.log(`   图片: ${c.images?.length || 0} 张`)
})
