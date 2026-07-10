// ===================================================================
// Mock 数据 · 后端唯一数据源
// 未来接入 SP-API / Ads API / Alexa API 时，替换此文件里的具体函数
// 例如：module.exports.getAsins = async () => await spApi.listSKUs()
// ===================================================================

const ASINS = [
  { id:1, asin:"B08GK4VPMR", model:"CVU30W4AST", name:"COMFEE 30\" Slim Range Hood", cat:"Range Hood 30\"", grade:"A", score:85, alexa:41, status:"live" },
  { id:2, asin:"B08GK4S8LK", model:"CVW36W6AST", name:"COMFEE 36\" Wall-Mount Hood",  cat:"Range Hood 36\"", grade:"A", score:88, alexa:44, status:"live" },
  { id:3, asin:"B091DK2H4W", model:"EM720CPL",   name:"COMFEE 0.7 Cu.Ft Microwave",   cat:"Microwave",       grade:"A", score:86, alexa:39, status:"live" },
  { id:4, asin:"B091DK9M2L", model:"EM110CAF",   name:"COMFEE 1.1 Cu.Ft Microwave",   cat:"Microwave",       grade:"A", score:84, alexa:37, status:"live" },
  { id:5, asin:"B08GK4V38N", model:"CVU30C5AST", name:"COMFEE 30\" Chef-Style Hood",  cat:"Range Hood 30\"", grade:"B", score:78, alexa:24, status:"ab" },
  { id:6, asin:"B08YXK3M2P", model:"CVU30L2W",   name:"COMFEE 30\" Legacy Hood",      cat:"Range Hood 30\"", grade:"C", score:58, alexa:11, status:"draft" },
];

const KB_FILES = [
  { name:"COMFEE_Range_Hood_Alexa_FollowUps_20260706.jsonl", cat:"Alexa Follow-up",       project:"油烟机",   uploadedAt:"今天 08:12", enabled:true,  source:"backend" },
  { name:"Broan_CVU30_Listing_Snapshot_20260704.html",       cat:"竞品 Listing",           project:"油烟机",   uploadedAt:"07-04",     enabled:true,  source:"backend" },
  { name:"A_B_Result_CVU30W4AST_14days.pdf",                 cat:"A/B 报告",               project:"油烟机",   uploadedAt:"07-05",     enabled:true,  source:"backend" },
  { name:"Rufus_Community_Feedback_RangeHood_Jun.csv",       cat:"Rufus Feedback",         project:"油烟机",   uploadedAt:"06-30",     enabled:true,  source:"backend" },
  { name:"Amazon_Modular_Titles_Guidelines_v3.pdf",          cat:"政策文档",                project:"—",       uploadedAt:"06-15",     enabled:true,  source:"backend" },
  { name:"COMFEE_Product_Specs_Master_Sheet.xlsx",           cat:"产品规格",                project:"全品类",   uploadedAt:"06-01",     enabled:true,  source:"backend" },
  { name:"Portable_AC_Alexa_Summary_Draft.txt",              cat:"场景提取",                project:"便携空调", uploadedAt:"07-02",     enabled:false, source:"backend" },
  // 新增：后端专属文件，用来直观演示数据从 API 来
  { name:"AWS_Bedrock_Prompt_Templates_v1.md",               cat:"Prompt 模板",             project:"—",       uploadedAt:"今天 10:47", enabled:true,  source:"backend-only" },
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

module.exports = { ASINS, KB_FILES, PROJ_TASKS, PROJECTS };
