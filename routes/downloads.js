const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const PLANET_DIR = '/planet-data';

// 列出可下载的文件
router.get('/download', (req, res) => {
  let files = [];
  try {
    files = fs.readdirSync(PLANET_DIR).filter(f => {
      const stat = fs.statSync(path.join(PLANET_DIR, f));
      return stat.isFile();
    });
  } catch (e) {
    files = [];
  }

  const list = files.map(f => 
    `<li><a href="/download/${encodeURIComponent(f)}">${f}</a></li>`
  ).join('');

  res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>ZeroTier 客户端文件下载</title>
<style>
  body { font-family: sans-serif; max-width: 700px; margin: 60px auto; padding: 20px; background: #f5f7fa; color: #333; }
  .box { background: #fff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
  h1 { margin-top: 0; font-size: 24px; }
  ul { list-style: none; padding: 0; }
  li { padding: 12px 0; border-bottom: 1px solid #eee; }
  li:last-child { border-bottom: none; }
  a { color: #1677ff; text-decoration: none; font-size: 16px; }
  a:hover { text-decoration: underline; }
  .tip { background: #f0f7ff; border-left: 4px solid #1677ff; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 14px; line-height: 1.6; }
  code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
</style>
</head>
<body>
  <div class="box">
    <h1>ZeroTier 客户端文件下载</h1>
    <ul>${list || '<li>暂无可下载文件</li>'}</ul>
    <div class="tip">
      <strong>使用说明：</strong><br>
      1. 下载 <code>planet</code> 文件<br>
      2. 替换本机 ZeroTier 安装目录下的 <code>planet</code> 文件<br>
         - Windows: <code>C:\\ProgramData\\ZeroTier\\One\\planet</code><br>
         - Linux: <code>/var/lib/zerotier-one/planet</code><br>
         - macOS: <code>/Library/Application Support/ZeroTier/One/planet</code><br>
      3. 重启 ZeroTier 服务<br>
      4. 加入网络（Network ID 由管理员提供）
    </div>
  </div>
</body>
</html>
  `);
});

// 下载具体文件
router.get('/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // 防止目录穿越
  const filepath = path.join(PLANET_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).send('File not found');
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  fs.createReadStream(filepath).pipe(res);
});

module.exports = router;
