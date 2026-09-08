const express = require('express');
const router = express.Router();
const db = require('../db');
const { genToken, nowSec } = require('../utils');
const { v4: uuidv4 } = require('uuid');

router.post('/create-invite', (req,res) => {
  const { nwid, created_by, ttl=600 } = req.body;
  if (!nwid) return res.status(400).json({error:'nwid required'});
  const payload = `${nwid}|${created_by}|${nowSec()}|${uuidv4()}`;
  const token = genToken(payload);
  const expires = nowSec() + parseInt(ttl,10);
  db.prepare('INSERT INTO invites (token,nwid,expires_at,uses_left,created_by,created_at) VALUES (?,?,?,?,?,?)')
    .run(token, nwid, expires, 1, created_by || 'admin', nowSec());
  db.prepare('INSERT INTO audit_logs (action,detail,actor,ts) VALUES (?,?,?,?)').run('create_invite', JSON.stringify({nwid,token,expires}), created_by || 'admin', nowSec());
  res.json({token, nwid, expires});
});

module.exports = router;
