/** Instalação externa: não depende de symlink, fonte do sistema ou código privado. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const folder = mkdtempSync(join(tmpdir(), 'lab-fixtures-consumer-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
try {
  if (!process.argv[2])
    execFileSync(npm, ['pack', '--pack-destination', folder, '--json'], {
      cwd: root,
      stdio: 'pipe',
    });
  const tarball = process.argv[2]
    ? resolve(process.argv[2])
    : join(
        folder,
        readdirSync(folder).find((name) => name.endsWith('.tgz')),
      );
  const entries = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).trim().split('\n');
  assert(
    entries.every((name) =>
      /^package\/(dist\/|assets\/|package.json$|LICENSE$|NOTICE$|README(\.en)?\.md$)/.test(name),
    ),
  );
  assert(entries.includes('package/assets/LICENSE_LIBERATION'));
  writeFileSync(
    join(folder, 'package.json'),
    JSON.stringify({ name: 'external-fixture-consumer', private: true, type: 'module' }),
  );
  execFileSync(
    npm,
    [
      'install',
      '--omit=dev',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--registry=https://registry.npmjs.org',
      tarball,
    ],
    { cwd: folder, stdio: 'pipe', timeout: 120_000 },
  );
  const snippet = `const {pdf,entry}=lib.renderCase(lib.makeCase('ruled',42,1,'pt-BR'),'digital');
    if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-')) || !entry.fields.some(f=>f.role==='value')) throw new Error('Invalid PDF');
    process.stdout.write(entry.sha256);`;
  writeFileSync(
    join(folder, 'esm.mjs'),
    `import * as lib from '@precisa-saude/lab-report-fixtures';${snippet}`,
  );
  writeFileSync(
    join(folder, 'cjs.cjs'),
    `const lib=require('@precisa-saude/lab-report-fixtures');${snippet}`,
  );
  const esm = execFileSync(process.execPath, ['esm.mjs'], { cwd: folder, encoding: 'utf8' });
  const cjs = execFileSync(process.execPath, ['cjs.cjs'], { cwd: folder, encoding: 'utf8' });
  assert.equal(esm, cjs);
  const repeated = execFileSync(process.execPath, ['esm.mjs'], { cwd: folder, encoding: 'utf8' });
  assert.equal(esm, repeated);
  const typeExample = `const result: lib.CorpusEntry = lib.renderCase(lib.makeCase('ruled',42),'digital').entry; void result.fields;`;
  writeFileSync(
    join(folder, 'esm.mts'),
    `import * as lib from '@precisa-saude/lab-report-fixtures';${typeExample}`,
  );
  writeFileSync(
    join(folder, 'cjs.cts'),
    `import lib = require('@precisa-saude/lab-report-fixtures');${typeExample}`,
  );
  execFileSync(
    process.execPath,
    [
      join(root, 'node_modules/typescript/bin/tsc'),
      '--strict',
      '--skipLibCheck',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--noEmit',
      '--types',
      'node',
      '--typeRoots',
      join(root, 'node_modules/@types'),
      'esm.mts',
      'cjs.cts',
    ],
    { cwd: folder, stdio: 'pipe' },
  );
  const bin = join(folder, 'node_modules/@precisa-saude/lab-report-fixtures/dist/cli.js');
  assert(
    execFileSync(process.execPath, [bin, '--help'], { encoding: 'utf8' }).includes('--locale'),
  );
  const summary = JSON.parse(
    execFileSync(process.execPath, [bin, '--out', join(folder, 'reports'), '--locale', 'pt-BR'], {
      encoding: 'utf8',
      timeout: 60_000,
    }),
  );
  assert.equal(summary.documents, 52);
  assert.equal(summary.pages, 108);
  const manifest = JSON.parse(readFileSync(join(folder, 'reports/manifest.json'), 'utf8'));
  assert(manifest.entries.every((e) => e.locale === 'pt-BR' && e.fields.length > 0));
  const dependencies = JSON.parse(readFileSync(join(folder, 'package-lock.json'), 'utf8')).packages;
  assert(
    !Object.keys(dependencies).some((name) =>
      /mupdf|ghostscript|fhir|extraction|aws-sdk/.test(name),
    ),
  );
  process.stdout.write(
    `${JSON.stringify({ tarball: basename(tarball), esm: true, cjs: true, types: true, cli: true, documents: 52, sha256: esm, dependencies: Object.keys(dependencies).length - 1 })}\n`,
  );
} finally {
  rmSync(folder, { recursive: true, force: true });
}
