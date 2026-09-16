const express = require('express');
const router = express.Router();
const db = require('../db');

function hasUser() {
  try {
    const row = db.prepare('SELECT COUNT(*) AS c FROM users').get();
    return row && row.c > 0;
  } catch (e) {
    return false;
  }
}

router.get('/register', (req, res) => {
  if (hasUser()) {
    return res.send(`
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>注册已关闭</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f0f2f5;}
.box{background:#fff;padding:40px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.1);text-align:center;max-width:400px;}
h2{color:#333;}p{color:#666;}a{color:#667eea;}</style></head>
<body><div class="box"><h2>注册已关闭</h2><p>系统已存在用户，请联系管理员添加账号。</p>
<p><a href="/login">返回登录</a></p></div></body></html>
    `);
  }

  res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>注册管理员 - Control Proxy</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
  .box { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); width: 360px; }
  h2 { margin: 0 0 8px; text-align: center; color: #333; font-weight: 600; }
  .tip { text-align: center; color: #888; font-size: 13px; margin-bottom: 20px; }
  input { width: 100%; padding: 12px 14px; margin: 8px 0; box-sizing: border-box; border: 1px solid #ddd; border-radius: 6px; font-size: 15px; }
  input:focus { outline: none; border-color: #667eea; }
  button { width: 100%; padding: 12px; margin-top: 12px; background: #667eea; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: 500; }
  button:hover { background: #5a67d8; }
  button:disabled { background: #a0aec0; cursor: not-allowed; }
  .err { color: #e53e3e; font-size: 14px; margin-top: 12px; min-height: 20px; text-align: center; }
  .link { text-align: center; margin-top: 16px; font-size: 14px; }
  .link a { color: #667eea; text-decoration: none; }
</style>
</head>
<body>
  <div class="box">
    <h2>创建管理员</h2>
    <div class="tip">首次部署，请创建管理员账号</div>
    <input id="username" placeholder="用户名" autocomplete="username" autofocus>
    <input id="password" type="password" placeholder="密码（至少 6 位）" autocomplete="new-password">
    <input id="password2" type="password" placeholder="确认密码" autocomplete="new-password">
    <button id="regBtn" onclick="doRegister()">注 册</button>
    <div class="err" id="err"></div>
    <div class="link"><a href="/login">已有账号？去登录</a></div>
  </div>
<script>
async function doRegister() {
  const u = document.getElementById('username').value.trim();
  const p = document.getElementById('password').value;
  const p2 = document.getElementById('password2').value;
  const err = document.getElementById('err');
  const btn = document.getElementById('regBtn');
  err.textContent = '';
  if (!u || !p) { err.textContent = '请填写用户名和密码'; return; }
  if (p.length < 6) { err.textContent = '密码至少 6 位'; return; }
  if (p !== p2) { err.textContent = '两次密码不一致'; return; }
  btn.disabled = true; btn.textContent = '注册中...';
  try {
    const r = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
    const data = await r.json();
    if (!r.ok) { err.textContent = data.error || data.message || '注册失败'; btn.disabled = false; btn.textContent = '注 册'; return; }
    location.href = '/login';
  } catch (e) { err.textContent = '网络错误: ' + e.message; btn.disabled = false; btn.textContent = '注 册'; }
}
document.addEventListener('keydown', (e) => { if (e.key === 'Enter') doRegister(); });
</script>
</body>
</html>
  `);
});

module.exports = router;
