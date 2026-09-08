const crypto = require('crypto');
const SECRET = process.env.SERVER_SECRET || 'replace_this_secret';

function genToken(payload) {
  const h = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return h;
}
function nowSec(){ return Math.floor(Date.now()/1000); }
module.exports = { genToken, nowSec };
