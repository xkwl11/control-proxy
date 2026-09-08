const express = require('express');
const router = express.Router();
const controller = require('../utils/controller');

// proxy any /controller/* request to the real controller
router.all('/*', async (req, res) => {
  try {
    const path = req.originalUrl.replace(/^\/controller/, '');
    const method = req.method.toUpperCase();
    const body = (method === 'GET' || method === 'DELETE') ? undefined : req.body;
    let r;
    if (method === 'GET') r = await controller.get(`/controller${path}`);
    else if (method === 'POST') r = await controller.post(`/controller${path}`, body);
    else if (method === 'DELETE') r = await controller.del(`/controller${path}`);
    else r = await controller.post(`/controller${path}`, body);
    res.status(r.status || 200).set(r.headers || {}).send(r.data);
  } catch (err) {
    console.error('controller proxy error', err?.response?.data || err?.message);
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: err.message };
    res.status(status).json(data);
  }
});

module.exports = router;
