const fs = require('fs');
const content = fs.readFileSync('client/src/pages/operations/EmailInbox.tsx', 'utf8');
const lines = content.split('\n');

// Find the main return statement (line 475)
let returnLine = 474;

// Extract just the JSX structure
let jsxContent = [];
let depth = 0;
let inReturn = false;

for (let i = returnLine; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('return (')) {
    inReturn = true;
  }
  
  if (!inReturn) continue;
  
  // Check for JSX tags
  const openTags = line.match(/<[A-Z][a-zA-Z]*|<[a-z]+|<>/g) || [];
  const closeTags = line.match(/<\/[A-Z][a-zA-Z]*>|<\/[a-z]+>|<\/>/g) || [];
  const selfClosing = line.match(/<[A-Z][a-zA-Z]*[^>]*\/>|<[a-z]+[^>]*\/>/g) || [];
  
  const netOpen = openTags.length - selfClosing.length;
  const netClose = closeTags.length;
  
  if (netOpen > 0 || netClose > 0) {
    console.log(`Line ${i + 1}: +${netOpen} -${netClose} | ${line.trim().substring(0, 80)}`);
  }
  
  depth += netOpen - netClose;
  
  if (line.trim() === ');' && depth === 0) {
    console.log('\\nReturn ends at line', i + 1, 'with depth', depth);
    break;
  }
}

console.log('Final depth:', depth);
