'use strict';
// Explicit one-time normalization using the extension defaults. No Git operations.
const fs = require('node:fs');
const { normalizeNotebook } = require('../src/cleaner');
let changed = 0;
for (const file of process.argv.slice(2)) {
  const before = fs.readFileSync(file, 'utf8');
  const notebook = JSON.parse(before);
  const cleaned = normalizeNotebook(notebook);
  if (JSON.stringify(notebook) === JSON.stringify(cleaned)) continue;
  if (fs.readFileSync(file, 'utf8') !== before) throw new Error(`Concurrent edit: ${file}`);
  const temporary = `${file}.cleaner-${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(cleaned, null, 1) + '\n', { flag: 'wx' });
    if (fs.readFileSync(file, 'utf8') !== before) throw new Error(`Concurrent edit: ${file}`);
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  changed++;
}
console.log(`Normalized ${changed} of ${process.argv.length - 2} notebooks.`);
