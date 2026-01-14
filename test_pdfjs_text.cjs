const fs = require('fs');

async function testPdfTextExtraction() {
  console.log("Testing PDF.js text extraction...");
  
  const testPdfPath = "/home/ubuntu/test_po.pdf";
  
  try {
    // Dynamic import of pdfjs-dist
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    // Read the PDF file
    const buffer = fs.readFileSync(testPdfPath);
    // Convert to Uint8Array as required by pdfjs-dist
    const uint8Array = new Uint8Array(buffer);
    console.log("Read PDF, size:", uint8Array.byteLength, "bytes");
    
    // Load the PDF
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;
    console.log("PDF loaded, pages:", pdf.numPages);
    
    // Extract text from all pages
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    console.log("Extracted text length:", fullText.length);
    console.log("First 500 chars:", fullText.substring(0, 500));
    
    return true;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

testPdfTextExtraction().then(success => {
  console.log("\nTest result:", success ? "PASSED" : "FAILED");
  process.exit(success ? 0 : 1);
});
