const fs = require('fs');
const content = fs.readFileSync('client/src/pages/operations/EmailInbox.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];
let inReturn = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('return (') && i >= 474) {
    inReturn = true;
  }
  
  if (!inReturn) continue;
  
  // Count div opens and closes on this line
  const divOpens = (line.match(/<div/g) || []).length;
  const divCloses = (line.match(/<\/div>/g) || []).length;
  
  // Push opens
  for (let j = 0; j < divOpens; j++) {
    stack.push(i + 1);
    if (stack.length <= 5) {
      console.log(`Line ${i + 1}: OPEN div (depth ${stack.length}): ${line.trim().substring(0, 60)}`);
    }
  }
  
  // Pop closes
  for (let j = 0; j < divCloses; j++) {
    const openLine = stack.pop();
    if (stack.length < 5) {
      console.log(`Line ${i + 1}: CLOSE div (depth ${stack.length + 1}, opened at ${openLine}): ${line.trim().substring(0, 60)}`);
    }
  }
  
  if (line.trim() === ');' && i > 1500) {
    break;
  }
}

console.log('\\nUnclosed divs:');
stack.forEach(line => {
  console.log(`  Line ${line}`);
});
