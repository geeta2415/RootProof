const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const router = express.Router();

function makeToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!['business', 'owner'].includes(role)) {
    return res.status(400).json({ error: 'Role must be business or owner' });
  }

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email, hash, role]
    );
    const user = result.rows[0];
    res.status(201).json({ token: makeToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }
    res.json({
      token: makeToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const resetResponse = {
  message: 'If an account exists for that email, reset instructions have been sent.',
};

router.post('/forgot-password', async (req, res) => {
  const email = typeof req.body?.email === 'string'
    ? req.body.email.trim()
    : '';

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const userResult = await pool.query(
      'SELECT email FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    // Keep the response the same for unknown and known email addresses.
    if (userResult.rows.length === 0) {
      return res.json(resetResponse);
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPassword) {
      console.error('Password reset email is not configured: SMTP credentials are missing.');
      return res.json(resetResponse);
    }

    const userEmail = userResult.rows[0].email;
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO password_reset_tokens (email, token_hash, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (email)
       DO UPDATE SET token_hash = EXCLUDED.token_hash,
                     expires_at = EXCLUDED.expires_at,
                     created_at = NOW()`,
      [userEmail, tokenHash, expiresAt]
    );

    const clientUrl = (process.env.FRONTEND_URL || 'http://localhost:5173')
      .replace(/\/+$/, '');
    const resetUrl = new URL('/reset-password', clientUrl);
    resetUrl.searchParams.set('token', token);

    const port = Number(process.env.SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE === 'true'
        : port === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || smtpUser,
        to: userEmail,
        subject: 'Reset your RootProof password',
        text: `Use this link to reset your RootProof password. It expires in one hour: ${resetUrl}`,
      });
    } catch (mailError) {
      await pool.query(
        'DELETE FROM password_reset_tokens WHERE email = $1 AND token_hash = $2',
        [userEmail, tokenHash]
      );
      console.error('Password reset email failed:', mailError.message);
    }

    return res.json(resetResponse);
  } catch (err) {
    console.error('Password reset request failed:', err.message);
    return res.status(500).json({ error: 'Could not process password reset request' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};

  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ error: 'Invalid or expired reset link' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tokenResult = await client.query(
      `SELECT email
         FROM password_reset_tokens
        WHERE token_hash = $1 AND expires_at > NOW()
        FOR UPDATE`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const userEmail = tokenResult.rows[0].email;
    const passwordHash = await bcrypt.hash(password, 10);

    const updateResult = await client.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id',
      [passwordHash, userEmail]
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    // Deleting the token makes the reset link single-use.
    await client.query(
      'DELETE FROM password_reset_tokens WHERE email = $1',
      [userEmail]
    );

    await client.query('COMMIT');
    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Password reset failed:', err.message);
    return res.status(500).json({ error: 'Could not reset password' });
  } finally {
    client.release();
  }
});

module.exports = router;
