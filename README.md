# AI Listing 优化引擎 · 前后端原型

面向 Amazon 卖家运营团队的 AI Listing 优化平台原型，基于 Amazon Bedrock + Amazon Q 视觉语言。把 Listing 优化从"AI 生成文本"扩展到"跨广告/库存/合规/竞品的一体化运营驾驶舱"。

**在线体验（GitHub Pages · 纯前端 mock 模式）**：https://tonyzhang55.github.io/AIListing/

---

## 目录结构

```
AIListing/
├── package.json          # 根级 · npm start 一键启动
├── frontend/
│   └── index.html        # 单文件前端（含全部 UI + fallback mock）
└── backend/
    ├── server.js         # Express 主入口
    ├── routes.js         # REST API 路由
    └── mock-data.js      # 后端 mock 数据源（未来替换为真实 SP-API/Bedrock）
```

## 本地启动

```bash
# 1. 安装依赖（只装 express 一个）
npm install

# 2. 启动
npm start
# 或开发模式（代码改动自动重启）：
npm run dev
```

打开 http://localhost:3000/ · 顶栏右上角会出现绿色的 **🟢 后端已连接** 状态灯。切到「知识库」页可以看到 8 个文件（比离线模式多 1 个 `AWS_Bedrock_Prompt_Templates_v1.md`，带紫色 **API** 徽章 —— 这是真实从后端 `/api/kb` 拉取的数据）。

## REST API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查（前端启动时 ping） |
| GET | `/api/asins` | ASIN 列表（支持 `?cat=` `?status=` 过滤） |
| GET | `/api/asins/:asin` | 单个 ASIN 详情 |
| GET | `/api/kb` | 知识库文件列表 |
| PATCH | `/api/kb/:name/enabled` | 切换文件是否参与推荐 |
| GET | `/api/projects` | 项目列表 |
| GET | `/api/projects/:id/tasks` | 项目内人工任务追踪 |
| POST | `/api/chat` | 对话（mock，未来接 Bedrock） |

用 curl 测一下：

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/kb
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"message":"你好"}'
```

## 部署模式

**A · GitHub Pages（纯静态、无后端）**：直接把 `frontend/index.html` 部署，前端会检测到后端不可达并回退到内嵌 mock。适合外部演示、方案讨论。当前 `main` 分支根目录之前是单文件，如需保持 Pages 兼容，可以在根建一个 `index.html` 转发到 `frontend/`，或改用 `frontend/` 作为 Pages source。

**B · 本地/服务器全栈**：`npm start` 一个进程搞定前后端，端口 3000。

**C · 未来 AWS 生产架构**：
- 前端：CloudFront + S3
- BFF：API Gateway + Lambda（复用当前 `routes.js` 逻辑，改成 Lambda handler）
- AI 编排：Bedrock AgentCore + Claude Sonnet / Nova
- 数据接入：SP-API · Amazon Ads API · Alexa Shopping API · Brand Registry/TQS
- 存储：DynamoDB · S3
- 异步：EventBridge + SQS + Lambda（多源抓取、A/B 结算、自动迭代触发）
- 身份：Cognito（对接客户 SSO）

## 接入真实 Bedrock

`backend/routes.js` 的 `/api/chat` 里有注释掉的示例代码。取消注释、安装 AWS SDK 即可：

```bash
npm install @aws-sdk/client-bedrock-runtime
```

然后配置 AWS 凭证（`aws configure` 或环境变量 `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION`）。

## 场景演示（点击体验）

1. 首屏点 chip「⚖️ 对比 3 ASIN」→ 看对比卡片 + 右侧 Amazon 商品页
2. 点其中一个 ASIN 的「🚀 优化此 ASIN」→ 走 Listing 优化 3 步流程
3. Step 3 AI 评分后看「人工跟进清单」→ 一键指派
4. 侧栏进「运营总览」→ 顶部切换品类 → 看跨域 AI Insights
5. 侧栏进「我的项目」→ 进入项目 → 点「👥 人工任务」看指派后追踪
6. 侧栏进「知识库」→ 顶部可见"数据源"提示（后端连接时会看到 API 徽章）

## 已知限制

- 目前只有「知识库」页真实调用后端 API，其他视图仍用前端内嵌 mock（渐进迁移）
- Chat API 返回 mock 响应，未接入 Bedrock
- 无身份验证 / 无持久化 / 无多用户
- 生产使用时需要接入 SP-API、Ads API、Alexa API 等（授权流程见 AWS 文档）

## License

内部演示原型，仅供客户方案讨论使用。
