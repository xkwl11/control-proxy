const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { nowSec } = require('../utils');

const JWT_SECRET = process.env.SERVER_SECRET || 'replace_this_secret';

// create first admin if no users exist: allowed
router.post('/register', (req,res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const exist = db.prepare('SELECT 1 FROM users LIMIT 1').get();
  const isFirst = !exist;
  const assignedRole = (isFirst && !role) ? 'admin' : (role || 'user');
  if (assignedRole === 'admin' && !isFirst){
    // only allow admin creation if caller provides SERVER_SECRET in body.secret
    if (req.body.secret !== process.env.SERVER_SECRET) return res.status(403).json({ error: 'admin creation not allowed' });
  }
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  try{
    db.prepare('INSERT INTO users (id,username,password_hash,role,created_at) VALUES (?,?,?,?,?)')
      .run(id, username, hash, assignedRole, nowSec());
    db.prepare('INSERT INTO audit_logs (action,detail,actor,ts) VALUES (?,?,?,?)').run('register', JSON.stringify({username,role:assignedRole}), username, nowSec());
    res.json({ id, username, role: assignedRole });
  }catch(err){
    if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ error: 'username exists' });
    res.status(500).json({ error: 'db error' });
  }
});

router.post('/login', (req,res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!row) return res.status(401).json({ error: 'invalid credentials' });
  if (!bcrypt.compareSync(password, row.password_hash)) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ id: row.id, username: row.username, role: row.role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

function authMiddleware(req,res,next){
  const h = req.headers.authorization || req.headers['x-access-token'] || req.headers['x-api-key'];
  if (!h) return res.status(401).json({ error: 'missing auth token' });
  const token = (h.startsWith('Bearer ')) ? h.slice(7) : h;
  try{
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  }catch(err){
    return res.status(401).json({ error: 'invalid token' });
  }
}

function adminOnly(req,res,next){
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'admin required' });
}

module.exports = router;
module.exports.authMiddleware = authMiddleware;
module.exports.adminOnly = adminOnly;
