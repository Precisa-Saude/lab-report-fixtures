import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Canvas, watermark } from './canvas.js';
import { makeCase, pairedCases } from './cases.js';
import { onPaper } from './locales.js';
import { renderCase } from './render.js';
import type { CorpusCase, CorpusEntry, CorpusManifest, Locale, Quality } from './types.js';
export { renderCase } from './render.js';
export function supplementalCases(
  locale: Locale = 'en-US',
): { test: CorpusCase; quality: Quality }[] {
  const unreadable = new Canvas();
  watermark(unreadable);
  const style = { font: 'Helvetica' as const, size: 10 };
  unreadable.text(
    30,
    35,
    locale === 'pt-BR'
      ? 'AMOSTRA SINTÉTICA - resultados intencionalmente ilegíveis'
      : 'SYNTHETIC SAMPLE - intentionally unreadable result area',
    style,
  );
  unreadable.text(
    30,
    60,
    locale === 'pt-BR'
      ? 'Nenhum valor do paciente pode ser recuperado desta página.'
      : 'No patient values can be recovered from this page.',
    style,
  );
  for (let top = 130; top < 550; top += 40) unreadable.rect(30, top, 540, 18, [0.15, 0.15, 0.15]);
  const test = makeCase('borderless', 529_999, 1, locale);
  return [
    { quality: 'mixed', test: makeCase('continued', 529_800, 6, locale) },
    { quality: 'typical', test: makeCase('continued', 529_815, 15, locale) },
    { quality: 'typical', test: makeCase('continued', 529_830, 30, locale) },
    {
      quality: 'unreadable',
      test: {
        ...test,
        expected: [],
        id: locale === 'pt-BR' ? 'br-unreadable-529999' : 'unreadable-529999',
        pages: [onPaper(unreadable.page(), locale)],
        pairId: 'unreadable-529999',
      },
    },
  ];
}

export function generateCorpus(
  out: string,
  locales: readonly Locale[] = ['en-US', 'pt-BR'],
): CorpusManifest {
  mkdirSync(out, { recursive: true });
  if (
    !locales.length ||
    new Set(locales).size !== locales.length ||
    locales.some((locale) => !['en-US', 'pt-BR'].includes(locale))
  )
    throw new Error('Locales inválidos.');
  const targets = locales
    .flatMap((locale) => pairedCases(locale))
    .flatMap((test) =>
      (['digital', 'clean', 'typical', 'difficult'] as const).map((quality) => ({ quality, test })),
    );
  const entries: CorpusEntry[] = [];
  for (const { quality, test } of [
    ...targets,
    ...locales.flatMap((locale) => supplementalCases(locale)),
  ]) {
    const { entry, pdf } = renderCase(test, quality);
    if (entry.bytes > 20 * 1024 * 1024) throw new Error(`${entry.id}: excede 20 MiB`);
    writeFileSync(join(out, entry.file), pdf);
    writeFileSync(
      join(out, `${entry.id}.expected.json`),
      `${JSON.stringify(entry.expected, null, 2)}\n`,
    );
    writeFileSync(
      join(out, `${entry.id}.fields.json`),
      `${JSON.stringify({ fields: entry.fields, pageSizes: entry.pageSizes }, null, 2)}\n`,
    );
    entries.push(entry);
  }
  const manifest: CorpusManifest = { entries, synthetic: true, version: 3 };
  writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
