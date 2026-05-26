import { McpClient } from "../../shared/src/mcp-client.mjs";
import { resolveWorkspaceRoot, resolveFromRoot } from "../../shared/src/index.mjs";
import { join } from "node:path";
import { existsSync } from "node:fs";

/**
 * 将项目中的"发布任务"桥接到外部 MCP 内核 (xiaohongshu-mcp)
 */
export async function runXhsMcpTask({ taskId, input, logger }) {
  const workspaceRoot = resolveWorkspaceRoot(import.meta.url);
  const binaryPath = join(workspaceRoot, "tools/bin/xiaohongshu-mcp-darwin-arm64");

  if (!existsSync(binaryPath)) {
    throw new Error(`找不到核心二进制文件：${binaryPath}。请从 Releases 下载并放置于该目录。`);
  }

  const client = new McpClient(binaryPath);

  try {
    logger("info", "mcp.start", { target: "xiaohongshu", binary: binaryPath });
    await client.start();

    // 转换参数以适配 publish_content 工具
    const mcpParams = {
      title: input.title || "未命名笔记",
      content: input.body || "",
      images: Array.isArray(input.images) ? input.images : [input.coverPath],
      tags: input.tags || [],
      visibility: input.visibility || "公开可见"
    };

    // 确保图片路径是绝对路径
    mcpParams.images = mcpParams.images.map(p => {
      if (p.startsWith("http") || p.startsWith("/")) return p;
      return resolveFromRoot(workspaceRoot, p);
    });

    logger("info", "mcp.tool.call", {
      tool: "publish_content",
      title: mcpParams.title,
      imageCount: mcpParams.images.length
    });

    const result = await client.callTool("publish_content", mcpParams);

    logger("info", "mcp.finish", { taskId, result });

    // 提取文本结果
    let summary = "发布流程已完成";
    if (result && result.content) {
      const textItem = Array.isArray(result.content)
        ? result.content.find(c => c.type === "text")
        : null;
      if (textItem) summary = textItem.text;
    }

    return {
      status: "completed",
      artifacts: [],
      summary
    };
  } catch (error) {
    logger("error", "mcp.error", { message: error.message });
    return {
      status: "failed",
      errorMessage: error.message
    };
  }
  // 注意：不调用 client.stop()，让 MCP 服务保持后台运行以便复用
}
