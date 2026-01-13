const fs = require('fs');
const content = fs.readFileSync('client/src/pages/operations/EmailInbox.tsx', 'utf8');
const lines = content.split('\n');

// Find the main return statement (line 475)
let returnLine = 474;

// Track all JSX elements
let stack = [];

for (let i = returnLine; i < lines.length; i++) {
  const line = lines[i];
  
  // Track opening JSX fragment <>
  const fragmentOpenMatch = line.match(/<>/g);
  if (fragmentOpenMatch) {
    for (let j = 0; j < fragmentOpenMatch.length; j++) {
      stack.push({ type: '<>', line: i + 1, indent: line.search(/\S/) });
    }
  }
  
  // Track closing JSX fragment </>
  const fragmentCloseMatch = line.match(/<\/>/g);
  if (fragmentCloseMatch) {
    for (let j = 0; j < fragmentCloseMatch.length; j++) {
      const last = stack.pop();
      if (!last || last.type !== '<>') {
        console.log(`Line ${i + 1}: Unexpected </>, expected ${last ? last.type : 'nothing'}`);
        if (last) stack.push(last);
      }
    }
  }
  
  // Track opening div
  const divOpenMatch = line.match(/<div/g);
  if (divOpenMatch) {
    for (let j = 0; j < divOpenMatch.length; j++) {
      stack.push({ type: 'div', line: i + 1, indent: line.search(/\S/) });
    }
  }
  
  // Track closing div
  const divCloseMatch = line.match(/<\/div>/g);
  if (divCloseMatch) {
    for (let j = 0; j < divCloseMatch.length; j++) {
      const last = stack.pop();
      if (!last || last.type !== 'div') {
        console.log(`Line ${i + 1}: Unexpected </div>, expected ${last ? last.type : 'nothing'}`);
        if (last) stack.push(last);
      }
    }
  }
  
  // End of return - only if stack is nearly empty
  if (line.trim() === ');' && stack.length <= 2) {
    console.log('Return statement ends at line', i + 1);
    break;
  }
}

console.log('\\nRemaining unclosed elements:');
stack.forEach(item => {
  console.log(`  ${item.type} at line ${item.line} (indent: ${item.indent})`);
});
