import { parse } from '@babel/parser';
import fs from 'fs';

const content = fs.readFileSync('client/src/pages/operations/EmailInbox.tsx', 'utf8');

try {
  const ast = parse(content, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  console.log('File parsed successfully!');
} catch (error) {
  console.log('Parse error:', error.message);
  console.log('Location:', error.loc);
}
