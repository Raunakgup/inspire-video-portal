// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const THUMB_DIR = path.join(__dirname, 'thumbnails');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR);

// multer config (store files on disk)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'thumbnail') cb(null, THUMB_DIR);
    else cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // unique filename: timestamp-random-originalname
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB limit (adjust)

// ---------- Profiles ----------

// Create a profile and assign a code (prefer unassigned codes from pool)
app.post('/api/profiles', (req, res) => {
  const { name, mobile, email, type, description } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
  // pick an unassigned code first
  const codeRow = db.prepare('SELECT code FROM codes WHERE assigned = 0 LIMIT 1').get();
  let code;
  const insertProfile = db.prepare('INSERT INTO profiles (name,mobile,email,type,description,code) VALUES (?,?,?,?,?,?)');
  try {
    if (codeRow) {
      code = codeRow.code;
      const tx = db.transaction(() => {
        db.prepare('UPDATE codes SET assigned = 1 WHERE code = ?').run(code);
        const info = insertProfile.run(name, mobile, email, type, description || null, code);
        return info;
      });
      const info = tx();
      return res.json({ success: true, id: info.lastInsertRowid, code });
    } else {
      // fallback: generate a secure code
      code = crypto.randomBytes(4).toString('base64').replace(/[/+=]/g, '').slice(0,8);
      db.prepare('INSERT INTO profiles (name,mobile,email,type,description,code) VALUES (?,?,?,?,?,?)')
        .run(name, mobile, email, type, description || null, code);
      return res.json({ success: true, code });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not create profile' });
  }
});

// Login by code -> return profile
app.post('/api/login', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });
  const row = db.prepare('SELECT id, name, mobile, email, type, description, code FROM profiles WHERE code = ?').get(code);
  if (!row) return res.status(404).json({ error: 'Profile not found' });
  res.json({ success: true, profile: row });
});

// Get profile by id
app.get('/api/profiles/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id, name, mobile, email, type, description, code FROM profiles WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// ---------- Videos ----------

// Upload video (requires code as body param to verify profile_id) — fields: video (file), thumbnail (optional), title, description, code
app.post('/api/videos', upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), (req, res) => {
  const { title, description, code } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  if (!req.files || !req.files.video || req.files.video.length === 0) return res.status(400).json({ error: 'video file required' });

  const profile = db.prepare('SELECT id FROM profiles WHERE code = ?').get(code);
  if (!profile) return res.status(403).json({ error: 'Invalid code — must be logged in to upload' });

  const filename = req.files.video[0].filename;
  const thumbnail = req.files.thumbnail && req.files.thumbnail.length ? req.files.thumbnail[0].filename : null;

  const stmt = db.prepare('INSERT INTO videos (profile_id, title, filename, thumbnail, description) VALUES (?,?,?,?,?)');
  const info = stmt.run(profile.id, title, filename, thumbnail, description || null);
  res.json({ success: true, id: info.lastInsertRowid });
});

// List featured videos (first 10 by created_at) — used for the carousel
app.get('/api/videos/featured', (req, res) => {
  const rows = db.prepare('SELECT id, title, thumbnail, filename FROM videos ORDER BY created_at DESC LIMIT 10').all();
  res.json(rows);
});

// List more videos (paging optional)
app.get('/api/videos', (req, res) => {
  const rows = db.prepare('SELECT v.id, v.title, v.thumbnail, v.description, p.name as uploader_name, v.created_at FROM videos v LEFT JOIN profiles p ON v.profile_id = p.id ORDER BY v.created_at DESC LIMIT 100').all();
  res.json(rows);
});

// Get videos uploaded by a profile code (Your Videos)
app.get('/api/myvideos', (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'code required' });
  const profile = db.prepare('SELECT id FROM profiles WHERE code = ?').get(code);
  if (!profile) return res.status(403).json({ error: 'invalid code' });
  const rows = db.prepare('SELECT id, title, filename, thumbnail, description, created_at FROM videos WHERE profile_id = ? ORDER BY created_at DESC').all(profile.id);
  res.json(rows);
});

// Stream video file (supports range requests)
app.get('/video/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  if (range) {
    // Parse Range
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const contentType = 'video/mp4'; // assume mp4; alternatively detect from extension
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });
    file.pipe(res);
  } else {
    const contentType = 'video/mp4';
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// Serve thumbnails
app.get('/thumb/:filename', (req, res) => {
  const filePath = path.join(THUMB_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  res.sendFile(filePath);
});

// Get single video metadata
app.get('/api/videos/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT v.*, p.name as uploader_name FROM videos v LEFT JOIN profiles p ON v.profile_id = p.id WHERE v.id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Video not found' });
  res.json(row);
});

// ---------- Comments ----------

// Get comments for a video
app.get('/api/videos/:id/comments', (req, res) => {
  const id = Number(req.params.id);
  const rows = db.prepare('SELECT c.id, c.text, c.name, c.profile_id, c.created_at, p.name as profile_name FROM comments c LEFT JOIN profiles p ON c.profile_id = p.id WHERE c.video_id = ? ORDER BY c.created_at ASC').all(id);
  res.json(rows);
});

// Add comment (can include code to attribute to profile)
app.post('/api/videos/:id/comments', (req, res) => {
  const id = Number(req.params.id);
  const { text, name, code } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  let profile_id = null;
  let commenterName = name || null;
  if (code) {
    const profile = db.prepare('SELECT id, name FROM profiles WHERE code = ?').get(code);
    if (profile) {
      profile_id = profile.id;
      commenterName = profile.name;
    }
  }
  const stmt = db.prepare('INSERT INTO comments (video_id, profile_id, name, text) VALUES (?,?,?,?)');
  const info = stmt.run(id, profile_id, commenterName, text);
  res.json({ success: true, id: info.lastInsertRowid, created_at: new Date().toISOString() });
});

// Serve static client
app.use(express.static(path.join(__dirname, 'public')));

// Start
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
