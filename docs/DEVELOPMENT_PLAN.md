# VirtuTry - 开发计划 (Development Roadmap)

**项目**: AI 虚拟试穿工具  
**目标**: 完成 MVP 版本  
**预计工期**: 3-4 周  
**技术栈**: Next.js 16 + React 19 + TypeScript + Drizzle + PostgreSQL

---

## 📊 项目时间线

```
Phase 1 (Week 1)    : 数据库 + 后端核心 API
Phase 2 (Week 2)    : 前端 UI + Seedream 集成
Phase 3 (Week 3)    : 测试 + 优化 + 部署准备
Phase 4 (可选/Week 4): 衣服库初始化 + 监控
```

---

## 🎯 Phase 1: 后端开发 (Week 1)

### 任务 1.1: 数据库 Schema 扩展

**文件**: `lib/db/schema.ts`

**新增表**:

```typescript
// 衣服库表
export const clothing = pgTable('clothing', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // dress, shirt, coat...
  tags: text('tags').array(), // ['casual', 'summer', 'blue']
  imageUrl: varchar('image_url', { length: 1024 }).notNull(),
  imageBase64: text('image_base64'), // 可选，缓存以减少API调用
  uploadedBy: uuid('uploaded_by').references(() => user.id),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 虚拟试穿历史表
export const virtualTryOn = pgTable('virtual_try_on', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  personImageUrl: varchar('person_image_url', { length: 1024 }).notNull(),
  clothingIds: uuid('clothing_ids').array(), // [uuid1, uuid2, uuid3]
  resultImageUrl: varchar('result_image_url', { length: 1024 }),
  resultImageBase64: text('result_image_base64'), // 可选，用于快速加载
  hasWatermark: boolean('has_watermark').default(true),
  creditsUsed: integer('credits_used').default(50),
  seedreamTaskId: varchar('seedream_task_id', { length: 255 }), // API返回的任务ID
  status: varchar('status', { length: 50 }).default('pending'), // pending, processing, completed, failed
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 使用配额表（每日和每月）
export const tryOnQuota = pgTable('try_on_quota', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  quotaType: varchar('quota_type', { length: 20 }).notNull(), // 'daily', 'monthly'
  quotaLimit: integer('quota_limit').notNull(),
  quotaUsed: integer('quota_used').default(0),
  resetAt: timestamp('reset_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 索引优化
export const clothingIndex = index('clothing_category_idx').on(clothing.category);
export const tryOnUserIndex = index('virtual_try_on_user_idx').on(virtualTryOn.userId);
export const quotaResetIndex = index('try_on_quota_reset_idx').on(tryOnQuota.resetAt);
```

**操作**:
- [ ] 在 `lib/db/schema.ts` 中添加上述 4 个表
- [ ] 运行 `pnpm db:generate` 生成迁移
- [ ] 运行 `pnpm db:push` 应用迁移
- [ ] **预计时间**: 1h

---

### 任务 1.2: 核心业务逻辑（积分/配额）

**文件**: `lib/virtualtry.ts` (新建)

```typescript
import { db } from '@/lib/db';
import { tryOnQuota, user } from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';

// 虚拟试穿的积分成本
export const VIRTUAL_TRY_ON_CREDIT_COST = 50; // 基础成本

/**
 * 获取用户的试穿配额
 * @param userId 用户ID
 * @returns { daily: {limit, used}, monthly: {limit, used} }
 */
export async function getVirtualTryOnQuota(userId: string) {
  const quotas = await db
    .select()
    .from(tryOnQuota)
    .where(eq(tryOnQuota.userId, userId));

  const daily = quotas.find(q => q.quotaType === 'daily') || { quotaLimit: 3, quotaUsed: 0 };
  const monthly = quotas.find(q => q.quotaType === 'monthly') || { quotaLimit: 200, quotaUsed: 0 };

  return { daily, monthly };
}

/**
 * 检查用户是否能进行虚拟试穿
 * @param userId 用户ID
 * @param clothingCount 衣服数量 (1-3)
 * @returns { allowed: boolean, reason?: string }
 */
export async function canUserTryOn(userId: string, clothingCount: number): Promise<{ allowed: boolean; reason?: string }> {
  // 1. 检查用户存在且未被封禁
  const userData = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (userData.length === 0) {
    return { allowed: false, reason: 'User not found' };
  }
  const u = userData[0];
  if (u.banned) {
    return { allowed: false, reason: `Account banned: ${u.banReason}` };
  }

  // 2. 检查衣服数量限制
  const userTier = u.planKey ? 'paid' : 'free'; // 根据订阅判断
  const maxClothing = userTier === 'paid' ? 3 : 1;
  if (clothingCount > maxClothing) {
    return { allowed: false, reason: `Max ${maxClothing} clothing(s) for ${userTier} users` };
  }

  // 3. 检查日配额
  const dailyQuota = await db
    .select()
    .from(tryOnQuota)
    .where(
      and(
        eq(tryOnQuota.userId, userId),
        eq(tryOnQuota.quotaType, 'daily'),
        gt(tryOnQuota.resetAt, new Date())
      )
    )
    .limit(1);

  if (dailyQuota.length > 0) {
    const quota = dailyQuota[0];
    if (quota.quotaUsed >= quota.quotaLimit) {
      const resetTime = new Date(quota.resetAt).toLocaleString('zh-CN');
      return { allowed: false, reason: `Daily limit reached. Reset at ${resetTime}` };
    }
  }

  // 4. 检查月配额
  const monthlyQuota = await db
    .select()
    .from(tryOnQuota)
    .where(
      and(
        eq(tryOnQuota.userId, userId),
        eq(tryOnQuota.quotaType, 'monthly'),
        gt(tryOnQuota.resetAt, new Date())
      )
    )
    .limit(1);

  if (monthlyQuota.length > 0) {
    const quota = monthlyQuota[0];
    if (quota.quotaUsed >= quota.quotaLimit) {
      const resetTime = new Date(quota.resetAt).toLocaleString('zh-CN');
      return { allowed: false, reason: `Monthly limit reached. Reset at ${resetTime}` };
    }
  }

  // 5. 检查积分（如果使用积分系统）
  const credits = await getUserCredits(userId);
  if (credits < VIRTUAL_TRY_ON_CREDIT_COST) {
    return { allowed: false, reason: `Insufficient credits. Need ${VIRTUAL_TRY_ON_CREDIT_COST}, have ${credits}` };
  }

  return { allowed: true };
}

/**
 * 扣除用户的试穿配额和积分
 */
export async function deductVirtualTryOnQuota(userId: string) {
  const now = new Date();

  // 扣除日配额
  await db
    .update(tryOnQuota)
    .set({ quotaUsed: tryOnQuota.quotaUsed + 1 })
    .where(
      and(
        eq(tryOnQuota.userId, userId),
        eq(tryOnQuota.quotaType, 'daily'),
        gt(tryOnQuota.resetAt, now)
      )
    );

  // 扣除月配额
  await db
    .update(tryOnQuota)
    .set({ quotaUsed: tryOnQuota.quotaUsed + 1 })
    .where(
      and(
        eq(tryOnQuota.userId, userId),
        eq(tryOnQuota.quotaType, 'monthly'),
        gt(tryOnQuota.resetAt, now)
      )
    );

  // 扣除积分
  await deductCredits(userId, VIRTUAL_TRY_ON_CREDIT_COST, 'virtual_try_on');
}

/**
 * 获取用户积分（引用现有函数）
 */
export async function getUserCredits(userId: string): Promise<number> {
  const u = await db.select({ credits: user.credits }).from(user).where(eq(user.id, userId)).limit(1);
  return u[0]?.credits || 0;
}

/**
 * 扣除积分（引用现有函数）
 */
export async function deductCredits(userId: string, amount: number, reason: string) {
  // TODO: 复用 lib/credits.ts 中的现有函数
  // 参考: lib/credits.ts:deductCredits
}
```

**操作**:
- [ ] 创建 `lib/virtualtry.ts`，添加上述函数
- [ ] 导入并复用 `lib/credits.ts` 中的积分逻辑
- [ ] **预计时间**: 2h

---

### 任务 1.3: Seedream API 集成

**文件**: `lib/volcano-engine/seedream.ts` (新建)

```typescript
import axios from 'axios';

interface SeedreamRequest {
  model: string;
  images: Array<{
    role: 'person' | 'clothing';
    image: string; // data:image/...;base64,...
  }>;
  parameters?: {
    negative_prompt?: string;
    steps?: number;
    guidance_scale?: number;
  };
}

interface SeedreamResponse {
  task_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  output?: {
    image: string; // Base64 或 URL
  };
  error?: string;
}

const API_KEY = process.env.VOLCANO_ENGINE_API_KEY;
const API_BASE_URL = process.env.VOLCANO_ENGINE_API_URL;

/**
 * 调用 Seedream API 生成虚拟试穿效果
 * @param personImageBase64 人物照 (data:image/...;base64,...)
 * @param clothingImagesBase64 衣服照数组 (1-3张)
 * @returns { taskId, status }
 */
export async function generateVirtualTryOn(
  personImageBase64: string,
  clothingImagesBase64: string[]
): Promise<{ taskId: string; status: string }> {
  const images = [
    {
      role: 'person',
      image: personImageBase64,
    },
    ...clothingImagesBase64.map((img, idx) => ({
      role: 'clothing' as const,
      image: img,
    })),
  ];

  const payload: SeedreamRequest = {
    model: 'seedream-5.0-lite',
    images: images,
    parameters: {
      negative_prompt: 'blurry, low quality',
      steps: 20,
      guidance_scale: 7.5,
    },
  };

  try {
    const response = await axios.post<SeedreamResponse>(
      `${API_BASE_URL}/text_to_image`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    return {
      taskId: response.data.task_id,
      status: response.data.status,
    };
  } catch (error) {
    console.error('Seedream API error:', error);
    throw new Error(`Failed to call Seedream API: ${error.message}`);
  }
}

/**
 * 查询虚拟试穿任务状态
 */
export async function querySeedreamStatus(taskId: string): Promise<SeedreamResponse> {
  try {
    const response = await axios.get<SeedreamResponse>(
      `${API_BASE_URL}/tasks/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
        timeout: 10000,
      }
    );

    return response.data;
  } catch (error) {
    console.error('Query Seedream status error:', error);
    throw new Error(`Failed to query Seedream status: ${error.message}`);
  }
}
```

**操作**:
- [ ] 创建 `lib/volcano-engine/seedream.ts`
- [ ] 参考官方文档验证 API 端点和字段
- [ ] **预计时间**: 1.5h

---

### 任务 1.4: 后端 API 路由

**新建文件**:

#### 1. `app/api/virtual-try-on/generate/route.ts`
```typescript
import { auth } from '@/lib/auth';
import { canUserTryOn, deductVirtualTryOnQuota } from '@/lib/virtualtry';
import { generateVirtualTryOn } from '@/lib/volcano-engine/seedream';
import { db } from '@/lib/db';
import { virtualTryOn } from '@/lib/db/schema';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 1. 认证
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // 2. 解析请求体
    const body = await request.json();
    const { personImageBase64, clothingIds, customClothingImages } = body;

    // 3. 验证输入
    if (!personImageBase64) {
      return NextResponse.json({ error: 'Person image required' }, { status: 400 });
    }

    const totalClothing = (clothingIds?.length || 0) + (customClothingImages?.length || 0);
    if (totalClothing === 0 || totalClothing > 3) {
      return NextResponse.json({ error: 'Need 1-3 clothing items' }, { status: 400 });
    }

    // 4. 检查配额
    const { allowed, reason } = await canUserTryOn(userId, totalClothing);
    if (!allowed) {
      return NextResponse.json({ error: reason }, { status: 429 });
    }

    // 5. 获取衣服图片
    const clothingImagesBase64 = [
      ...(customClothingImages || []),
      // TODO: 从库中获取 clothingIds 对应的图片
    ];

    // 6. 调用 Seedream API
    const { taskId, status } = await generateVirtualTryOn(personImageBase64, clothingImagesBase64);

    // 7. 保存记录到数据库
    const tryOnRecord = await db.insert(virtualTryOn).values({
      userId,
      personImageUrl: 'pending', // 先保存为 pending，之后可优化为直接存 URL
      clothingIds: clothingIds || [],
      seedreamTaskId: taskId,
      status: 'pending',
    });

    // 8. 扣除配额和积分（立即扣除，结果失败不退款）
    await deductVirtualTryOnQuota(userId);

    // 9. 返回响应
    return NextResponse.json({
      taskId,
      status,
      message: 'Virtual try-on request submitted. Please poll for results.',
    });
  } catch (error) {
    console.error('Virtual try-on error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### 2. `app/api/virtual-try-on/status/route.ts`
```typescript
import { auth } from '@/lib/auth';
import { querySeedreamStatus } from '@/lib/volcano-engine/seedream';
import { db } from '@/lib/db';
import { virtualTryOn } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 });
    }

    // 查询 Seedream 状态
    const result = await querySeedreamStatus(taskId);

    if (result.status === 'completed' && result.output?.image) {
      // 更新数据库
      await db
        .update(virtualTryOn)
        .set({
          status: 'completed',
          resultImageUrl: result.output.image,
          updatedAt: new Date(),
        })
        .where(eq(virtualTryOn.seedreamTaskId, taskId));
    } else if (result.status === 'failed') {
      await db
        .update(virtualTryOn)
        .set({
          status: 'failed',
          errorMessage: result.error,
          updatedAt: new Date(),
        })
        .where(eq(virtualTryOn.seedreamTaskId, taskId));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Query status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### 3. `app/api/virtual-try-on/history/route.ts`
```typescript
// 获取试穿历史列表
// GET /api/virtual-try-on/history?page=1&limit=10
```

#### 4. `app/api/admin/clothing/upload/route.ts`
```typescript
// 管理员上传衣服图片
// POST /api/admin/clothing/upload
```

**操作**:
- [ ] 创建上述 4 个 API 路由
- [ ] 添加错误处理和日志
- [ ] **预计时间**: 3h

---

### 任务 1.5: 订阅计划配置更新

**文件**: `constants/billing.ts`

**添加**:
```typescript
// 虚拟试穿套餐
export const VIRTUAL_TRY_ON_PLANS = {
  free: {
    dailyQuota: 3,
    monthlyQuota: 90,
    maxClothingPerTry: 1,
    hasWatermark: true,
  },
  starter: {
    priceCents: 999,     // $9.99/月
    monthlyQuota: 200,
    maxClothingPerTry: 3,
    hasWatermark: false,
  },
  pro: {
    priceCents: 1999,    // $19.99/月
    monthlyQuota: 1000,
    maxClothingPerTry: 5,
    hasWatermark: false,
  },
};
```

**操作**:
- [ ] 更新 `constants/billing.ts`
- [ ] **预计时间**: 0.5h

---

### Phase 1 总结
**完成清单**:
- [x] 数据库 Schema (3 新表)
- [x] 业务逻辑函数 (配额/积分)
- [x] Seedream API 集成
- [x] 后端 API 路由 (4 个)
- [x] 订阅计划配置
- **预计总时间**: 8-10h

---

## 🎨 Phase 2: 前端开发 (Week 2)

### 任务 2.1: 试穿主页面组件

**文件**: `app/[locale]/(protected)/try-on/page.tsx`

**功能**:
- 展示模特照上传区
- 衣服选择区（库选 + 自上传）
- 生成按钮 + 进度提示
- 结果展示区

**操作**:
- [ ] 创建布局（左右两栏）
- [ ] 集成图片上传逻辑（file → Base64）
- [ ] 集成衣服库选择器
- [ ] 连接后端 API
- [ ] 添加加载状态和错误提示
- [ ] **预计时间**: 4-5h

---

### 任务 2.2: 衣服库浏览页面

**文件**: `app/[locale]/(protected)/try-on/wardrobe/page.tsx`

**功能**:
- 衣服分类筛选
- 标签筛选
- 衣服网格展示
- 选择衣服并返回主页

**操作**:
- [ ] 创建衣服库组件
- [ ] 集成分类/标签过滤
- [ ] 连接后端 API
- [ ] **预计时间**: 3h

---

### 任务 2.3: 试穿历史页面

**文件**: `app/[locale]/(protected)/try-on/history/page.tsx`

**功能**:
- 展示历史记录列表（分页）
- 支持删除、下载、查看大图
- 时间过滤

**操作**:
- [ ] 创建历史列表组件
- [ ] 连接后端 API
- [ ] **预计时间**: 2.5h

---

### 任务 2.4: 管理员衣服库管理页面

**文件**: `app/[locale]/(admin)/admin/clothing/page.tsx`

**功能**:
- 上传衣服图片
- 编辑衣服信息（分类、标签）
- 删除衣服

**操作**:
- [ ] 创建衣服管理表格
- [ ] 集成文件上传
- [ ] 连接后端 API
- [ ] **预计时间**: 2.5h

---

### 任务 2.5: UI 组件库扩展

**新组件**:
- `ImageUploader`: 图片上传 + Base64 转换
- `ClothingSelector`: 衣服多选器
- `VirtualTryOnResult`: 结果展示卡片
- `QuotaDisplay`: 配额提示

**操作**:
- [ ] 创建 4 个新组件
- [ ] 编写文档
- [ ] **预计时间**: 2h

---

### Phase 2 总结
**完成清单**:
- [x] 试穿主页面
- [x] 衣服库浏览
- [x] 试穿历史
- [x] 管理员衣服库管理
- [x] UI 组件库扩展
- **预计总时间**: 14-15h

---

## ✅ Phase 3: 测试 + 优化 + 部署 (Week 3)

### 任务 3.1: 功能测试

**测试清单**:
- [ ] 用户认证 (登录/未登录访问)
- [ ] 配额管理 (日/月限制)
- [ ] 图片上传和 Base64 转换
- [ ] Seedream API 调用和状态轮询
- [ ] 结果保存和历史查询
- [ ] 水印显示（免费用户 vs 付费用户）
- [ ] 衣服库筛选和选择
- [ ] 管理员衣服上传

**预计时间**: 3-4h

---

### 任务 3.2: 性能优化

**优化点**:
- [ ] Base64 缓存 (避免重复转换)
- [ ] 图片懒加载
- [ ] API 响应时间 < 2s
- [ ] 前端加载时间 < 3s

**预计时间**: 2-3h

---

### 任务 3.3: 安全审计

**检查项**:
- [ ] 用户隔离 (不能访问其他用户数据)
- [ ] 图片存储安全 (HTTPS 传输，加密存储)
- [ ] API 速率限制
- [ ] 管理员权限验证

**预计时间**: 1-2h

---

### 任务 3.4: 部署准备

**操作**:
- [ ] 环境变量配置 (生产环境)
- [ ] 数据库迁移脚本
- [ ] Seedream API Key 验证
- [ ] 初始衣服库数据 (50-100件)
- [ ] 监控和告警设置

**预计时间**: 2-3h

---

### Phase 3 总结
**完成清单**:
- [x] 功能测试通过
- [x] 性能优化
- [x] 安全审计
- [x] 部署配置
- **预计总时间**: 8-12h

---

## 📦 初始数据准备

### 衣服库初始化

**需要准备**:
- 50-100 件衣服图片（分类：连衣裙、T恤、外套、裤子等）
- 每件衣服的标签（风格、季节、颜色等）
- 上传脚本或批量导入

**文件**: `scripts/seed-clothing.ts` (可选)

---

## 📈 监控和告警

**需要跟踪的指标**:
1. **API 成功率** (Seedream 调用成功率)
2. **平均响应时间** (< 30s)
3. **配额使用情况** (日/月)
4. **错误率** (< 2%)
5. **用户转化率** (免费 → 付费)

**工具**: PostHog / Google Analytics (已集成)

---

## 🚀 发布清单

- [ ] 所有 API 端点测试通过
- [ ] 前端 UI 完成且响应式适配
- [ ] 数据库迁移成功
- [ ] 初始衣服库数据导入 (50+ 件)
- [ ] 管理员账户创建
- [ ] Seedream API 密钥配置正确
- [ ] 支付系统集成验证
- [ ] 邮件系统验证 (可选：试穿成功提醒)
- [ ] 性能测试 (100 并发用户)
- [ ] 安全审计通过
- [ ] 文档完成

---

## 📝 技术文档待编写

1. **API 文档** (OpenAPI/Swagger)
2. **组件库文档** (Storybook)
3. **部署指南** (Docker 或 Vercel)
4. **故障排查指南**

---

## 🔍 可能的风险和缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|--------|
| Seedream API 限流 | 用户请求失败 | 添加队列和重试机制 |
| Base64 大文件性能 | 前端卡顿 | 限制图片大小，压缩 |
| 配额管理复杂 | 逻辑错误 | 充分测试和事务处理 |
| 衣服库初期空虚 | 用户体验差 | MVP 发布前准备 100+ 件衣服 |

---

## 👥 团队分工建议

- **后端开发**: Phase 1 全部 + Phase 3 部分
- **前端开发**: Phase 2 全部
- **QA 测试**: Phase 3 全部
- **DevOps 运维**: 部署和监控

---

## 📞 相关文档链接

- [Seedream API 文档](https://www.volcengine.com/docs/82379/1541523)
- [多图融合 API](https://www.volcengine.com/docs/82379/1824121)
- [VirtuTry PRD](./VirtuTry_PRD.md)
- [现有项目架构](../CLAUDE.md)

