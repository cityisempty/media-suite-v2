import { spawn } from "node:child_process";
import { resolveWorkspaceRoot } from "../packages/shared/src/index.mjs";
import { join } from "node:path";

const root = resolveWorkspaceRoot(import.meta.url);
const loginBin = join(root, "tools/bin/xiaohongshu-login-darwin-arm64");

console.log("🚀 正在启动小红书扫码登录工具...");
console.log("--------------------------------------------------");
console.log("1. 请在随即弹出的浏览器中手动完成扫码登录。");
console.log("2. 登录成功后，工具会自动关闭窗口并保存 Cookie。");
console.log("3. 登录态将持久化存储，后续发布任务将自动复用。");
console.log("--------------------------------------------------");

// 启动二进制程序
const child = spawn(loginBin, [], {
  stdio: "inherit",
  cwd: root,
  env: {
    ...process.env,
    // 如果该工具支持自定义数据目录，可以在此设置环境标量
    XHS_DATA_DIR: join(root, "runtime/profiles/mcp-xhs")
  }
});

child.on("close", (code) => {
  if (code === 0) {
    console.log("\n✅ 登录流程正常完成。你可以运行发布任务了。");
  } else {
    console.warn(`\n⚠️ 登录工具已结束 (退出码: ${code})。如果你已成功登录，请忽略此提示。`);
  }
});

child.on("error", (err) => {
  console.error("❌ 启动失败：", err.message);
  console.log("请确保 tools/bin/xiaohongshu-login-darwin-arm64 文件存在且具有执行权限 (+x)。");
});
