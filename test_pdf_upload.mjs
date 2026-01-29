import { readFileSync } from 'fs';
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Test PDF text extraction - the core functionality of PDF upload
 * This simulates what happens in documentImportService.ts when processing a PDF
 */
async function testPdfTextExtraction() {
  console.log('=== Testing PDF Text Extraction ===\n');
  
  try {
    // Read test PDF
    const pdfPath = './node_modules/pdf2pic/examples/docker/example.pdf';
    console.log('Reading PDF from:', pdfPath);
    const pdfBuffer = readFileSync(pdfPath);
    const uint8Array = new Uint8Array(pdfBuffer);
    console.log('✓ PDF loaded, size:', uint8Array.byteLength, 'bytes\n');
    
    // Use pdfjs-dist to extract text (same as documentImportService.ts)
    console.log('Extracting text using pdfjs-dist...');
    const loadingTask = getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;
    console.log('✓ PDF parsed successfully');
    console.log('  Number of pages:', pdf.numPages);
    
    // Extract text from all pages
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
      fullText += pageText + '\n';
      console.log(`  Page ${i}: ${pageText.substring(0, 80)}...`);
    }
    
    console.log('\n✓ Full text extracted, length:', fullText.length, 'characters');
    console.log('\nFirst 500 characters of extracted text:');
    console.log('---');
    console.log(fullText.substring(0, 500));
    console.log('---\n');
    
    // Verify we got some text
    if (fullText.length > 0) {
      console.log('✅ PDF text extraction SUCCESSFUL!');
      console.log('   PDF upload functionality is working correctly.\n');
      return true;
    } else {
      console.log('❌ PDF text extraction FAILED - no text extracted');
      return false;
    }
    
  } catch (error) {
    console.error('❌ ERROR during PDF processing:');
    console.error('   ', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    return false;
  }
}

// Run the test
testPdfTextExtraction().then(success => {
  process.exit(success ? 0 : 1);
});
