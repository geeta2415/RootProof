const express = require('express');
const multer = require('multer');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadToCloudinary } = require('../services/upload');

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROOF_TYPES = ['photo', 'gps', 'receipt'];

// Keep the file in memory (max 5 MB), then send it to Cloudinary
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function readFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File must be 5 MB or smaller' });
      }
      return res.status(400).json({ error: 'Could not read the uploaded file' });
    }
    next();
  });
}

// US-20 and US-26: upload proof (also used to resubmit after a first rejection)
router.post('/purchases/:id/proof', authenticate, requireRole('owner'), readFile, async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Purchase not found' });

  const proofType = req.body.proofType;
  if (!PROOF_TYPES.includes(proofType)) {
    return res.status(400).json({ error: 'proofType must be photo, gps or receipt' });
  }
  if (!req.file) return res.status(400).json({ error: 'A file is required' });
  const okType = req.file.mimetype.startsWith('image/') || req.file.mimetype === 'application/pdf';
  if (!okType) return res.status(400).json({ error: 'Only images and PDF files are allowed' });

  const notes = req.body.notes ? String(req.body.notes).trim() : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the purchase row so two uploads cannot happen at once
    const found = await client.query(
      `SELECT pr.id, pr.status, p.owner_id
       FROM purchase_records pr
       JOIN offset_projects p ON p.id = pr.project_id
       WHERE pr.id = $1
       FOR UPDATE OF pr`,
      [id]
    );
    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase not found' });
    }
    const purchase = found.rows[0];
    if (purchase.owner_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'This purchase is not on one of your projects' });
    }
    if (purchase.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Proof can only be uploaded for a pending purchase' });
    }
    const count = await client.query(
      'SELECT COUNT(*)::int AS n FROM verification_submissions WHERE purchase_id = $1',
      [id]
    );
    if (count.rows[0].n >= 2) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This purchase already has 2 submissions' });
    }

    const url = await uploadToCloudinary(req.file.buffer, req.file.mimetype);

    const inserted = await client.query(
      `INSERT INTO verification_submissions (purchase_id, proof_type, proof_file_url, submitted_at, status, notes)
       VALUES ($1, $2, $3, NOW(), 'pending', $4)
       RETURNING *`,
      [id, proofType, url, notes]
    );
    await client.query(`UPDATE purchase_records SET status = 'under_review' WHERE id = $1`, [id]);
    await client.query('COMMIT');
    res.status(201).json({ submission: inserted.rows[0], purchaseStatus: 'under_review' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;