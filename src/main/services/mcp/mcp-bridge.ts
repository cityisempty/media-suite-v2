import { mcpServiceManager } from './mcp-service-manager'
import { log } from '../../utils/logger'

export interface XhsPublishInput {
  title: string
  body: string
  tags: string[]
  images: string[]
  visibility: string
}

export interface XhsTaskResult {
  status: 'completed' | 'failed'
  summary?: string
  errorMessage?: string
}

/**
 * 将发布任务桥接到 MCP 内核 (xiaohongshu-mcp)
 */
export async function runXhsMcpTask(params: {
  taskId: string
  input: XhsPublishInput
  logger: (level: string, event: string, data?: any) => void
}): Promise<XhsTaskResult> {
  const maxRetries = 2

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        log.info(`[runXhsMcpTask] 第 ${attempt} 次重试: ${params.taskId}`)
        params.logger('info', 'mcp.retry', { attempt, taskId: params.taskId })
      }

      params.logger('info', 'mcp.start', { target: 'xiaohongshu', attempt })
      log.info(`[runXhsMcpTask] 开始发布任务: ${params.taskId} (attempt ${attempt + 1}/${maxRetries + 1})`)

      // 获取全局 MCP 客户端实例
      log.info('[runXhsMcpTask] 获取 MCP 客户端...')
      const client = await mcpServiceManager.getClient()
      log.info('[runXhsMcpTask] MCP 客户端已获取')

      const rawTitle = params.input.title || '未命名笔记'
      const mcpParams = {
        title: rawTitle.length > 20 ? rawTitle.slice(0, 20) : rawTitle,
        content: params.input.body || '',
        images: params.input.images,
        tags: params.input.tags || [],
        visibility: params.input.visibility || '公开可见'
      }

      params.logger('info', 'mcp.tool.call', {
        tool: 'publish_content',
        title: mcpParams.title,
        imageCount: mcpParams.images.length
      })
      log.info('[runXhsMcpTask] 调用 MCP 工具:', mcpParams)

      const result = await client.callTool('publish_content', mcpParams)
      log.info('[runXhsMcpTask] MCP 工具调用完成:', result)

      params.logger('info', 'mcp.finish', { taskId: params.taskId })

      // 提取文本结果
      let summary = '发布流程已完成'
      if (result && result.content) {
        const textItem = Array.isArray(result.content)
          ? result.content.find((c: any) => c.type === 'text')
          : null
        if (textItem) summary = textItem.text
      }

      log.info('[runXhsMcpTask] 发布成功:', summary)
      return { status: 'completed', summary }
    } catch (error: any) {
      const isTimeout = error.message?.includes('deadline exceeded') || error.message?.includes('超时')

      if (isTimeout && attempt < maxRetries) {
        log.warn(`[runXhsMcpTask] 超时，将重试 (${attempt + 1}/${maxRetries}): ${params.taskId}`)
        // 重试前重启 MCP 服务，因为超时后服务状态可能异常
        try {
          await mcpServiceManager.shutdown()
        } catch {}
        continue
      }

      log.error(`[runXhsMcpTask] 发布失败: ${params.taskId}`, error.message)
      params.logger('error', 'mcp.error', { message: error.message })
      return {
        status: 'failed',
        errorMessage: isTimeout
          ? '发布超时：MCP 服务器处理时间过长，已重试多次仍失败。可能是网络问题或小红书服务繁忙。'
          : error.message
      }
    }
  }

  return { status: 'failed', errorMessage: '未知错误' }
}
