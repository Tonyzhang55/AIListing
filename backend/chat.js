// ===================================================================
// Chat API · 按 activeModel 分发到对应 provider
// - OpenAI / DeepSeek / Ollama：走 OpenAI 兼容协议（fetch）
// - Bedrock：结构预留，装 @aws-sdk/client-bedrock-runtime 即可启用
// ===================================================================
const express = require('express');
const router = express.Router();
const { PROVIDERS, loadConfig, resolveBedrockCredentials } = require('./providers');

async function callOpenAICompatible({ baseUrl, apiKey, modelId, messages }) {
  const r = await fetch(baseUrl.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'Authorization': 'Bearer ' + apiKey } : {}),
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`${r.status} ${r.statusText} · ${errText.slice(0, 200)}`);
  }
  const data = await r.json();
  return data.choices?.[0]?.message?.content || '(空响应)';
}

// Bedrock 真实调用 · 5 种凭证方式全支持
async function callBedrock({ pc, modelId, messages }) {
  // 1. Bedrock API Key（官方 · Bearer token 走 REST endpoint）
  if (pc.credMode === 'bedrockApiKey') {
    const region = pc.region || 'us-west-2';
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + pc.bedrockApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role, content: [{ text: m.content }] })),
        inferenceConfig: { maxTokens: 1024, temperature: 0.7, topP: 0.9 },
      }),
    });
    if (!r.ok) throw new Error(`Bedrock ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const data = await r.json();
    return data.output.message.content[0].text;
  }
  // 2. SwiftChat Server 代理（aws-samples · Bedrock ConverseStream V3 · NDJSON 流式）
  if (pc.credMode === 'proxyServer') {
    const base = (pc.proxyBaseUrl || '').replace(/\/$/, '');
    const url = base + '/api/converse/v3';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + pc.proxyApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId,
        region: pc.region || 'us-west-2',
        messages: messages.map(m => ({ role: m.role, content: [{ text: m.content }] })),
      }),
    });
    const raw = await r.text();
    console.log(`  [SwiftChat] POST ${url} → ${r.status} · length: ${raw.length}`);
    if (!r.ok) throw new Error(`SwiftChat HTTP ${r.status}: ${raw.slice(0, 300)}`);
    // 早期错误检测（stream 前就报错）
    if (raw.trim().startsWith('Error')) throw new Error(`SwiftChat 错误：${raw.slice(0, 300)}`);
    // 按行解析 NDJSON · 收集 contentBlockDelta.delta.text 拼成完整 reply
    let reply = '';
    let usage = null;
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        const chunk = JSON.parse(t);
        // Bedrock ConverseStream 事件类型
        if (chunk.contentBlockDelta?.delta?.text) reply += chunk.contentBlockDelta.delta.text;
        else if (chunk.contentBlockDelta?.delta?.reasoningContent?.text) { /* thinking · 暂不显示 */ }
        else if (chunk.metadata?.usage) usage = chunk.metadata.usage;
        // 兼容非流式返回
        else if (chunk.output?.message?.content?.[0]?.text) reply = chunk.output.message.content[0].text;
      } catch { /* 跳过无法解析的行 */ }
    }
    if (!reply) throw new Error(`SwiftChat 返回内容无法解析 · 前 300 字符：${raw.slice(0, 300)}`);
    console.log(`  [SwiftChat] parsed reply length: ${reply.length}${usage ? ` · tokens: in=${usage.inputTokens} out=${usage.outputTokens}` : ''}`);
    return reply;
  }
  // 3-5. SDK 分支（default / profile / accessKey）· 用 Converse API
  const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
  const credentials = await resolveBedrockCredentials(pc);
  const client = new BedrockRuntimeClient({
    region: pc.region || 'us-west-2',
    credentials,
  });
  const cmd = new ConverseCommand({
    modelId,
    messages: messages.map(m => ({ role: m.role, content: [{ text: m.content }] })),
    inferenceConfig: { maxTokens: 1024, temperature: 0.7, topP: 0.9 },
  });
  const response = await client.send(cmd);
  return response.output.message.content[0].text;
}

router.post('/', async (req, res) => {
  const { message = '', context = null, modelId: overrideModelId, provider: overrideProvider } = req.body || {};
  console.log(`  [Chat] msg="${message.slice(0,60)}" ctx=${JSON.stringify(context||null).slice(0,80)}`);
  const cfg = loadConfig();

  // 允许 body 里覆盖当前 activeModel，否则用配置里的
  let provider = overrideProvider || cfg.activeModel?.provider;
  let modelId = overrideModelId || cfg.activeModel?.modelId;

  // 没配置：返回 mock 提示
  if (!provider || !modelId) {
    return res.json({
      reply: `[Mock · 未选择模型] "${message}"\n\n请点击右上角 ⚙ 配置 API Key 并选择模型后再对话。`,
      mock: true, model: null,
    });
  }

  const pc = cfg.providers?.[provider];
  if (!pc) {
    return res.json({
      reply: `[Mock · Provider ${provider} 未配置] "${message}"`,
      mock: true, model: { provider, modelId },
    });
  }

  const messages = [{ role: 'user', content: message }];
  const def = PROVIDERS[provider];
  const modelName = def?.models.find(m => m.id === modelId)?.name || modelId;

  try {
    let reply;
    if (provider === 'openai' || provider === 'deepseek') {
      const baseUrl = pc.baseUrl || def.fields.find(f => f.key === 'baseUrl')?.default;
      reply = await callOpenAICompatible({ baseUrl, apiKey: pc.apiKey, modelId, messages });
    } else if (provider === 'ollama') {
      // Ollama 也支持 OpenAI 兼容格式（v1/chat/completions），无需 apiKey
      const baseUrl = (pc.baseUrl || 'http://localhost:11434') + '/v1';
      reply = await callOpenAICompatible({ baseUrl, apiKey: null, modelId, messages });
    } else if (provider === 'bedrock') {
      reply = await callBedrock({ pc, modelId, messages });
    } else {
      return res.status(400).json({ error: 'Unsupported provider: ' + provider });
    }
    res.json({ reply, model: { provider, modelId, name: modelName } });
  } catch (e) {
    console.error(`  [Chat] failed: ${e.message}`);
    console.error(`  [Chat] stack: ${(e.stack||'').split('\n').slice(0,3).join(' | ')}`);
    res.status(500).json({
      error: 'Provider call failed',
      detail: e.message,
      model: { provider, modelId, name: modelName },
    });
  }
});

module.exports = router;
