import { embedWatermark, watermarkPayload } from "./watermark.js";

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;

function svgStringToPngBlob(svgString, scale, watermarkText) {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = PAGE_WIDTH * scale;
      canvas.height = PAGE_HEIGHT * scale;
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
      URL.revokeObjectURL(url);
      if (watermarkText) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        embedWatermark(imageData, watermarkText);
        ctx.putImageData(imageData, 0, 0);
      }
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas export produced no data"));
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to rasterize certificate SVG"));
    };
    img.src = url;
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadCertificatePng(svgString, record) {
  const blob = await svgStringToPngBlob(svgString, 2.5, watermarkPayload(record));
  downloadBlob(blob, `${record.certificate_id}.png`);
}

export async function downloadCertificatePdf(svgString, record) {
  // pdf-lib is the single largest dependency in this app and only the PDF
  // export path needs it, so it's fetched on demand here instead of being in
  // the initial bundle every visitor downloads just to search or verify.
  const { PDFDocument } = await import("pdf-lib");

  const pngBlob = await svgStringToPngBlob(svgString, 3, watermarkPayload(record));
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  // embedPng keeps the source PNG's pixel data intact (no re-encoding), so
  // the LSB watermark survives inside the PDF too.
  const pngImage = await pdfDoc.embedPng(pngBytes);
  page.drawImage(pngImage, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });

  const pdfBytes = await pdfDoc.save();
  downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), `${record.certificate_id}.pdf`);
}
