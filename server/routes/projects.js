const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Validate the editable fields. Returns an error string or null.
function validate(p) {
  const text = ['title', 'description', 'project_type', 'location', 'unit_label'];
  for (const f of text) {
    if (typeof p[f] !== 'string' || p[f].trim() === '') return `${f} is required`;
  }
  const cost = Number(p.cost_per_unit);
  if (!Number.isFinite(cost) || cost <= 0) return 'cost_per_unit must be greater than 0';
  const units = Number(p.total_units_available);
  if (!Number.isInteger(units) || units <= 0) return 'total_units_available must be a whole number greater than 0';
  return null;
}

// US-09 Create project
router.post('/', authenticate, requireRole('owner'), async (req, res) => {
  try {
    const err = validate(req.body);
    if (err) return res.status(400).json({ error: err });
    const { title, description, project_type, location, cost_per_unit, total_units_available, unit_label } = req.body;
    const result = await pool.query(
      `INSERT INTO offset_projects
        (title, description, project_type, location, cost_per_unit,
         total_units_available, units_remaining, unit_label, status, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7,'active',$8)
       RETURNING *`,
      [title.trim(), description.trim(), project_type.trim(), location.trim(),
       Number(cost_per_unit), Number(total_units_available), unit_label.trim(), req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// US-10 List my projects (must be before /:id routes)
router.get('/mine', authenticate, requireRole('owner'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *, (total_units_available - units_remaining) AS units_sold
       FROM offset_projects
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// US-11 Edit project
router.put('/:id', authenticate, requireRole('owner'), async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Project not found' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the row so a concurrent purchase cannot change units while we edit
    const found = await client.query('SELECT * FROM offset_projects WHERE id = $1 FOR UPDATE', [id]);
    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }
    const current = found.rows[0];
    if (current.owner_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only edit your own projects' });
    }
    const merged = { ...current, ...req.body };
    const err = validate(merged);
    if (err) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: err });
    }
    const sold = current.total_units_available - current.units_remaining;
    const newTotal = Number(merged.total_units_available);
    if (newTotal < sold) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Total units cannot be less than units already sold (${sold})` });
    }
    const result = await client.query(
      `UPDATE offset_projects
       SET title=$1, description=$2, project_type=$3, location=$4, cost_per_unit=$5,
           total_units_available=$6, units_remaining=$7, unit_label=$8
       WHERE id=$9
       RETURNING *`,
      [merged.title.trim(), merged.description.trim(), merged.project_type.trim(),
       merged.location.trim(), Number(merged.cost_per_unit), newTotal, newTotal - sold,
       merged.unit_label.trim(), id]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// US-12 Close project
router.patch('/:id/close', authenticate, requireRole('owner'), async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Project not found' });
  try {
    const found = await pool.query('SELECT owner_id, status FROM offset_projects WHERE id = $1', [id]);
    if (found.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    if (found.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only close your own projects' });
    }
    if (found.rows[0].status === 'closed') {
      return res.status(409).json({ error: 'Project is already closed' });
    }
    const result = await pool.query(
      `UPDATE offset_projects SET status = 'closed' WHERE id = $1 RETURNING *`,
      [id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// US-13 Delete project (only if it has no purchases)
router.delete('/:id', authenticate, requireRole('owner'), async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Project not found' });
  try {
    const found = await pool.query('SELECT owner_id FROM offset_projects WHERE id = $1', [id]);
    if (found.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    if (found.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own projects' });
    }
    const purchases = await pool.query(
      'SELECT COUNT(*)::int AS n FROM purchase_records WHERE project_id = $1',
      [id]
    );
    if (purchases.rows[0].n > 0) {
      return res.status(409).json({ error: 'This project has purchases and cannot be deleted. Close it instead.' });
    }
    await pool.query('DELETE FROM offset_projects WHERE id = $1', [id]);
    res.json({ message: 'Project deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;