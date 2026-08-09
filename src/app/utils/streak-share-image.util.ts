/**
 * The streak poster — rendered to a PNG so a streak can actually leave the app.
 *
 * This is the only VoxFit artefact that gets seen outside VoxFit, so it is
 * composed as a poster rather than as a screenshot of the streak page: one
 * enormous numeral, the week's dots underneath as the receipt that proves it,
 * and a quiet wordmark strip at the foot. Everything is drawn from the same
 * tokens as the page (`--vox-canvas-gradient`, apricot, Poppins) so the two
 * read as the same object at different sizes.
 *
 * Canvas 2D rather than an SVG or a DOM-to-image library: no dependency, no
 * external fetch, and it works identically in the Android WebView.
 */

/** 4:5 — the aspect every feed and story surface crops least badly. */
const W = 1080;
const H = 1350;
const PAD = 76;
const CX = W / 2;

const INK = '#ffffff';
const INK_SUBTLE = 'rgba(255, 255, 255, 0.62)';
const INK_TERTIARY = 'rgba(255, 255, 255, 0.38)';
const APRICOT = '#f8a44c';
const APRICOT_BRIGHT = '#ffb764';
const APRICOT_TEXT = '#f8c286';
const ON_APRICOT = '#2e1b06';
const BRAND = '#887bfc';
const ROSE = '#e77161';

const DISPLAY = 'Poppins, system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const EMOJI = '"Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif';

export interface StreakShareData {
  readonly days: number;
  /** The page's own headline, newlines included — same voice in both places. */
  readonly headline: string;
  /** The page's subline; carries the "past your old record" context. */
  readonly subline: string;
  readonly bestRun: number;
  readonly daysLogged: number;
  readonly weekDots: readonly { readonly label: string; readonly completed: boolean }[];
}

/**
 * Draws the poster and returns it as a PNG blob.
 *
 * Fonts are awaited before the first `fillText`: canvas takes no part in CSS
 * font loading, so drawing early silently falls back to the system face and
 * every measurement — and therefore the whole layout — comes out wrong.
 */
export async function renderStreakShareImage(data: StreakShareData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable on this device');

  await loadFonts();
  paint(ctx, data);

  return toPngBlob(canvas);
}

async function loadFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  /*
   * Every size/weight combination the poster draws at. A face loaded at one
   * size counts as loaded for all of them, but the weights are genuinely
   * distinct files and 600 vs 700 here is the difference between the display
   * voice and a synthetic bold.
   */
  const faces = ['700 320px Poppins', '600 48px Poppins', '500 20px Poppins', '700 46px "JetBrains Mono"'];
  try {
    await Promise.all(faces.map((f) => document.fonts.load(f)));
  } catch {
    /* A failed load is not fatal — the system fallback still renders text. */
  }
}

/* Vertical metrics of the hero block. Glyph boxes, not font sizes: a 320px
   numeral is only ~232px of visible cap height, and laying out against the
   font size instead leaves a hole under every element. */
const FLAME_BOX = 176;
const NUMERAL_BOX = 232;
const UNIT_BOX = 34;
const DOTS_BOX = 104;
const HEADLINE_LH = 62;
const SUBLINE_LH = 40;
const FOOTER_BAND = 290;

function paint(ctx: CanvasRenderingContext2D, data: StreakShareData): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  paintCanvasGradient(ctx);
  paintAtmosphere(ctx);

  /*
   * The hero is measured before it is drawn, then centred in the band above the
   * footer. Laying it out from a fixed top instead leaves a growing hole above
   * the footer for short headlines and crowds the dots for long ones — and the
   * headline is 1–3 lines depending on the milestone.
   */
  ctx.font = `600 48px ${DISPLAY}`;
  const headlineLines = wrapLines(ctx, data.headline, W - PAD * 2 - 40);
  ctx.font = `500 30px ${DISPLAY}`;
  const sublineLines = wrapLines(ctx, data.subline, W - PAD * 2 - 130);
  const hasDots = data.weekDots.length > 0;

  const blockHeight =
    FLAME_BOX +
    30 +
    NUMERAL_BOX +
    30 +
    UNIT_BOX +
    50 +
    headlineLines.length * HEADLINE_LH +
    (sublineLines.length > 0 ? 16 + sublineLines.length * SUBLINE_LH : 0) +
    (hasDots ? 62 + DOTS_BOX : 0);

  const bandTop = PAD;
  const bandBottom = H - FOOTER_BAND - 40;
  let y = bandTop + Math.max(0, (bandBottom - bandTop - blockHeight) / 2);

  ctx.font = `${FLAME_BOX}px ${EMOJI}`;
  ctx.fillText('🔥', CX, y + FLAME_BOX * 0.94);
  y += FLAME_BOX + 30;

  paintNumeral(ctx, String(data.days), y + NUMERAL_BOX);
  y += NUMERAL_BOX + 30;

  ctx.font = `700 34px ${DISPLAY}`;
  ctx.fillStyle = APRICOT_TEXT;
  drawTracked(ctx, 'DAY STREAK', CX, y + UNIT_BOX, 6.8);
  y += UNIT_BOX + 50;

  ctx.font = `600 48px ${DISPLAY}`;
  ctx.fillStyle = INK;
  for (const line of headlineLines) {
    y += HEADLINE_LH;
    ctx.fillText(line, CX, y);
  }

  if (sublineLines.length > 0) {
    y += 16;
    ctx.font = `500 30px ${DISPLAY}`;
    ctx.fillStyle = INK_SUBTLE;
    for (const line of sublineLines) {
      y += SUBLINE_LH;
      ctx.fillText(line, CX, y);
    }
  }

  if (hasDots) {
    paintWeekDots(ctx, data.weekDots, y + 62);
  }

  paintFooter(ctx, data);

  /* Grain sits above content here exactly as it does in the app (.vx-grain is
     z-index 3, above the page layer) — it is what stops the gradient reading
     as a flat wash. */
  paintGrain(ctx);
}

function paintCanvasGradient(ctx: CanvasRenderingContext2D): void {
  /* The same four stops as --vox-canvas-gradient. */
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1c1536');
  g.addColorStop(0.4, '#151228');
  g.addColorStop(0.7, '#0d0b18');
  g.addColorStop(1, '#191029');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** The page's three blurred blobs, as radial gradients — same placement logic. */
function paintAtmosphere(ctx: CanvasRenderingContext2D): void {
  radialGlow(ctx, CX, 380, 520, APRICOT, 0.34);
  radialGlow(ctx, W + 60, 820, 380, ROSE, 0.26);
  radialGlow(ctx, -40, 1180, 360, BRAND, 0.26);
}

function radialGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  alpha: number,
): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/**
 * The app's grain overlay, which is what stops the gradient reading as a flat
 * wash. Seeded rather than `Math.random` so the same streak always produces a
 * byte-identical poster — a user re-sharing the same day should not get a
 * subtly different image.
 */
function paintGrain(ctx: CanvasRenderingContext2D): void {
  const rand = seededRandom(0x5eed);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  /* 1px specks, not 2px: at poster scale anything larger reads as dust on the
     lens rather than as the fine noise the app's overlay applies. */
  for (let i = 0; i < 14000; i++) {
    ctx.fillRect(Math.floor(rand() * W), Math.floor(rand() * H), 1, 1);
  }
}

function paintNumeral(ctx: CanvasRenderingContext2D, text: string, baseline: number): void {
  ctx.font = `700 320px ${DISPLAY}`;
  /* The one glow in the system, and only on this screen — see .sk-count. */
  ctx.shadowColor = 'rgba(248, 164, 76, 0.5)';
  ctx.shadowBlur = 110;
  ctx.fillStyle = INK;
  ctx.fillText(text, CX, baseline);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

function paintWeekDots(
  ctx: CanvasRenderingContext2D,
  dots: readonly { readonly label: string; readonly completed: boolean }[],
  top: number,
): void {
  const size = 66;
  const gap = 22;
  const rowWidth = dots.length * size + (dots.length - 1) * gap;
  let x = CX - rowWidth / 2;

  for (const dot of dots) {
    const cx = x + size / 2;
    const cy = top + size / 2;

    if (dot.completed) {
      const g = ctx.createLinearGradient(x, top, x + size, top + size);
      g.addColorStop(0, APRICOT_BRIGHT);
      g.addColorStop(1, '#ef8f3f');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.fill();
      /* White on apricot fails contrast; --vox-on-apricot is the assigned ink. */
      drawCheck(ctx, cx, cy, 26, ON_APRICOT);
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 3;
      ctx.setLineDash([9, 8]);
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2 - 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.font = `600 22px ${DISPLAY}`;
    ctx.fillStyle = INK_TERTIARY;
    ctx.fillText(dot.label.toUpperCase(), cx, top + size + 38);

    x += size + gap;
  }
}

function drawCheck(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  const s = size / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - s, cy);
  ctx.lineTo(cx - s * 0.25, cy + s * 0.7);
  ctx.lineTo(cx + s, cy - s * 0.62);
  ctx.stroke();
}

/**
 * Two stats and the wordmark, pinned to the bottom above a hairline. The stats
 * are what make the poster a claim rather than a boast: the current run is
 * only interesting next to the best one.
 */
function paintFooter(ctx: CanvasRenderingContext2D, data: StreakShareData): void {
  const ruleY = H - FOOTER_BAND;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(PAD, ruleY, W - PAD * 2, 1);

  const statY = ruleY + 74;
  paintStat(ctx, CX - 190, statY, String(data.bestRun), 'BEST RUN');
  paintStat(ctx, CX + 190, statY, String(data.daysLogged), 'DAYS LOGGED');

  /* Divider between the two stats, matching the card's 2-column grid. */
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(CX, statY - 40, 1, 84);

  const markSize = 46;
  const markX = CX - 100;
  const markY = H - PAD - 46;
  ctx.fillStyle = BRAND;
  roundRect(ctx, markX, markY, markSize, markSize, 14);
  ctx.fill();
  ctx.font = `700 27px ${DISPLAY}`;
  ctx.fillStyle = INK;
  ctx.fillText('V', markX + markSize / 2, markY + 33);

  ctx.textAlign = 'left';
  ctx.font = `600 31px ${DISPLAY}`;
  ctx.fillStyle = INK;
  ctx.fillText('VoxFit', markX + markSize + 18, markY + 21);
  ctx.font = `500 20px ${DISPLAY}`;
  ctx.fillStyle = INK_TERTIARY;
  ctx.fillText('Say it. It’s logged.', markX + markSize + 18, markY + 45);
  ctx.textAlign = 'center';
}

function paintStat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseline: number,
  value: string,
  label: string,
): void {
  ctx.font = `700 46px ${MONO}`;
  ctx.fillStyle = INK;
  ctx.fillText(value, cx, baseline);
  ctx.font = `600 20px ${DISPLAY}`;
  ctx.fillStyle = INK_TERTIARY;
  drawTracked(ctx, label, cx, baseline + 34, 2.4);
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Letter-spaced text, drawn one glyph at a time.
 *
 * `ctx.letterSpacing` exists but only in newer engines, and the Android
 * WebView version is whatever the device shipped with — a silently ignored
 * property would collapse every tracked label in the poster. Measuring and
 * placing each glyph works everywhere and is exact.
 *
 * Caller must have `textAlign = 'center'`; the run is centred on `cx`.
 */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  baseline: number,
  spacing: number,
): void {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);

  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  let x = cx - total / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, x, baseline);
    x += (widths[i] ?? 0) + spacing;
  });
  ctx.textAlign = prevAlign;
}

/** Greedy word wrap that honours explicit newlines in the source string. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    let line = words[0] ?? '';
    for (let i = 1; i < words.length; i++) {
      const word = words[i] ?? '';
      const candidate = `${line} ${word}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** `#rrggbb` → `rgba()`. Only hex literals from the token set are passed in. */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Mulberry32 — small, seeded, and good enough for scattering grain. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode the streak image'));
    }, 'image/png');
  });
}
