const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Load .env variables for local development
const dotenvPath = path.join(__dirname, '.env');
if (fs.existsSync(dotenvPath)) {
  const envContent = fs.readFileSync(dotenvPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length > 0 && !process.env[key.trim()]) {
      process.env[key.trim()] = val.join('=').trim();
    }
  });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API fallback route
app.use('/api', async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  const apiPath = path.join(__dirname, 'api', req.path + '.js');
  if (!fs.existsSync(apiPath)) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  try {
    const handler = require(apiPath);
    if (typeof handler === 'function') {
      await handler(req, res);
    } else {
      res.status(500).json({ error: 'API handler is not a function' });
    }
  } catch (err) {
    console.error('[DEV-SERVER] API handler error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Catch all handler: send back index.html for other routes
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Development server running at http://localhost:${PORT}`);
});