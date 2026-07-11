# Tech Stack

## Runtime

- **Node.js ≥ 18**（原生 `fetch`、`node --watch`）
- **Express 4.19** · REST API + 静态资源 + SPA fallback，单进程搞定前后端
- 前端：单文件 `frontend/index.html`（内联 CSS/JS，无构建）

## 依赖

- `express` · HTTP 服务
- `@aws-sdk/client-bedrock` + `@aws-sdk/client-bedrock-runtime` · Bedrock 模型列表 / Converse API
- `@aws-sdk/credential-providers` · `fromIni` / `fromNodeProviderChain`
- 无测试框架 · 无 lint · 无 TypeScript · 无打包器

## LLM Provider 抽象

`backend/providers.js` 定义 4 个 provider（Bedrock / OpenAI / DeepSeek / Ollama）· `backend/llm.js` 按 `activeModel` 分发 · `backend/chat.js` 处理对话 · `backend/ai-routes.js` 用 `askLLMForJSON` 做业务推理（意图 / 生成 / 评分 / 对比 / 合规）。

Bedrock 支持 5 种凭证模式：`bedrockApiKey`（官方 Bearer）· `proxyServer`（SwiftChat / LiteLLM）· `default`（凭证链）· `profile`（AWS Profile）· `accessKey`。

## 配置存储

`backend/config.json` 存 provider 凭证和 `activeModel` · **已在 `.gitignore`** · 不要提交，不要在日志或响应里回显完整 Key（`providers.js` 里已有 `maskKey` 脱敏工具）。

## 常用命令

```bash
# 安装依赖
npm install

# 启动（生产模式）· http://localhost:3000
npm start

# 开发模式 · 代码改动自动重启（node --watch）
npm run dev

# 快速验证后端联通
curl http://localhost:3000/api/health
curl http://localhost:3000/api/kb
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"你好"}'

# 测试某个 provider 的凭证
curl -X POST http://localhost:3000/api/providers/bedrock/test
```

## 代码风格约定

- CommonJS `require` / `module.exports`（不用 ESM）
- 双空格缩进，单引号字符串，行尾无分号强制约定
- 顶部保留 `// ===` 分隔线的模块说明注释块（现有文件的统一风格）
- 中文注释 + 英文技术术语混排，符合项目现状
- 日志用 `console.log` · 前缀 `  [Module]` 便于扫读（见 `chat.js` / `ai-routes.js`）
- LLM 相关错误一律包含 provider / modelId 上下文
- 用 `askLLMForJSON` 而不是自己解析 · 它已经处理 markdown fence 剥离和平衡括号提取
