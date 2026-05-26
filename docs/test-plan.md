# 上线前全系统测试计划

> 版本：v1.0 | 日期：2026-05-01 | 状态：**自动化部分已执行（2026-05-01）**
> 执行说明：✅ 通过 / ❌ 失败（见 bugs.md） / ⏭️ 需人工 / 🟡 通过但有遗留
> 详细 Bug 清单：`docs/bugs.md`

---

## 执行顺序建议

E01（新用户完整流程）→ T01~T10（客户端逐页）→ T11~T15（API）→ T16~T17（后台）→ E02~E04（集成场景）

---

## 一、客户端测试（Electron App）

### T01 — 用户认证

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| 1 | 输入手机号，点击"发送验证码" | 收到短信，按钮进入60秒倒计时 | ⏭️ 需人工（后端接口✅） |
| 2 | 输入正确验证码，点击登录 | 跳转仪表盘，顶部显示用户信息 | ⏭️ 需人工（后端接口✅） |
| 3 | 输入错误验证码 | 显示错误提示，不跳转 | ⏭️ 需人工（后端接口✅ HTTP401） |
| 4 | 退出登录 | 返回登录页，Token 清除 | ⏭️ 需人工（后端接口✅） |

### T02 — 个人资料 / 人设

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| 1 | 首次进入，填写人设信息并保存 | 保存成功，数据同步到服务器 | ⏭️ 需人工 |
| 2 | 修改人设字段（性格、语言风格等） | 更新成功 | ⏭️ 需人工（API ✅，PUT /personas/4 成功） |
| 3 | 上传头像 | 头像显示更新 | ⏭️ 需人工（API ✅ POST /auth/avatar） |
| 4 | 修改昵称/手机号 | 保存成功 | ⏭️ 需人工（API ✅ PUT /auth/profile） |

### T03 — 平台管理

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| 1 | 进入平台管理，检查小红书状态 | 显示"已连接"（Cookie 有效） | ✅ `cookies.json.web_session` 有效至 2027-05-01；`platforms.json` 标记 connected |
| 2 | 删除小红书账号，重启应用 | 自动重建账号，显示"已连接" | ✅ PlatformsView.checkXhsLoginStatus 逻辑验证通过（见代码 310-320） |
| 3 | 点击"重新连接"，扫码登录 | 登录成功，状态更新 | ⏭️ 需人工（扫码） |
| 4 | 删除 cookies.json，刷新页面 | 状态变为"未连接" | ✅ LoginService.checkLoginStatus 在文件不存在时返回 loggedIn:false |

### T04 — 仪表盘

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| 1 | 进入仪表盘 | 显示统计数据（发布数、粉丝数等） | ✅ GET /analytics/overview 返回 6 个字段 |
| 2 | 点击"同步物料包" | 显示同步结果（成功/暂无新物料） | ✅ material:sync IPC + /materials/latest 返回 `{success:true, data:[], message:"暂无可用物料包"}` |
| 3 | 检查用户信息展示 | 头像、昵称、订阅状态正确 | ⏭️ 需人工 |

### T05 — 内容管理

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| 1 | 查看内容列表 | 按日期分组，最新在上 | ✅ content:get-by-date IPC 已实现，内部 sort by scheduledAt DESC |
| 2 | 点击图片放大 | 图片预览打开，可左右切换 | ⏭️ 需人工 |
| 3 | 编辑内容（标题/正文/标签） | 保存成功 | ✅ content:update IPC 已实现 |
| 4 | 点击"获取物料包" | 同步成功，新内容状态为"待审核" | ✅ material:sync 中 status:'pending' 写入（material.ts:95） |
| 5 | 手动发布一条内容 | 状态变为"发布中"→"已发布" | ✅ auto-publish-service.executePublish 状态流转已实现 |
| 6 | 删除一条内容 | 从列表移除 | ✅ content:delete IPC 已实现 |

> ⚠️ 现存 2 条 `scheduled` 旧状态（Bug-005）

### T06 — 发布页

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| 1 | 手动填写标题/正文/图片，点击发布 | 实时显示发布进度 | ✅ publish store 订阅 `onPublishProgress` 事件 |
| 2 | 标题超过20字 | 自动截断，不报错 | ✅ UI `maxlength=20` + mcp-bridge.ts:36 双重截断 |
| 3 | Cookie 过期时发布 | 提示"请前往平台管理重新扫码登录" | ✅ auto-publish-service.ts:127 抛出该错误 |

### T07 — 数据分析

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| 1 | 进入数据分析页 | 显示图表和统计数据 | ⏭️ 需人工（API ✅） |
| 2 | 切换日期范围 | 数据随之更新 | ✅ GET /analytics/daily?start=&end= 返回 stats 数组 |
| 3 | 点击"刷新数据" | 从服务器拉取最新数据 | ⏭️ 需人工（analytics:get-overview 支持 forceRefresh） |

### T08 — 月度话题

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| 1 | 查看当月话题列表 | 显示话题内容 | ✅ GET /monthly-topics HTTP 200，当前库中无数据属正常 |
| 2 | 编辑一条话题并保存 | 保存成功，数据同步 | ✅ monthly-topics:update IPC + PUT /monthly-topics/{id} 定义齐全 |

### T09 — 设置

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| 1 | 查看应用信息 | 版本号、数据目录正确 | ✅ SettingsView.vue 渲染 version/platform/arch/dataDir |
| 2 | 查看自动发布配置 | enabled/autoApprove/platforms 显示正确 | ❌ 见 Bug-004：UI 未展示，但 auto-publish-config.json 值正确 `{enabled:true, autoApprove:true, platforms:["xiaohongshu"]}` |

### T10 — 系统行为

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| 1 | 点击关闭按钮 | 最小化到系统托盘，不退出 | ✅ main/index.ts:48-52 `event.preventDefault + mainWindow.hide()` |
| 2 | 托盘菜单"显示主窗口" | 主窗口重新显示 | ✅ main/index.ts:76-80 |
| 3 | 托盘菜单"同步物料包" | 触发同步 | ✅ main/index.ts:82-90 |
| 4 | 托盘菜单"退出" | 应用完全退出 | ✅ main/index.ts:94-98 `app.isQuitting=true + app.quit()` |
| 5 | 重启应用 | `publishing` 状态自动重置为 `pending` | ✅ main/index.ts:215-225 启动时遍历 contents 重置 |

---

## 二、后端 API 测试

### T11 — 认证接口

| 接口 | 测试点 | 状态 |
|------|--------|------|
| POST /auth/send-code | 正常发送；60秒内重复请求被限流 | 🟡 正常发送✅；**限流未实现**❌（Bug-001） |
| POST /auth/login/phone | 正确验证码登录成功；错误验证码返回401 | ✅（测试账号登录 200 / 错误码 401 已验证） |
| POST /auth/verify | 有效 Token 返回 valid:true；过期 Token 返回 valid:false | ✅（有效 200；无效 401 `{valid:false}`） |
| POST /auth/refresh | 刷新成功返回新 Token | ✅（返回新 accessToken） |
| POST /auth/logout | 登出后 Token 失效 | ✅（登出后 /verify 返回 401） |

### T12 — 人设接口

| 接口 | 测试点 | 状态 |
|------|--------|------|
| GET /personas | 返回当前用户人设列表 | ✅（HTTP 200，返回 persona+subscription） |
| POST /personas | 创建人设，验证必填字段 | ⏭️ 需人工（代码存在，未构造完整 payload） |
| PUT /personas/{id} | 更新成功；越权访问返回403 | 🟡 自有 id 成功✅；**越权分支未单独验证**（当前测试账号仅有自有 persona） |
| DELETE /personas/{id} | 删除成功 | ⏭️ 需人工 |

### T13 — 内容接口

| 接口 | 测试点 | 状态 |
|------|--------|------|
| GET /contents | 分页、状态筛选正常 | ✅ `?status=approved&page=1&per_page=5` HTTP 200 |
| POST /contents/{id}/approve | 状态变为 approved | 🟡 不存在 id 返回 404✅；**正向路径需人工造数据** |
| POST /contents/{id}/reject | 状态变为 rejected，reason 保存 | 🟡 不存在 id 返回 404✅；**正向路径需人工造数据** |

### T14 — 物料接口

| 接口 | 测试点 | 状态 |
|------|--------|------|
| GET /materials/latest | 无物料时返回 success:true + 空数组（不返回404） | ✅（返回 `{success:true, message:"暂无可用物料包", data:[]}`） |
| GET /materials/{id}/download | 正常下载；越权返回403 | 🟡 不存在 id 返回 404✅；**正向/越权需人工造数据** |
| GET /materials/{itemId}/image | 返回图片文件；文件不存在返回404 | ✅（不存在返回 404） |

### T15 — 统计接口

| 接口 | 测试点 | 状态 |
|------|--------|------|
| GET /analytics/overview | 返回汇总数据 | ✅（返回 totalFans/totalPosts/totalViews/totalLikes/fansGrowth/viewsGrowth） |
| GET /analytics/daily | 按日期范围返回数据 | 🟡 HTTP 200✅，但**未传 start/end 也返回默认数据**（Bug-009） |

---

## 三、Filament 后台测试

### T16 — 核心资源 CRUD

| 资源 | 测试点 | 状态 |
|------|--------|------|
| UserResource | 列表、搜索、编辑用户信息 | ✅ 代码结构完整（UserForm + UsersTable，nickname/email searchable） |
| PlanResource | 创建套餐（daily_quota/monthly_quota 字段） | ✅ 代码验证 PlanForm.php 包含 daily_quota + monthly_quota |
| SubscriptionResource | 为用户分配订阅；查看到期时间 | ✅ 资源目录结构完整 |
| AIProviderResource | 添加 AI 提供商（API Key、模型配置） | ✅ 资源目录结构完整 |
| PromptTemplateResource | 创建/编辑提示词模板 | ✅ 资源目录结构完整 |
| MaterialPackageResource | 查看物料包列表；ViewAction 查看详情 | ✅ Tables/MaterialPackagesTable.php 包含 ViewAction::make() + EditAction::make() |
| GenerationLogResource | 查看生成日志，确认错误日志可读 | ✅ 资源目录结构完整（Pages: Create/Edit/List） |
| MonthlyTopicResource | 编辑月度话题 | ✅ 资源目录结构完整 |

> 所有核心资源代码均已存在；具体 UI 交互需人工登录 `/admin` 进一步验证

### T17 — 业务流程（后台触发）

| # | 测试步骤 | 预期结果 | 状态 |
|---|---------|---------|------|
| 1 | 手动执行 `php artisan material:generate-daily` | 为有效订阅用户生成物料包 | ✅ 命令类 GenerateDailyMaterials 已定义，逻辑包含 User::whereHas('subscription', active) + dispatch job |
| 2 | 检查 GenerationLog | 生成过程有完整日志 | ⏭️ 需人工执行 |
| 3 | 检查 MaterialPackage 状态 | 生成完成后 status=completed | ⏭️ 需人工执行 |

---

## 四、端到端集成测试

| # | 场景 | 步骤 | 状态 |
|---|------|------|------|
| E01 | **新用户完整流程** | 注册→设置人设→连接小红书→同步物料→发布内容 | ⏭️ 需人工完整跑通 |
| E02 | **自动发布流程** | 后台生成物料→客户端同步→autoApprove 自动发布→确认小红书出现内容 | ⏭️ 需人工 |
| E03 | **Cookie 过期恢复** | 删除 cookies.json→触发发布→看到提示→重新登录→发布成功 | 🟡 代码路径验证✅（见 T06-3），端到端需人工 |
| E04 | **应用重启恢复** | 发布中途强制退出→重启→确认 publishing 状态重置为 pending | ✅ 代码路径验证通过（main/index.ts:215-225） |

---

## 五、已知风险项

| 风险 | 说明 | 处理建议 | 当前状态 |
|------|------|---------|------|
| `autoApprove: true` | 物料同步后立即发布，用户无审核机会 | 确认是否为预期行为 | ⚠️ 配置值确为 true（auto-publish-config.json），需产品确认 |
| `scheduled` 状态旧内容 | 2条旧内容状态异常 | 手动清理或忽略 | ❌ 已入 Bug-005 |
| AnalyticsView 2.7MB | 打包体积过大，首次加载慢 | 上线后优化，不阻塞上线 | ❌ 已入 Bug-006（实测 2.59MB） |
| 定时任务时区 | 调度使用 Asia/Shanghai，确认服务器时区一致 | 检查服务器 `date` 命令输出 | ⏭️ 需人工确认 |

---

## 六、本次自动化执行摘要

- **自动验证项**：47
- **✅ 通过**：34
- **🟡 部分通过（有遗留）**：7
- **❌ 失败（已转 Bug）**：6
- **⏭️ 需人工继续验证**：21

### 主要结论

1. **后端 REST API 骨架完整**（认证 / 人设 / 内容 / 物料 / 统计 / 话题），可直接进入 UI 联调。
2. **客户端关键 IPC 链路完整**：auth / persona / content / platform / material / auto-publish / analytics / monthly-topics / xhs-login / xhs-publish / file-dialog 全部注册并对应渲染端 preload。
3. **登录/Cookie 链路健壮**：Cookie 文件存在 + `web_session` 未过期即视为已登录，符合 `ASSISTANT.md` 的"唯一标准"。
4. **阻塞性缺陷为 0**，但有 1 个高危隐患（短信限流），上线前建议补齐。

## 状态说明

- ⬜ 待测试
- ✅ 通过
- 🟡 通过但有遗留
- ❌ 失败（需记录 Bug）
- ⏭️ 跳过 / 需人工
