const express = require('express');
const router = express.Router();
const db = require('../db');
const { nowSec } = require('../utils');
const { authMiddleware, adminOnly } = require('./auth');

router.get('/', (req,res) => {
  res.sendFile(require('path').join(__dirname,'../views/admin.html'));
});

router.get('/applications', authMiddleware, adminOnly, (req,res) => {
  const rows = db.prepare('SELECT id,name,email,phone,purpose,status,created_at FROM applications WHERE status = ?').all('pending');
  res.json(rows);
});

router.post('/approve/:id', authMiddleware, adminOnly, (req,res) => {
  const id = req.params.id;
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
  if (!app) return res.status(404).json({error:'not found'});
  db.prepare('UPDATE applications SET status = ? WHERE id = ?').run('approved', id);
  db.prepare('INSERT INTO audit_logs (action,detail,actor,ts) VALUES (?,?,?,?)').run('approve', JSON.stringify(app), req.user.username||'local_admin', nowSec());
  res.json({status:'approved'});
});

router.post('/reject/:id', authMiddleware, adminOnly, (req,res) => {
  const id = req.params.id;
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
  if (!app) return res.status(404).json({error:'not found'});
  db.prepare('UPDATE applications SET status = ? WHERE id = ?').run('rejected', id);
  db.prepare('INSERT INTO audit_logs (action,detail,actor,ts) VALUES (?,?,?,?)').run('reject', JSON.stringify(app), req.user.username||'local_admin', nowSec());
  res.json({status:'rejected'});
});

module.exports = router;
