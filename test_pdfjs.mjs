import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { readFileSync, writeFileSync } from "fs";

// Disable worker for Node.js environment
GlobalWorkerOptions.workerSrc = "";

async function testPdfConversion() {
  try {
    // Read the test PDF
    const pdfBuffer = readFileSync("/home/ubuntu/test_po.pdf");
    console.log("PDF buffer size:", pdfBuffer.length);
    
    // Load PDF
    const loadingTask = getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    console.log("PDF loaded, pages:", pdf.numPages);
    
    // Get first page
    const page = await pdf.getPage(1);
    const scale = 2.0;
    const viewport = page.getViewport({ scale });
    console.log("Viewport:", viewport.width, "x", viewport.height);
    
    // Create canvas
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");
    
    // Render
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;
    
    // Save as PNG
    const pngBuffer = canvas.toBuffer("image/png");
    writeFileSync("/home/ubuntu/test_output.png", pngBuffer);
    console.log("PNG saved, size:", pngBuffer.length);
    console.log("Base64 length:", pngBuffer.toString('base64').length);
    
    console.log("SUCCESS!");
  } catch (error) {
    console.error("Error:", error);
  }
}

testPdfConversion();
