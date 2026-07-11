// ===================================================================
// Mock 数据 · 后端唯一数据源
// 未来接入 SP-API / Ads API / Alexa API 时，替换此文件里的具体函数
// ===================================================================

const ASINS = [
  { id:1, asin:"B08GK4VPMR", model:"CVU30W4AST", name:"COMFEE 30\" Slim Range Hood", cat:"Range Hood 30\"", grade:"A", score:85, alexa:41, status:"live" },
  { id:2, asin:"B08GK4S8LK", model:"CVW36W6AST", name:"COMFEE 36\" Wall-Mount Hood",  cat:"Range Hood 36\"", grade:"A", score:88, alexa:44, status:"live" },
  { id:3, asin:"B091DK2H4W", model:"EM720CPL",   name:"COMFEE 0.7 Cu.Ft Microwave",   cat:"Microwave",       grade:"A", score:86, alexa:39, status:"live" },
  { id:4, asin:"B091DK9M2L", model:"EM110CAF",   name:"COMFEE 1.1 Cu.Ft Microwave",   cat:"Microwave",       grade:"A", score:84, alexa:37, status:"live" },
  { id:5, asin:"B08GK4V38N", model:"CVU30C5AST", name:"COMFEE 30\" Chef-Style Hood",  cat:"Range Hood 30\"", grade:"B", score:78, alexa:24, status:"ab" },
  { id:6, asin:"B08YXK3M2P", model:"CVU30L2W",   name:"COMFEE 30\" Legacy Hood",      cat:"Range Hood 30\"", grade:"C", score:58, alexa:11, status:"draft" },
];

// ===== 数据源类型定义（可枚举、可展示）=====
const DATA_SOURCE_TYPES = {
  alexa_summary:      { name:'Alexa AI Summary',            desc:'产品被 Alexa 描述/推荐的方式',                    category:'Alexa 三路', locked:true,  recommend:null },
  alexa_followup:     { name:'Alexa Follow-up Questions',   desc:'用户 30 天内的追问场景与频次',                     category:'Alexa 三路', locked:true,  recommend:null },
  product_describe:   { name:'Product Describe',            desc:'AI 对产品属性 (COSMO NER) 的理解',                 category:'Alexa 三路', locked:true,  recommend:null },
  brand_analytics:    { name:'Brand Analytics 搜索词报告',  desc:'品类 TOP 100 高流量搜索词 + 排名位置',             category:'搜索排名',   locked:false, recommend:'搜索第一页目标必开' },
  sp_ads:             { name:'SP 广告搜索词报告',           desc:'过去 30 天转化率 ≥5% 的关键词',                    category:'搜索排名',   locked:false, recommend:'定位买家真实用词' },
  keyword_rank:       { name:'品类关键词排名快照',          desc:'当前主 SKU 在各关键词的位置',                       category:'搜索排名',   locked:false, recommend:null },
  competitor_listing: { name:'竞品 Listing 抓取',           desc:'Broan / COSMO / Zline 等竞品的 Modular Title 结构',category:'竞品参考',   locked:false, recommend:'用于差异化' },
  rufus_feedback:     { name:'Rufus Community Feedback',    desc:'评论情感洞察与高频短语（近 30 天）',                category:'评论社交',   locked:false, recommend:null },
};

// ===== 知识库文件 · 按品类打 tag + 含数据摘要 =====
// 每个文件的 catTags 决定"哪些品类能匹配到我"
// payload 是模拟的数据摘要（真实系统里应该来自实际数据源）
const KB_FILES = [
  // --- Alexa 三路 · Pressure Cooker（Instant Pot 品类）---
  { id:'kb001', name:'alexa_summary_pressure_cooker_2026Q2.jsonl', type:'alexa_summary', catTags:['pressure cooker','instant pot','multi-cooker','electric pressure cooker'],
    project:'Kitchen Appliance · 通用', uploadedAt:'今天 08:12', enabled:true, source:'backend',
    payload:{ metric:'描述范式条数', value:24, sample:'A versatile 7-in-1 electric pressure cooker that replaces slow cooker, rice cooker, steamer...' } },
  { id:'kb002', name:'alexa_followup_pressure_cooker_202607.jsonl', type:'alexa_followup', catTags:['pressure cooker','instant pot','multi-cooker'],
    project:'Kitchen Appliance · 通用', uploadedAt:'昨天 22:30', enabled:true, source:'backend',
    payload:{ metric:'Follow-up 场景', value:9, sample:'Is it safe for small kitchens? / Can I cook rice and stew at the same time? / How loud is pressure release?', sampleSize:8420 } },
  { id:'kb003', name:'product_describe_pressure_cooker.jsonl', type:'product_describe', catTags:['pressure cooker','instant pot'],
    project:'Kitchen Appliance · 通用', uploadedAt:'06-25', enabled:true, source:'backend',
    payload:{ metric:'COSMO 属性数', value:38 } },

  // --- Alexa 三路 · Range Hood ---
  { id:'kb101', name:'alexa_summary_range_hood_2026Q2.jsonl', type:'alexa_summary', catTags:['range hood','油烟机','under-cabinet'],
    project:'油烟机', uploadedAt:'今天 08:14', enabled:true, source:'backend',
    payload:{ metric:'描述范式条数', value:14, sample:'A compact under-cabinet range hood with 200 CFM extraction ideal for apartment kitchens...' } },
  { id:'kb102', name:'COMFEE_Range_Hood_Alexa_FollowUps_20260706.jsonl', type:'alexa_followup', catTags:['range hood','油烟机'],
    project:'油烟机', uploadedAt:'今天 08:12', enabled:true, source:'backend',
    payload:{ metric:'Follow-up 场景', value:7, sample:'Is this quiet enough for apartment? / Can I install without electrician? / Does it work rental with no vent?', sampleSize:12428 } },
  { id:'kb103', name:'product_describe_range_hood.jsonl', type:'product_describe', catTags:['range hood','油烟机'],
    project:'油烟机', uploadedAt:'06-25', enabled:true, source:'backend',
    payload:{ metric:'COSMO 属性数', value:42 } },

  // --- Alexa 三路 · Microwave ---
  { id:'kb201', name:'alexa_summary_microwave_2026Q2.jsonl', type:'alexa_summary', catTags:['microwave','countertop microwave','microwave oven'],
    project:'微波炉', uploadedAt:'07-01', enabled:true, source:'backend',
    payload:{ metric:'描述范式条数', value:19, sample:'Compact countertop microwave ideal for dorms and small apartments...' } },
  { id:'kb202', name:'alexa_followup_microwave_202607.jsonl', type:'alexa_followup', catTags:['microwave'],
    project:'微波炉', uploadedAt:'07-01', enabled:true, source:'backend',
    payload:{ metric:'Follow-up 场景', value:11, sampleSize:6892 } },

  // --- 搜索排名 · Brand Analytics（大类聚合）---
  { id:'kb301', name:'brand_analytics_kitchen_appliance_top100_202607.csv', type:'brand_analytics',
    catTags:['pressure cooker','instant pot','microwave','rice cooker','air fryer','range hood','油烟机','kitchen appliance','small appliance'],
    project:'跨品类', uploadedAt:'今天 06:00', enabled:true, source:'backend',
    payload:{ metric:'TOP 100 关键词', value:100, coverage:72 } },

  // --- SP 广告搜索词报告（只有部分品类有）---
  { id:'kb401', name:'sp_high_conversion_range_hood_202607.csv', type:'sp_ads', catTags:['range hood','油烟机'],
    project:'油烟机', uploadedAt:'07-05', enabled:true, source:'backend',
    payload:{ metric:'高转化词（CVR ≥ 5%）', value:23 } },
  // 注意：Pressure Cooker / Microwave 的 SP 报告故意缺失，用于演示"缺数据源"提示

  // --- 竞品 Listing 抓取 ---
  { id:'kb501', name:'competitor_broan_cvu30_snapshot.html', type:'competitor_listing', catTags:['range hood 30','油烟机 30'],
    project:'油烟机', uploadedAt:'07-04', enabled:true, source:'backend',
    payload:{ metric:'竞品 SKU', value:'Broan-NuTone BUEZ130SS 30-Inch' } },
  { id:'kb502', name:'competitor_cosmo_range_hood_snapshot.html', type:'competitor_listing', catTags:['range hood','油烟机'],
    project:'油烟机', uploadedAt:'07-04', enabled:true, source:'backend',
    payload:{ metric:'竞品 SKU', value:'COSMO 5MU30' } },
  { id:'kb503', name:'competitor_ninja_foodi_pressure_cooker.html', type:'competitor_listing', catTags:['pressure cooker','instant pot','multi-cooker'],
    project:'Kitchen Appliance · 通用', uploadedAt:'06-28', enabled:true, source:'backend',
    payload:{ metric:'竞品 SKU', value:'Ninja Foodi 6.5 QT · Cosori Pressure Cooker' } },

  // --- Rufus Community Feedback ---
  { id:'kb601', name:'rufus_feedback_pressure_cooker_jun.csv', type:'rufus_feedback', catTags:['pressure cooker','instant pot'],
    project:'Kitchen Appliance · 通用', uploadedAt:'06-30', enabled:true, source:'backend',
    payload:{ metric:'评论洞察条数', value:342, positiveRate:82 } },
  { id:'kb602', name:'Rufus_Community_Feedback_RangeHood_Jun.csv', type:'rufus_feedback', catTags:['range hood','油烟机'],
    project:'油烟机', uploadedAt:'06-30', enabled:true, source:'backend',
    payload:{ metric:'评论洞察条数', value:187, positiveRate:78 } },

  // --- 政策 / 通用（跨品类）---
  { id:'kb901', name:'Amazon_Modular_Titles_Guidelines_v3.pdf', type:'policy_doc', catTags:['*'],
    project:'—', uploadedAt:'06-15', enabled:true, source:'backend',
    payload:{ metric:'政策条款', value:'2026-07-27 Modular Titles 强制生效 · Item Name ≤75 · Highlights ≤125' } },
  { id:'kb902', name:'AWS_Bedrock_Prompt_Templates_v1.md', type:'policy_doc', catTags:['*'],
    project:'—', uploadedAt:'今天 10:47', enabled:true, source:'backend-only',
    payload:{ metric:'Prompt 模板', value:'Listing 生成 · 评分 · 对比 · 合规扫描' } },
];

const PROJ_TASKS = [
  { asin:"B08GK4VPMR", model:"CVU30W4AST", type:"主图 · apartment 场景",   from:"Step 3 人工清单",     owner:"设计 · 张明",   assignedAt:"07-01", status:"in-progress", progress:"Day 2/3", impact:"视觉 7→10 · CVR +8%", note:"" },
  { asin:"B08GK4VPMR", model:"CVU30W4AST", type:"A+ 视频 · Install",       from:"Step 3 人工清单",     owner:"内容 · 李华",   assignedAt:"07-01", status:"in-progress", progress:"Day 2/5", impact:"A+ 8→10 · 退货 -32%", note:"" },
  { asin:"B08GK4VPMR", model:"CVU30W4AST", type:"Vine · 20 名额",           from:"Step 3 人工清单",     owner:"品牌 · 王芳",   assignedAt:"07-01", status:"submitted",   progress:"Amazon 审核中", impact:"评论 +30 · 30 天见效", note:"预算已扣 $600" },
  { asin:"B091DL8W7C", model:"EM144KM1",   type:"Highlights 合规改写",     from:"Dashboard 合规检测",  owner:"Listing · 陈杰",assignedAt:"07-05", status:"in-progress", progress:"Day 1/2", impact:"合规风险清零", note:"Medical claim sanitizing" },
  { asin:"B08GK4S8LK", model:"CVW36W6AST", type:"主图差异化 · open-plan",  from:"Step 3 人工清单",     owner:"设计 · 张明",   assignedAt:"06-28", status:"done",        progress:"100%",    impact:"相似度 62%→38% · 已重评 88", note:"已合入 V3 · 07-06" },
  { asin:"B08GK4S8LK", model:"CVW36W6AST", type:"Vine · 20 名额",           from:"Step 3 人工清单",     owner:"品牌 · 王芳",   assignedAt:"06-28", status:"done",        progress:"100%",    impact:"+34 条评论 · 已到账", note:"评论 1,523→1,557" },
];

const PROJECTS = [
  { id:"range-hood", name:"COMFEE 油烟机 Range Hood", version:"V3", status:"active", skuCount:12, updatedAt:"今天 09:23" },
  { id:"portable-ac", name:"COMFEE 便携空调 Portable AC", version:"V2", status:"ab-testing", skuCount:18, updatedAt:"07-05" },
  { id:"microwave", name:"COMFEE 微波炉 Microwave", version:"V4", status:"active", skuCount:24, updatedAt:"07-04" },
];

module.exports = { ASINS, KB_FILES, PROJ_TASKS, PROJECTS, DATA_SOURCE_TYPES };
