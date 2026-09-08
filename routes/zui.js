const express = require('express');
const router = express.Router();
const db = require('../db');
const controller = require('../utils/controller');
const { v4: uuidv4 } = require('uuid');
const { nowSec, genToken } = require('../utils');
const { authMiddleware, adminOnly } = require('./auth');

// List networks (controller)
router.get('/networks', authMiddleware, async (req,res) => {
  try{
    const r = await controller.get('/controller/network');
    res.json(r.data);
  }catch(err){
    console.error(err?.response?.data || err.message);
    res.status(500).json({ error: 'controller call failed', detail: err?.response?.data || err.message });
  }
});

// Create network
router.post('/networks', authMiddleware, adminOnly, async (req,res) => {
  const body = req.body || {};
  try{
    const r = await controller.post('/controller/network', body);
    // try to get nwid from response or from Location
    const nwid = r.data && r.data.id ? r.data.id : (r.data && r.data.nwid ? r.data.nwid : null);
    const id = uuidv4();
    db.prepare('INSERT INTO networks (id,nwid,name,created_by,created_at) VALUES (?,?,?,?,?)').run(id, nwid || '', body.name || '', req.user.username, nowSec());
    db.prepare('INSERT INTO audit_logs (action,detail,actor,ts) VALUES (?,?,?,?)').run('create_network', JSON.stringify({nwid,body}), req.user.username, nowSec());
    res.json({ ok:true, nwid: nwid, raw: r.data });
  }catch(err){
    console.error(err?.response?.data || err.message);
    res.status(500).json({ error: 'controller call failed', detail: err?.response?.data || err.message });
  }
});

// Get network members
router.get('/networks/:nwid/members', authMiddleware, async (req,res) => {
  const nwid = req.params.nwid;
  try{
    const r = await controller.get(`/controller/network/${nwid}/member`);
    res.json(r.data);
  }catch(err){
    console.error(err?.response?.data || err.message);
    res.status(500).json({ error: 'controller call failed', detail: err?.response?.data || err.message });
  }
});

// Authorize a member (set auth true)
router.post('/networks/:nwid/members/:nodeid/authorize', authMiddleware, adminOnly, async (req,res) => {
  const { nwid, nodeid } = req.params;
  try{
    const body = { id: nodeid, auth: true };
    const r = await controller.post(`/controller/network/${nwid}/member/${nodeid}`, body);
    db.prepare('INSERT INTO audit_logs (action,detail,actor,ts) VALUES (?,?,?,?)').run('authorize_member', JSON.stringify({nwid,nodeid}), req.user.username, nowSec());
    res.json({ ok:true, raw: r.data });
  }catch(err){
    console.error(err?.response?.data || err.message);
    res.status(500).json({ error: 'controller call failed', detail: err?.response?.data || err.message });
  }
});

// Revoke a member (set auth false)
router.post('/networks/:nwid/members/:nodeid/revoke', authMiddleware, adminOnly, async (req,res) => {
  const { nwid, nodeid } = req.params;
  try{
    const body = { id: nodeid, auth: false };
    const r = await controller.post(`/controller/network/${nwid}/member/${nodeid}`, body);
    db.prepare('INSERT INTO audit_logs (action,detail,actor,ts) VALUES (?,?,?,?)').run('revoke_member', JSON.stringify({nwid,nodeid}), req.user.username, nowSec());
    res.json({ ok:true, raw: r.data });
  }catch(err){
    console.error(err?.response?.data || err.message);
    res.status(500).json({ error: 'controller call failed', detail: err?.response?.data || err.message });
  }
});

// List invites
router.get('/invites', authMiddleware, async (req,res) => {
  const rows = db.prepare('SELECT token,nwid,expires_at,uses_left,created_by,created_at FROM invites').all();
  res.json(rows);
});

// Create invite (wrap existing logic) - allow admin or authenticated user
router.post('/invites', authMiddleware, async (req,res) => {
  const { nwid, ttl=600, uses_left=1 } = req.body;
  if (!nwid) return res.status(400).json({ error: 'nwid required' });
  const payload = `${nwid}|${req.user.username}|${nowSec()}|${uuidv4()}`;
  const token = genToken(payload);
  const expires = nowSec() + parseInt(ttl,10);
  db.prepare('INSERT INTO invites (token,nwid,expires_at,uses_left,created_by,created_at) VALUES (?,?,?,?,?,?)')
    .run(token, nwid, expires, uses_left, req.user.username, nowSec());
  db.prepare('INSERT INTO audit_logs (action,detail,actor,ts) VALUES (?,?,?,?)').run('create_invite', JSON.stringify({nwid,token,expires,uses_left}), req.user.username, nowSec());
  res.json({ token, nwid, expires, uses_left });
});

// List audit logs (admin)
router.get('/audit-logs', authMiddleware, adminOnly, (req,res) => {
  const rows = db.prepare('SELECT id,action,detail,actor,ts FROM audit_logs ORDER BY ts DESC LIMIT 1000').all();
  res.json(rows);
});

module.exports = router;
