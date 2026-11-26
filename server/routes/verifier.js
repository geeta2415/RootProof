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
// US-23: approve a submission
router.post('/submissions/:id/approve', authenticate, requireRole('verifier'), async (req, res) => {
  const { id } = req.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  const client = await pool.connect();
  let purchaseId;
  try {
    await client.query('BEGIN');

    const found = await client.query(
      `SELECT s.id, s.status AS submission_status, s.purchase_id,
              pr.status AS purchase_status
         FROM verification_submissions s
         JOIN purchase_records pr ON pr.id = s.purchase_id
        WHERE s.id = $1
          FOR UPDATE OF s, pr`,
      [id]
    );

    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Submission not found' });
    }

    const row = found.rows[0];
    if (row.submission_status !== 'pending' || row.purchase_status !== 'under_review') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This submission cannot be approved' });
    }

    purchaseId = row.purchase_id;

    await client.query(
      `UPDATE verification_submissions
          SET status = 'approved', verifier_id = $1, reviewed_at = NOW()
        WHERE id = $2`,
      [req.user.id, id]
    );
    await client.query(
      `UPDATE purchase_records SET status = 'verified' WHERE id = $1`,
      [purchaseId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    return res.status(500).json({ error: 'Approval failed' });
  } finally {
    client.release();
  }

  // Certificate step (Sausan's function). If it is missing or fails,
  // the purchase stays verified and the verifier can retry.
  let generateCertificate = null;
  try {
    ({ generateCertificate } = require('../services/certificate'));
  } catch (e) {
    generateCertificate = null;
  }

  if (!generateCertificate) {
    return res.json({
      purchaseId,
      status: 'verified',
      certificateUrl: null,
      note: 'Certificate service is not available yet',
    });
  }

  try {
    const certificateUrl = await generateCertificate(purchaseId);
    await pool.query(
      `UPDATE purchase_records SET certificate_url = $1, status = 'certified' WHERE id = $2`,
      [certificateUrl, purchaseId]
    );
    res.json({ purchaseId, status: 'certified', certificateUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Approved, but the certificate failed. The purchase stays verified; retry later.',
    });
  }
});
// US-24: reject a submission with a written reason
router.post('/submissions/:id/reject', authenticate, requireRole('verifier'), async (req, res) => {
  const { id } = req.params;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(404).json({ error: 'Submission not found' });
  }
  if (!reason) {
    return res.status(400).json({ error: 'A written reason is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const found = await client.query(
      `SELECT s.id, s.status AS submission_status, s.purchase_id,
              pr.status AS purchase_status
         FROM verification_submissions s
         JOIN purchase_records pr ON pr.id = s.purchase_id
        WHERE s.id = $1
          FOR UPDATE OF s, pr`,
      [id]
    );

    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Submission not found' });
    }

    const row = found.rows[0];
    if (row.submission_status !== 'pending' || row.purchase_status !== 'under_review') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This submission cannot be rejected' });
    }

    await client.query(
      `UPDATE verification_submissions
          SET status = 'rejected', rejection_reason = $1, verifier_id = $2, reviewed_at = NOW()
        WHERE id = $3`,
      [reason, req.user.id, id]
    );

    const count = await client.query(
      `SELECT COUNT(*)::int AS n
         FROM verification_submissions
        WHERE purchase_id = $1 AND status = 'rejected'`,
      [row.purchase_id]
    );

    let purchaseStatus;
    if (count.rows[0].n >= 2) {
      // Second rejection: cancel the purchase and return the units,
      // inside this same transaction (Sausan's function).
      let cancelPurchase = null;
      try {
        ({ cancelPurchase } = require('../services/cancel'));
      } catch (e) {
        cancelPurchase = null;
      }
      if (!cancelPurchase) {
        await client.query('ROLLBACK');
        return res.status(503).json({ error: 'Cancel service is not available yet' });
      }
      await cancelPurchase(row.purchase_id, client);
      purchaseStatus = 'cancelled';
    } else {
      // First rejection: back to pending so the owner can upload again.
      await client.query(
        `UPDATE purchase_records SET status = 'pending' WHERE id = $1`,
        [row.purchase_id]
      );
      purchaseStatus = 'pending';
    }

    await client.query('COMMIT');
    res.json({ purchaseId: row.purchase_id, purchaseStatus });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Rejection failed' });
  } finally {
    client.release();
  }
});
module.exports = router;