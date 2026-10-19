import { createCanvas } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { afterAll, describe, expect, it } from 'vitest';
import {
  FAMILIES,
  generateCorpus,
  makeCase,
  pairedCases,
  renderCase,
  renderGeometry,
  supplementalCases,
  type Locale,
  type Page,
} from '../src/index.js';
import { Canvas, wrap } from '../src/canvas.js';
import { dateText, printedNumber } from '../src/locales.js';
const out = mkdtempSync(join(tmpdir(), 'lab-report-fixtures-test-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));
async function open(pdf: Uint8Array) {
  return getDocument({ data: Uint8Array.from(pdf), useSystemFonts: false }).promise;
}
async function pixels(pdf: Uint8Array) {
  const doc = await open(pdf);
  try {
    const page = await doc.getPage(1),
      viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    await page.render({
      canvas: canvas as never,
      canvasContext: canvas.getContext('2d') as never,
      viewport,
    }).promise;
    return {
      canvas,
      data: canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data,
    };
  } finally {
    await doc.destroy();
  }
}

describe('corpus público independente', () => {
  it.each(['en-US', 'pt-BR'] as const)(
    'cobre as seis famílias, gabaritos e campos em %s',
    (locale) => {
      const cases = pairedCases(locale);
      expect(cases).toHaveLength(12);
      expect(new Set(cases.map((c) => c.id)).size).toBe(12);
      for (const family of FAMILIES)
        expect(new Set(cases.filter((c) => c.family === family).map((c) => c.split)).size).toBe(1);
      for (const c of cases) {
        const { entry } = renderCase(c, 'digital');
        for (const row of c.expected) {
          expect(
            entry.fields.some(
              (f) =>
                f.code === row.code &&
                f.role === 'value' &&
                f.text === row.display &&
                f.page === row.page,
            ),
          ).toBe(true);
          expect(entry.fields.some((f) => f.code === row.code && f.role === 'label')).toBe(true);
          if (row.unit)
            expect(entry.fields.some((f) => f.code === row.code && f.role === 'unit')).toBe(true);
          if (row.referenceText)
            expect(entry.fields.some((f) => f.code === row.code && f.role === 'reference')).toBe(
              true,
            );
        }
        if (c.family === 'wrapped') {
          const fragments = entry.fields.filter((f) => f.role === 'label');
          expect(
            fragments.some(
              (f) =>
                fragments.filter((other) => other.page === f.page && other.id === f.id).length > 1,
            ),
          ).toBe(true);
        }
        expect(entry.fields.some((f) => f.role === 'specimen')).toBe(true);
        expect(entry.fields.filter((f) => f.role === 'value').every((f) => !f.clipped)).toBe(true);
      }
      const odd = makeCase('history', 1, 1, locale),
        even = makeCase('ruled', 2, 1, locale);
      expect(odd.expected.find((r) => r.code === 'Creatinine')?.display).toBe(
        locale === 'pt-BR' ? '0,08' : '0.08',
      );
      expect(even.expected.find((r) => r.code === 'Creatinine')?.display).toBe(
        locale === 'pt-BR' ? '0,80' : '0.80',
      );
      expect(odd.expected.find((r) => r.code === 'WBC')?.unit).toBe(
        locale === 'pt-BR' ? '/µL' : 'cells/uL',
      );
      expect(even.expected.find((r) => r.code === 'WBC')?.unit).toBe(
        locale === 'pt-BR' ? 'mil/µL' : 'Thousand/uL',
      );
      expect(odd.expected.find((r) => r.code === 'Nitrite_Urine')?.value).toBe(
        locale === 'pt-BR' ? 'NEGATIVO' : 'NEGATIVE',
      );
      expect(odd.expected.some((r) => r.previous)).toBe(true);
      expect(odd.expected.some((r) => r.comparator === '<')).toBe(true);
      expect(odd.expected.some((r) => !r.referenceText)).toBe(true);
      expect(makeCase('ruled', 22).expected).not.toEqual(makeCase('ruled', 24).expected);
    },
  );
  it.each(['digital', 'clean', 'typical', 'difficult', 'mixed', 'unreadable'] as const)(
    '%s é determinístico; leitor independente confirma as camadas',
    async (quality) => {
      const c =
        quality === 'unreadable'
          ? supplementalCases('pt-BR').find((c) => c.quality === 'unreadable')!.test
          : makeCase('continued', 51, 2, 'pt-BR');
      const a = renderCase(c, quality),
        b = renderCase(c, quality);
      expect(a.pdf.equals(b.pdf)).toBe(true);
      expect(a.entry.sha256).toBe(createHash('sha256').update(a.pdf).digest('hex'));
      const doc = await open(a.pdf);
      try {
        expect(doc.numPages).toBe(c.pages.length);
        for (let i = 1; i <= doc.numPages; i++) {
          const p = await doc.getPage(i),
            text = await p.getTextContent();
          expect(p.view).toEqual([0, 0, 595, 842]);
          const strings = text.items
            .filter((x) => 'str' in x)
            .map((x) => x.str)
            .join('');
          expect(strings.length > 0).toBe(a.entry.pageKinds[i - 1] === 'digital');
          if (a.entry.pageKinds[i - 1] === 'digital')
            expect(strings).toContain('Coleta: 15/01/2026');
        }
      } finally {
        await doc.destroy();
      }
      const field = a.entry.fields.find((f) => f.role === 'value') ?? a.entry.fields[0]!;
      expect(field.quad).toEqual(
        quality === 'digital' || quality === 'mixed'
          ? field.sourceQuad
          : expect.not.arrayContaining([...field.sourceQuad]),
      );
    },
  );
  it('boxes do scan rotacionado contêm tinta real; fora dos boxes não aparecem dígitos', async () => {
    const page: Page = {
      lines: [
        {
          y: 392,
          cells: [
            {
              x: 260,
              text: '0,08 <5 µL',
              font: 'Helvetica-Bold',
              size: 18,
              field: { id: 'value', role: 'value' },
            },
          ],
        },
      ],
    };
    for (const quality of ['digital', 'clean', 'typical', 'difficult'] as const) {
      const r = renderGeometry([page], { quality, seed: 31 });
      const { canvas, data } = await pixels(r.pdf);
      const box = r.fields[0]!.box;
      let ink = 0,
        outside = 0;
      for (let y = 0; y < canvas.height; y++)
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (data[i]! < 180 && data[i + 1]! < 180 && data[i + 2]! < 180) {
            ink++;
            if (
              x / 2 < box[0] - 2 ||
              x / 2 > box[2] + 2 ||
              y / 2 < box[1] - 2 ||
              y / 2 > box[3] + 2
            )
              outside++;
          }
        }
      expect(ink).toBeGreaterThan(200);
      expect(outside / ink).toBeLessThan(0.02);
    }
  });
  it('geometria genérica suporta fills, regras, carimbos, clipping e fallback sem tags', async () => {
    const c = new Canvas(),
      style = { font: 'Helvetica-Bold' as const, size: 12 };
    c.rect(10, 10, 100, 40, [0.9, 0.9, 0.9]);
    c.box(10, 10, 110, 50, { width: 1, color: [0.1, 0.2, 0.3] });
    c.text(20, 30, 'TESTE', style);
    c.centerText(200, 80, 'CENTRO', style);
    c.underline(20, 30, 'TESTE', style);
    c.stamp({
      x: 40,
      y: 550,
      text: 'CARIMBO',
      font: 'Helvetica',
      size: 15,
      color: [0.3, 0.3, 0.3],
      angle: 20,
    });
    c.text(-5, 100, 'CLIPPED', style);
    c.text(20, 130, '', style);
    const r = renderGeometry([c.page()]);
    expect(r.fields).toHaveLength(4);
    expect(r.fields.every((f) => f.role === 'other')).toBe(true);
    expect(r.fields.find((f) => f.text === 'CLIPPED')?.clipped).toBe(true);
    expect(r.fields.find((f) => f.text === 'CLIPPED')?.visibleBox[0]).toBe(0);
    const { data } = await pixels(r.pdf);
    expect(data.some((v) => v < 100)).toBe(true);
    expect(wrap('uma palavra muito longa', 45, style).length).toBeGreaterThan(1);
    expect(wrap('', 45, style)).toEqual([]);
  });
  it('traduz prosa de referências sem perder unidade ou valor numérico', () => {
    const rows = makeCase('continued', 529815, 15, 'pt-BR').expected;
    expect(rows.find((r) => r.code === 'Bacteria_Urine')?.referenceText).toBe('NÃO OBSERVADO /HPF');
    expect(rows.find((r) => r.code === 'eGFR')?.referenceText).toContain('Maior ou igual a 60');
    expect(rows.find((r) => r.code === 'Leukocytes_Urine')?.referenceText).toContain(
      'Menor ou igual a 5',
    );
    expect(
      rows.every(
        (r) => !r.referenceText.includes('OR =') && !r.referenceText.includes('NONE SEEN'),
      ),
    ).toBe(true);
  });
  it('paginação longa não duplica marcadores nem cria páginas vazias', () => {
    for (const locale of ['pt-BR', 'en-US'] as const)
      for (const { test, quality } of supplementalCases(locale)) {
        expect(test.pages.length).toBeGreaterThan(0);
        if (quality === 'unreadable') {
          expect(test.expected).toEqual([]);
          continue;
        }
        expect(new Set(test.expected.map((r) => r.code)).size).toBe(test.expected.length);
        expect(new Set(test.expected.map((r) => r.page)).size).toBe(test.pages.length);
        expect(new Set(test.pages.map((p) => JSON.stringify(p))).size).toBe(test.pages.length);
      }
  });
  it(
    'gera os 104 PDFs, gabaritos e anotações; todos os arquivos conferem',
    { timeout: 120_000 },
    async () => {
      const manifest = generateCorpus(out);
      expect(manifest.version).toBe(3);
      expect(manifest.entries).toHaveLength(104);
      expect(manifest.entries.reduce((n, e) => n + e.pageCount, 0)).toBe(216);
      for (const entry of manifest.entries) {
        expect(entry.bytes).toBeLessThan(20 * 1024 * 1024);
        const pdf = readFileSync(join(out, entry.file));
        expect(createHash('sha256').update(pdf).digest('hex')).toBe(entry.sha256);
        expect(
          JSON.parse(readFileSync(join(out, `${entry.id}.fields.json`), 'utf8')).fields,
        ).toEqual(entry.fields);
        expect(JSON.parse(readFileSync(join(out, `${entry.id}.expected.json`), 'utf8'))).toEqual(
          entry.expected,
        );
        const doc = await open(pdf);
        try {
          expect(doc.numPages).toBe(entry.pageCount);
        } finally {
          await doc.destroy();
        }
      }
    },
  );
  it('rejeita configurações inválidas antes de desenhar', () => {
    for (const locales of [[], ['pt-BR', 'pt-BR'], ['bad']] as Locale[][])
      expect(() => generateCorpus(out, locales)).toThrow();
    expect(() => makeCase('ruled', 1, 0)).toThrow();
    expect(() => makeCase('ruled', NaN)).toThrow();
    expect(() => makeCase('ruled', 1, 31)).toThrow();
    expect(() => makeCase('bad' as never, 1)).toThrow();
    expect(() => makeCase('ruled', 1, 1, 'bad' as never)).toThrow();
    expect(() => makeCase('ruled', 1, 20)).toThrow();
    expect(() => renderCase(makeCase('ruled', 1), 'unreadable')).toThrow();
    expect(() => renderGeometry([])).toThrow();
    expect(() => renderGeometry(Array(31).fill({ lines: [] }))).toThrow();
    expect(() => renderGeometry([{ lines: [] }], { quality: 'bad' as never })).toThrow();
    expect(dateText('2026-01-15', 'pt-BR')).toBe('15/01/2026');
    expect(printedNumber('0.08', 'en-US')).toBe('0.08');
  });
});
