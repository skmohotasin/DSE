const axios = require('axios');
const https = require('https');

// dsebd.org serves an incomplete TLS chain; Node rejects it on Windows and GitHub Actions.
const http = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  },
});

module.exports = http;
