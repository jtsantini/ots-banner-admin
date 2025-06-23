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

// 1) List images
app.get('/images', async (req, res) => {
  try {
    console.log('Listing resources with prefix:', 'banner_images');
    const result = await cloudinary.api.resources({
      resource_type: 'image',
      type: 'upload',
      prefix: 'banner_images',    // drop the trailing slash
      max_results: 100,
    });
    console.log('Cloudinary result.resources:', result.resources.length, 'items');
    const urls = result.resources.map(r => r.secure_url);
    console.log('Returning URLs:', urls);
    res.json(urls);
  } catch (err) {
    console.error('Error fetching /images →', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Admin server listening on http://localhost:3000'));
