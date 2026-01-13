const fs = require('fs');
const content = fs.readFileSync('client/src/pages/operations/EmailInbox.tsx', 'utf8');
const lines = content.split('\n');

// Track all JSX elements
let stack = [];

// Find the return statement
let inReturn = false;
let returnStart = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (i === 474) { // Line 475 is the main return
    inReturn = true;
    returnStart = i + 1;
  }
  
  if (!inReturn) continue;
  
  // Track fragments
  const fragmentOpens = (line.match(/<>/g) || []).length;
  const fragmentCloses = (line.match(/<\/>/g) || []).length;
  
  for (let j = 0; j < fragmentOpens; j++) {
    stack.push({ type: 'fragment', line: i + 1 });
  }
  for (let j = 0; j < fragmentCloses; j++) {
    if (stack.length > 0 && stack[stack.length - 1].type === 'fragment') {
      stack.pop();
    } else {
      console.log(`Line ${i + 1}: Unexpected fragment close, stack top is: ${stack.length > 0 ? stack[stack.length - 1].type : 'empty'}`);
    }
  }
  
  // Track divs
  const divOpens = (line.match(/<div/g) || []).length;
  const divCloses = (line.match(/<\/div>/g) || []).length;
  
  for (let j = 0; j < divOpens; j++) {
    stack.push({ type: 'div', line: i + 1 });
  }
  for (let j = 0; j < divCloses; j++) {
    if (stack.length > 0 && stack[stack.length - 1].type === 'div') {
      stack.pop();
    } else {
      console.log(`Line ${i + 1}: Unexpected div close, stack top is: ${stack.length > 0 ? stack[stack.length - 1].type : 'empty'}`);
    }
  }
  
  // Track Dialog
  const dialogOpens = (line.match(/<Dialog /g) || []).length;
  const dialogCloses = (line.match(/<\/Dialog>/g) || []).length;
  
  for (let j = 0; j < dialogOpens; j++) {
    stack.push({ type: 'Dialog', line: i + 1 });
  }
  for (let j = 0; j < dialogCloses; j++) {
    if (stack.length > 0 && stack[stack.length - 1].type === 'Dialog') {
      stack.pop();
    } else {
      console.log(`Line ${i + 1}: Unexpected Dialog close, stack top is: ${stack.length > 0 ? stack[stack.length - 1].type : 'empty'}`);
    }
  }
  
  // End of return
  if (line.trim() === ');' && stack.length === 0) {
    console.log('Return statement ends at line', i + 1);
    break;
  }
}

console.log('\\nRemaining unclosed elements:');
stack.forEach(item => {
  console.log(`  ${item.type} at line ${item.line}`);
});
