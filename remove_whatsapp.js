const fs = require('fs');

// 1. Clean server.js
let serverJs = fs.readFileSync('server.js', 'utf8');
const lines = serverJs.split('\n');

// We want to keep:
// - Lines 1 to 640 (0-indexed: 0 to 639)
// - Lines 699 to 701 (0-indexed: 698 to 700)
// This will remove all WhatsApp webhook endpoints and helper functions!

const cleanLines = [
  ...lines.slice(0, 640),
  ...lines.slice(698, 701)
];

fs.writeFileSync('server.js', cleanLines.join('\n'));
console.log('Cleaned server.js successfully!');

// 2. Clean .env
let env = fs.readFileSync('.env', 'utf8');
const envLines = env.split('\n').filter(line => {
  const lower = line.toLowerCase();
  return !lower.startsWith('whatsapp');
});
fs.writeFileSync('.env', envLines.join('\n'));
console.log('Cleaned .env successfully!');
