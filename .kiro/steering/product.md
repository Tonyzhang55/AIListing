# Product

**AI Listing 优化引擎** · 面向 Amazon 卖家运营团队的 Listing 优化平台原型。把 Listing 优化从"AI 生成文本"扩展到跨广告 / 库存 / 合规 / 竞品的一体化运营驾驶舱。

## 状态

前后端分离原型 · Demo 用途。当前只有「知识库」页调用真实后端 API，其他视图仍走前端内嵌 mock。无认证、无持久化、无多用户。

## 核心能力

- **Listing 生成**：Modular Title / Highlights / Bullets / Q&A / Backend Keywords / A+ 骨架，遵循 Amazon 2026 政策的字符限制
- **AI 评分**：8 维度加权（A9 / 场景 / AI 可读性 / GEO / 视觉 / A+ / TQS / Social），产出 A/B/C 等级 + 人工跟进清单
- **多 ASIN 对比**：竞品洞察 + 差异化建议
- **合规扫描**：绝对化用词 / 医疗宣称 / 商标风险 / 类目错配
- **意图路由**：把用户自然语言分派到上述能力
- **多模型 provider**：Bedrock（含 SwiftChat 代理）/ OpenAI / DeepSeek / Ollama，可在 UI 里切换

## 目标用户

Amazon 卖家品牌方运营团队（当前项目背景是 COMFEE 家电类目）。

## 部署形态

- **A · GitHub Pages**：纯静态，前端检测到后端不可达自动回退到内嵌 mock
- **B · 本地全栈**：`npm start` 单进程跑前后端，端口 3000
- **C · 未来 AWS 生产架构**（未实现）：CloudFront + S3 · API Gateway + Lambda · Bedrock AgentCore · SP-API / Ads API / Alexa API · DynamoDB · EventBridge · Cognito
