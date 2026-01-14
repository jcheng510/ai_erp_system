import { fromBuffer } from "pdf2pic";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

async function testPdfConvert() {
  try {
    const pdfBuffer = readFileSync("/home/ubuntu/test_po.pdf");
    console.log("PDF buffer size:", pdfBuffer.length);
    
    const options = {
      density: 200,
      saveFilename: "pdf_page",
      savePath: join(tmpdir(), 'pdf_convert_test'),
      format: "png",
      width: 2000,
      height: 2800
    };
    
    if (!existsSync(options.savePath)) {
      mkdirSync(options.savePath, { recursive: true });
    }
    
    console.log("Converting PDF to image...");
    const convert = fromBuffer(pdfBuffer, options);
    const pageResult = await convert(1, { responseType: "base64" });
    
    if (pageResult && pageResult.base64) {
      console.log("SUCCESS! Base64 length:", pageResult.base64.length);
    } else {
      console.log("FAILED: No base64 result", pageResult);
    }
  } catch (error) {
    console.error("ERROR:", error);
  }
}

testPdfConvert();
