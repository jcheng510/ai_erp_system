import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';

// Create a simple test - we'll test with a downloaded sample PDF
async function testPdfParse() {
  console.log("Testing pdf-parse library...");
  
  // Download a sample PDF
  const sampleUrl = "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf";
  console.log("Downloading sample PDF from:", sampleUrl);
  
  try {
    const response = await fetch(sampleUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("Downloaded PDF, size:", buffer.byteLength, "bytes");
    
    // Parse the PDF
    const data = await pdfParse(buffer);
    console.log("PDF parsed successfully!");
    console.log("Number of pages:", data.numpages);
    console.log("Text length:", data.text.length);
    console.log("First 500 chars of text:", data.text.substring(0, 500));
    
    return true;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

testPdfParse().then(success => {
  console.log("\nTest result:", success ? "PASSED" : "FAILED");
  process.exit(success ? 0 : 1);
});
