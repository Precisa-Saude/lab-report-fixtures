import { createHash } from 'node:crypto';

import { type Canvas, createCanvas, PDFDocument, type SKRSContext2D } from '@napi-rs/canvas';

import { fontSpec, measure } from './fonts.js';
import type {
  Box,
  FieldAnnotation,
  FieldTag,
  FontName,
  Page,
  PageSize,
  Quad,
  Rgb,
} from './geometry.js';
import type { CorpusCase, CorpusEntry, Quality, ScanSettings } from './types.js';

export const SCANS: Record<'clean' | 'typical' | 'difficult', ScanSettings> = {
  clean: { blur: false, contrast: 1, dpi: 300, jpegQuality: 90, noise: 0, rotation: 0, shadow: 0 },
  difficult: {
    blur: true,
    contrast: 0.55,
    dpi: 110,
    jpegQuality: 35,
    noise: 8,
    rotation: -1.8,
    shadow: 35,
  },
  typical: {
    blur: false,
    contrast: 0.8,
    dpi: 170,
    jpegQuality: 70,
    noise: 3,
    rotation: 0.6,
    shadow: 10,
  },
};
export const hash = (bytes: Uint8Array | string): string =>
  createHash('sha256').update(bytes).digest('hex');
const color = (rgb: Rgb = [0, 0, 0]): string =>
  `rgb(${rgb.map((v) => Math.round(v * 255)).join(',')})`;
const mapped = (q: Quad, fn: (x: number, y: number) => readonly [number, number]): Quad =>
  q.flatMap((_, i) => (i % 2 ? [] : [...fn(q[i]!, q[i + 1]!)])) as unknown as Quad;
const bounds = (quad: Quad): Box => {
  const xs = [quad[0], quad[2], quad[4], quad[6]],
    ys = [quad[1], quad[3], quad[5], quad[7]];
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
function annotation(
  tag: FieldTag,
  text: string,
  sourceQuad: Quad,
  page: number,
  size: PageSize,
  scan?: ScanSettings,
): FieldAnnotation {
  const quad = scan
    ? mapped(sourceQuad, (x, y) => {
        const s = scan.dpi / 72,
          w = Math.ceil(size.width * s),
          h = Math.ceil(size.height * s);
        const a = (scan.rotation * Math.PI) / 180,
          c = Math.cos(a),
          n = Math.sin(a);
        return [
          ((c * (x * s - w / 2) - n * (y * s - h / 2) + w / 2) * size.width) / w,
          ((n * (x * s - w / 2) + c * (y * s - h / 2) + h / 2) * size.height) / h,
        ];
      })
    : sourceQuad;
  const box = bounds(quad);
  const visibleBox = box.map((v, i) =>
    Math.max(0, Math.min(i % 2 ? size.height : size.width, v)),
  ) as unknown as Box;
  return {
    ...tag,
    box,
    clipped: box.some((v, i) => v !== visibleBox[i]),
    page,
    quad,
    sourceQuad,
    text,
    visibleBox,
  };
}

/** Desenha o mesmo modelo no PDF vetorial e no scan rasterizado. */
type DrawingContext = Pick<
  SKRSContext2D,
  | 'fillStyle'
  | 'fillRect'
  | 'beginPath'
  | 'lineTo'
  | 'moveTo'
  | 'closePath'
  | 'fill'
  | 'save'
  | 'translate'
  | 'rotate'
  | 'font'
  | 'fillText'
  | 'restore'
  | 'lineWidth'
  | 'strokeStyle'
  | 'stroke'
>;
function draw(
  ctx: DrawingContext,
  page: Page,
  size: PageSize,
  number: number,
  scan?: ScanSettings,
): FieldAnnotation[] {
  const fields: FieldAnnotation[] = [];
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, size.width, size.height);
  for (const fill of page.fills ?? []) {
    ctx.beginPath();
    fill.points.forEach(([x, y], i) =>
      i ? ctx.lineTo(x, size.height - y) : ctx.moveTo(x, size.height - y),
    );
    ctx.closePath();
    ctx.fillStyle = color(fill.color);
    ctx.fill();
  }
  const text = (
    x: number,
    y: number,
    value: string,
    font: FontName = 'Helvetica',
    fontsize = 9,
    rgb?: Rgb,
    tag?: FieldTag,
    angle = 0,
  ) => {
    if (!value) return;
    const metric = measure(value, font, fontsize),
      a = (angle * Math.PI) / 180;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.font = fontSpec(font, fontsize);
    ctx.fillStyle = color(rgb);
    ctx.fillText(value, 0, 0);
    ctx.restore();
    const left = -metric.actualBoundingBoxLeft - 0.5,
      right = metric.actualBoundingBoxRight + 0.5;
    const top = -metric.actualBoundingBoxAscent - 0.5,
      bottom = metric.actualBoundingBoxDescent + 0.5;
    const sourceQuad = mapped([left, top, right, top, right, bottom, left, bottom], (px, py) => [
      x + px * Math.cos(a) - py * Math.sin(a),
      y + px * Math.sin(a) + py * Math.cos(a),
    ]);
    fields.push(
      annotation(
        tag ?? { id: `p${number}:span${fields.length}`, role: 'other' },
        value,
        sourceQuad,
        number,
        size,
        scan,
      ),
    );
  };
  for (const stamp of page.stamps ?? [])
    text(
      stamp.x,
      size.height - stamp.y,
      stamp.text,
      stamp.font,
      stamp.size,
      stamp.color,
      stamp.field,
      -stamp.angle,
    );
  for (const rule of page.rules ?? []) {
    ctx.beginPath();
    ctx.moveTo(rule.x1, size.height - rule.y1);
    ctx.lineTo(rule.x2, size.height - rule.y2);
    ctx.lineWidth = rule.width ?? 0.5;
    ctx.strokeStyle = color(rule.color);
    ctx.stroke();
  }
  for (const line of page.lines)
    for (const cell of line.cells)
      text(
        cell.x,
        size.height - line.y,
        cell.text,
        cell.font,
        cell.size ?? line.size,
        cell.color,
        cell.field,
      );
  return fields;
}
function degrade(source: Canvas, settings: ScanSettings, seed: number) {
  const { height, width } = source;
  const rotated = createCanvas(width, height),
    ctx = rotated.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2);
  ctx.rotate((settings.rotation * Math.PI) / 180);
  ctx.drawImage(source, -width / 2, -height / 2);
  ctx.resetTransform();
  const image = ctx.getImageData(0, 0, width, height),
    pixels = image.data;
  let state = seed >>> 0;
  for (let i = 0; i < pixels.length; i += 4) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const gray = pixels[i]! * 0.299 + pixels[i + 1]! * 0.587 + pixels[i + 2]! * 0.114;
    const x = (i / 4) % width;
    const noise = (state / 4294967296 - 0.5) * settings.noise;
    const v = 255 - (255 - gray) * settings.contrast + noise - settings.shadow * (1 - x / width);
    pixels[i] = pixels[i + 1] = pixels[i + 2] = Math.max(0, Math.min(255, v));
  }
  if (settings.blur) {
    const copy = new Uint8ClampedArray(pixels);
    for (let y = 1; y < height - 1; y++)
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        const v =
          (copy[i]! * 4 +
            copy[i - 4]! +
            copy[i + 4]! +
            copy[i - width * 4]! +
            copy[i + width * 4]!) /
          8;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = v;
      }
  }
  ctx.putImageData(image, 0, 0);
  return rotated;
}
export interface GeometryOptions {
  paper?: 'a4' | 'letter';
  quality?: Quality;
  seed?: number;
}
/** Entrada a partir do rodapé; anotações a partir do canto superior esquerdo. */
export function renderGeometry(pages: readonly Page[], options: GeometryOptions = {}) {
  const quality = options.quality ?? 'digital';
  if (!['digital', 'clean', 'typical', 'difficult', 'mixed', 'unreadable'].includes(quality))
    throw new Error('Qualidade inválida.');
  if (!pages.length || pages.length > 30) throw new Error('São necessárias entre 1 e 30 páginas.');
  const size: PageSize =
    options.paper === 'a4' ? { height: 842, width: 595 } : { height: 792, width: 612 };
  const scan =
    quality === 'digital'
      ? undefined
      : SCANS[quality === 'clean' || quality === 'difficult' ? quality : 'typical'];
  const doc = new PDFDocument({
    creator: 'lab-report-fixtures',
    encodingQuality: scan?.jpegQuality ?? 101,
    producer: 'lab-report-fixtures',
  });
  const fields: FieldAnnotation[] = [],
    pageKinds: CorpusEntry['pageKinds'] = [],
    textChars: number[] = [];
  for (const [i, page] of pages.entries()) {
    const target = doc.beginPage(size.width, size.height);
    const digital = quality === 'digital' || (quality === 'mixed' && i % 2 === 0);
    pageKinds.push(digital ? 'digital' : 'scan');
    if (digital) fields.push(...draw(target, page, size, i + 1));
    else {
      const s = scan!.dpi / 72;
      const canvas = createCanvas(Math.ceil(size.width * s), Math.ceil(size.height * s));
      const ctx = canvas.getContext('2d');
      ctx.scale(s, s);
      fields.push(...draw(ctx, page, size, i + 1, scan));
      // O binding PDF oferece drawImage, mas 0.1.88 omite o método no tipo PDF.
      (target as unknown as Pick<SKRSContext2D, 'drawImage'>).drawImage(
        degrade(canvas, scan!, (options.seed ?? 0) + i),
        0,
        0,
        size.width,
        size.height,
      );
    }
    textChars.push(
      digital ? fields.filter((f) => f.page === i + 1).reduce((n, f) => n + f.text.length, 0) : 0,
    );
    doc.endPage();
  }
  return {
    fields,
    pageKinds,
    pageSizes: pages.map(() => ({ ...size })),
    pdf: doc.close(),
    textChars,
    ...(scan && { scan }),
  };
}
export function renderCase(
  test: CorpusCase,
  quality: Quality,
): { pdf: Buffer; entry: CorpusEntry } {
  if (quality === 'unreadable' && test.expected.length)
    throw new Error('O caso ilegível não pode conter leituras recuperáveis no gabarito.');
  const rendered = renderGeometry(test.pages, {
    paper: test.locale === 'pt-BR' ? 'a4' : 'letter',
    quality,
    seed: test.seed,
  });
  const id = `${test.id}-${quality}`;
  const { pdf, ...metadata } = rendered;
  return {
    entry: {
      bytes: pdf.length,
      collectionDate: test.collectionDate,
      family: test.family,
      file: `${id}.pdf`,
      id,
      locale: test.locale,
      pageCount: test.pages.length,
      pageHashes: test.pages.map((page) => hash(JSON.stringify(page))),
      pairId: test.pairId,
      quality,
      seed: test.seed,
      sha256: hash(pdf),
      split: test.split,
      ...metadata,
      behavior: quality === 'unreadable' ? 'reject-or-review-empty' : 'complete',
      expected: test.expected,
      review: quality === 'digital' ? 'not-required' : 'required',
    },
    pdf,
  };
}
