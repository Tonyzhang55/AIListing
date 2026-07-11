# Project Structure

```
Listing/
├── package.json            # 单一 package · npm start 一键启动
├── README.md               # 项目说明（中文）
├── .gitignore              # 已排除 node_modules / backend/config.json
├── frontend/
│   └── index.html          # 单文件前端 · 内联 CSS/JS · 含 fallback mock
└── backend/
    ├── server.js           # Express 入口 · 挂载所有路由 + 静态资源 + SPA fallback
    ├── routes.js           # 业务 REST API（/api/asins /api/kb /api/projects）
    ├── chat.js             # /api/chat · 按 activeModel 分发到 provider
    ├── ai-routes.js        # /api/ai/* · 意图 / 生成 / 评分 / 对比 / 合规
    ├── providers.js        # /api/providers/* · 4 provider 定义 + 配置管理
    ├── llm.js              # 通用 LLM 调用 · askLLM / askLLMForJSON
    ├── mock-data.js        # 后端唯一 mock 数据源（ASINS / KB_FILES / PROJECTS / PROJ_TASKS）
    └── config.json         # Provider 凭证 · gitignored · 通过 /api/providers/*/config 写入
```

## 路由挂载顺序（`server.js`）

顺序很关键 · 前面的会覆盖 `routes.js` 里旧的 mock 实现：

1. `/api/providers` → `providers.router`
2. `/api/chat` → `chatRouter`
3. `/api/ai` → `aiRoutes`
4. `/api` → `routes`（catch-all · 放最后）
5. 静态资源 · `frontend/` · dev 阶段禁 cache
6. SPA fallback · 非 `/api` 且 accept html 的都回 `index.html`

## 数据流约定

- **业务数据**（ASINs / KB 文件 / 项目 / 任务）：`mock-data.js` 是唯一来源 · 未来接入 SP-API / Ads API 时替换此文件里的具体函数
- **配置数据**（provider 凭证 / activeModel）：`config.json` · 通过 `providers.js` 里的 `loadConfig` / `saveConfig` 读写
- **LLM 调用**：业务路由 → `llm.js` 的 `askLLMForJSON` → 按 `activeModel.provider` 分发

## 新增功能的约定位置

| 需求类型 | 放哪 |
|---|---|
| 新业务 REST 接口（非 AI）| `routes.js` 里加一段 |
| 新的 AI 推理接口 | `ai-routes.js` · 用 `askLLMForJSON` 复用分发逻辑 |
| 新支持一个 LLM provider | `providers.js` 的 `PROVIDERS` 定义 + `chat.js` / `llm.js` 各加一个分支 |
| 新 mock 数据 | `mock-data.js` · 保持导出的常量命名一致 |
| 前端新 view | `frontend/index.html` 内联 JS 里加，通过 fetch `/api/*` 拿数据 |

## 边界

- 前端不直连任何外部 API · 所有对外调用（Bedrock / OpenAI / SP-API 等）从后端出
- Provider 凭证只经过 `providers.js` 存取 · 其他文件通过 `loadConfig()` 读取
- 前端 fetch 失败时应回退到内嵌 mock（现有代码已经这么做，新增视图要保持这个约定）
