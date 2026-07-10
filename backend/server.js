// ===================================================================
// AI Listing 优化引擎 · 后端主入口
// - Express 提供 REST API
// - 同时 serve frontend/ 静态文件（一个进程搞定前后端）
// - 未来可拆到 Lambda + CloudFront，逻辑不变
// ===================================================================
const express = require('express');
const path = require('path');
const routes = require('./routes');
const providersModule = require('./providers');
const chatRouter = require('./chat');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

// 简单请求日志，方便观察前端在调什么 API
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      const ms = Date.now() - start;
      console.log(`  ${req.method} ${req.originalUrl} → ${res.statusCode} · ${ms}ms`);
    }
  });
  next();
});

// API · 顺序：先挂 chat / providers（覆盖 routes.js 里的旧 /chat mock）
app.use('/api/providers', providersModule.router);
app.use('/api/chat', chatRouter);
app.use('/api', routes);

// 前端静态资源 · dev 阶段禁 cache，避免 index.html 改动没生效
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// SPA fallback：非 /api 且 accept html 的都返回 index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (req.accepts('html')) return res.sendFile(path.join(frontendPath, 'index.html'));
  next();
});

app.listen(PORT, () => {
  console.log('');
  console.log('  ═══════════════════════════════════════════════════════');
  console.log('    AI Listing 优化引擎 · 已启动');
  console.log('  ═══════════════════════════════════════════════════════');
  console.log(`    前端  →  http://localhost:${PORT}/`);
  console.log(`    API   →  http://localhost:${PORT}/api/health`);
  console.log(`    数据  →  mock 模式（未接入 Bedrock/SP-API）`);
  console.log('  ═══════════════════════════════════════════════════════');
  console.log('');
});
