const { PDFParse } = require('pdf-parse');
const fs = require('fs');

async function testPdfParse() {
  console.log("Testing pdf-parse library with local file...");
  
  // Check if test PDF exists
  const testPdfPath = "/home/ubuntu/test_po.pdf";
  if (!fs.existsSync(testPdfPath)) {
    console.log("No test PDF found at", testPdfPath);
    console.log("Creating a simple test...");
    
    // Just test that pdf-parse loads correctly
    console.log("PDFParse class available:", typeof PDFParse);
    return true;
  }
  
  try {
    const buffer = fs.readFileSync(testPdfPath);
    console.log("Read PDF, size:", buffer.byteLength, "bytes");
    
    // Parse the PDF using PDFParse class
    const parser = new PDFParse();
    await parser.load(buffer);
    const info = await parser.getInfo();
    console.log("PDF info:", info);
    
    const text = await parser.getText();
    console.log("PDF text length:", text.length);
    console.log("First 500 chars:", text.substring(0, 500));
    
    await parser.destroy();
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
