const fs = require('fs');
const content = fs.readFileSync('client/src/pages/operations/EmailInbox.tsx', 'utf8');
const lines = content.split('\n');

// Track div balance
let divStack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Find all <div tags
  const divOpens = line.match(/<div/g) || [];
  const divCloses = line.match(/<\/div>/g) || [];
  
  for (let j = 0; j < divOpens.length; j++) {
    divStack.push({ line: i + 1, indent: line.search(/\S/) });
  }
  
  for (let j = 0; j < divCloses.length; j++) {
    if (divStack.length > 0) {
      divStack.pop();
    } else {
      console.log('Extra closing div at line', i + 1);
    }
  }
}

console.log('Unclosed divs:');
divStack.forEach(item => {
  console.log(`  Line ${item.line}: ${lines[item.line - 1].trim().substring(0, 60)}`);
});
