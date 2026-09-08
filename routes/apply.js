const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { nowSec } = require('../utils');

router.post('/apply', (req,res) => {
  const id = uuidv4();
  const { name, email, phone, purpose } = req.body;
  if (!name || !purpose) return res.status(400).json({error:'name and purpose required'});
  const stmt = db.prepare('INSERT INTO applications (id,name,email,phone,purpose,status,created_at) VALUES (?,?,?,?,?,?,?)');
  stmt.run(id, name, email||'', phone||'', purpose, 'pending', nowSec());
  db.prepare('INSERT INTO audit_logs (action,detail,actor,ts) VALUES (?,?,?,?)').run('apply', JSON.stringify(req.body), name, nowSec());
  res.json({id, status:'pending'});
});

router.get('/apply/:id/status', (req,res) => {
  const row = db.prepare('SELECT id,name,status,created_at FROM applications WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({error:'not found'});
  res.json(row);
});

module.exports = router;
