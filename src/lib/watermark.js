// Invisible LSB steganography watermark for exported certificate images.
//
// Embeds `${certificate_id}|${token}` into the least-significant bit of the
// blue channel of the rasterized PNG, so a certificate can still be traced
// back to its registry record even if the printed/rendered QR code is
// cropped, obscured, or never scanned. This is a redundant, low-friction
// recovery path -- the QR + online registry lookup remains the authoritative
// verification mechanism. LSB watermarks do not survive re-compression,
// resizing, or screenshotting, so this only works on the original exported
// PNG (and the PDF, which embeds that same PNG losslessly).

const MAGIC = "PSGWM1";
const HEADER_BITS = (MAGIC.length + 2) * 8; // magic + 2-byte payload length

function stringToBytes(str) {
  return new TextEncoder().encode(str);
}

function bytesToBits(bytes) {
  const bits = new Array(bytes.length * 8);
  for (let i = 0; i < bytes.length; i++) {
    for (let b = 0; b < 8; b++) {
      bits[i * 8 + b] = (bytes[i] >> (7 - b)) & 1;
    }
  }
  return bits;
}

function bitsToBytes(bits) {
  const bytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bytes.length; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    bytes[i] = byte;
  }
  return bytes;
}

// Writes one payload bit into the blue channel's LSB of each successive
// pixel (row-major from pixel 0). `channels` is the stride per pixel (4 for
// RGBA canvas ImageData, 3 for the raw RGB samples pdf-lib stores PDFs with).
function embedBits(data, channels, payload) {
  const payloadBytes = stringToBytes(payload);
  if (payloadBytes.length > 0xffff) {
    throw new Error("Watermark payload too large");
  }
  const magicBytes = stringToBytes(MAGIC);
  const allBytes = new Uint8Array(magicBytes.length + 2 + payloadBytes.length);
  allBytes.set(magicBytes, 0);
  allBytes[magicBytes.length] = (payloadBytes.length >> 8) & 0xff;
  allBytes[magicBytes.length + 1] = payloadBytes.length & 0xff;
  allBytes.set(payloadBytes, magicBytes.length + 2);

  const bits = bytesToBits(allBytes);
  const capacityPixels = data.length / channels;
  if (bits.length > capacityPixels) {
    throw new Error("Image too small to hold watermark payload");
  }

  for (let i = 0; i < bits.length; i++) {
    const blueIndex = i * channels + 2;
    data[blueIndex] = (data[blueIndex] & 0xfe) | bits[i];
  }
}

// Returns the decoded payload string, or null if no valid watermark is present.
function extractBits(data, channels, capacityPixels) {
  if (capacityPixels < HEADER_BITS) return null;

  const headerBits = new Array(HEADER_BITS);
  for (let i = 0; i < HEADER_BITS; i++) {
    headerBits[i] = data[i * channels + 2] & 1;
  }
  const headerBytes = bitsToBytes(headerBits);
  const magic = String.fromCharCode(...headerBytes.subarray(0, MAGIC.length));
  if (magic !== MAGIC) return null;

  const length = (headerBytes[MAGIC.length] << 8) | headerBytes[MAGIC.length + 1];
  const totalBits = HEADER_BITS + length * 8;
  if (length === 0 || totalBits > capacityPixels) return null;

  const payloadBits = new Array(length * 8);
  for (let i = 0; i < payloadBits.length; i++) {
    payloadBits[i] = data[(HEADER_BITS + i) * channels + 2] & 1;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bitsToBytes(payloadBits));
  } catch {
    return null;
  }
}

// Mutates imageData (RGBA canvas ImageData) in place.
export function embedWatermark(imageData, payload) {
  embedBits(imageData.data, 4, payload);
  return imageData;
}

export function extractWatermark(imageData) {
  return extractBits(imageData.data, 4, imageData.data.length / 4);
}

export function watermarkPayload(record) {
  return `${record.certificate_id}|${record.token}`;
}

function decodeWatermarkPayload(payload) {
  if (!payload) return null;
  const [certificateId, token] = payload.split("|");
  if (!certificateId || !token) return null;
  return { certificateId, token };
}

// Loads an uploaded raster image (PNG, JPEG, etc. -- not PDF), extracts its
// watermark, and returns { certificateId, token } or null.
export async function extractWatermarkFromImageFile(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return decodeWatermarkPayload(extractWatermark(imageData));
}

// Loads an uploaded certificate PDF and extracts the watermark from its
// embedded page image directly from the PDF's object graph -- not by
// re-rendering the page to a canvas. Re-rasterizing a PDF page resamples
// pixels to fit the requested viewport, which would corrupt LSB data; the
// raw image stream pdf-lib wrote when the PDF was exported is untouched, so
// reading it back the same way recovers the watermark losslessly.
export async function extractWatermarkFromPdfFile(file) {
  const { PDFDocument, PDFName, PDFDict, PDFRawStream, decodePDFRawStream } = await import(
    "pdf-lib"
  );

  let pdfDoc;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    pdfDoc = await PDFDocument.load(bytes);
  } catch {
    return null;
  }
  if (pdfDoc.getPageCount() < 1) return null;

  let xobjects;
  try {
    xobjects = pdfDoc.getPage(0).node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
  } catch {
    return null;
  }
  if (!xobjects) return null;

  for (const key of xobjects.keys()) {
    let stream;
    try {
      stream = pdfDoc.context.lookup(xobjects.get(key), PDFRawStream);
    } catch {
      continue;
    }
    if (!stream) continue;

    const width = stream.dict.get(PDFName.of("Width"))?.asNumber();
    const height = stream.dict.get(PDFName.of("Height"))?.asNumber();
    if (!width || !height) continue;

    let raw;
    try {
      raw = decodePDFRawStream(stream).decode();
    } catch {
      continue;
    }

    const channels = Math.round(raw.length / (width * height));
    if (channels < 3) continue;

    const decoded = decodeWatermarkPayload(extractBits(raw, channels, width * height));
    if (decoded) return decoded;
  }
  return null;
}
