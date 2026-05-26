import { spawn } from "node:child_process";
import { sleep } from "./index.mjs";

/**
 * 通过 HTTP 与 MCP Server 通信的客户端
 * 
 * MCP Streamable HTTP 传输要求：
 * 1. POST /mcp 发送 initialize → 服务器返回 Mcp-Session-Id 头
 * 2. 后续所有请求都必须携带该 Session ID
 */
export class McpClient {
  constructor(binaryPath, baseUrl = "http://127.0.0.1:18060") {
    this.binaryPath = binaryPath;
    this.baseUrl = baseUrl;
    this.process = null;
    this.requestId = 1;
    this.sessionId = null; // 关键：保存 MCP Session ID
  }

  async start() {
    const alive = await this.healthCheck();
    if (alive) {
      console.log("[McpClient] 服务已在运行，直接复用。");
    } else {
      console.log("[McpClient] 正在启动 MCP 服务...");
      this.process = spawn(this.binaryPath, [], {
        stdio: "inherit",
        detached: true,
        env: { ...process.env }
      });
      this.process.unref();

      for (let i = 0; i < 30; i++) {
        await sleep(500);
        if (await this.healthCheck()) break;
      }

      if (!(await this.healthCheck())) {
        throw new Error("MCP 服务启动超时。");
      }
      console.log("[McpClient] 服务已就绪。");
    }

    // 第一步：initialize（捕获 Session ID）
    console.log("[McpClient] 正在执行 MCP 协议握手...");
    const initResponse = await this.rawPost("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "media-automation-suite", version: "0.1.0" }
    });

    // 从响应头中提取 Session ID
    const sid = initResponse.headers.get("mcp-session-id");
    if (sid) {
      this.sessionId = sid;
      console.log("[McpClient] 获取到 Session ID:", sid);
    }

    const initJson = await initResponse.json();
    if (initJson.error) {
      throw new Error(`initialize 失败: ${JSON.stringify(initJson.error)}`);
    }
    console.log("[McpClient] initialize 完成:", JSON.stringify(initJson.result?.serverInfo || {}));

    // 第二步：notifications/initialized
    await this.sendNotification("notifications/initialized", {});
    console.log("[McpClient] 握手完成，可以调用工具了。");

    return initJson.result;
  }

  async healthCheck() {
    try {
      const resp = await fetch(`${this.baseUrl}/health`);
      return resp.ok;
    } catch {
      return false;
    }
  }

  /**
   * 底层 HTTP POST，自动携带 Session ID
   */
  async rawPost(method, params, hasId = true) {
    const body = { jsonrpc: "2.0", method, params };
    if (hasId) {
      body.id = this.requestId++;
    }

    const headers = { "Content-Type": "application/json" };
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    return response;
  }

  /**
   * 发送 JSON-RPC 请求（带 id，期待响应）
   */
  async sendRpc(method, params) {
    const response = await this.rawPost(method, params, true);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`MCP HTTP 请求失败: ${response.status} ${text}`);
    }

    const json = await response.json();
    if (json.error) {
      throw new Error(`MCP 工具错误: ${json.error.message || JSON.stringify(json.error)}`);
    }

    return json.result;
  }

  /**
   * 发送 JSON-RPC 通知（无 id，不期待响应）
   */
  async sendNotification(method, params) {
    await this.rawPost(method, params, false);
  }

  /**
   * 调用指定的工具
   */
  async callTool(name, args) {
    const result = await this.sendRpc("tools/call", {
      name,
      arguments: args
    });

    if (result?.isError) {
      const msg = result.content?.find(c => c.type === "text")?.text || "Unknown error";
      throw new Error(`MCP Tool Error: ${msg}`);
    }

    return result;
  }

  async stop() {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }
}
