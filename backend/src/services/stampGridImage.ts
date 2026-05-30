import { deflateSync } from "node:zlib";

// Renders the loyalty "stamp grid" as a wide banner PNG, used as the Google
// Wallet hero image so the pass visually mirrors the in-app card. Implemented
// with a tiny hand-rolled PNG encoder (only node:zlib) to avoid native deps.

const WIDTH = 1032; // Google hero image: ~3:1, min width 1032px.
const HEIGHT = 336;

type RGB = [number, number, number];

const hexToRgb = (hex: string): RGB => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [4, 52, 44]; // fallback brand green
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Relative luminance, to pick readable stamp colors over any brand background.
const isDark = ([r, g, b]: RGB) => (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.6;

export function renderStampGrid(filled: number, total: number, brandHex: string): Buffer {
  const bg = hexToRgb(brandHex);
  const onDark = isDark(bg);
  // Earned stamps: warm "soleil"; empty: faint ring tinted for contrast.
  const earned: RGB = [239, 159, 39];
  const ring: RGB = onDark ? [244, 235, 217] : [4, 52, 44];

  const px = new Uint8Array(WIDTH * HEIGHT * 4);
  // Fill background (opaque).
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    px[i * 4] = bg[0];
    px[i * 4 + 1] = bg[1];
    px[i * 4 + 2] = bg[2];
    px[i * 4 + 3] = 255;
  }

  const n = Math.max(1, total);
  // Lay the circles out on one or two rows so they stay reasonably large.
  const rows = n > 6 ? 2 : 1;
  const perRow = Math.ceil(n / rows);
  const padX = 70;
  const usableW = WIDTH - padX * 2;
  const cell = usableW / perRow;
  const radius = Math.min(cell * 0.32, (HEIGHT / rows) * 0.3);
  const rowGap = HEIGHT / (rows + 1);

  const blend = (x: number, y: number, c: RGB, a: number) => {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT || a <= 0) return;
    const i = (y * WIDTH + x) * 4;
    const inv = 1 - a;
    px[i] = c[0] * a + px[i] * inv;
    px[i + 1] = c[1] * a + px[i + 1] * inv;
    px[i + 2] = c[2] * a + px[i + 2] * inv;
  };

  const stroke = Math.max(3, radius * 0.16);
  for (let idx = 0; idx < n; idx++) {
    const row = Math.floor(idx / perRow);
    const col = idx % perRow;
    const cx = padX + cell * (col + 0.5);
    const cy = rowGap * (row + 1);
    const isFilled = idx < filled;
    const r0 = Math.ceil(radius + 2);
    for (let dy = -r0; dy <= r0; dy++) {
      for (let dx = -r0; dx <= r0; dx++) {
        const dist = Math.hypot(dx, dy);
        if (isFilled) {
          // Solid disc, ~1px antialiased edge.
          const a = Math.max(0, Math.min(1, radius - dist + 0.5));
          blend(Math.round(cx + dx), Math.round(cy + dy), earned, a);
        } else {
          // Ring outline only.
          const edge = Math.abs(dist - radius);
          const a = Math.max(0, Math.min(1, stroke / 2 - edge + 0.5)) * 0.55;
          blend(Math.round(cx + dx), Math.round(cy + dy), ring, a);
        }
      }
    }
  }

  return encodePng(WIDTH, HEIGHT, px);
}

// --- Minimal PNG encoder (8-bit RGBA, single IDAT) ---

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf: Buffer): number => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer): Buffer => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
};

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // compression / filter / interlace default 0.

  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type "none"
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 6 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
