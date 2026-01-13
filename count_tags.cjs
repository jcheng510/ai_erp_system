const fs = require('fs');
const content = fs.readFileSync('client/src/pages/operations/EmailInbox.tsx', 'utf8');
const lines = content.split('\n');

let opens = 0;
let closes = 0;

for (let i = 474; i < lines.length; i++) {
  const line = lines[i];
  
  // Count opening tags (not self-closing)
  const openMatches = line.match(/<[A-Za-z][A-Za-z0-9]*/g) || [];
  const selfClosing = line.match(/\/>/g) || [];
  const closeMatches = line.match(/<\/[A-Za-z][A-Za-z0-9]*>/g) || [];
  const fragmentOpen = (line.match(/<>/g) || []).length;
  const fragmentClose = (line.match(/<\/>/g) || []).length;
  
  opens += openMatches.length - selfClosing.length + fragmentOpen;
  closes += closeMatches.length + fragmentClose;
  
  if (line.trim() === ');' && i > 1500) {
    console.log('Return ends at line', i + 1);
    break;
  }
}

console.log('Opens:', opens, 'Closes:', closes, 'Diff:', opens - closes);
