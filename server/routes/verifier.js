const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// US-21: pending submissions for review, oldest first
router.get('/submissions', authenticate, requireRole('verifier'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.purchase_id, s.proof_type, s.proof_file_url, s.submitted_at,
              p.title AS project_title,
              b.name AS business_name,
              o.name AS owner_name,
              pr.units_purchased, p.unit_label,
              (SELECT COUNT(*)::int
                 FROM verification_submissions s2
                WHERE s2.purchase_id = s.purchase_id
                  AND s2.submitted_at <= s.submitted_at) AS attempt
         FROM verification_submissions s
         JOIN purchase_records pr ON pr.id = s.purchase_id
         JOIN offset_projects p ON p.id = pr.project_id
         JOIN users b ON b.id = pr.business_id
         JOIN users o ON o.id = p.owner_id
        WHERE s.status = 'pending'
          AND pr.status = 'under_review'
        ORDER BY s.submitted_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load submissions' });
  }
});
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// US-22: one submission for review
router.get('/submissions/:id', authenticate, requireRole('verifier'), async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Submission not found' });
  try {
    const result = await pool.query(
      `SELECT s.id, s.purchase_id, s.proof_type, s.proof_file_url, s.submitted_at,
              p.title AS project_title,
              b.name AS business_name,
              o.name AS owner_name,
              pr.units_purchased, p.unit_label,
              (SELECT COUNT(*)::int
                 FROM verification_submissions s2
                WHERE s2.purchase_id = s.purchase_id
                  AND s2.submitted_at <= s.submitted_at) AS attempt
         FROM verification_submissions s
         JOIN purchase_records pr ON pr.id = s.purchase_id
         JOIN offset_projects p ON p.id = pr.project_id
         JOIN users b ON b.id = pr.business_id
         JOIN users o ON o.id = p.owner_id
        WHERE s.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load submission' });
  }
});

module.exports = router;