import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffImage } from "@/lib/image-sniff";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

test("recognises the four accepted formats by their magic bytes", () => {
  assert.equal(sniffImage(bytes([0xff, 0xd8, 0xff, 0xe0]))?.ext, "jpg");
  assert.equal(sniffImage(bytes([0x89], "PNG\r\n"))?.ext, "png");
  assert.equal(sniffImage(bytes("RIFF", [0, 0, 0, 0], "WEBP"))?.ext, "webp");
  assert.equal(sniffImage(bytes([0, 0, 0, 0x18], "ftypheic"))?.ext, "heic");
});

test("rejects anything else, whatever it claims to be", () => {
  assert.equal(sniffImage(bytes("<svg xmlns")), null);
  assert.equal(sniffImage(bytes("GIF89a")), null);
  assert.equal(sniffImage(bytes("%PDF-1.7")), null);
  assert.equal(sniffImage(new Uint8Array()), null);
});
