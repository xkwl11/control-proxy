const express = require('express');
const router = express.Router();
const db = require('../db');
const { nowSec } = require('../utils');
const axios = require('axios');

function getTokenRow(token){ return db.prepare('SELECT * FROM invites WHERE token = ?').get(token); }

router.post('/join-with-invite', async (req,res) => {
  const { token, nodeid, device_info } = req.body;
  if (!token || !nodeid) return res.status(400).json({error:'token and nodeid required'});
  const row = getTokenRow(token);
  if (!row) return res.status(400).json({error:'invalid token'});
  if (row.expires_at < nowSec()) return res.status(400).json({error:'token expired'});
  if (row.uses_left <= 0) return res.status(400).json({error:'token already used'});
  try {
    const authtoken = require('fs').readFileSync('/secrets/authtoken.secret','utf8').trim();
    const url = `http://localhost:9993/controller/network/${row.nwid}/member/${nodeid}`;
    const body = { id: nodeid, auth: true };
    await axios.post(url, body, { headers: { 'Content-Type':'application/json', 'X-ZT1-Auth': authtoken } });
    db.prepare('UPDATE invites SET uses_left = uses_left - 1 WHERE token = ?').run(token);
    db.prepare('INSERT INTO audit_logs (action,detail,actor,ts) VALUES (?,?,?,?)').run('join', JSON.stringify({token,nodeid,device_info}), 'system', nowSec());
    res.json({status:'ok'});
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({error:'controller call failed', detail: err?.response?.data || err.message});
  }
});

module.exports = router;
