import fs from 'fs';
import { parseUploadedDocument } from './server/documentImportService.ts';

// Read the test image
const imageBuffer = fs.readFileSync('/home/ubuntu/test_po.png');
const base64 = imageBuffer.toString('base64');

// Call the parse function
const result = await parseUploadedDocument(base64, 'test_po.png', 'image/png');
console.log('Result:', JSON.stringify(result, null, 2));
