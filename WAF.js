const express = require('express');
const rateLimit = require('express-rate-limit');
const requestIp = require('request-ip');
const geoip = require('geoip-lite');

const app = express();

// Rate Limiting: Max 10 requests per minute per IP
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: "Too many requests, slow down!",
});

app.use(limiter);

// Middleware: Detect Proxies & Block Suspicious IPs
app.use((req, res, next) => {
  const clientIp = requestIp.getClientIp(req); // Get real client IP
  const geo = geoip.lookup(clientIp);

  // Block known proxy/VPN IPs
  if (geo && geo.country === 'Anonymous Proxy') {
    return res.status(403).send('Access denied');
  }


  
  // Block if User-Agent rotates too frequently
  const suspiciousAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'Mozilla/5.0 (Linux; Android 11; SM-G991B)',
  ];
  
  if (suspiciousAgents.includes(req.headers['user-agent'])) {
    return res.status(403).send('Bot detected!');
  }

  next();
});

app.get('/', (req, res) => {
  res.send('Welcome to the protected site.');
});

app.listen(3000, () => console.log('Server running on port 3000'));
