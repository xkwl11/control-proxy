const fs = require('fs');
const axios = require('axios');

const CONTROLLER_URL = process.env.CONTROLLER_URL || 'http://localhost:9993';

function readAuthToken(){
  try{
    if (process.env.AUTHTOKEN) return process.env.AUTHTOKEN.trim();
    const p = '/secrets/authtoken.secret';
    if (fs.existsSync(p)) return fs.readFileSync(p,'utf8').trim();
  } catch(e){}
  return null;
}

function makeHeaders(){
  const t = readAuthToken();
  const h = { 'Content-Type':'application/json' };
  if (t) h['X-ZT1-Auth'] = t;
  return h;
}

async function get(path){
  const url = `${CONTROLLER_URL}${path}`;
  return axios.get(url, { headers: makeHeaders() });
}
async function post(path, body){
  const url = `${CONTROLLER_URL}${path}`;
  return axios.post(url, body, { headers: makeHeaders() });
}
async function del(path){
  const url = `${CONTROLLER_URL}${path}`;
  return axios.delete(url, { headers: makeHeaders() });
}

module.exports = { get, post, del, CONTROLLER_URL };
