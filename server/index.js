const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const browseRoutes = require('./routes/browse');
const purchaseRoutes = require('./routes/purchases');
const projectRoutes = require('./routes/projects');
const verifierRoutes = require('./routes/verifier');
const pool = require('./db');
const ownerRoutes = require('./routes/owner');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/browse', browseRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/verifier', verifierRoutes);

app.use('/api/owner', ownerRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'RootProof API' });
});

app.get('/api/db-check', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM users');
    res.json({ db: 'connected', users: result.rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ db: 'error', message: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));