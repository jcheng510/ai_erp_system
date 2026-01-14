import fs from 'fs';
import { storagePut } from './server/storage.ts';

// Read the test image
const imageBuffer = fs.readFileSync('/home/ubuntu/test_po.png');

// Upload to S3
const fileKey = `document-imports/test-${Date.now()}-test_po.png`;
console.log('Uploading to S3 with key:', fileKey);

try {
  const { url } = await storagePut(fileKey, imageBuffer, 'image/png');
  console.log('S3 URL:', url);
  
  // Try to fetch the URL
  console.log('Fetching URL to verify...');
  const response = await fetch(url);
  console.log('Fetch status:', response.status);
  console.log('Fetch ok:', response.ok);
} catch (error) {
  console.error('Error:', error);
}
