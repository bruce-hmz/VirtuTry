# 品牌替换待办 (Sistine → VirtuTry)

以下文件中仍有 "Sistine" 引用需要替换为 "VirtuTry"：

## 源码文件

- `app/api/newsletter/unsubscribe/route.ts` — 页面标题和正文中的 "Sistine AI"
- `app/api/newsletter/subscribe/route.ts` — 邮件主题和正文中的 "Sistine AI Newsletter"
- `features/marketing/components/contact-form.tsx` — GitHub 链接指向旧仓库

## 测试文件（低优先级，不影响用户）

- `tests/lib/form-schemas.test.ts` — 测试数据中的 "Sistine"
- `tests/lib/docs-metadata.test.ts` — 断言中的 "Sistine Docs"
- `tests/lib/admin-user-directory.test.ts` — 搜索测试中的 "sistine"
- `tests/lib/account-settings.test.ts` — 测试数据中的 "Sistine Builder"
- `tests/components/settings-page.test.tsx` — 测试数据中的 "Sistine Builder"

## 配置文件（可选）

- `package.json` — name 和 author 字段（不影响用户体验，但建议更新）
