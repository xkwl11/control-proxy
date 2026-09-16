const express = require('express');
const router = express.Router();

router.get('/login', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>登录 - Control Proxy</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
  .box { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); width: 360px; }
  h2 { margin: 0 0 24px; text-align: center; color: #333; font-weight: 600; }
  input { width: 100%; padding: 12px 14px; margin: 8px 0; box-sizing: border-box; border: 1px solid #ddd; border-radius: 6px; font-size: 15px; transition: border 0.2s; }
  input:focus { outline: none; border-color: #667eea; }
  button { width: 100%; padding: 12px; margin-top: 12px; background: #667eea; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: 500; transition: background 0.2s; }
  button:hover { background: #5a67d8; }
  button:disabled { background: #a0aec0; cursor: not-allowed; }
  .err { color: #e53e3e; font-size: 14px; margin-top: 12px; min-height: 20px; text-align: center; }
  .link { text-align: center; margin-top: 16px; font-size: 14px; }
  .link a { color: #667eea; text-decoration: none; }
</style>
</head>
<body>
  <div class="box">
    <h2>登录</h2>
    <input id="username" placeholder="用户名" autocomplete="username" autofocus>
    <input id="password" type="password" placeholder="密码" autocomplete="current-password">
    <button id="loginBtn" onclick="doLogin()">登 录</button>
    <div class="err" id="err"></div>
    <div class="link"><a href="/register">没有账号？去注册</a></div>
  </div>
<script>
async function doLogin() {
  const u = document.getElementById('username').value.trim();
  const p = document.getElementById('password').value;
  const err = document.getElementById('err');
  const btn = document.getElementById('loginBtn');
  err.textContent = '';
  if (!u || !p) { err.textContent = '请输入账号和密码'; return; }
  btn.disabled = true; btn.textContent = '登录中...';
  try {
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
    const data = await r.json();
    if (!r.ok) { err.textContent = data.error || data.message || '登录失败'; btn.disabled = false; btn.textContent = '登 录'; return; }
    document.cookie = 'token=' + encodeURIComponent(data.token) + '; path=/; max-age=86400; SameSite=Lax';
    const redirect = new URLSearchParams(location.search).get('redirect') || '/ztncui';
    location.href = redirect;
  } catch (e) { err.textContent = '网络错误: ' + e.message; btn.disabled = false; btn.textContent = '登 录'; }
}
document.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
</script>
</body>
</html>
  `);
});

router.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'token=; path=/; max-age=0; SameSite=Lax');
  res.redirect('/login');
});

module.exports = router;
