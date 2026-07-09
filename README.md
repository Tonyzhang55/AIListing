# AI Listing 优化引擎 · 原型

面向 Amazon 卖家运营团队的 AI Listing 优化平台原型，为美的集团 COMFEE 品牌定制。基于 Amazon Bedrock + Amazon Q 视觉语言，把 Listing 优化从"AI 生成文本"扩展到"跨广告/库存/合规/竞品的一体化运营驾驶舱"。

**在线访问**：https://tonyzhang55.github.io/AIListing/

---

## 快速预览

- **对话首屏**：4 个任务入口（Listing 优化 / Modular Title 迁移 / AI 评分诊断 / 通用问答）+ 4 条 chip 示例
- **运营总览 Dashboard**：合规红线 · 广告 × Listing 联动 · 库存 · Buy Box · Citation 监控 · AI 跨域建议，按品类/项目切换
- **Listing 优化流程**（3 必选 + 1 可选）：场景提取 → 内容生成 → AI 评分（入项目门槛）→ A/B 测试（可选）
- **项目工作区**：Citation 监控 + 自动迭代 + 人工任务追踪
- **多 ASIN 对比**：AI 分析卡片 + 右侧同步渲染 Amazon 真实买家详情页
- **人工任务闭环**：AI 明确列出无法自动完成的事项（主图/A+ 视频/Vine），指派到设计/内容/品牌运营团队并追踪

## 场景演示（点击体验）

1. 首屏点 chip「⚖️ 对比 B08GK4VPMR、B08GK4S8LK、竞品 B0BXK6L2VP」→ 看对比卡片 + 右侧 Amazon 商品页
2. 点其中一个 ASIN 的「🚀 优化此 ASIN」→ 走 Listing 优化 4 步流程
3. Step 3 AI 评分后看「人工跟进清单」→ 一键指派
4. 侧栏进「运营总览」→ 顶部切换品类 → 看跨域 AI Insights
5. 侧栏进「我的项目」→ 进入项目 → 点「👥 人工任务」看指派后追踪

## 技术栈

**当前原型**：单文件纯静态 HTML，无框架无构建。

**规划后端**：
- 前端：CloudFront + S3（或继续用 GitHub Pages）
- BFF：API Gateway + Lambda
- AI 编排：Bedrock AgentCore + Claude Sonnet / Nova
- 数据接入：SP-API · Amazon Ads API · Alexa Shopping API · Brand Registry/TQS
- 存储：DynamoDB · S3
- 异步：EventBridge + SQS + Lambda（多源抓取、A/B 结算、自动迭代触发）
- 身份：Cognito（对接美的 SSO）

## 本地打开

```bash
git clone https://github.com/Tonyzhang55/AIListing.git
cd AIListing
open index.html    # macOS
# 或直接双击 index.html
```

## GitHub Pages 部署

1. `Settings → Pages`
2. Source 选 `Deploy from a branch`，Branch 选 `main` / `root`
3. 保存后等 1-2 分钟，`https://tonyzhang55.github.io/AIListing/` 可访问

## 数据说明

原型内所有数据（ASIN、评分、广告、库存、Citation 等）为 mock，方便快速演示。真实接入后端时需要 SP-API / Ads API / Alexa API 授权。

## License

内部演示原型，仅供 AWS · 美的集团方案讨论使用。
