require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 8443;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 引入路由
const authRoutes = require('./routes/auth');
const applyRoutes = require('./routes/apply'); // 假设存在
const ztncuiProxyRoutes = require('./routes/ztncuiProxy');

// 挂载 API 路由（现有）
app.use('/api', authRoutes);
app.use('/api', applyRoutes);

// 挂载 ztncui 代理（新增）
app.use('/', ztncuiProxyRoutes); // 访问 /ztncui 将代理

// 健康检查（可选）
app.get('/health', (req, res) => res.status(200).send('OK'));

// 启动服务
app.listen(port, () => {
  console.log(`control-proxy listening on ${port}`);
});
