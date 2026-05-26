# 上线前测试发现 Bug 列表

> 测试日期：2026-05-01 | 执行人：自动化测试代理

---

## 严重程度说明

- 🔴 **阻塞**：影响上线核心功能，必须修复
- 🟠 **高**：明显功能缺陷或安全隐患，建议上线前修复
- 🟡 **中**：用户体验问题或非主流程缺陷，可上线后跟进
- 🟢 **低**：优化项，不影响使用

---

## BUG-001 🟠 验证码发送接口未做发送频率限制（throttle）

- **影响**：T11 / 短信安全
- **位置**：`media-automation-server/app/Http/Controllers/Api/AuthController.php::sendSmsCode`
- **现象**：连续两次（同一手机号、同一秒）请求 `POST /api/auth/send-code` 都返回 `HTTP 200 / 验证码已发送`，不会触发 60 秒限流。
- **复现**：
  ```
  curl -s POST /api/auth/send-code -d '{"phone":"13900000000"}'   # HTTP 200
  curl -s POST /api/auth/send-code -d '{"phone":"13900000000"}'   # HTTP 200（应被限流）
  ```
- **代码佐证**：控制器内仅做格式校验和 `Cache::put("sms_code:{phone}", ...)`，没有 `RateLimiter::attempt` / `throttle` 逻辑，路由 `Route::post('send-code', ...)` 也未挂任何 `throttle` 中间件。
- **风险**：被恶意刷短信，正式接入短信运营商后可能产生大量费用。
- **建议**：
  1. 路由层增加 `->middleware('throttle:1,1')`（每分钟 1 次/IP）。
  2. 控制器内基于 `Cache::has("sms_code_lock:{phone}")` 做 60 秒锁，命中返回 `429`。

---

## BUG-002 🟡 未授权访问返回 500 HTML 而非 401 JSON（缺 Accept header 时）

- **影响**：T11 / 健壮性
- **位置**：Laravel 全局异常处理 + `auth:api` 中间件
- **现象**：
  - 带 `Accept: application/json`：返回 `HTTP 401 {"message":"Unauthenticated."}` ✅
  - 不带 `Accept` header：返回 `HTTP 500` 的 HTML 错误页 ❌
- **复现**：`curl http://localhost:8000/api/personas`（无 Accept 头）→ HTTP 500
- **风险**：非常规客户端（如某些代理/调试工具）会显示混乱的 5xx 错误。
- **建议**：在 `bootstrap/app.php` 或 `Exceptions/Handler.php` 中将 `/api/*` 全局强制 JSON 响应，或在路由组上加 `->middleware('api')` 时强制 `Accept: application/json`。

---

## BUG-003 🟡 `auth.refreshToken()` 在客户端是死链路 / IPC handler 缺失

- **影响**：Token 刷新链路完整性
- **位置**：
  - `src/preload/index.ts:115` 暴露 `refreshToken: () => ipcRenderer.invoke('auth:refresh-token')`
  - `src/main/ipc/auth.ts` **没有**注册名为 `auth:refresh-token` 的 handler
- **现象**：渲染层若调用 `window.api.auth.refreshToken()` 会触发 `Error: No handler registered for 'auth:refresh-token'`。
- **缓解情况**：当前渲染端代码全局搜索无任何位置调用此方法（grep 0 命中），实际不会触发；主进程内部由 `auth-service.startRefreshTimer()` 自动刷新。
- **建议**：要么从 preload 中移除该方法，要么补回 main 端的 handler，避免后续接入时踩坑。

---

## BUG-004 🟡 设置页未展示"自动发布配置"

- **影响**：T09-2
- **位置**：`src/renderer/src/views/SettingsView.vue`
- **现象**：测试计划要求"查看自动发布配置（enabled/autoApprove/platforms）"，但 SettingsView.vue 仅展示 `version / platform / arch / dataDir / loggedIn`，没有读取 `window.api.autoPublish.getConfig()`。`auto-publish-config.json` 实际值为 `{enabled:true, autoApprove:true, platforms:["xiaohongshu"]}`，但用户在 UI 上看不到。
- **建议**：在设置页加入只读的"自动发布"区块，调用 `autoPublish.getConfig()` 显示三个字段；最好支持开关切换。

---

## BUG-005 🟡 `contents.json` 存在过期 `scheduled` 状态

- **影响**：T05 / 测试计划已知风险项
- **现象**：
  ```
  $ grep '"status":' contents.json
  "status": "scheduled",   # content-1776916891842-...
  "status": "published",
  "status": "scheduled",   # content-...
  "status": "pending"...（其余）
  ```
  存在 2 条 `scheduled` 状态（4 月 20 日的旧物料），调度时间戳 `1776835200000` 已过去。
- **建议**：
  1. 启动时除了重置 `publishing → pending`，也对超期未发布的 `scheduled → pending`。
  2. 或在 `content-service` 内补一个 `cleanupStaleScheduled()` 任务。

---

## BUG-006 🟡 `AnalyticsView` 打包体积 2.7MB

- **影响**：首屏加载时长
- **现象**：`out/renderer/assets/AnalyticsView-T2pwIU8T.js` 单文件 **2,714,728 bytes** ≈ 2.59 MB（主要来自 echarts 全量引入）。
- **建议**：
  1. 改用 `echarts/core + 按需引入`，预计可降到 300~600 KB。
  2. 已在测试计划"已知风险项"中列出，不阻塞上线。

---

## BUG-007 🟡 `PlatformsView.onLoginSuccess` 写入硬编码 accountName，与 `syncXiaohongshuLogin` 不一致

- **影响**：T03 / 用户体验
- **位置**：`src/renderer/src/views/PlatformsView.vue:235-275`
- **现象**：扫码成功后渲染端直接调用 `platform.add({accountName:'小红书账号', ...})`，并未调用主进程的 `platformService.syncXiaohongshuLogin()`（该方法会从 MCP 拉到真实昵称、profileUserId 并合并 metadata）。结果：
  - 列表里始终显示"小红书账号"而不是用户真实昵称。
  - `accountId` 需要用户手动 `prompt` 输入，UX 较差。
- **建议**：登录成功后改为调用一个新 IPC（例如 `platform:sync-xhs`）触发 `platformService.syncXiaohongshuLogin()`，由主进程统一更新账号信息。

---

## BUG-008 🟢 `monthly-topics` 路由缺少 `topics/{id}` 校验或返回结构略不一致

- **影响**：T08
- **现象**：`GET /api/monthly-topics` 返回 `{success:true, data:[]}`，但其它列表接口（`/contents`、`/personas`）返回 `{items:[], total, page, pageSize}` 或 `{persona:..., subscription:...}`，命名不统一。
- **建议**：上线前对外接口统一使用 `{success, data}` 或 `{items, total, page, pageSize}` 任选其一即可，文档化即可不修代码。

---

## BUG-009 🟢 `analytics/daily` 不校验日期参数

- **影响**：T15
- **现象**：未传 `start/end` 时也返回 `200`，且固定返回一条 `2026-04-27` 的零值数据。
- **建议**：添加 `start|end` 必填校验或回退到"最近 7 天"。

---

## 已自动化通过项（仅记录，非 Bug）

- `POST /auth/login/phone`：测试号 `13800138000/000000` 正常登录、错误验证码返回 401 ✅
- `POST /auth/verify`：有效 token `valid:true`，无效 token 401 `valid:false` ✅
- `POST /auth/refresh`：返回新 token ✅
- `POST /auth/logout`：登出成功，再用旧 token 验证返回 401 ✅
- `GET /materials/latest`：无物料时返回 `{success:true, data:[], message:"暂无可用物料包"}`，**不再返回 404** ✅
- `GET /materials/{id}/download`：不存在的 id 返回 404 ✅
- `GET /materials/{itemId}/image`：不存在的 itemId 返回 404 ✅
- `POST /contents/{id}/approve|reject`：不存在 id 返回 404 ✅
- `PUT /personas/{id}`：不存在 id 返回 404 ✅
- 主进程在 `app.whenReady` 启动时遍历 `contents` 把 `publishing → pending` ✅（src/main/index.ts:215-225）
- 发布流程标题截断逻辑 `rawTitle.length > 20 ? rawTitle.slice(0, 20) : rawTitle` ✅（src/main/services/mcp/mcp-bridge.ts:36）
- Cookie 过期检查 `sessionCookie.expires * 1000 > Date.now()` ✅（src/main/services/mcp/login-service.ts）
- 自动发布前 cookie 校验：抛出"小红书登录已过期，请前往\"平台管理\"重新扫码登录" ✅（auto-publish-service.ts:127）
- 系统托盘菜单：`显示主窗口 / 同步物料包 / 退出` 三项已注册 ✅（src/main/index.ts:71-100）
- `cookies.json` 中 `web_session` 过期时间 `2027-05-01`，**当前有效** ✅
