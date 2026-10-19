#!/usr/bin/env node
import { parseArgs } from 'node:util';

import { generateCorpus } from './generate.js';
const { values } = parseArgs({
  options: {
    help: { type: 'boolean' },
    locale: { default: 'all', type: 'string' },
    out: { type: 'string' },
  },
});
if (values.help)
  process.stdout.write('lab-report-fixtures --out DIRECTORY [--locale all|pt-BR|en-US]\n');
else {
  if (!values.out || !['all', 'pt-BR', 'en-US'].includes(values.locale!))
    throw new Error('Use --out DIRECTORY e --locale all|pt-BR|en-US.');
  const manifest = generateCorpus(
    values.out,
    values.locale === 'all' ? ['en-US', 'pt-BR'] : [values.locale as 'pt-BR' | 'en-US'],
  );
  process.stdout.write(
    `${JSON.stringify({
      documents: manifest.entries.length,
      out: values.out,
      pages: manifest.entries.reduce((n, e) => n + e.pageCount, 0),
    })}\n`,
  );
}
