import { runXhsMcpTask } from "../packages/worker/src/mcp-bridge.mjs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { resolveWorkspaceRoot } from "../packages/shared/src/index.mjs";

async function main() {
  const root = resolveWorkspaceRoot(import.meta.url);
  const postDir = join(root, "post");

  const imageFiles = readdirSync(postDir)
    .filter(f => f.endsWith(".jpg") || f.endsWith(".png"))
    .sort()
    .map(f => join(root, "post", f)); // 直接用绝对路径

  if (imageFiles.length === 0) {
    console.error("❌ 错误：在 post 目录下没有找到任何图片。");
    return;
  }

  console.log(`📸 识别到待发布图片: ${imageFiles.length} 张`);
  imageFiles.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));

  const taskInput = {
    title: "生肖壁纸",
    body: "国风美学 ✨ 十二生肖系列壁纸分享！\n\n每一款都精心打磨，传统韵味与现代审美的碰撞。\n不仅可以作为开运壁纸，还能让你的手机瞬间充满格调。\n\n喜欢的仙女/帅哥记得点赞收藏，支持一下原创呀 🫶\n后续还会更新更多系列哦～",
    tags: ["壁纸", "生肖", "国风", "国潮", "审美", "手机壁纸", "原创"],
    images: imageFiles,
    visibility: "公开可见"
  };

  const logger = (level, event, data) => {
    const icon = level === "error" ? "❌" : "ℹ️";
    console.log(`${icon} [${event}]`, JSON.stringify(data));
  };

  console.log("\n🚀 正式启动 MCP 发布流程...");
  const result = await runXhsMcpTask({
    taskId: `post-${Date.now()}`,
    input: taskInput,
    logger
  });

  if (result.status === "completed") {
    console.log("\n✅ 发布完成！", result.summary);
  } else {
    console.error("\n❌ 发布失败：", result.errorMessage);
  }
}

main().catch(console.error);
