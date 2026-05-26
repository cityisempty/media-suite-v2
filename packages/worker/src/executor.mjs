import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import {
  createRunId,
  ensureDir,
  resolveFromRoot,
  resolveWorkspaceRoot,
  saveJson,
  writeText
} from "../../shared/src/index.mjs";
import { interpolateTemplate, validateScript } from "../../dsl/src/index.mjs";
import { createBrowserSession } from "./browser-session.mjs";
import { runXhsMcpTask } from "./mcp-bridge.mjs";

export async function executeTask({ taskId, script, input = {}, reportUrl = null, deviceId = null }) {
  const workspaceRoot = resolveWorkspaceRoot(import.meta.url);
  const logger = (level, event, data = {}) => {
    console.log(`[${level.toUpperCase()}] ${event}`, data);
  };

  // 如果目标是小红书且脚本 ID 匹配，则路由到 MCP 内核
  if (script.target === "xiaohongshu" || script.id === "xhs-note-publish-smoke") {
    return await runXhsMcpTask({ taskId, input, logger });
  }

  // 以下是兜底的原生 DSL 解析逻辑 (以防非小红书任务)
  // ... (简化版 DSL 执行器逻辑)
  return { status: "failed", errorMessage: "目前非小红书任务暂未完全复原" };
}
