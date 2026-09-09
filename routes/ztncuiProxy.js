const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const { authenticateJWT } = require('./auth'); // 确保该中间件存在

const router = express.Router();

const ZTNCUI_TARGET = process.env.ZTNCUI_TARGET || 'http://planet:3443';
const ZTNCUI_USER = process.env.ZTNCUI_USER || 'admin';
const ZTNCUI_PASS = process.env.ZTNCUI_PASS || 'password';

const sessionCache = new Map();

async function loginToZtncui() {
  try {
    const loginUrl = `${ZTNCUI_TARGET}/login`;
    const response = await axios.post(loginUrl,
      new URLSearchParams({
        username: ZTNCUI_USER,
        password: ZTNCUI_PASS
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

const proxyMiddleware = createProxyMiddleware({
  target: ZTNCUI_TARGET,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    const userId = req.user?.id;
    if (userId && sessionCache.has(userId)) {
      proxyReq.setHeader('Cookie', sessionCache.get(userId));
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

// 所有请求都先经过 JWT 认证
router.use('/', authenticateJWT, async (req, res, next) => {
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
  next();
});

// 代理所有请求（包括静态资源、页面、API）
router.use('/', proxyMiddleware);

module.exports = router;
