# VirtuTry (虚拟试穿) - 产品需求文档

**文档版本**: 1.0  
**更新日期**: 2026-05-15  
**产品名**: VirtuTry 虚拟试穿  
**目标用户**: 年轻女性（18-35岁）  
**核心痛点**: 在线购物衣服，试穿后不合适，退货流程繁琐

---

## 📋 产品概述

### 产品定位
AI驱动的虚拟试穿工具，帮助女性用户在购买衣服前预览实际穿着效果，降低退货率，提升购物体验。

### 核心价值
- 用户：提前看到实际试穿效果，减少冲动购物和退货
- 平台：提升用户粘性，积累试穿数据（可用于推荐系统）

---

## 🎯 MVP 功能范围

### 1. 核心使用流程

```
登录 → 选择/上传人物照 → 上传衣服（1-3件）→ 生成试穿效果 → 保存/分享
```

### 2. 功能清单

#### 2.1 用户认证与访问控制
- ✅ 必须登录（支持邮箱/Google OAuth）
- ✅ 匿名用户拒绝访问
- ✅ 会员等级判断（免费/付费）

#### 2.2 试穿功能核心流程
**输入**:
- 人物照（必需）: 用户上传的全身照或模特照
- 衣服图（必需1张，可选2-3张）: 衣服正面/平铺照

**处理**:
1. 将图片转换为 Base64 格式 (`data:image/<type>;base64,xxx`)
2. 调用 Seedream-5.0-lite API 的多图融合功能
3. 返回试穿后的合成图

**输出**:
- 1张试穿效果图（人物穿上所选衣服的效果）
- 根据用户类型添加水印（免费用户添加，付费用户无）

#### 2.3 试穿历史保存
- 保存每次试穿记录：人物照、衣服照、结果图、时间戳
- 用户可查看历史、下载、删除

#### 2.4 衣服库管理
- **衣服库功能** (Admin 后台)：
  - 上传衣服图片（支持多张，用于批量管理）
  - 分类管理（连衣裙、T恤、外套等）
  - 标签系统（风格、季节、颜色等）
  
- **用户端**：
  - 浏览衣服库中的衣服
  - 选择库中衣服进行试穿
  - 或上传自己的衣服图片

---

## 📊 用户分级与限制

| 维度 | 免费用户 | 付费用户 |
|------|--------|--------|
| **访问权限** | 登录必需 | 登录必需 |
| **日使用次数** | 3次/天 | 无限制 |
| **月使用次数** | ~90次/月 | 200次/月 |
| **单次衣服数量** | 1件 | 3件 |
| **水印** | ✅ 有 | ❌ 无 |
| **试穿历史保存** | ✅ 支持 | ✅ 支持 |
| **衣服库访问** | ✅ 支持 | ✅ 支持 |

---

## 💰 收费模式设计

### 方案：分级订阅 + 按量购买组合

#### A. 订阅计划（推荐）

| 计划 | 价格 | 月使用次数 | 单次衣服数 | 水印 | 其他权益 |
|------|------|----------|----------|------|--------|
| **Free** | $0 | 3次/天 (~90) | 1件 | ✅ | 衣服库浏览 |
| **Starter** | $9.99/月 | 200次/月 | 3件 | ❌ | 优先支持 |
| **Pro** | $19.99/月 | 1000次/月 | 5件 | ❌ | 优先支持 + 试穿记录统计 |
| **Annual Pro** | $199.99/年 | 12000次/年 | 5件 | ❌ | 节省 50% + 所有权益 |

#### B. 按量购买（补充方案）
- 10次试穿 → $2.99
- 50次试穿 → $10.99
- 100次试穿 → $18.99

**定位**: 给免费用户尝试升级 / 付费用户额外需求

#### C 试穿积分包（与现有系统整合）
沿用 VirtuTry 现有的积分系统：
- 1次试穿 = 50 积分（免费用户）或 30 积分（订阅用户）
- 用户可购买积分包补充额度

**推荐方案**: A (订阅) + B (按量) 的组合，因为：
- ✅ 免费用户可通过限流体验产品
- ✅ 付费用户明确看到月度额度，更易付费
- ✅ 按量购买作为临时需求补充
- ✅ 年度计划鼓励长期使用

---

## 🗄️ 数据模型（新增表）

### 1. 衣服库表 (Clothing)
```sql
clothing (
  id: UUID,
  name: String,                    -- 衣服名称
  category: Enum,                  -- 分类 (连衣裙、T恤、外套...)
  tags: String[],                  -- 标签 (风格、季节、颜色)
  imageUrl: String,                -- 衣服图URL
  imageBase64: Text,               -- Base64编码（可选，避免重复转换）
  uploadedBy: UUID,                -- 上传者ID (admin或平台)
  uploadedAt: DateTime,
  active: Boolean,                 -- 是否可用
)
```

### 2. 试穿历史表 (VirtualTryOn)
```sql
virtualTryOn (
  id: UUID,
  userId: UUID,                    -- 用户ID
  personImageUrl: String,          -- 人物照URL
  clothingIds: UUID[],             -- 选中的衣服ID列表 (1-3件)
  resultImageUrl: String,          -- 试穿结果图URL
  hasWatermark: Boolean,           -- 是否带水印
  creditsUsed: Int,                -- 消耗的积分
  createdAt: DateTime,
  updatedAt: DateTime,
)
```

### 3. 使用配额表 (TryOnQuota)
```sql
tryOnQuota (
  id: UUID,
  userId: UUID,
  quotaType: Enum,                 -- 'daily' (日) / 'monthly' (月)
  quotaLimit: Int,                 -- 配额上限
  quotaUsed: Int,                  -- 已使用
  resetAt: DateTime,               -- 重置时间
  createdAt: DateTime,
)
```

---

## 🔌 API 端点设计（新增）

### 用户端 API

#### 1. 获取衣服库 (GET)
```
GET /api/clothing/list
Query: category?, tags?, page?, limit?
Response: { clothes: Clothing[], total: Int }
```

#### 2. 创建试穿 (POST)
```
POST /api/virtual-try-on/generate
Body: {
  personImageBase64: String,        -- data:image/...;base64,...
  clothingIds: UUID[],              -- 1-3件
  customClothingImages?: String[]   -- 自上传衣服的Base64
}
Response: {
  taskId: String,
  status: 'queued' | 'processing' | 'completed'
}
```

#### 3. 查询试穿结果 (GET)
```
GET /api/virtual-try-on/status?taskId=xxx
Response: {
  status: String,
  resultImageUrl?: String,
  hasWatermark: Boolean
}
```

#### 4. 查看试穿历史 (GET)
```
GET /api/virtual-try-on/history?page=1&limit=10
Response: { items: VirtualTryOn[], total: Int }
```

#### 5. 删除试穿记录 (DELETE)
```
DELETE /api/virtual-try-on/:id
Response: { success: Boolean }
```

### 管理端 API（衣服库管理）

#### 1. 上传衣服 (POST)
```
POST /api/admin/clothing/upload
Body: FormData { file, category, tags, name }
Response: { clothingId: UUID }
```

#### 2. 管理衣服 (PATCH/DELETE)
```
PATCH /api/admin/clothing/:id
DELETE /api/admin/clothing/:id
```

---

## 🎨 UI 界面流程（核心交互）

### 页面1: 试穿主界面 (`/try-on`)
```
┌─────────────────────────────────────┐
│ VirtuTry 虚拟试穿                    │
│ [登出] [配额: 3/3] [升级]           │
├─────────────────────────────────────┤
│ 左: 模特照片上传区                   │
│   [上传模特照] → 人物照预览          │
│                                      │
│ 右: 衣服选择                         │
│   ☐ 衣服1 (必需)  [上传] / [库选]  │
│   ☐ 衣服2 (可选)  [上传] / [库选]  │
│   ☐ 衣服3 (可选)  [上传] / [库选]  │
│                                      │
│   [生成试穿效果] (需配额)            │
├─────────────────────────────────────┤
│ 结果区域:                            │
│ [试穿效果图]  [下载] [保存] [分享]  │
│ "今日还剩: 2次"                      │
└─────────────────────────────────────┘
```

### 页面2: 衣服库浏览 (`/try-on/wardrobe`)
```
┌────────────────────────┐
│ 衣服库                  │
│ [分类▼] [标签▼]        │
├────────────────────────┤
│ 🖼️ 衣服1    🖼️ 衣服2  │
│ T恤          连衣裙    │
│ [选择]       [选择]    │
├────────────────────────┤
│ 🖼️ 衣服3               │
│ 外套                   │
│ [选择]                 │
└────────────────────────┘
```

### 页面3: 试穿历史 (`/try-on/history`)
```
┌──────────────────────────────┐
│ 我的试穿                      │
│ [全部] [最近7天] [最近30天]   │
├──────────────────────────────┤
│ 🖼️ 结果图1  | 2026-05-15    │
│ 模特+T恤+连衣裙             │
│ [查看大图] [下载] [删除]      │
├──────────────────────────────┤
│ 🖼️ 结果图2  | 2026-05-14    │
│ ...                          │
└──────────────────────────────┘
```

---

## ⚙️ 技术实现细节

### 1. Seedream API 集成
**参考文档**: https://www.volcengine.com/docs/82379/1541523

**调用方式**:
```javascript
// 伪代码
const response = await volcEngine.api.call({
  model: 'seedream-5.0-lite',
  prompt: '虚拟试穿',
  images: [
    {
      role: 'person',      // 人物照
      image: personBase64  // data:image/jpeg;base64,...
    },
    {
      role: 'clothing',    // 衣服照
      image: clothingBase64
    },
    {
      role: 'clothing',    // 第2件衣服
      image: clothing2Base64
    }
    // ... 最多3件衣服
  ]
});
```

### 2. Base64 编码处理
```typescript
// 前端上传时：
const file = userSelectedFile;
const reader = new FileReader();
reader.readAsDataURL(file);  // 自动转为 data:image/...;base64,...

// 后端存储优化：
// - 小图(<5MB): 直接存 Base64 在数据库
// - 大图: 上传到 S3,保存 URL
```

### 3. 异步处理（结果生成可能需要10-30秒）
```
用户点击[生成] → 返回 taskId
前端轮询 GET /api/virtual-try-on/status?taskId=xxx
当 status=completed 时,展示结果
```

### 4. 水印添加
```typescript
// 后端生成结果后：
if (userTier === 'free') {
  resultImage = addWatermark(resultImage, 'VirtuTry');
}
```

### 5. 配额管理
```typescript
// 每次试穿前检查：
const quota = await checkQuota(userId);
if (quota.quotaUsed >= quota.quotaLimit) {
  return { error: '今日配额已用尽,请升级或明天再试' };
}

// 试穿成功后扣除：
await deductQuota(userId, 1);
```

---

## 📋 非功能需求

| 维度 | 要求 |
|------|------|
| **性能** | API 响应 < 2s，Seedream 生成 < 30s |
| **安全** | 图片 HTTPS 传输，用户数据加密 |
| **可用性** | 支持 Web + 移动端响应式 |
| **可观测性** | 记录试穿成功率、平均时长 |

---

## 🚀 MVP 发布标准

- ✅ 核心试穿功能完成 (生成效果图)
- ✅ 用户认证与配额管理
- ✅ 试穿历史保存
- ✅ 水印显示
- ✅ 基础衣服库 (20-50件)
- ✅ 订阅计费集成
- ✅ 前端 UI 完成
- ✅ 充分测试 (功能 + 压力测试)

**不在 MVP 范围内**:
- ❌ AR 虚拟试衣间
- ❌ 3D 模型
- ❌ 与电商平台对接
- ❌ 多人协作

---

## 📈 后续迭代（Phase 2+）

1. **数据分析**: 试穿数据统计、趋势分析
2. **个性化推荐**: 基于试穿历史推荐衣服
3. **社交分享**: 分享试穿结果到社交媒体
4. **电商对接**: 试穿→直接购买流程
5. **AR 功能**: 移动端 AR 虚拟试衣
6. **风格诊断**: AI 帮助用户发现适合的风格

