const fs = require('fs');
const content = fs.readFileSync('client/src/pages/operations/EmailInbox.tsx', 'utf8');
const lines = content.split('\n');

// Start from line 475 (main return)
let stack = [];

for (let i = 474; i < lines.length; i++) {
  const line = lines[i];
  
  // Track fragment opens
  const fragmentOpens = (line.match(/<>(?!.*<\/>)/g) || []).length;
  // Track fragment closes
  const fragmentCloses = (line.match(/<\/>(?!.*<>)/g) || []).length;
  
  // For same-line fragments, they cancel out
  const sameLineFragments = (line.match(/<>.*<\/>/g) || []).length;
  
  const netFragmentOpen = fragmentOpens - sameLineFragments;
  const netFragmentClose = fragmentCloses - sameLineFragments;
  
  for (let j = 0; j < netFragmentOpen; j++) {
    stack.push({ type: '<>', line: i + 1 });
  }
  
  for (let j = 0; j < netFragmentClose; j++) {
    const last = stack.pop();
    if (!last) {
      console.log(`Line ${i + 1}: Unexpected </> - stack is empty`);
    } else if (last.type !== '<>') {
      console.log(`Line ${i + 1}: Unexpected </> - expected ${last.type} from line ${last.line}`);
      stack.push(last); // Put it back
    }
  }
  
  // Track div opens (not self-closing)
  const divOpens = (line.match(/<div[^>]*(?<!\/)>/g) || []).length;
  const divCloses = (line.match(/<\/div>/g) || []).length;
  
  for (let j = 0; j < divOpens; j++) {
    stack.push({ type: 'div', line: i + 1 });
  }
  
  for (let j = 0; j < divCloses; j++) {
    const last = stack.pop();
    if (!last) {
      console.log(`Line ${i + 1}: Unexpected </div> - stack is empty`);
    } else if (last.type !== 'div') {
      console.log(`Line ${i + 1}: Unexpected </div> - expected ${last.type} from line ${last.line}`);
      stack.push(last); // Put it back
    }
  }
  
  if (line.trim() === ');' && i > 1500) {
    console.log('Return ends at line', i + 1);
    break;
  }
}

console.log('\\nRemaining stack:');
stack.forEach(item => {
  console.log(`  ${item.type} from line ${item.line}`);
});
