// ===================================================================
// REST API 路由
// 未来接入真实 AWS 服务时，在此文件里替换 handler 实现
// ===================================================================
const express = require('express');
const router = express.Router();
const { ASINS, KB_FILES, PROJ_TASKS, PROJECTS } = require('./mock-data');

// 健康检查（前端启动时 ping，用于顶栏后端连接状态指示灯）
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ai-listing-backend',
    version: '0.1.0',
    ts: Date.now(),
    features: ['mock-data', 'no-auth', 'ready-for-bedrock'],
  });
});

// ---- ASINs ----
router.get('/asins', (req, res) => {
  const { cat, status } = req.query;
  let items = ASINS;
  if (cat) items = items.filter(a => a.cat === cat);
  if (status) items = items.filter(a => a.status === status);
  res.json({ items, total: items.length });
});
router.get('/asins/:asin', (req, res) => {
  const a = ASINS.find(x => x.asin === req.params.asin);
  if (!a) return res.status(404).json({ error: 'ASIN not found' });
  res.json(a);
});

// ---- Knowledge Base ----
router.get('/kb', (req, res) => {
  res.json({ items: KB_FILES, total: KB_FILES.length });
});
router.patch('/kb/:name/enabled', (req, res) => {
  const file = KB_FILES.find(f => f.name === req.params.name);
  if (!file) return res.status(404).json({ error: 'File not found' });
  file.enabled = !!req.body.enabled;
  res.json({ ok: true, file });
});

// ---- Projects & Tasks ----
router.get('/projects', (req, res) => {
  res.json({ items: PROJECTS });
});
router.get('/projects/:id/tasks', (req, res) => {
  // demo 阶段：全部项目共享同一份 mock 任务
  res.json({ items: PROJ_TASKS });
});

// Chat 路由已挪到 backend/chat.js（支持多 provider 分发）

module.exports = router;
