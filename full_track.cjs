const fs = require('fs');
const content = fs.readFileSync('client/src/pages/operations/EmailInbox.tsx', 'utf8');
const lines = content.split('\n');

// Start from line 475 (main return)
let stack = [];
let errors = [];

for (let i = 474; i < lines.length; i++) {
  const line = lines[i];
  
  // Track all JSX elements
  // Opening tags: <TagName or <tagname (not self-closing)
  const openingTags = [];
  const closingTags = [];
  
  // Find opening tags
  const openRegex = /<([A-Z][A-Za-z0-9]*|[a-z][a-z0-9-]*)[^>]*(?<!\/)>/g;
  let match;
  while ((match = openRegex.exec(line)) !== null) {
    openingTags.push(match[1]);
  }
  
  // Find closing tags
  const closeRegex = /<\/([A-Z][A-Za-z0-9]*|[a-z][a-z0-9-]*)>/g;
  while ((match = closeRegex.exec(line)) !== null) {
    closingTags.push(match[1]);
  }
  
  // Handle fragments
  const fragmentOpens = (line.match(/<>(?!.*<\/>)/g) || []).length;
  const fragmentCloses = (line.match(/<\/>(?!.*<>)/g) || []).length;
  const sameLineFragments = (line.match(/<>.*<\/>/g) || []).length;
  
  const netFragmentOpen = fragmentOpens - sameLineFragments;
  const netFragmentClose = fragmentCloses - sameLineFragments;
  
  // Push opening tags
  for (const tag of openingTags) {
    stack.push({ type: tag, line: i + 1 });
  }
  
  for (let j = 0; j < netFragmentOpen; j++) {
    stack.push({ type: '<>', line: i + 1 });
  }
  
  // Pop closing tags
  for (const tag of closingTags) {
    const last = stack.pop();
    if (!last) {
      errors.push(`Line ${i + 1}: Unexpected </${tag}> - stack is empty`);
    } else if (last.type !== tag) {
      errors.push(`Line ${i + 1}: Unexpected </${tag}> - expected </${last.type}> from line ${last.line}`);
      stack.push(last); // Put it back
    }
  }
  
  for (let j = 0; j < netFragmentClose; j++) {
    const last = stack.pop();
    if (!last) {
      errors.push(`Line ${i + 1}: Unexpected </> - stack is empty`);
    } else if (last.type !== '<>') {
      errors.push(`Line ${i + 1}: Unexpected </> - expected </${last.type}> from line ${last.line}`);
      stack.push(last); // Put it back
    }
  }
  
  if (line.trim() === ');' && i > 1500) {
    console.log('Return ends at line', i + 1);
    break;
  }
}

console.log('\\nErrors found:');
errors.forEach(e => console.log('  ' + e));

console.log('\\nRemaining stack:');
stack.forEach(item => {
  console.log(`  ${item.type} from line ${item.line}`);
});
