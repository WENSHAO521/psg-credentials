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

// Mutates imageData in place, writing one payload bit into the blue
// channel's LSB of each successive pixel (row-major from pixel 0).
export function embedWatermark(imageData, payload) {
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
  const data = imageData.data; // RGBA
  const capacityPixels = data.length / 4;
  if (bits.length > capacityPixels) {
    throw new Error("Image too small to hold watermark payload");
  }

  for (let i = 0; i < bits.length; i++) {
    const blueIndex = i * 4 + 2;
    data[blueIndex] = (data[blueIndex] & 0xfe) | bits[i];
  }
  return imageData;
}

// Returns the decoded payload string, or null if no valid watermark is present.
export function extractWatermark(imageData) {
  const data = imageData.data;
  const capacityPixels = data.length / 4;
  if (capacityPixels < HEADER_BITS) return null;

  const headerBits = new Array(HEADER_BITS);
  for (let i = 0; i < HEADER_BITS; i++) {
    headerBits[i] = data[i * 4 + 2] & 1;
  }
  const headerBytes = bitsToBytes(headerBits);
  const magic = String.fromCharCode(...headerBytes.subarray(0, MAGIC.length));
  if (magic !== MAGIC) return null;

  const length = (headerBytes[MAGIC.length] << 8) | headerBytes[MAGIC.length + 1];
  const totalBits = HEADER_BITS + length * 8;
  if (length === 0 || totalBits > capacityPixels) return null;

  const payloadBits = new Array(length * 8);
  for (let i = 0; i < payloadBits.length; i++) {
    payloadBits[i] = data[(HEADER_BITS + i) * 4 + 2] & 1;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bitsToBytes(payloadBits));
  } catch {
    return null;
  }
}

export function watermarkPayload(record) {
  return `${record.certificate_id}|${record.token}`;
}

// Loads an uploaded image file, extracts its watermark (if any), and
// returns { certificateId, token } or null. Only works on image formats the
// browser can decode (PNG, JPEG, etc.) -- not on PDFs.
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
  const payload = extractWatermark(imageData);
  if (!payload) return null;

  const [certificateId, token] = payload.split("|");
  if (!certificateId || !token) return null;
  return { certificateId, token };
}
