// ===================================================================
// Provider 管理 · 大模型接入配置
// - 支持 4 个 provider：Amazon Bedrock / Ollama / DeepSeek / OpenAI
// - 配置持久化到 backend/config.json（.gitignore 已排除）
// - OpenAI/DeepSeek/Ollama 走真实 REST 调用（OpenAI 兼容协议）
// - Bedrock 结构预留，装了 @aws-sdk/client-bedrock-runtime 即可启用
// ===================================================================
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// ---- Provider 定义（前端展示 + 后端调用参考） ----
const PROVIDERS = {
  bedrock: {
    id: 'bedrock',
    name: 'Amazon Bedrock',
    endpoint: '/api/providers/bedrock',
    fields: [
      { key: 'credMode', label: '凭证方式', type: 'select', required: true, default: 'bedrockApiKey',
        options: ['bedrockApiKey', 'proxyServer', 'default', 'profile', 'accessKey'],
        optionLabels: {
          'bedrockApiKey': '🔑 Bedrock API Key（官方 · 类似 OpenAI Bearer Token · 推荐）',
          'proxyServer': '🌐 API URL + Key（自搭代理 · SwiftChat / LiteLLM / App Runner）',
          'default': '⚙ 默认凭证链（SSO / Ada / EC2 Role / 环境变量）',
          'profile': '📁 AWS Profile',
          'accessKey': '🔐 Access Key + Secret',
        }
      },
      // Bedrock API Key（官方）
      { key: 'bedrockApiKey', label: 'Bedrock API Key', type: 'password', required: true,
        placeholder: 'ABSK... · 在 Bedrock console 的 API keys 页面生成',
        dependsOn: { credMode: 'bedrockApiKey' } },
      // 代理服务器
      { key: 'proxyBaseUrl', label: 'API URL', type: 'text', required: true,
        placeholder: 'https://xxx.us-west-2.awsapprunner.com',
        dependsOn: { credMode: 'proxyServer' } },
      { key: 'proxyApiKey', label: 'API Key', type: 'password', required: true,
        dependsOn: { credMode: 'proxyServer' } },
      // AWS Profile
      { key: 'awsProfile', label: 'AWS Profile 名', type: 'text', default: 'default', placeholder: 'default', dependsOn: { credMode: 'profile' } },
      // Access Key
      { key: 'accessKeyId', label: 'AWS Access Key ID', type: 'password', required: true, dependsOn: { credMode: 'accessKey' } },
      { key: 'secretAccessKey', label: 'AWS Secret Access Key', type: 'password', required: true, dependsOn: { credMode: 'accessKey' } },
      { key: 'sessionToken', label: 'Session Token（临时凭证时填）', type: 'password', dependsOn: { credMode: 'accessKey' } },
      // 通用
      { key: 'region', label: 'Region', type: 'select', required: true, default: 'us-west-2',
        options: ['us-east-1', 'us-west-2', 'us-east-2', 'eu-west-1', 'eu-central-1', 'ap-northeast-1', 'ap-southeast-1', 'ap-southeast-2'] },
    ],
    models: [
      // Cross-Region Inference Profile · us. 前缀 · 适用 us-east-1 / us-west-2 / us-east-2
      { id: 'us.anthropic.claude-opus-4-5-20250929-v1:0',    name: 'Claude Opus 4.5',    kind: 'chat', cris: true },
      { id: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',  name: 'Claude Sonnet 4.5',  kind: 'chat', cris: true },
      { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',   name: 'Claude Haiku 4.5',   kind: 'chat', cris: true },
      { id: 'us.anthropic.claude-sonnet-4-20250514-v1:0',    name: 'Claude Sonnet 4',    kind: 'chat', cris: true },
      { id: 'us.anthropic.claude-opus-4-20250514-v1:0',      name: 'Claude Opus 4',      kind: 'chat', cris: true },
      { id: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',  name: 'Claude 3.7 Sonnet',  kind: 'chat', cris: true },
      { id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',     name: 'Claude 3.5 Sonnet v2', kind: 'chat' },
      { id: 'anthropic.claude-3-5-haiku-20241022-v1:0',      name: 'Claude 3.5 Haiku',   kind: 'chat' },
      { id: 'us.amazon.nova-premier-v1:0',                   name: 'Amazon Nova Premier', kind: 'chat', cris: true },
      { id: 'us.amazon.nova-pro-v1:0',                       name: 'Amazon Nova Pro',    kind: 'chat', cris: true },
      { id: 'us.amazon.nova-lite-v1:0',                      name: 'Amazon Nova Lite',   kind: 'chat', cris: true },
      { id: 'us.amazon.nova-micro-v1:0',                     name: 'Amazon Nova Micro',  kind: 'chat', cris: true },
      { id: 'us.meta.llama3-3-70b-instruct-v1:0',            name: 'Llama 3.3 70B',      kind: 'chat', cris: true },
      { id: 'us.deepseek.r1-v1:0',                           name: 'DeepSeek R1',        kind: 'chat', cris: true },
    ],
  },
  openai: {
    id: 'openai', name: 'OpenAI',
    fields: [
      { key: 'apiKey',  label: 'API Key',  type: 'password', required: true, placeholder: 'sk-...' },
      { key: 'baseUrl', label: 'Base URL', type: 'text',     required: false, default: 'https://api.openai.com/v1' },
    ],
    models: [
      { id: 'gpt-4o',       name: 'GPT-4o',       kind: 'chat' },
      { id: 'gpt-4o-mini',  name: 'GPT-4o Mini',  kind: 'chat' },
      { id: 'gpt-4-turbo',  name: 'GPT-4 Turbo',  kind: 'chat' },
      { id: 'o1-preview',   name: 'o1 Preview',   kind: 'chat' },
      { id: 'o1-mini',      name: 'o1 Mini',      kind: 'chat' },
    ],
  },
  deepseek: {
    id: 'deepseek', name: 'DeepSeek',
    fields: [
      { key: 'apiKey',  label: 'API Key',  type: 'password', required: true, placeholder: 'sk-...' },
      { key: 'baseUrl', label: 'Base URL', type: 'text',     required: false, default: 'https://api.deepseek.com/v1' },
    ],
    models: [
      { id: 'deepseek-chat',      name: 'DeepSeek Chat',      kind: 'chat' },
      { id: 'deepseek-reasoner',  name: 'DeepSeek Reasoner',  kind: 'chat' },
    ],
  },
  ollama: {
    id: 'ollama', name: 'Ollama · 本地',
    fields: [
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, default: 'http://localhost:11434' },
    ],
    models: [
      { id: 'llama3.2',        name: 'Llama 3.2',        kind: 'chat' },
      { id: 'qwen2.5',         name: 'Qwen 2.5',         kind: 'chat' },
      { id: 'deepseek-r1',     name: 'DeepSeek R1',      kind: 'chat' },
      { id: 'mistral',         name: 'Mistral',          kind: 'chat' },
    ],
  },
};

// ---- 配置存储 ----
const CONFIG_PATH = path.join(__dirname, 'config.json');
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch { return { providers: {}, activeModel: null }; }
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
// 脱敏：sk-abc...xyz
function maskKey(k) {
  if (!k) return '';
  if (k.length <= 8) return '****';
  return k.slice(0, 4) + '...' + k.slice(-4);
}
function maskProviderConfig(pid, cfg) {
  const def = PROVIDERS[pid];
  if (!def || !cfg) return null;
  const out = {};
  def.fields.forEach(f => {
    if (cfg[f.key] === undefined) return;
    out[f.key] = f.type === 'password' ? maskKey(cfg[f.key]) : cfg[f.key];
  });
  return out;
}
// 解析 Bedrock 凭证 · 支持三种模式
// 返回 SDK 可接受的 credentials 值（对象或 provider function）
async function resolveBedrockCredentials(pc){
  const mode = pc.credMode || 'default';
  if (mode === 'accessKey') {
    if (!pc.accessKeyId || !pc.secretAccessKey) throw new Error('Access Key 模式下 accessKeyId / secretAccessKey 必填');
    return {
      accessKeyId: pc.accessKeyId,
      secretAccessKey: pc.secretAccessKey,
      ...(pc.sessionToken ? { sessionToken: pc.sessionToken } : {}),
    };
  }
  if (mode === 'profile') {
    const { fromIni } = require('@aws-sdk/credential-providers');
    return fromIni({ profile: pc.awsProfile || 'default' });
  }
  // default: 走 Node 默认凭证链 · 依次查环境变量 / SSO / EC2 role
  const { fromNodeProviderChain } = require('@aws-sdk/credential-providers');
  return fromNodeProviderChain();
}

module.exports.PROVIDERS = PROVIDERS;
module.exports.loadConfig = loadConfig;
module.exports.saveConfig = saveConfig;
module.exports.resolveBedrockCredentials = resolveBedrockCredentials;


// ===================================================================
// 路由
// ===================================================================

// 列出所有支持的 provider 定义（含 fields 和 models）
router.get('/', (req, res) => {
  const list = Object.values(PROVIDERS).map(p => ({
    id: p.id, name: p.name, fields: p.fields, models: p.models,
  }));
  res.json({ providers: list });
});

// 获取当前配置状态（key 脱敏 · 用于前端显示"哪些 provider 已配置"）
router.get('/config', (req, res) => {
  const cfg = loadConfig();
  const status = {};
  Object.keys(PROVIDERS).forEach(pid => {
    status[pid] = {
      configured: !!cfg.providers?.[pid],
      config: cfg.providers?.[pid] ? maskProviderConfig(pid, cfg.providers[pid]) : null,
    };
  });
  res.json({ status, activeModel: cfg.activeModel || null });
});

// 保存某个 provider 的配置
router.post('/:id/config', (req, res) => {
  const pid = req.params.id;
  const def = PROVIDERS[pid];
  if (!def) return res.status(404).json({ error: 'Unknown provider' });
  const cfg = loadConfig();
  cfg.providers = cfg.providers || {};
  const incoming = req.body || {};
  const existing = cfg.providers[pid] || {};
  // 保留未在 body 中出现的字段（例如用户只更新了 apiKey，保留 baseUrl）
  const merged = { ...existing };
  def.fields.forEach(f => {
    if (incoming[f.key] !== undefined && incoming[f.key] !== '') merged[f.key] = incoming[f.key];
  });
  cfg.providers[pid] = merged;
  saveConfig(cfg);
  res.json({ ok: true, provider: pid, config: maskProviderConfig(pid, merged) });
});

// 清除某个 provider 的配置
router.delete('/:id/config', (req, res) => {
  const pid = req.params.id;
  const cfg = loadConfig();
  if (cfg.providers?.[pid]) {
    delete cfg.providers[pid];
    // 如果 activeModel 属于被删的 provider，一并清掉
    if (cfg.activeModel?.provider === pid) cfg.activeModel = null;
    saveConfig(cfg);
  }
  res.json({ ok: true });
});

// 测试连接 · 真实调用对应 provider 的一个轻量 API
router.post('/:id/test', async (req, res) => {
  const pid = req.params.id;
  const def = PROVIDERS[pid];
  if (!def) return res.status(404).json({ error: 'Unknown provider' });
  const cfg = loadConfig();
  const pc = cfg.providers?.[pid];
  if (!pc) return res.status(400).json({ ok: false, error: '尚未配置该 provider' });

  try {
    let result;
    if (pid === 'openai' || pid === 'deepseek') {
      const baseUrl = pc.baseUrl || def.fields.find(f => f.key === 'baseUrl')?.default;
      const r = await fetch(baseUrl.replace(/\/$/, '') + '/models', {
        headers: { 'Authorization': 'Bearer ' + pc.apiKey },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      const data = await r.json();
      result = { modelCount: (data.data || []).length, sample: (data.data || []).slice(0, 3).map(m => m.id) };
    } else if (pid === 'ollama') {
      const baseUrl = pc.baseUrl || 'http://localhost:11434';
      const r = await fetch(baseUrl.replace(/\/$/, '') + '/api/tags');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      result = { modelCount: (data.models || []).length, sample: (data.models || []).slice(0, 3).map(m => m.name) };
    } else if (pid === 'bedrock') {
      if (pc.credMode === 'bedrockApiKey') {
        // 调 Nova Micro 一次 · 便宜且验证端到端
        const region = pc.region || 'us-west-2';
        const testModel = 'us.amazon.nova-micro-v1:0';
        const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(testModel)}/converse`;
        const r2 = await fetch(url, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + pc.bedrockApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: [{ text: 'ping' }] }], inferenceConfig: { maxTokens: 5 } }),
        });
        if (!r2.ok) throw new Error(`HTTP ${r2.status} · ${(await r2.text()).slice(0, 240)}`);
        const data = await r2.json();
        result = {
          note: `Bedrock API Key 验证通过 · Region ${region} · 测试模型 Nova Micro · 返回 tokens: ${data.usage?.outputTokens || '?'}`,
          region,
        };
      } else if (pc.credMode === 'proxyServer') {
        // SwiftChat Server（aws-samples）· POST /api/models 拿模型列表
        const base = (pc.proxyBaseUrl || '').replace(/\/$/, '');
        const r2 = await fetch(base + '/api/models', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + pc.proxyApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ region: pc.region || 'us-west-2' }),
        });
        if (!r2.ok) throw new Error(`HTTP ${r2.status} @ ${base}/api/models · ${(await r2.text()).slice(0, 200)}`);
        const data = await r2.json();
        // SwiftChat 返回结构：{ textModel: [...], imageModel: [...] }
        const arr = Array.isArray(data) ? data : (data.textModel || data.chatModel || data.models || data.data || []);
        const imageArr = Array.isArray(data) ? [] : (data.imageModel || []);
        result = {
          modelCount: arr.length,
          sample: arr.slice(0, 5).map(m => m.modelName || m.name || m.modelId || m.id || JSON.stringify(m).slice(0, 40)),
          note: `SwiftChat Server 响应正常 · ${base} · Region ${pc.region}${imageArr.length ? ' · 另含 '+imageArr.length+' 个图像模型' : ''}`,
        };
      } else {
        // SDK 分支（default / profile / accessKey）
        const { BedrockClient, ListFoundationModelsCommand } = require('@aws-sdk/client-bedrock');
        const credentials = await resolveBedrockCredentials(pc);
        const client = new BedrockClient({ region: pc.region || 'us-west-2', credentials });
        const cmd = new ListFoundationModelsCommand({ byOutputModality: 'TEXT' });
        const r2 = await client.send(cmd);
        const models = r2.modelSummaries || [];
        const anthropic = models.filter(m => m.modelId.startsWith('anthropic.')).length;
        const amazon = models.filter(m => m.modelId.startsWith('amazon.')).length;
        result = {
          modelCount: models.length,
          breakdown: { anthropic, amazon, other: models.length - anthropic - amazon },
          region: pc.region,
          note: `凭证方式：${pc.credMode || 'default'} · 已列出 ${models.length} 个 foundation models`,
        };
      }
    }
    res.json({ ok: true, provider: pid, tested: new Date().toISOString(), result });
  } catch (e) {
    // 更友好的错误信息 · AWS 员工常见坑
    let hint = '';
    const msg = e.message || String(e);
    if (/security token.*(invalid|expired)/i.test(msg))
      hint = '💡 临时凭证已过期。AWS 员工用 Ada：`ada credentials update --account=... --role=... --profile=...` · SSO：`aws sso login --profile=...`';
    else if (/Could not load credentials/i.test(msg))
      hint = '💡 凭证链读不到。检查：`~/.aws/credentials` 有对应 profile；或换到「AWS Profile」模式指定 profile 名；或先运行 `aws configure` / `ada credentials update`';
    else if (/not authorized|AccessDenied/i.test(msg))
      hint = '💡 IAM 权限不足。测试连接需要 `bedrock:ListFoundationModels`，调用模型需要 `bedrock:InvokeModel`。检查 IAM policy 或 role';
    else if (/could not be found|ExpiredToken/i.test(msg))
      hint = '💡 Session Token 过期。用临时凭证时刷新 STS 会话';
    else if (/timeout|ETIMEDOUT|ENOTFOUND/i.test(msg))
      hint = '💡 网络问题。检查 Region 是否正确、VPN 是否影响 AWS API 访问';
    res.status(400).json({ ok: false, provider: pid, error: msg, hint });
  }
});

// 获取某个 provider 实际可用的模型列表 · 联通后调用真实端点，未配置就返回硬编码 fallback
router.get('/:id/models', async (req, res) => {
  const pid = req.params.id;
  const def = PROVIDERS[pid];
  if (!def) return res.status(404).json({ error: 'Unknown provider' });
  const cfg = loadConfig();
  const pc = cfg.providers?.[pid];
  if (!pc) return res.json({ models: def.models, source: 'fallback-notconfigured' });
  try {
    // Bedrock proxyServer（SwiftChat）· 走 POST /api/models
    if (pid === 'bedrock' && pc.credMode === 'proxyServer') {
      const base = (pc.proxyBaseUrl || '').replace(/\/$/, '');
      const r = await fetch(base + '/api/models', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + pc.proxyApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: pc.region || 'us-west-2' }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const arr = data.textModel || data.chatModel || data.models || data.data || [];
      const models = arr.map(m => ({
        id: m.modelId || m.id,
        name: m.modelName || m.name || m.modelId,
        kind: 'chat',
        cris: /^(us|eu|apac)\./.test(m.modelId || ''),
      })).filter(m => m.id);
      return res.json({ models, source: 'swiftchat-live', count: models.length });
    }
    // Bedrock SDK 模式 · 走 ListFoundationModels
    if (pid === 'bedrock' && (pc.credMode === 'default' || pc.credMode === 'profile' || pc.credMode === 'accessKey')) {
      const { BedrockClient, ListFoundationModelsCommand } = require('@aws-sdk/client-bedrock');
      const credentials = await resolveBedrockCredentials(pc);
      const client = new BedrockClient({ region: pc.region || 'us-west-2', credentials });
      const cmd = new ListFoundationModelsCommand({ byOutputModality: 'TEXT' });
      const r = await client.send(cmd);
      const models = (r.modelSummaries || [])
        .filter(m => (m.inferenceTypesSupported || []).includes('ON_DEMAND') || (m.inferenceTypesSupported || []).includes('INFERENCE_PROFILE'))
        .map(m => ({
          id: m.modelId,
          name: m.modelName || m.modelId,
          kind: 'chat',
          cris: false,
        }));
      return res.json({ models, source: 'bedrock-sdk', count: models.length });
    }
    // OpenAI/DeepSeek/Ollama · GET /models（OpenAI 兼容）
    if (pid === 'openai' || pid === 'deepseek') {
      const baseUrl = pc.baseUrl || def.fields.find(f => f.key === 'baseUrl')?.default;
      const r = await fetch(baseUrl.replace(/\/$/, '') + '/models', { headers: { 'Authorization': 'Bearer ' + pc.apiKey } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const models = (data.data || []).map(m => ({ id: m.id, name: m.id, kind: 'chat', cris: false }));
      return res.json({ models, source: pid + '-live', count: models.length });
    }
    if (pid === 'ollama') {
      const baseUrl = pc.baseUrl || 'http://localhost:11434';
      const r = await fetch(baseUrl.replace(/\/$/, '') + '/api/tags');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const models = (data.models || []).map(m => ({ id: m.name, name: m.name, kind: 'chat', cris: false }));
      return res.json({ models, source: 'ollama-live', count: models.length });
    }
    // 其他（如 bedrockApiKey · 官方 API Key 模式）用硬编码
    res.json({ models: def.models, source: 'fallback-hardcoded' });
  } catch (e) {
    res.json({ models: def.models, source: 'fallback-error', error: e.message, count: def.models.length });
  }
});

// 设置当前活跃模型（前端选择模型时调用）· 接受任意 modelId（真实列表可能比硬编码多）
router.post('/active-model', (req, res) => {
  const { provider, modelId, name } = req.body || {};
  const def = PROVIDERS[provider];
  if (!def) return res.status(400).json({ error: 'Unknown provider' });
  if (!modelId) return res.status(400).json({ error: 'modelId required' });
  const cfg = loadConfig();
  if (!cfg.providers?.[provider]) return res.status(400).json({ error: '该 provider 尚未配置 API Key' });
  // 优先用传入 name；否则从硬编码里查；再否则用 modelId 兜底
  const resolvedName = name || def.models.find(m => m.id === modelId)?.name || modelId;
  cfg.activeModel = { provider, modelId, name: resolvedName };
  saveConfig(cfg);
  res.json({ ok: true, activeModel: cfg.activeModel });
});

module.exports.router = router;
