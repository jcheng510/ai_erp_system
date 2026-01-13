const fs = require('fs');
const content = fs.readFileSync('client/src/pages/operations/EmailInbox.tsx', 'utf8');
const lines = content.split('\n');

// Start from line 525 (the main div)
let depth = 0;
let foundClose = false;

for (let i = 524; i < lines.length; i++) {
  const line = lines[i];
  const opens = (line.match(/<div/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  
  depth += opens;
  depth -= closes;
  
  if (depth === 0 && foundClose === false) {
    console.log('Main div closes at line', i + 1);
    console.log('Line content:', line.trim());
    foundClose = true;
    break;
  }
}

if (foundClose === false) {
  console.log('Main div never closes! Final depth:', depth);
}
