// ===================================================================
// AI 业务路由 · 用 LLM 做推理（意图路由 · 内容生成 · 评分 · 对比 · 合规）
// ===================================================================
const express = require('express');
const router = express.Router();
const { askLLMForJSON, askLLM } = require('./llm');

// -------- 意图路由 --------
router.post('/intent', async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });
  const system = `你是 Amazon 卖家运营平台的意图识别器。判断用户消息属于以下哪一类，并返回 JSON。

可选意图：
- listingOpt: 优化 Listing 文案 / 标题 / Highlights / Bullets（含"帮我优化 / 改标题 / 重写 listing"等）
- compare: 对比 ≥2 个 ASIN 或产品
- migration: 批量迁移旧标题到 Modular Title 格式（合规操作）
- audit: 给 Listing 打分 / 诊断健康度
- compliance: 检查禁忌词 / 合规风险
- chat: 普通问答 / 闲聊 / 上述以外

返回 JSON:
{
  "intent": "listingOpt",
  "confidence": 0.9,
  "reason": "用户明确提到要重写 Item Name",
  "extractedAsins": ["B08GK4VPMR"]
}
extractedAsins 是消息里出现的 ASIN 码（B0 开头 10 位），没有就返回 []。`;
  try {
    const t0 = Date.now();
    const { data } = await askLLMForJSON({ system, user: message, maxTokens: 200 });
    console.log(`  [Intent] "${message.slice(0,40)}" → ${data.intent} (${data.confidence}) · ${Date.now()-t0}ms`);
    res.json({ ok: true, ...data });
  } catch (e) {
    console.error('  [Intent] failed:', e.message);
    res.json({ ok: false, intent: 'chat', reason: 'LLM 失败 · 降级为通用问答', error: e.message });
  }
});

// -------- 内容生成 · Modular Title / Bullets / Q&A / A+ / Backend --------
router.post('/generate-listing', async (req, res) => {
  const { asin, model, cat, market, goal, scenarios, competitorInsights } = req.body || {};
  const system = `你是 Amazon Listing 内容生成专家，遵循 2026 年 Modular Titles 政策：
- Item Name ≤ 75 chars · 品牌 + 核心属性
- Item Highlights ≤ 125 chars · 用 · 或 , 分隔的关键卖点与场景
- Bullets 5 条 · 每条 ≤ 200 chars · 场景化、AI-Ready
- Q&A 10 条 · 覆盖用户 Follow-up 场景
- Backend Keywords · ≤ 249 bytes · 长尾搜索词
- A+ Content 骨架 · 描述模块布局

返回严格 JSON:
{
  "itemName": "...",
  "highlights": "...",
  "bullets": ["...","...","...","...","..."],
  "qa": [{"q":"...","a":"..."}, ... 共 10 条],
  "backendKeywords": "...",
  "aplusOutline": "..."
}`;
  const user = `ASIN: ${asin || '(未提供)'}
型号: ${model || '(未提供)'}
品类: ${cat || '(未提供)'}
目标站点: ${market || 'US'}
核心业务目标: ${goal || '(未提供)'}

用户高频场景（Alexa Follow-up）:
${(scenarios || []).map(s => '- ' + s).join('\n') || '(无)'}

${competitorInsights ? '竞品差异化输入：\n' + competitorInsights : ''}

请生成完整、场景化、AI-Ready 的 Listing 内容。字符数严格遵守限制。`;
  try {
    const t0 = Date.now();
    const { data } = await askLLMForJSON({ system, user, maxTokens: 2500 });
    console.log(`  [Generate] ${asin || 'unknown'} · Name ${data.itemName?.length||0}chars · ${(data.bullets||[]).length} bullets · ${(data.qa||[]).length} Q&A · ${Date.now()-t0}ms`);
    res.json({ ok: true, ...data });
  } catch (e) {
    console.error('  [Generate] failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// -------- AI 评分 · 8 维度加权 --------
router.post('/score-listing', async (req, res) => {
  const { listing } = req.body || {};
  if (!listing) return res.status(400).json({ error: 'listing required' });
  const system = `你是 Amazon Listing AI-Ready 评估专家。给定 Listing，按 8 维度打分：
- a9: A9 关键词覆盖+语义相关性 (max 20)
- scenario: 场景化/人设化表达 (max 15)
- ai: AI 语义可读性 (max 15)
- geo: GEO 生成式引擎优化 · 结构化对 AI 代理可读性 (max 15)
- visual: 视觉内容质量与丰富度 (max 12)
- aplus: A+ 品牌内容质量 (max 10)
- tqs: TQS+KBYB 合规 (max 8)
- social: 评论与社交信号整合 (max 5)

评分标准：
- A 级 (总分 ≥85): 各维度均衡强
- B 级 (65-84): 单项或多项短板
- C 级 (<65): 需回炉

同时列出人工跟进事项（AI 无法自动完成，需设计/内容/品牌运营做）· 3-5 项。

严格 JSON 返回:
{
  "dims": {"a9": 18, "scenario": 13, "ai": 13, "geo": 13, "visual": 7, "aplus": 8, "tqs": 6, "social": 4},
  "total": 82,
  "grade": "A",
  "why": "简短说明为什么给这个等级",
  "strengths": ["文本部分场景覆盖强","..."],
  "humanTodos": [
    {"title":"主图缺场景","dim":"visual 7/12","issue":"主图为白底产品照","advice":"拍 lifestyle 图","impact":"视觉+3 · CVR +8%","owner":"设计团队","eta":"3 个工作日","cost":null}
  ]
}
total 必须等于 dims 各项之和。`;
  const user = `Item Name (${(listing.itemName||'').length}/75): ${listing.itemName}
Highlights (${(listing.highlights||'').length}/125): ${listing.highlights}
Bullets (${(listing.bullets||[]).length} 条):
${(listing.bullets||[]).map((b,i) => `${i+1}. ${b}`).join('\n')}
Q&A 数量: ${(listing.qa||[]).length}
Backend Keywords: ${(listing.backendKeywords||'').length} bytes
A+ 骨架: ${listing.aplusOutline || '(未提供)'}

请评分。`;
  try {
    const t0 = Date.now();
    const { data } = await askLLMForJSON({ system, user, maxTokens: 1800 });
    console.log(`  [Score] total=${data.total} grade=${data.grade} · ${(data.humanTodos||[]).length} human todos · ${Date.now()-t0}ms`);
    res.json({ ok: true, ...data });
  } catch (e) {
    console.error('  [Score] failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// -------- 多 ASIN 对比 --------
router.post('/compare-asins', async (req, res) => {
  const { asins } = req.body || {};
  if (!Array.isArray(asins) || asins.length < 2) return res.status(400).json({ error: 'asins array (≥2) required' });
  const system = `你是 Amazon 竞品分析专家。对比多个 ASIN，生成关键洞察 + 优化建议。
返回 JSON:
{
  "insights": [
    {"tag":"价格","body":"..."},
    {"tag":"评论量","body":"..."},
    {"tag":"差异化","body":"..."}
  ],
  "recommendations": [
    {"asin":"B08XXX","priority":"high","action":"...","reason":"..."}
  ]
}
每条 insight body 用具体数字说明。`;
  const user = `对比 ${asins.length} 个 ASIN：\n\n${asins.map((a, i) => `【${i+1}】${a.asin} · ${a.brand||'?'}
  标题: ${a.title||a.name||'?'}
  价格: $${a.price||'?'} · 评分 ★${a.stars||'?'} · ${a.reviews||'?'} reviews
  Highlights: ${(a.highlights||[]).join('; ') || '未提供'}
  AI-Ready ${a.aiScore||'?'} · Alexa ${a.alexa||'?'}%${a.own ? ' · 自家' : ' · 竞品'}`).join('\n\n')}`;
  try {
    const t0 = Date.now();
    const { data } = await askLLMForJSON({ system, user, maxTokens: 1500 });
    console.log(`  [Compare] ${asins.length} asins · ${(data.insights||[]).length} insights · ${Date.now()-t0}ms`);
    res.json({ ok: true, ...data });
  } catch (e) {
    console.error('  [Compare] failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// -------- 知识库 · 按品类和业务目标找数据源 --------
router.post('/kb-find-for-listing', async (req, res) => {
  const { asin, cat, brand, goal, title } = req.body || {};
  if (!cat) return res.status(400).json({ ok: false, error: 'cat (品类) required' });
  const { KB_FILES, DATA_SOURCE_TYPES } = require('./mock-data');

  // 品类匹配 · 双向 substring · 大小写不敏感
  const catLower = String(cat).toLowerCase();
  const titleLower = String(title || '').toLowerCase();
  const matches = (tag) => {
    const t = String(tag).toLowerCase();
    if (t === '*') return true;
    return catLower.includes(t) || t.includes(catLower.split(/[\s·]/)[0])
        || (titleLower && titleLower.includes(t));
  };
  const isRelevant = (f) => (f.catTags || []).some(matches);

  // 按类型分组
  const byType = {};
  KB_FILES.forEach(f => {
    if (!f.enabled) return;
    if (!isRelevant(f)) return;
    (byType[f.type] = byType[f.type] || []).push(f);
  });

  // 用 LLM 推荐必开数据源（如果 activeModel 联通 · 且给了 goal）
  let recommendations = null;
  if (goal) {
    try {
      const cfg = require('./providers').loadConfig();
      if (cfg.activeModel) {
        const { askLLMForJSON } = require('./llm');
        const typeKeys = Object.keys(DATA_SOURCE_TYPES).join(' / ');
        const { data } = await askLLMForJSON({
          system: `你根据用户业务目标推荐 Amazon Listing 优化必开的数据源类型。可选类型（typeKey）：${typeKeys}

返回 JSON:
{
  "mustHave": ["typeKey1", ...],
  "niceToHave": ["typeKey2", ...],
  "reason": "一句话说明为什么这些是必开"
}
如果目标提到"搜索排名/进入第一页" · brand_analytics / sp_ads / keyword_rank 必开
如果目标提到"差异化 / 竞品" · competitor_listing 必开
如果目标提到"评论积累 / 社交" · rufus_feedback 必开
Alexa 三路（alexa_summary/followup/product_describe）永远必开。`,
          user: `品类: ${cat}\n业务目标: ${goal}\n品牌: ${brand || '(未知)'}`,
          maxTokens: 400,
        });
        recommendations = data;
      }
    } catch (e) { console.warn('  [KB-find] LLM 推荐失败:', e.message); }
  }

  // 组装每个类型的结果
  const mustHaveSet = new Set([...(recommendations?.mustHave || []), 'alexa_summary', 'alexa_followup', 'product_describe']);
  const niceToHaveSet = new Set(recommendations?.niceToHave || []);
  const sources = [];
  for (const [typeKey, typeInfo] of Object.entries(DATA_SOURCE_TYPES)) {
    const files = byType[typeKey] || [];
    const required = typeInfo.locked || mustHaveSet.has(typeKey);
    const suggested = niceToHaveSet.has(typeKey);
    let status;
    if (files.length > 0) status = 'available';
    else if (required) status = 'missing_required';
    else if (suggested) status = 'missing_suggested';
    else status = 'not_needed';
    sources.push({
      typeKey,
      name: typeInfo.name,
      desc: typeInfo.desc,
      category: typeInfo.category,
      required,
      suggested,
      recommend: typeInfo.recommend,
      status,
      fileCount: files.length,
      files: files.map(f => ({
        id: f.id, name: f.name,
        uploadedAt: f.uploadedAt, project: f.project,
        payload: f.payload,
      })),
    });
  }

  const availableCount = sources.filter(s => s.status === 'available').length;
  const missingRequiredCount = sources.filter(s => s.status === 'missing_required').length;
  const missingSuggestedCount = sources.filter(s => s.status === 'missing_suggested').length;

  console.log(`  [KB-find] cat="${cat}" · 可用 ${availableCount} · 必需缺 ${missingRequiredCount} · 建议缺 ${missingSuggestedCount}`);
  res.json({
    ok: true, asin, cat, goal,
    availableCount, missingRequiredCount, missingSuggestedCount,
    sources,
    recommendations,
  });
});

// -------- Amazon 商品页抓取 · 自动填 ASIN 画像 --------
router.post('/asin-lookup', async (req, res) => {
  const { asin, market = 'US' } = req.body || {};
  if (!/^B0[A-Z0-9]{8}$/i.test(asin || '')) return res.status(400).json({ ok: false, error: '非法 ASIN 格式（B0 开头 10 位）' });
  const domain = { US: 'amazon.com', UK: 'amazon.co.uk', DE: 'amazon.de', JP: 'amazon.co.jp', CA: 'amazon.ca' }[market] || 'amazon.com';
  const url = `https://www.${domain}/dp/${asin}`;

  try {
    const t0 = Date.now();
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        // 强制 US 站点 · 避免被 IP 地理位置重定向到 amazon.co.jp
        'Cookie': 'i18n-prefs=USD; lc-main=en_US; sp-cdn="L5Z9:CN"',
      },
    });
    if (!r.ok) throw new Error(`Amazon 返回 HTTP ${r.status}（该 ASIN 可能不存在或不在此站点售卖）`);
    const html = await r.text();

    // HTML 实体解码 · Amazon 页面里 &#39; / &amp; / &quot; / &#34; 需要还原
    const decodeEntities = (s) => (s || '')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'); // amp 放最后避免二次解码
    // 简单 regex 抽核心字段（Amazon HTML 结构相对稳定）
    const pick = (re) => decodeEntities((html.match(re)?.[1] || '').replace(/\s+/g, ' ').trim());
    const title = pick(/<span id="productTitle"[^>]*>([\s\S]*?)<\/span>/i);
    const brand = pick(/<tr class="po-brand"[\s\S]{0,300}?<span[^>]*class="[^"]*po-break-word[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/i)
               || pick(/<a id="bylineInfo"[^>]*>\s*(?:Visit the |Brand:\s*)?([^<]+?)(?:\s+Store)?\s*<\/a>/i);
    // 价格 · 优先从 buy box 抓 · 避免抓到 "customers also viewed" 里的其他币种价格
    const buyBox = html.match(/id="corePriceDisplay_desktop_feature_div"[\s\S]{0,3000}/i)?.[0]
                || html.match(/id="apex_desktop"[\s\S]{0,3000}/i)?.[0]
                || html.match(/id="corePrice_feature_div"[\s\S]{0,3000}/i)?.[0]
                || '';
    const priceRaw = (buyBox.match(/<span class="a-offscreen">\s*(\$[\d.,]+)\s*<\/span>/i)?.[1]
                   || pick(/<span class="a-price[^"]*"[^>]*>\s*<span class="a-offscreen">\s*(\$[\d.,]+)\s*<\/span>/i)
                   || '').replace(/\s+/g, ' ').trim();
    const featureBullets = [...html.matchAll(/<span class="a-list-item[^"]*"[^>]*>\s*([^<]{20,300}?)\s*<\/span>/gi)].slice(0, 5).map(m => decodeEntities(m[1].trim()));
    const bcHtml = html.match(/id="wayfinding-breadcrumbs_feature_div"[\s\S]{0,3000}?<\/ul>/i)?.[0] || '';
    const breadcrumb = [...bcHtml.matchAll(/<a[^>]*class="[^"]*a-link-normal[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/g)].map(m => decodeEntities(m[1].trim()));

    // ---- 新增：图片 / 评分 / 评论数 / Prime / 优惠 / 送达时间 ----
    // 主图 · Amazon 用 data-a-dynamic-image JSON 或 hi-res 属性
    let imageUrl = pick(/<img[^>]+id="landingImage"[^>]+data-old-hires="([^"]+)"/i)
                || pick(/<img[^>]+id="landingImage"[^>]+src="([^"]+)"/i)
                || pick(/"hiRes":"([^"]+\.jpg)"/i)
                || pick(/"large":"([^"]+\.jpg)"/i);
    if (imageUrl) imageUrl = imageUrl.replace(/&amp;/g, '&');

    // 评分 · "4.5 out of 5 stars"
    const starsRaw = pick(/<span[^>]+class="a-icon-alt"[^>]*>\s*([\d.]+)\s+out of\s+5 stars?/i)
                  || pick(/data-hook="rating-out-of-text"[^>]*>\s*([\d.]+)/i);
    const stars = starsRaw ? parseFloat(starsRaw) : null;

    // 评论数 · "2,847 ratings" 或 "2,847 global ratings"
    const reviewsRaw = pick(/id="acrCustomerReviewText"[^>]*>\s*([\d,]+)\s+ratings?/i)
                    || pick(/data-hook="total-review-count"[^>]*>[\s\S]*?([\d,]+)\s+global ratings/i);
    const reviews = reviewsRaw ? parseInt(reviewsRaw.replace(/,/g, ''), 10) : null;

    // Prime · 检测 prime 徽标存在（多种页面结构：icon / json / badge）
    const prime = /class="[^"]*a-icon-prime[^"]*"|"isPrimeEligible"\s*:\s*true|"isEligibleForPrime"\s*:\s*true|primeBadgeVisible|badge_feature_slot[^"]*>\s*<[^>]*prime|id="primeSupplement/i.test(html);

    // Deal / Lightning Deal 徽标
    const deal = /Lightning Deal|Limited time deal|Deal of the Day/i.test(html);

    // Coupon · "Save $X with coupon" / "Save 10% with coupon"
    const couponRaw = pick(/(?:promoPriceBlockMessage|couponBadge)[\s\S]{0,300}?Save\s+(\$[\d.]+|\d+%)/i)
                   || pick(/Save\s+(\$[\d.]+|\d+%)\s+with (?:coupon|Coupon)/i);

    // 划线价 · List Price（优先在 buyBox 范围内找）
    const listPriceRaw = (buyBox.match(/<span class="a-price a-text-price[^"]*"[\s\S]{0,200}?<span class="a-offscreen">\s*(\$[\d.,]+)\s*<\/span>/i)?.[1]
                       || buyBox.match(/data-a-strike="true"[\s\S]{0,200}?a-offscreen">\s*(\$[\d.,]+)\s*<\/span>/i)?.[1]
                       || pick(/basisPrice[\s\S]{0,300}?<span class="a-offscreen">\s*(\$[\d.,]+)\s*<\/span>/i)
                       || '').trim();

    // 送达时间 · "FREE delivery Tue, Jul 14"
    const deliveryRaw = pick(/id="mir-layout-DELIVERY_BLOCK"[\s\S]{0,600}?<span[^>]*>\s*([A-Z][a-z]+,\s+[A-Z][a-z]+\s+\d+)/i)
                     || pick(/FREE (?:delivery|Delivery)[^<]*?([A-Z][a-z]+,\s+[A-Z][a-z]+\s+\d+)/i);

    if (!title) throw new Error('未能解析商品标题 · 可能被 Amazon 反爬拦截或页面结构变化');

    // 用 LLM 从抓取的原始字段推断结构化画像（如果模型联通）
    let llmData = null;
    try {
      const cfg = require('./providers').loadConfig();
      if (cfg.activeModel) {
        const { askLLMForJSON } = require('./llm');
        const { data } = await askLLMForJSON({
          system: `你从 Amazon 商品页信息里抽取结构化字段。返回严格 JSON:
{
  "brand": "品牌名（如 COMFEE / Broan / Instant Pot）",
  "model": "型号或产品简称（如 CVU30W4AST / Duo 6 QT）· 从 title 提取核心识别名",
  "cat": "品类（含关键规格 · 如 'Range Hood 30 英寸 Under-Cabinet' / 'Pressure Cooker 6 Quart'）",
  "suggestedGoal": "根据品类和品牌建议一个 Listing 优化的业务目标（一句话）"
}`,
          user: `Title: ${title}
Brand: ${brand || '未知'}
Price: ${priceRaw || '未知'}
Breadcrumb: ${breadcrumb.join(' > ') || '未知'}
Feature bullets（前 3 条）: ${featureBullets.slice(0, 3).join(' | ') || '未知'}`,
          maxTokens: 400,
        });
        llmData = data;
      }
    } catch (e) { console.warn('  [ASIN lookup] LLM 抽取失败:', e.message); }

    // 价格数值化（用于比较 / 计算折扣）
    const priceNum = priceRaw ? parseFloat(priceRaw.replace(/[^0-9.]/g, '')) : null;
    const listPriceNum = listPriceRaw ? parseFloat(listPriceRaw.replace(/[^0-9.]/g, '')) : null;

    const result = {
      ok: true,
      asin,
      url,
      market,
      title,
      brand: llmData?.brand || brand || '',
      model: llmData?.model || asin,
      cat: llmData?.cat || breadcrumb[breadcrumb.length - 1] || '',
      price: priceRaw,
      priceNum,
      listPrice: listPriceRaw,
      listPriceNum,
      imageUrl,
      stars,
      reviews,
      prime,
      deal,
      coupon: couponRaw || null,
      delivery: deliveryRaw || null,
      breadcrumb,
      featureBullets: featureBullets.slice(0, 5),
      suggestedGoal: llmData?.suggestedGoal || '',
      llmEnriched: !!llmData,
      ms: Date.now() - t0,
    };
    console.log(`  [ASIN lookup] ${asin} → "${(result.title||'').slice(0,50)}" · brand=${result.brand} · $${priceNum||'?'} · ★${stars||'?'} · ${reviews||'?'} reviews · img=${imageUrl?'✓':'✗'} · ${result.ms}ms · llm=${!!llmData}`);
    res.json(result);
  } catch (e) {
    console.error(`  [ASIN lookup] ${asin} failed:`, e.message);
    res.status(500).json({ ok: false, error: e.message, asin });
  }
});

// -------- 合规扫描 --------
router.post('/compliance-check', async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  const system = `你是 Amazon Listing 合规审核专家。扫描以下类别的违禁词与合规风险：
- Absolute claims: "#1", "best", "guaranteed", "certified"（无凭证）
- Medical claims: "cure", "prevent", "treat", "sanitize"（除非有 FDA 等）
- Restricted words: "eco-friendly" / "organic" 无认证 · "FDA approved" 未获批
- Trademark risk: 影射其他品牌（Instant Pot / KitchenAid 等）
- Cross-listing content: 类目不符的描述

返回 JSON:
{
  "issues": [
    {"type":"Absolute claim","severity":"高","match":"...","advice":"..."}
  ],
  "cleanScore": 85,
  "summary": "..."
}
如果无问题 issues 返回 []，cleanScore 100。`;
  try {
    const t0 = Date.now();
    const { data } = await askLLMForJSON({ system, user: text, maxTokens: 1000 });
    console.log(`  [Compliance] ${(data.issues||[]).length} issues · score=${data.cleanScore} · ${Date.now()-t0}ms`);
    res.json({ ok: true, ...data });
  } catch (e) {
    console.error('  [Compliance] failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
