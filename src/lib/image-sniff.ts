/**
 * Identify an image by its first bytes rather than trusting the file extension
 * or the declared MIME type, both of which the client controls. Only formats a
 * browser will actually render are accepted.
 */
export type ImageKind = { ext: "jpg" | "png" | "webp" | "heic"; type: string };

export function sniffImage(bytes: Uint8Array): ImageKind | null {
  const at = (i: number) => bytes[i];
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return { ext: "png", type: "image/png" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return { ext: "webp", type: "image/webp" };
  // HEIC/HEIF sit in an ISO base media container: "....ftypheic" and friends.
  if (ascii(bytes, 4, 4) === "ftyp" && /heic|heix|heif|mif1|msf1/.test(ascii(bytes, 8, 4))) {
    return { ext: "heic", type: "image/heic" };
  }
  return null;
}

function ascii(bytes: Uint8Array, from: number, length: number): string {
  return String.fromCharCode(...bytes.slice(from, from + length));
}
