require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();
const port = process.env.PORT || 8443;

// ---------- 中间件 ----------
app.use(helmet());
app.use(morgan('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- 路由 ----------
const applyRoutes = require('./routes/apply');
const joinRoutes = require('./routes/join');
const adminRoutes = require('./routes/admin');
const inviteRoutes = require('./routes/invite');
const authRoutes = require('./routes/auth');
const zuiRoutes = require('./routes/zui');
const ztncuiProxyRoutes = require('./routes/ztncuiProxy'); // 新增

// API 路由
app.use('/api', authRoutes);
app.use('/api', applyRoutes);
app.use('/api', joinRoutes);
app.use('/api', inviteRoutes);
app.use('/api/zui', zuiRoutes);

// 提供 zui 静态文件（control-proxy 自己的管理界面）
app.use('/zui/static', express.static(path.join(__dirname, 'views', 'zui', 'static')));
app.get('/zui/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'zui', 'index.html'));
});

// ---------- 新增：ztncui 代理（挂载到 /ztncui） ----------
app.use('/ztncui', ztncuiProxyRoutes);

// ---------- 管理后台（仅 localhost 或认证管理员） ----------
app.use('/admin', function(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') return next();
  // 非 localhost 必须通过 admin 认证（adminRoutes 中会再次校验）
  res.status(403).send('Admin UI only accessible from localhost or authenticated admin');
});
app.use('/admin', adminRoutes);

// 健康检查
app.get('/health', (req, res) => res.status(200).send('OK'));

// ---------- 启动服务 ----------
app.listen(port, () => {
  console.log(`control-proxy listening on ${port}`);
});
