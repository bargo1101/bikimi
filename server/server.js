const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Temporary storage for uploaded files
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit enforced server-side
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WEBP allowed.'));
    }
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Backend running' });
});

// ==================== HELIUS RPC PROXY ====================
// Proxies RPC requests so the Helius API key never touches the frontend
app.post('/rpc/:network', async (req, res) => {
  const { network } = req.params;

  let rpcUrl;
  if (network === 'mainnet-beta') {
    rpcUrl = process.env.HELIUS_MAINNET_URL;
  } else if (network === 'devnet') {
    rpcUrl = process.env.HELIUS_DEVNET_URL;
  } else {
    return res.status(400).json({ error: `Unknown network: ${network}` });
  }

  if (!rpcUrl) {
    return res.status(500).json({ error: `RPC URL not configured for ${network}` });
  }

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('RPC proxy error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== UPLOAD IMAGE TO PINATA ====================
app.post('/upload-image', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    filePath = file.path;

    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.path));
    formData.append('pinataMetadata', JSON.stringify({
      name: file.originalname
    }));

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        pinata_api_key: process.env.PINATA_API_KEY,
        pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY
      },
      body: formData
    });

    const data = await response.json();

    if (!data.IpfsHash) {
      throw new Error('Pinata did not return an IPFS hash');
    }

    res.json({
      url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`
    });

  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    // Always clean up temp file whether success or failure
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

// ==================== UPLOAD METADATA TO PINATA ====================
app.post('/upload-metadata', async (req, res) => {
  try {
    const metadata = req.body;

    if (!metadata || !metadata.name || !metadata.symbol) {
      return res.status(400).json({ error: 'Missing required metadata fields' });
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        pinata_api_key: process.env.PINATA_API_KEY,
        pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY
      },
      body: JSON.stringify({
        pinataMetadata: { name: `${metadata.name} Metadata` },
        pinataContent: metadata
      })
    });

    const data = await response.json();

    if (!data.IpfsHash) {
      throw new Error('Pinata did not return an IPFS hash');
    }

    res.json({
      url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`
    });

  } catch (err) {
    console.error('Metadata upload error:', err);
    res.status(500).json({ error: err.message });
  }
});
// ==================== JUPITER PROXY ====================

const JUPITER_API = 'https://api.jup.ag/swap/v1';

// Jupiter quote proxy
app.get('/jupiter/quote', async (req, res) => {
  try {
    const { inputMint, outputMint, amount, slippageBps } = req.query;

    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({ error: 'Missing required query params' });
    }

    const response = await fetch(
      `${JUPITER_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps || 50}`
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Jupiter quote error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Jupiter swap proxy
app.post('/jupiter/swap', async (req, res) => {
  try {
    const response = await fetch(`${JUPITER_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Jupiter swap error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message });
});

app.listen(3001, () => {
  console.log('Server running on port 3001');
  console.log('Helius Devnet:', process.env.HELIUS_DEVNET_URL ? '✓ Configured' : '✗ Missing');
  console.log('Helius Mainnet:', process.env.HELIUS_MAINNET_URL ? '✓ Configured' : '✗ Missing');
  console.log('Pinata:', process.env.PINATA_API_KEY ? '✓ Configured' : '✗ Missing');
});
