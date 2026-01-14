const { PDFParse } = require('pdf-parse');

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
