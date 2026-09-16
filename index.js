require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();
const port = process.env.PORT || 8443;

// ---------- 中间件 ----------
app.use(helmet({
  hsts: false,
  referrerPolicy: { policy: 'same-origin' },
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: null
    }
  }
}));
app.use(morgan('combined'));
app.use('/api', bodyParser.json());
app.use('/api', bodyParser.urlencoded({ extended: false }));
app.use('/api', express.json());
app.use('/api', express.urlencoded({ extended: true }));

// ---------- 路由 ----------
const applyRoutes = require('./routes/apply');
const joinRoutes = require('./routes/join');
const adminRoutes = require('./routes/admin');
const inviteRoutes = require('./routes/invite');
const authRoutes = require('./routes/auth');
const zuiRoutes = require('./routes/zui');
const loginPageRoutes = require('./routes/loginPage');
const registerPageRoutes = require('./routes/registerPage');
const downloadsRoutes = require('./routes/downloads');
const ztncuiProxyRoutes = require('./routes/ztncuiProxy');

// API 路由
app.use('/api', authRoutes);
app.use('/api', applyRoutes);
app.use('/api', joinRoutes);
app.use('/api', inviteRoutes);
app.use('/api/zui', zuiRoutes);

// zui 静态文件
app.use('/zui/static', express.static(path.join(__dirname, 'views', 'zui', 'static')));
app.get('/zui/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'zui', 'index.html'));
});

// ---------- 登录/注册/登出页面 ----------
app.use('/', loginPageRoutes);
app.use('/', registerPageRoutes);

// ---------- ztncui 代理 ----------
app.use('/', downloadsRoutes);
app.use('/ztncui', ztncuiProxyRoutes);

// ---------- 管理后台（仅 localhost） ----------
app.use('/admin', function(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') return next();
  res.status(403).send('Admin UI only accessible from localhost or authenticated admin');
});
app.use('/admin', adminRoutes);

// 健康检查
app.get('/health', (req, res) => res.status(200).send('OK'));

// ---------- 启动服务 ----------
app.listen(port, () => {
  console.log(`control-proxy listening on ${port}`);
});
