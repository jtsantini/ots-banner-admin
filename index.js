require('dotenv').config({ path: 'cloudinary-credentials.env' });
const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
app.use(cors());
app.use(express.static('public')); // serve our frontend from /public

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// On startup, ensure our table exists
pool.query(`
  CREATE TABLE IF NOT EXISTS texts (
    position  INT PRIMARY KEY,
    content   TEXT    NOT NULL
  );
`).catch(err => console.error('Error creating texts table:', err));

// 1) List images
app.get('/images', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'banner_images',
      max_results: 100,
    });
    // now return an array of objects:
    const imgs = result.resources.map(r => ({
      url:       r.secure_url,
      public_id: r.public_id
    }));
    res.json(imgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/images/:public_id', async (req, res) => {
  try {
    const { public_id } = req.params;
    // destroy the image on Cloudinary:
    const result = await cloudinary.uploader.destroy(public_id, { invalidate: true });
    res.json(result);
  } catch (err) {
    console.error('Error deleting image:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2) GET /texts → return an array of 6 strings (in order)
app.get('/texts', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT position, content FROM texts ORDER BY position'
    );
    // Build array with empty strings for any missing slots:
    const texts = Array(6).fill('');
    for (let { position, content } of rows) {
      if (position >= 1 && position <= 6) texts[position-1] = content;
    }
    res.json(texts);
  } catch (err) {
    console.error('Error GET /texts:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3) POST /texts → accept JSON array of 6 strings and upsert them
app.post('/texts', express.json(), async (req, res) => {
  const texts = Array.isArray(req.body) ? req.body : [];
  if (texts.length > 6) return res.status(400).json({ error: 'Max 6 entries' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < 6; i++) {
      const content = texts[i] || '';
      await client.query(`
        INSERT INTO texts(position, content)
          VALUES($1, $2)
        ON CONFLICT(position)
          DO UPDATE SET content = EXCLUDED.content
      `, [i+1, content]);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error POST /texts:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.listen(3000, () => console.log('Admin server listening on http://localhost:3000'));
