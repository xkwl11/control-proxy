const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const applyRoutes = require('./routes/apply');
const joinRoutes = require('./routes/join');
const adminRoutes = require('./routes/admin');
const inviteRoutes = require('./routes/invite');

const app = express();
app.use(helmet());
app.use(morgan('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/api', applyRoutes);
app.use('/api', joinRoutes);
app.use('/api', inviteRoutes);

app.use('/admin', function(req,res,next){
  const ip = req.ip || req.connection.remoteAddress;
  if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') return next();
  res.status(403).send('Admin UI only accessible from localhost');
});
app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 8443;
app.listen(PORT, () => {
  console.log(`control-proxy listening on ${PORT}`);
});
