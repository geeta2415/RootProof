const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/browse/projects
// Active listings with units remaining. Optional filters, all combinable:
// ?type=tree planting&location=Karachi&minPrice=100&maxPrice=1000
router.get('/projects', authenticate, requireRole('business'), async (req, res) => {
  try {
    const { type, location, minPrice, maxPrice } = req.query;

    const conditions = ["p.status = 'active'", 'p.units_remaining > 0'];
    const values = [];

    if (type) {
      values.push(type);
      conditions.push(`LOWER(p.project_type) = LOWER($${values.length})`);
    }

    if (location) {
      values.push(`%${location}%`);
      conditions.push(`p.location ILIKE $${values.length}`);
    }

    if (minPrice !== undefined && minPrice !== '') {
      const min = Number(minPrice);
      if (Number.isNaN(min) || min < 0) {
        return res.status(400).json({ error: 'minPrice must be a non-negative number' });
      }
      values.push(min);
      conditions.push(`p.cost_per_unit >= $${values.length}`);
    }

    if (maxPrice !== undefined && maxPrice !== '') {
      const max = Number(maxPrice);
      if (Number.isNaN(max) || max < 0) {
        return res.status(400).json({ error: 'maxPrice must be a non-negative number' });
      }
      values.push(max);
      conditions.push(`p.cost_per_unit <= $${values.length}`);
    }

    const result = await pool.query(
      `SELECT p.id, p.title, p.description, p.project_type, p.location,
              p.cost_per_unit, p.total_units_available, p.units_remaining,
              p.unit_label, p.status, p.created_at,
              u.name AS owner_name
         FROM offset_projects p
         JOIN users u ON u.id = p.owner_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.created_at DESC`,
      values
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

// GET /api/browse/projects/:id
// Full details of one active listing, including the owner's name.
router.get('/projects/:id', authenticate, requireRole('business'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!UUID_RE.test(id)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await pool.query(
      `SELECT p.id, p.title, p.description, p.project_type, p.location,
              p.cost_per_unit, p.total_units_available, p.units_remaining,
              p.unit_label, p.status, p.created_at,
              u.name AS owner_name
         FROM offset_projects p
         JOIN users u ON u.id = p.owner_id
        WHERE p.id = $1 AND p.status = 'active'`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load project' });
  }
});

module.exports = router;
