# 应用修复验证指南

## 修复内容总结

### 1. ✅ 图片路径错误
- **问题**: 路径缺少前导斜杠 `/`
- **修复**: protocol handler 自动添加前导斜杠
- **文件**: `src/main/index.ts:68-93`

### 2. ✅ 人设数据丢失
- **问题**: `personas.json` 文件不存在
- **修复**: 创建了默认人设"心理学科普博主"
- **文件**: `personas.json`

### 3. ✅ USER_ID_NOT_CONFIGURED 错误
- **问题**: 平台账号没有 userId，数据分析报错
- **修复**: 
  - 登录时自动获取 userId
  - 未配置时返回默认数据而不报错
- **文件**: 
  - `src/main/services/platform/platform-service.ts`
  - `src/main/services/analytics/analytics-service.ts`

### 4. ✅ Auth Store API 不匹配
- **问题**: 使用了错误的API，缺少属性和方法
- **修复**: 修正了所有API调用
- **文件**: `src/renderer/src/stores/auth.ts`

### 5. ✅ 重复内容数据
- **问题**: 57条内容中有54条重复
- **修复**: 清理后保留3条唯一内容
- **备份**: `contents.json.backup`

---

## 验证方法

### 方法1: 使用验证脚本（推荐）

```bash
node verify-fixes.js
```

**预期输出**:
```
✅ 人设数据已恢复
   - 找到 1 个人设
   - 默认人设: 心理学科普博主

✅ 平台数据检查
   - 找到 1 个平台账号
   - 小红书账号: 小红书账号
   - 状态: disconnected
   - userId: 未配置

✅ 内容数据检查
   - 找到 3 条内容
   - 第一条内容: 如何提升自信心？心理学视角解析
   - 图片数量: 1
   - 路径是否以/开头: ✅ 是
```

### 方法2: 手动验证应用功能

#### 步骤1: 启动应用
```bash
npm run dev
```

#### 步骤2: 检查内容管理页面
1. 打开应用
2. 点击左侧菜单"内容管理"
3. **验证点**:
   - ✅ 应该看到3条内容（不是57条）
   - ✅ 每条内容的封面图片应该正常显示（不是404错误）
   - ✅ 内容按日期分组显示

**如果图片显示为"无封面"**:
- 原因：物料包目录中没有实际的图片文件
- 解决：在 `materials/2026-04-20/post-001/` 等目录中添加图片文件
- 图片命名：`image-1.jpg`, `image-2.jpg` 等

#### 步骤3: 检查个人资料页面
1. 点击左侧菜单"个人资料"或底部用户头像
2. **验证点**:
   - ✅ 应该看到"心理学科普博主"人设
   - ✅ 可以查看和编辑人设信息

#### 步骤4: 检查数据分析页面
1. 点击左侧菜单"数据分析"
2. **验证点**:
   - ✅ 页面不应该报错
   - ✅ 应该显示默认数据（全0）
   - ✅ 不应该看到 "USER_ID_NOT_CONFIGURED" 错误

**如需真实数据**:
1. 进入"平台管理"页面
2. 点击"添加平台账号"
3. 选择"小红书"
4. 扫码登录
5. 登录成功后会自动获取 userId
6. 返回"数据分析"页面刷新

#### 步骤5: 检查平台管理页面
1. 点击左侧菜单"平台管理"
2. **验证点**:
   - ✅ 应该看到一个小红书账号
   - ✅ 状态显示为"未连接"（disconnected）
   - ✅ 可以点击"重新连接"进行登录

---

## 常见问题

### Q1: 图片显示"无封面"
**原因**: 物料包目录中没有实际的图片文件，只有 metadata.json 和 README.txt

**解决方案**:
```bash
# 查看物料包目录
ls -la materials/2026-04-20/post-001/

# 应该包含:
# - metadata.json (元数据)
# - README.txt (说明文件)
# - image-1.jpg (需要手动添加)
```

添加图片后，重启应用或刷新页面即可看到。

### Q2: 数据分析显示全0
**原因**: 这是正常的，因为：
1. 小红书账号未登录
2. userId 未配置

**解决方案**:
1. 在平台管理中登录小红书
2. 登录后会自动获取 userId
3. 刷新数据分析页面

### Q3: 内容数量不对
**原因**: 可能是清理脚本未运行或运行失败

**解决方案**:
```bash
# 重新运行清理脚本
node clean-duplicates.js

# 检查内容数量
jq 'length' contents.json
# 应该输出: 3
```

### Q4: 应用启动后仍有错误
**解决方案**:
```bash
# 1. 完全停止应用
pkill -f "electron.*media-automation"

# 2. 清理构建缓存
rm -rf out/

# 3. 重新启动
npm run dev
```

---

## 数据文件说明

### 关键数据文件
- `personas.json` - 人设数据（1个默认人设）
- `contents.json` - 内容数据（3条内容）
- `platforms.json` - 平台账号（1个小红书账号）
- `material-sync-state.json` - 同步状态（防止重复导入）
- `analytics.json` - 数据分析缓存

### 物料包目录结构
```
materials/
├── 2026-04-20/
│   ├── post-001/
│   │   ├── metadata.json
│   │   ├── README.txt
│   │   └── image-1.jpg (需要手动添加)
│   └── post-002/
│       ├── metadata.json
│       ├── README.txt
│       ├── image-1.jpg (需要手动添加)
│       └── image-2.jpg (需要手动添加)
└── 2026-04-21/
    └── post-001/
        ├── metadata.json
        ├── README.txt
        └── image-1.jpg (需要手动添加)
```

---

## 验证清单

使用此清单确认所有修复都已生效：

- [ ] 运行 `node verify-fixes.js` 全部通过
- [ ] 应用启动无错误日志
- [ ] 内容管理页面显示3条内容
- [ ] 图片路径正确（以 `/` 开头）
- [ ] 人设数据存在
- [ ] 数据分析页面不报错
- [ ] 平台管理页面显示小红书账号

---

## 下一步建议

1. **添加图片文件**: 在物料包目录中添加实际的图片文件
2. **登录小红书**: 在平台管理中登录以获取真实数据
3. **测试发布功能**: 尝试发布一条内容到小红书
4. **配置自动发布**: 在发布管理中配置自动发布规则

---

## 技术细节

### 图片路径处理
```typescript
// 修复前: users/sunlice/... (缺少前导/)
// 修复后: /users/sunlice/... (正确)

// protocol handler 中的修复
if (!decodedPath.startsWith('/') && !decodedPath.match(/^[A-Za-z]:/)) {
  decodedPath = '/' + decodedPath
}
```

### 数据分析降级处理
```typescript
// 修复前: 抛出 USER_ID_NOT_CONFIGURED 错误
// 修复后: 返回默认数据
if (error.message === 'USER_ID_NOT_CONFIGURED') {
  return this.getDefaultData() // { totalFollowers: 0, ... }
}
```

### 自动获取 userId
```typescript
// 登录时自动调用 MCP 获取用户信息
const feedsResult = await client.callTool('list_feeds', {})
if (feedsData.currentUser) {
  userId = feedsData.currentUser.userId
  accountName = feedsData.currentUser.nickname
}
```
