PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY,
  assigned INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  type TEXT CHECK(type IN ('student','working')) NOT NULL,
  description TEXT,
  code TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(code) REFERENCES codes(code)
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  thumbnail TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  profile_id INTEGER,
  name TEXT,
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(video_id) REFERENCES videos(id),
  FOREIGN KEY(profile_id) REFERENCES profiles(id)
);
