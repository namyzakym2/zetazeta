const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = require('../asyncRouter')(express.Router({ mergeParams: true }));
const multer = require('multer');
const { ensureAuth } = require('../middleware');
const { isConfigured, uploadBuffer } = require('../utils/cloudinary');

// Memory storage — the file never touches disk, it goes straight to Cloudinary as a
// Buffer. Works identically whether it's a phone camera photo, a phone gallery pick,
// or a desktop file dialog — the browser's <input type="file"> handles all of those,
// this endpoint just sees bytes + a mimetype either way.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB — generous for a phone photo, still safe
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('نوع الملف غير مدعوم — الصيغ المسموحة: PNG, JPG, WEBP, GIF.'));
    }
    cb(null, true);
  }
});

/**
 * POST /api/upload
 * Body: multipart/form-data, field name "image"
 * Optional query/body "folder" to organize uploads (e.g. ticket panels vs embeds).
 * Requires login (ensureAuth) — any authenticated dashboard user can upload; the
 * resulting URL is only ever *saved* somewhere if a later, already-guarded save
 * route (ensureGuildAdmin etc.) accepts it, so this alone can't modify server settings.
 */
router.post('/', ensureAuth, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      const msg = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? 'حجم الصورة أكبر من الحد المسموح (8MB).'
        : err.message || 'فشل رفع الملف.';
      return res.status(400).json({ success: false, error: msg });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'ما فيه ملف مرفوع.' });
    }

    try {
      const folder = (req.body.folder || 'misc').replace(/[^a-zA-Z0-9_\-]/g, '') || 'misc';
      // Prefer Cloudinary when configured. Otherwise keep uploads locally so the
      // dashboard's upload button works out of the box on normal bot hosting.
      if (isConfigured()) {
        const result = await uploadBuffer(req.file.buffer, `zeta/${folder}`);
        return res.json({ success: true, url: result.secure_url || result.url, storage: 'cloudinary' });
      }

      const ext = ({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'})[req.file.mimetype] || 'png';
      const dir = path.join(__dirname, '..', 'public', 'uploads', folder);
      await fs.promises.mkdir(dir, { recursive: true });
      const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
      await fs.promises.writeFile(path.join(dir, filename), req.file.buffer);
      return res.json({ success: true, url: `/dashboard/uploads/${folder}/${filename}`, storage: 'local' });
    } catch (uploadErr) {
      console.error('Image upload error:', uploadErr);
      res.status(500).json({ success: false, error: 'فشل حفظ الصورة، حاول مرة ثانية.' });
    }
  });
});

module.exports = router;
