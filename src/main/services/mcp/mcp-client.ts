import { spawn, ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { resolvePlatformBinary, getDataDir } from '../../utils/paths'
import { sleep } from '../../utils/file-utils'

/**
 * MCP Streamable HTTP 传输客户端
 *
 * 协议流程:
 * 1. POST /mcp 发送 initialize → 服务器返回 Mcp-Session-Id 头
 * 2. 后续所有请求都必须携带该 Session ID
 */
export class McpClient {
  private process: ChildProcess | null = null
  private requestId = 1
  private sessionId: string | null = null
  private baseUrl: string
  private onLog: (msg: string) => void

  constructor(
    baseUrl = 'http://127.0.0.1:18060',
    onLog: (msg: string) => void = (msg) => console.log(msg)
  ) {
    this.baseUrl = baseUrl
    this.onLog = onLog
  }

  async start(): Promise<any> {
    const alive = await this.healthCheck()
    if (alive) {
      this.onLog('[McpClient] 服务已在运行，直接复用。')
    } else {
      this.onLog('[McpClient] 正在启动 MCP 服务...')
      const binaryPath = resolvePlatformBinary('xiaohongshu-mcp')
      const cookiePath = join(getDataDir(), 'cookies.json')
      const dataDir = getDataDir()

      this.onLog(`[McpClient] Cookie 路径: ${cookiePath}`)
      this.onLog(`[McpClient] 数据目录: ${dataDir}`)

      // 始终使用无头浏览器模式
      const args = ['-headless=true']

      this.process = spawn(binaryPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        cwd: dataDir, // 设置工作目录，确保 MCP 在正确的目录下运行
        env: {
          ...process.env,
          COOKIES_PATH: cookiePath,
          PROFILE_DIR: dataDir
        }
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        this.onLog(`[MCP stdout] ${data.toString().trim()}`)
      })
      this.process.stderr?.on('data', (data: Buffer) => {
        this.onLog(`[MCP stderr] ${data.toString().trim()}`)
      })

      this.process.on('error', (err) => {
        this.onLog(`[MCP error] ${err.message}`)
      })

      for (let i = 0; i < 30; i++) {
        await sleep(500)
        if (await this.healthCheck()) break
      }

      if (!(await this.healthCheck())) {
        throw new Error('MCP 服务启动超时。')
      }
      this.onLog('[McpClient] 服务已就绪。')
    }

    // initialize（捕获 Session ID）
    this.onLog('[McpClient] 正在执行 MCP 协议握手...')
    const initResponse = await this.rawPost('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'media-automation-suite', version: '0.1.0' }
    })

    const sid = initResponse.headers.get('mcp-session-id')
    if (sid) {
      this.sessionId = sid
      this.onLog(`[McpClient] 获取到 Session ID: ${sid}`)
    }

    const initJson = await initResponse.json()
    if (initJson.error) {
      throw new Error(`initialize 失败: ${JSON.stringify(initJson.error)}`)
    }
    this.onLog(`[McpClient] initialize 完成: ${JSON.stringify(initJson.result?.serverInfo || {})}`)

    // notifications/initialized
    await this.sendNotification('notifications/initialized', {})
    this.onLog('[McpClient] 握手完成，可以调用工具了。')

    // 列出所有可用工具
    try {
      const toolsResult = await this.listTools()
      this.onLog('[McpClient] 可用工具列表:')
      if (toolsResult?.tools) {
        toolsResult.tools.forEach((tool: any) => {
          this.onLog(`  - ${tool.name}: ${tool.description || ''}`)
        })
      }
    } catch (err) {
      this.onLog(`[McpClient] 获取工具列表失败: ${err}`)
    }

    return initJson.result
  }

  async healthCheck(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/health`)
      return resp.ok
    } catch {
      return false
    }
  }

  /** 底层 HTTP POST，自动携带 Session ID */
  private async rawPost(method: string, params: any, hasId = true): Promise<Response> {
    const body: any = { jsonrpc: '2.0', method, params }
    if (hasId) {
      body.id = this.requestId++
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId
    }

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })

    return response
  }

  /** 发送 JSON-RPC 请求（带 id，期待响应） */
  private async sendRpc(method: string, params: any): Promise<any> {
    const response = await this.rawPost(method, params, true)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`MCP HTTP 请求失败: ${response.status} ${text}`)
    }

    const json = await response.json()
    if (json.error) {
      throw new Error(`MCP 工具错误: ${json.error.message || JSON.stringify(json.error)}`)
    }

    return json.result
  }

  /** 发送 JSON-RPC 通知（无 id，不期待响应） */
  private async sendNotification(method: string, params: any): Promise<void> {
    await this.rawPost(method, params, false)
  }

  /** 列出所有可用的工具 */
  async listTools(): Promise<any> {
    return this.sendRpc('tools/list', {})
  }

  /** 调用指定的工具 */
  async callTool(name: string, args: Record<string, any>): Promise<any> {
    // 添加超时控制 - 10分钟超时，因为发布操作可能需要上传图片和等待页面加载
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('MCP 工具调用超时（10分钟）')), 600000)
    })

    console.log(`[MCP] 开始调用工具: ${name}`)
    const startTime = Date.now()

    const callPromise = this.sendRpc('tools/call', {
      name,
      arguments: args
    })

    const result = await Promise.race([callPromise, timeoutPromise])

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[MCP] 工具调用完成: ${name}, 耗时: ${duration}秒`)

    if (result?.isError) {
      const msg = result.content?.find((c: any) => c.type === 'text')?.text || 'Unknown error'
      throw new Error(`MCP Tool Error: ${msg}`)
    }

    return result
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM')
      this.process = null
    }
  }
}
