// Client-side palette extraction. The merchant uploads a logo; we sample its
// dominant colours in-browser (canvas) and derive a coherent card palette
// (deep background, readable foreground, vivid accent). The backend just stores
// the resulting hex values, so every client (web + Flutter) reads the same
// colours without needing an image-processing dependency server-side.

export type Palette = { bg: string; fg: string; accent: string };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const to255 = (n: number) => clamp(Math.round(n), 0, 255);

const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => to255(v).toString(16).padStart(2, "0")).join("").toUpperCase();

// Perceived luminance, 0 (black) .. 1 (white).
const luminance = (r: number, g: number, b: number) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

type Bucket = { r: number; g: number; b: number; count: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function extractPalette(file: File): Promise<Palette> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return fallback();
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    // Quantise into 5-bit-per-channel buckets, averaging the true colour inside.
    const buckets = new Map<number, Bucket>();
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue; // skip transparent pixels
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const bk = buckets.get(key);
      if (bk) {
        bk.r += r;
        bk.g += g;
        bk.b += b;
        bk.count++;
      } else {
        buckets.set(key, { r, g, b, count: 1 });
      }
    }
    if (buckets.size === 0) return fallback();

    const colors = [...buckets.values()].map((bk) => {
      const r = bk.r / bk.count;
      const g = bk.g / bk.count;
      const b = bk.b / bk.count;
      const [h, s, l] = rgbToHsl(r, g, b);
      return { r, g, b, count: bk.count, h, s, l, lum: luminance(r, g, b) };
    });

    // Accent: the most prominent vivid colour, avoiding near-black / near-white.
    const accentPick =
      [...colors]
        .filter((c) => c.lum > 0.16 && c.lum < 0.85)
        .sort((a, b) => b.count * (0.25 + b.s) - a.count * (0.25 + a.s))[0] ??
      [...colors].sort((a, b) => b.count - a.count)[0];

    // Background: a deep, branded shade. Start from the most prominent colour,
    // bias its hue toward the accent, and force a dark lightness.
    const dominant = [...colors].sort((a, b) => b.count - a.count)[0];
    const baseHue = accentPick.s > 0.15 ? accentPick.h : dominant.h;
    const bgSat = clamp(Math.max(accentPick.s, dominant.s) * 0.9, 0.18, 0.6);
    const [br, bg_, bb] = hslToRgb(baseHue, bgSat, 0.15);
    const bg = toHex(br, bg_, bb);

    // Accent stays vivid; nudge saturation/lightness into a usable range.
    const [ar, ag, ab] = hslToRgb(
      accentPick.h,
      clamp(accentPick.s * 1.05, 0.45, 1),
      clamp(accentPick.l, 0.42, 0.62),
    );
    const accent = toHex(ar, ag, ab);

    // Foreground: readable against the background.
    const fg = luminance(br, bg_, bb) < 0.45 ? "#F4EBD9" : "#1A1A1A";

    return { bg, fg, accent };
  } catch {
    return fallback();
  } finally {
    URL.revokeObjectURL(url);
  }
}

const fallback = (): Palette => ({ bg: "#04342C", fg: "#F4EBD9", accent: "#D85A30" });
