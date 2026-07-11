// ===================================================================
// LLM 通用调用 · 按 activeModel 分发到对应 provider
// - 复用 chat.js 里的所有分发逻辑
// - 提供 askLLM (返回纯文本) 和 askLLMForJSON (返回解析后的对象)
// - 供 ai-routes 里的 intent / generate / score / compare 等业务复用
// ===================================================================
const { PROVIDERS, loadConfig, resolveBedrockCredentials } = require('./providers');

// 解析 SwiftChat 的 Bedrock ConverseStream NDJSON · 拼接 delta.text
function parseSwiftChatNDJSON(raw) {
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));
  // 如果只有 1 行 · 可能是错误 JSON 或 non-streaming
  if (lines.length === 1) {
    try {
      const d = JSON.parse(lines[0]);
      return d.output?.message?.content?.[0]?.text || d.content?.[0]?.text || d.reply || d.text || '';
    } catch(e) { throw new Error(`SwiftChat 单行 JSON 解析失败：${lines[0].slice(0,200)}`); }
  }
  // NDJSON streaming · 拼接所有 contentBlockDelta.delta.text
  let text = '';
  let errMsg = null;
  for (const line of lines) {
    try {
      const evt = JSON.parse(line);
      if (evt.contentBlockDelta?.delta?.text) text += evt.contentBlockDelta.delta.text;
      // 也支持 delta.reasoningContent（thinking 模型）· 只取 text
      // 或错误事件
      if (evt.internalServerException || evt.modelStreamErrorException || evt.validationException || evt.throttlingException) {
        errMsg = evt.internalServerException?.message || evt.modelStreamErrorException?.message || evt.validationException?.message || evt.throttlingException?.message;
      }
    } catch(e){ /* skip malformed lines */ }
  }
  if (errMsg) throw new Error(`SwiftChat stream error: ${errMsg}`);
  if (!text) throw new Error(`SwiftChat stream 返回空文本 · 首行 preview: ${lines[0].slice(0,200)}`);
  return text;
}

async function askLLM({ system, user, temperature = 0.3, maxTokens = 1024 }) {
  const cfg = loadConfig();
  const activeModel = cfg.activeModel;
  if (!activeModel) throw new Error('未选择模型 · 请到 ⚙ 配置');
  const { provider, modelId } = activeModel;
  const pc = cfg.providers?.[provider];
  if (!pc) throw new Error(`Provider ${provider} 未配置`);

  const bedrockMessages = [{ role: 'user', content: [{ text: user }] }];
  const bedrockSystem = system ? [{ text: system }] : undefined;

  // Bedrock · SwiftChat Server 代理 · 返回 Bedrock ConverseStream NDJSON
  if (provider === 'bedrock' && pc.credMode === 'proxyServer') {
    const base = pc.proxyBaseUrl.replace(/\/$/, '');
    const body = { modelId, region: pc.region, messages: bedrockMessages };
    if (bedrockSystem) body.system = bedrockSystem;
    const r = await fetch(base + '/api/converse/v3', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + pc.proxyApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const raw = await r.text();
    if (!r.ok) throw new Error(`SwiftChat ${r.status}: ${raw.slice(0, 300)}`);
    return parseSwiftChatNDJSON(raw);
  }
  // Bedrock · 官方 API Key
  if (provider === 'bedrock' && pc.credMode === 'bedrockApiKey') {
    const region = pc.region || 'us-west-2';
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`;
    const body = { messages: bedrockMessages, inferenceConfig: { maxTokens, temperature, topP: 0.9 } };
    if (bedrockSystem) body.system = bedrockSystem;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + pc.bedrockApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Bedrock ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const data = await r.json();
    return data.output?.message?.content?.[0]?.text || '';
  }
  // Bedrock · SDK 分支（default / profile / accessKey）
  if (provider === 'bedrock') {
    const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
    const credentials = await resolveBedrockCredentials(pc);
    const client = new BedrockRuntimeClient({ region: pc.region || 'us-west-2', credentials });
    const args = { modelId, messages: bedrockMessages, inferenceConfig: { maxTokens, temperature, topP: 0.9 } };
    if (bedrockSystem) args.system = bedrockSystem;
    const response = await client.send(new ConverseCommand(args));
    return response.output.message.content[0].text;
  }
  // OpenAI 兼容（OpenAI / DeepSeek）
  if (provider === 'openai' || provider === 'deepseek') {
    const baseUrl = pc.baseUrl || PROVIDERS[provider].fields.find(f => f.key === 'baseUrl')?.default;
    const msgs = [];
    if (system) msgs.push({ role: 'system', content: system });
    msgs.push({ role: 'user', content: user });
    const r = await fetch(baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + pc.apiKey },
      body: JSON.stringify({ model: modelId, messages: msgs, temperature, max_tokens: maxTokens }),
    });
    if (!r.ok) throw new Error(`${provider} ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const data = await r.json();
    return data.choices?.[0]?.message?.content || '';
  }
  // Ollama · OpenAI 兼容协议
  if (provider === 'ollama') {
    const baseUrl = (pc.baseUrl || 'http://localhost:11434').replace(/\/$/, '') + '/v1';
    const msgs = [];
    if (system) msgs.push({ role: 'system', content: system });
    msgs.push({ role: 'user', content: user });
    const r = await fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, messages: msgs, temperature, max_tokens: maxTokens }),
    });
    if (!r.ok) throw new Error(`Ollama ${r.status}`);
    const data = await r.json();
    return data.choices?.[0]?.message?.content || '';
  }
  throw new Error(`Unknown provider: ${provider}`);
}

// 提取第一个平衡的 JSON 对象（考虑字符串内的花括号）
function extractFirstJSON(s) {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  return null;
}

// 严格 JSON 输出 · 自动剥 markdown fence · 提取第一个平衡 JSON
async function askLLMForJSON({ system, user, maxTokens = 1024 }) {
  const augSystem = (system || '') + `\n\n严格要求：只返回一个合法的 JSON 对象 · 不要 markdown 代码块（\`\`\`json）· 不要任何解释文字前后附加 · 不要返回多个 JSON。`;
  const raw = await askLLM({ system: augSystem, user, temperature: 0.1, maxTokens });
  let s = raw.trim();
  // 剥离 ```json ... ```
  const cb = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (cb) s = cb[1].trim();
  // 提取第一个平衡的 JSON 对象
  const jsonBlock = extractFirstJSON(s);
  if (!jsonBlock) throw new Error(`未找到 JSON 对象 · raw: ${raw.slice(0, 200)}`);
  try { return { data: JSON.parse(jsonBlock), raw }; }
  catch (e) { throw new Error(`JSON 解析失败: ${e.message} · block: ${jsonBlock.slice(0, 200)}`); }
}

module.exports = { askLLM, askLLMForJSON };
