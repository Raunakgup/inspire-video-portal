// db.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.sqlite');
const db = new Database(DB_FILE);

// initialize schema if needed
const initSql = fs.readFileSync(path.join(__dirname, 'init-db.sql'), 'utf8');
db.exec(initSql);

// load codes.json into codes table if codes table empty
const codesCount = db.prepare('SELECT count(*) as c FROM codes').get().c;
if (codesCount === 0) {
  const codes = JSON.parse(fs.readFileSync(path.join(__dirname, 'codes.json')));
  const insert = db.prepare('INSERT INTO codes (code, assigned) VALUES (?, 0)');
  const insertMany = db.transaction((arr) => {
    for (const c of arr) insert.run(c);
  });
  insertMany(codes);
}

module.exports = db;
