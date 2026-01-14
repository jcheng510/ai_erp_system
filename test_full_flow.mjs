import fs from 'fs';
import { storagePut } from './server/storage.ts';
import { parseUploadedDocument } from './server/documentImportService.ts';

// Read the test image
const imageBuffer = fs.readFileSync('/home/ubuntu/test_po.png');

// Upload to S3
const fileKey = `document-imports/test-${Date.now()}-test_po.png`;
console.log('Uploading to S3 with key:', fileKey);

try {
  const { url } = await storagePut(fileKey, imageBuffer, 'image/png');
  console.log('S3 URL:', url);
  
  // Parse the document
  console.log('Parsing document...');
  const result = await parseUploadedDocument(url, 'test_po.png', undefined, 'image/png');
  console.log('Parse result:', JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Error:', error);
}
