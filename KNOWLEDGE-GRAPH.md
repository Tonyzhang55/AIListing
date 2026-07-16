# AI Listing 优化引擎 · 知识图谱

面向 Amazon 卖家运营的 Listing 优化平台原型 · 3 层架构 · 4 类核心业务能力 · 8 类数据源。

## 1. 系统架构总览

```mermaid
graph TB
  User([Amazon 卖家运营 · Tony])

  subgraph FE ["前端 · 单文件 frontend/index.html · 内联 CSS/JS"]
    HomeView[首页对话]
    RecStepper[Listing 优化 4 步流程]
    Dashboard[运营总览 Dashboard]
    Project[项目工作区]
    Compare[多 ASIN 对比]
    KB[知识库视图]
    CurrentOpt[当前优化 ASIN 面板]
  end

  subgraph BE ["后端 · Express · Node ≥18 · 单进程 :3000"]
    Server[server.js · 路由挂载]
    Routes[routes.js · 业务 REST]
    Chat[chat.js · /api/chat]
    AI[ai-routes.js · /api/ai/*]
    Providers[providers.js · /api/providers/*]
    LLM[llm.js · askLLMForJSON 通用分发]
    Mock[mock-data.js · 唯一业务数据源]
    Config[config.json · 凭证 · gitignored]
  end

  subgraph LLMLayer ["LLM Provider 层 · 4 选 1"]
    Bedrock[Amazon Bedrock]
    OpenAI[OpenAI]
    DeepSeek[DeepSeek]
    Ollama[Ollama · 本地]
  end

  subgraph BedrockModes ["Bedrock 凭证 · 5 种"]
    APIKey[bedrockApiKey · 官方 Bearer]
    Proxy[proxyServer · SwiftChat/LiteLLM]
    Default[default · SSO/Ada 凭证链]
    Profile[profile · AWS Profile]
    AK[accessKey · AK/SK]
  end

  subgraph External ["外部接口 · 网络出向"]
    Amazon[amazon.com/dp/*]
    SwiftChat[SwiftChat App Runner]
    BedrockAPI[Bedrock Runtime API]
  end

  User --> HomeView
  User --> Dashboard
  User --> Project
  HomeView --> RecStepper
  RecStepper --> CurrentOpt
  HomeView --> Compare
  HomeView --> KB

  FE -->|fetch /api/*| Server
  Server --> Routes
  Server --> Chat
  Server --> AI
  Server --> Providers

  AI --> LLM
  Chat --> LLM
  LLM --> LLMLayer
  Providers --> Config
  Providers --> BedrockModes

  Bedrock --> BedrockAPI
  Bedrock -.SwiftChat 代理.-> SwiftChat
  AI -.抓取商品页.-> Amazon
  Routes --> Mock

  style FE fill:#f5f0ff,stroke:#7C3AED
  style BE fill:#e8f4ff,stroke:#2b6cb0
  style LLMLayer fill:#fef7e0,stroke:#d97706
  style External fill:#f0f9f4,stroke:#059669
```

## 2. REST API 端点图

```mermaid
graph LR
  subgraph Health ["健康 / 基础"]
    H1[GET /api/health]
    H2[GET /api/asins]
    H3[GET /api/kb]
    H4[GET /api/projects]
    H5[GET /api/projects/:id/tasks]
  end

  subgraph AIRoutes ["/api/ai/* · LLM 驱动"]
    A1["POST /intent · 意图分类"]
    A2["POST /generate-listing · Modular Title 生成"]
    A3["POST /score-listing · 8 维评分"]
    A4["POST /compare-asins · 竞品对比洞察"]
    A5["POST /compliance-check · 合规扫描"]
    A6["POST /asin-lookup · Amazon 商品页抓取"]
    A7["POST /kb-find-for-listing · 知识库品类检索"]
  end

  subgraph ProviderRoutes ["/api/providers/* · 配置管理"]
    P1[GET / · 列 provider 定义]
    P2[GET /config · 当前配置状态]
    P3["POST /:id/config · 保存凭证"]
    P4["POST /:id/test · 连接测试"]
    P5["GET /:id/models · 拉真实模型列表"]
    P6[POST /active-model · 切模型]
  end

  ChatRoute["POST /api/chat · 按 activeModel 分发"]

  style AIRoutes fill:#f5f0ff,stroke:#7C3AED
  style ProviderRoutes fill:#e8f4ff,stroke:#2b6cb0
```

## 3. Listing 优化 4 步流程 · 数据流

```mermaid
graph TB
  Start([用户点 · AI Listing 优化])
  Default["默认 ASIN · B0CLGYLKXP · Midea 30 Range Hood"]

  subgraph Step1 ["Step 1 · ASIN 画像"]
    Lookup["asin-lookup · 抓 amazon.com"]
    Fields[标题 · 品牌 · 价格 · 主图 · ★评分 · 评论数]
    LLMExtract[LLM 结构化 · 品类 · 型号 · 建议目标]
    Baseline[基线评分 · LLM 打原始 Listing · 例 30/100 C]
    KBFind[kb-find-for-listing · 按品类查知识库]
    KBResult[✓ 可用类 · ⚠ 必需缺 · 💡 建议补]
  end

  subgraph Step2 ["Step 2 · 内容生成"]
    Sources[数据源清单 · 从知识库真实文件]
    Scenarios[Alexa Follow-up 场景评审]
    Generate[generate-listing · LLM 生成]
    Output[Item Name · Highlights · Bullets · Q&A · Backend Keywords · A+ 骨架]
  end

  subgraph Step3 ["Step 3 · AI 评分 · 入项目门槛"]
    Score[score-listing · 8 维度加权]
    Dims[A9 20 · 场景 15 · AI 15 · GEO 15 · 视觉 12 · A+ 10 · TQS 8 · 社交 5]
    Grade[A ≥85 · B 65-84 · C < 65]
    HumanTodos[人工跟进事项 · 设计/内容/品牌指派]
  end

  subgraph Step4 ["Step 4 · A/B 测试 · 可选"]
    AB[Amazon Manage Your Experiments]
    Judge[14 天 · 每组 ≥5000 sessions · p<0.05]
    Verdict[显著胜出 → 全量 · 未通过 → 回退]
  end

  Save[保存到项目 · Citation 监控 · 自动迭代]

  Start --> Default --> Lookup
  Lookup --> Fields --> LLMExtract
  Fields --> Baseline
  LLMExtract --> KBFind --> KBResult
  KBResult --> Sources
  Sources --> Scenarios --> Generate --> Output
  Output --> Score --> Dims --> Grade --> HumanTodos
  Grade -->|≥80| AB
  AB --> Judge --> Verdict
  Verdict --> Save
  HumanTodos -.可选跳过.-> AB

  style Step1 fill:#f0f9f4,stroke:#059669
  style Step2 fill:#fef7e0,stroke:#d97706
  style Step3 fill:#f5f0ff,stroke:#7C3AED
  style Step4 fill:#e8f4ff,stroke:#2b6cb0
```

## 4. 数据源类型图谱

```mermaid
graph LR
  subgraph Alexa ["Alexa 三路 · 必备 · locked"]
    AS[alexa_summary · 描述范式]
    AF[alexa_followup · 30 天追问场景]
    PD[product_describe · COSMO 属性]
  end

  subgraph Search ["搜索排名 · 可选"]
    BA[brand_analytics · TOP 100 搜索词]
    SP[sp_ads · CVR ≥ 5% 高转化词]
    KR[keyword_rank · SKU 排名快照]
  end

  subgraph Competitor ["竞品参考"]
    CL[competitor_listing · Broan/COSMO/Ninja 抓取]
  end

  subgraph Social ["评论社交"]
    RF[rufus_feedback · 30 天评论洞察]
  end

  subgraph Policy ["政策 · 跨品类"]
    PL[Amazon Modular Titles Guidelines v3]
  end

  subgraph Cats ["品类 · catTags 打标"]
    C1[pressure cooker]
    C2[range hood]
    C3[microwave]
  end

  AS -->|catTags| Cats
  AF -->|catTags| Cats
  PD -->|catTags| Cats
  BA -->|catTags 跨品类聚合| Cats
  SP -->|Range Hood 有 · Pressure Cooker 故意缺| Cats
  CL -->|各品类竞品分开| Cats
  RF -->|各品类| Cats

  style Alexa fill:#ffe8d9,stroke:#d97706
  style Search fill:#e0f2fe,stroke:#0284c7
  style Competitor fill:#fce7f3,stroke:#be185d
  style Social fill:#dcfce7,stroke:#16a34a
```

## 5. 意图路由 · 用户输入到功能的映射

```mermaid
graph LR
  Input["用户自然语言输入"]
  Intent["POST /api/ai/intent · LLM 分类"]

  I1[listingOpt · Listing 优化]
  I2[compare · ≥2 ASIN 对比]
  I3[migration · Modular Title 迁移]
  I4[audit · AI 评分诊断]
  I5[compliance · 合规扫描]
  I6[chat · 通用问答]

  F1[startListing 4 步流程]
  F2[startCompareAsins · 真实/mock 双模式]
  F3[startMigration · 脚本演示]
  F4[startAudit · 单独走 Step 3]
  F5[runCompliance · compliance-check]
  F6[sendToClaude · 直调 chat 接口]

  Input --> Intent
  Intent --> I1 --> F1
  Intent --> I2 --> F2
  Intent --> I3 --> F3
  Intent --> I4 --> F4
  Intent --> I5 --> F5
  Intent --> I6 --> F6

  Intent -.失败 fallback.-> Regex[detectIntentLocal · regex 匹配]

  style Intent fill:#f5f0ff,stroke:#7C3AED
```

## 6. 前端状态实体图

```mermaid
graph TB
  subgraph GlobalState ["全局状态"]
    BC[backendConnected · bool]
    AM[ACTIVE_MODEL · provider/modelId/name]
    RC[recChatActive · 是否在 4 步流程中]
    RS[recStepNow / recSubNow · 当前步/子步]
  end

  subgraph ListingFlow ["Listing 优化流程状态"]
    AA[asinAnswers · asin/cat/model/brand/title/price/goal]
    KFR[kbFindResult · 知识库检索结果]
    CS[customSources · 用户上传的自定义源]
    GL[generatedListing · Step 2 产出]
    COL["currentOptListing · 侧边栏面板 · baselineScore + score"]
    SD[scenarioDecisions · Alexa Follow-up 保留决策]
  end

  subgraph CompareFlow ["对比流程状态"]
    RCD[realCompareData · 真实抓取 3 ASIN 数据]
    CMP[CMP_ASINS · mock 3 ASIN 演示]
  end

  subgraph ProjectFlow ["项目视图状态"]
    ASINS[ASINS · 12 SKU 表格]
    HT[HUMAN_TODOS · 人工任务清单]
    TS[todoStates · pending/assigned/done]
    Sel[selected · 表格选中集]
  end

  BC --> AM
  RC --> RS --> AA
  AA --> COL
  COL -->|抓完后异步| Score1[LLM baseline 打分]
  GL -->|Step 3| Score2[LLM optimized 打分]
  Score1 --> COL
  Score2 --> COL
```

## 7. 部署形态

```mermaid
graph LR
  subgraph A ["模式 A · GitHub Pages"]
    GH[tonyzhang55.github.io/AIListing]
    Static[纯静态 · 内嵌 mock]
    NoBackend[无后端 · 顶栏显示离线]
  end

  subgraph B ["模式 B · 本地全栈 · 当前使用"]
    Local[localhost:3000]
    NPM[npm start · 单进程]
    ExpressLocal[Express 服务前端 + API]
    ConfigLocal[config.json 保存 SwiftChat + Claude Opus 4.6]
  end

  subgraph C ["模式 C · AWS 生产 · 未实现"]
    CF[CloudFront + S3]
    APIGW[API Gateway + Lambda]
    AC[Bedrock AgentCore + Claude Sonnet/Nova]
    DDB[DynamoDB + S3]
    EB[EventBridge + SQS]
    Cognito[Cognito]
    SPAPI[SP-API · Ads API · Alexa API · Brand Registry]
  end

  GH --> Static --> NoBackend
  Local --> NPM --> ExpressLocal --> ConfigLocal
  CF --> APIGW --> AC
  APIGW --> DDB
  APIGW --> EB
  APIGW --> SPAPI
  CF --> Cognito

  style A fill:#fef2f2,stroke:#dc2626
  style B fill:#f0f9f4,stroke:#059669
  style C fill:#fef7e0,stroke:#d97706
```

## 关键约定

- **业务数据唯一来源** · `backend/mock-data.js`（未来接入 SP-API 时替换）
- **配置数据唯一来源** · `backend/config.json`（gitignored · 通过 `providers.js` 存取）
- **LLM 分发唯一入口** · `askLLMForJSON`（自动剥离 markdown fence · 平衡括号提取）
- **意图路由降级** · LLM 失败 fallback 到 regex `detectIntentLocal`
- **前端 fallback** · 后端不可达时使用内嵌 mock（GitHub Pages 模式）
- **凭证脱敏** · 所有 config 返回都过 `maskKey` 处理
