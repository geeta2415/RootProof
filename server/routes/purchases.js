const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/purchases
// Body: { projectId, quantity }
// Runs as ONE transaction. The project row is locked with FOR UPDATE so two
// businesses buying at the same moment cannot oversell the same units.
router.post('/', authenticate, requireRole('business'), async (req, res) => {
  const { projectId, quantity } = req.body || {};
  const qty = Number(quantity);

  if (!projectId || !UUID_RE.test(projectId)) {
    return res.status(400).json({ error: 'A valid projectId is required' });
  }
  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ error: 'quantity must be a whole number of at least 1' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the project row until this transaction finishes
    const projectResult = await client.query(
      `SELECT id, cost_per_unit, units_remaining, status
         FROM offset_projects
        WHERE id = $1
          FOR UPDATE`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    if (project.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This project is closed and no longer accepting purchases' });
    }

    if (qty > project.units_remaining) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Only ${project.units_remaining} units remaining`,
      });
    }

    // Reserve the units immediately
    await client.query(
      `UPDATE offset_projects
          SET units_remaining = units_remaining - $1
        WHERE id = $2`,
      [qty, projectId]
    );

    // Work in whole cents to avoid floating point rounding errors
    const totalCost = (Math.round(parseFloat(project.cost_per_unit) * 100) * qty) / 100;

    const purchaseResult = await client.query(
      `INSERT INTO purchase_records
         (business_id, project_id, units_purchased, total_cost, status, purchase_date)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING id, business_id, project_id, units_purchased, total_cost, status, purchase_date`,
      [req.user.id, projectId, qty, totalCost]
    );

    await client.query('COMMIT');
    res.status(201).json(purchaseResult.rows[0]);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error(rollbackErr);
    }
    console.error(err);
    res.status(500).json({ error: 'Purchase failed' });
  } finally {
    client.release();
  }
});

// GET /api/purchases/mine
// The logged-in business's own purchases, newest first, with project title and status.
router.get('/mine', authenticate, requireRole('business'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pr.id, pr.project_id, pr.units_purchased, pr.total_cost,
              pr.status, pr.purchase_date, pr.certificate_url,
              p.title AS project_title, p.unit_label
         FROM purchase_records pr
         JOIN offset_projects p ON p.id = pr.project_id
        WHERE pr.business_id = $1
        ORDER BY pr.purchase_date DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load purchases' });
  }
});

module.exports = router;
