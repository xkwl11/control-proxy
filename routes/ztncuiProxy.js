const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const router = express.Router();

const ZTNCUI_TARGET = process.env.ZTNCUI_TARGET || 'http://nginx:8080';
const ZTNCUI_USER = process.env.ZTNCUI_USER || 'admin';
const ZTNCUI_PASS = process.env.ZTNCUI_PASS || 'password';
const JWT_SECRET = process.env.SERVER_SECRET || 'change_this_long_random';

const sessionCache = new Map();

function getUserFromRequest(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch (e) { return null; }
}

async function loginToZtncui() {
  try {
    const response = await axios.post(
      `${ZTNCUI_TARGET}/login`,
      new URLSearchParams({ username: ZTNCUI_USER, password: ZTNCUI_PASS }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, maxRedirects: 0, validateStatus: (s) => s < 400 || s === 302 }
    );
    const sc = response.headers['set-cookie'];
    if (sc && sc.length) {
      return sc.find(c => c.includes('connect.sid') || c.includes('session')) || sc[0];
    }
    return null;
  } catch (err) {
    console.error('ztncui login error:', err.message);
    return null;
  }
}

router.use('/', (req, res, next) => {
  const user = getUserFromRequest(req);
  if (!user) {
    if (req.accepts('html') && !req.xhr) {
      return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
    }
    return res.status(401).json({ error: 'missing auth token' });
  }
  req.user = user;
  next();
});

router.use('/', async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  let cookie = sessionCache.get(userId);
  if (!cookie) {
    cookie = await loginToZtncui();
    if (cookie) { sessionCache.set(userId, cookie); }
    else { return res.status(503).json({ error: 'Could not authenticate with ztncui' }); }
  }
  next();
});

const proxyMiddleware = createProxyMiddleware({
  target: ZTNCUI_TARGET,
  changeOrigin: true,
  pathRewrite: { '^/ztncui': '' },
  onProxyReq: (proxyReq, req, res) => {
    const userId = req.user?.id;
    if (userId && sessionCache.has(userId)) {
      proxyReq.setHeader('Cookie', sessionCache.get(userId));
    }
    const host = req.headers.host || 'localhost';
    proxyReq.setHeader('Origin', 'http://' + host);
    proxyReq.setHeader('Referer', 'http://' + host + req.originalUrl);
  },
  onProxyRes: (proxyRes, req, res) => {
    const userId = req.user?.id;

    // 保存 ztncui session
    const setCookie = proxyRes.headers['set-cookie'];
    if (setCookie && userId) {
      const sessionCookie = setCookie.find(c => c.includes('connect.sid') || c.includes('session'));
      if (sessionCookie) { sessionCache.set(userId, sessionCookie); }
    }
    delete proxyRes.headers['set-cookie'];

    // 关键：改写 Location，去掉绝对 URL 的 host，加上 /ztncui 前缀
    if (proxyRes.headers.location) {
      let loc = proxyRes.headers.location;
      console.log('原始 Location:', loc);
      // 去掉 http://host 部分
      loc = loc.replace(/^https?:\/\/[^/]+/, '');
      // 加上 /ztncui 前缀（如果还没有）
      if (loc.startsWith('/') && !loc.startsWith('/ztncui')) {
        loc = '/ztncui' + loc;
      }
      proxyRes.headers.location = loc;
      console.log('改写后 Location:', loc);
    }
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    if (!res.headersSent) res.status(502).send('Bad Gateway');
  }
});

router.use('/', proxyMiddleware);

module.exports = router;
