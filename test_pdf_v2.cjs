const { PDFParse } = require('pdf-parse');
const fs = require('fs');

async function testPdfParse() {
  console.log("Testing pdf-parse v2 library...");
  
  const testPdfPath = "/home/ubuntu/test_po.pdf";
  
  try {
    // Use the file path directly with PDFParse
    const parser = new PDFParse({ file: testPdfPath });
    
    // Load the PDF
    const loaded = await parser.load();
    console.log("PDF loaded:", loaded);
    
    // Get info
    const info = await parser.getInfo();
    console.log("PDF info:", info);
    
    // Get text
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
