const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const { authenticateJWT } = require('./auth'); // 确保路径正确

const router = express.Router();

// 配置从环境变量读取
const ZTNCUI_TARGET = process.env.ZTNCUI_TARGET || 'http://planet:3443';
const ZTNCUI_USER = process.env.ZTNCUI_USER || 'admin';
const ZTNCUI_PASS = process.env.ZTNCUI_PASS || 'password';

// 缓存每个用户的 ztncui session cookie（key: userId）
const sessionCache = new Map();

// 解析 ztncui 的登录响应，提取 session cookie
async function loginToZtncui() {
  try {
    // 假设 ztncui 登录 endpoint 为 /login，使用表单提交
    const loginUrl = `${ZTNCUI_TARGET}/login`;
    const response = await axios.post(loginUrl, 
      new URLSearchParams({
        username: ZTNCUI_USER,
        password: ZTNCUI_PASS
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 400 || status === 302
      }
    );
    const setCookie = response.headers['set-cookie'];
    if (setCookie && setCookie.length) {
      const sessionCookie = setCookie.find(c => c.includes('connect.sid') || c.includes('session'));
      return sessionCookie || setCookie[0];
    }
    return null;
  } catch (err) {
    console.error('ztncui login error:', err.message);
    return null;
  }
}

// 创建代理中间件
const proxyMiddleware = createProxyMiddleware({
  target: ZTNCUI_TARGET,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    const userId = req.user?.id;
    if (userId && sessionCache.has(userId)) {
      const cookie = sessionCache.get(userId);
      proxyReq.setHeader('Cookie', cookie);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    const userId = req.user?.id;
    if (!userId) return;
    const setCookie = proxyRes.headers['set-cookie'];
    if (setCookie) {
      const sessionCookie = setCookie.find(c => c.includes('connect.sid') || c.includes('session'));
      if (sessionCookie) {
        sessionCache.set(userId, sessionCookie);
      }
    }
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(502).send('Bad Gateway');
  }
});

// 认证中间件 + 代理
router.use('/ztncui', authenticateJWT, async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let cookie = sessionCache.get(userId);
  if (!cookie) {
    cookie = await loginToZtncui();
    if (cookie) {
      sessionCache.set(userId, cookie);
    } else {
      return res.status(503).json({ error: 'Could not authenticate with ztncui' });
    }
  }

  proxyMiddleware(req, res, next);
});

module.exports = router;
