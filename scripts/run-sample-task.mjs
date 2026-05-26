import { spawn } from "node:child_process";
import { DEFAULT_SERVER_PORT, DEFAULT_WORKER_PORT, resolveWorkspaceRoot, waitForHealth } from "../packages/shared/src/index.mjs";

const workspaceRoot = resolveWorkspaceRoot(import.meta.url);
const serverPort = Number(process.env.PORT || DEFAULT_SERVER_PORT);
const workerPort = Number(process.env.WORKER_PORT || DEFAULT_WORKER_PORT);

const children = [];

try {
  // 暂时先只跑模拟逻辑
  console.log("[sample] Starting MCP Task Simulation...");

  const result = await postJson(`http://127.0.0.1:${workerPort}/runs/execute`, {
    taskId: "task-mcp-demo-001",
    deviceId: "local-mcp-runner",
    script: { target: "xiaohongshu", id: "xhs-note-publish-smoke" },
    input: {
      title: "今日心理学分享",
      body: "这是一条通过 MCP 内核自动发布的心理学见解分享。",
      coverPath: "fixtures/uploads/sample-cover.txt"
    }
  });

  console.log("[sample] MCP task result:");
  console.log(JSON.stringify(result, null, 2));

} catch (e) {
  console.error(e);
} finally {
  for (const child of children) {
    child.kill("SIGTERM");
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.json();
}
