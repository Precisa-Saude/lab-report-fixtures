# lab-report-fixtures

[Documentação completa em português](README.md)

Generate fictional laboratory PDFs in **Brazilian Portuguese and US English**,
with current-reading ground truth and field geometry. Library and synthetic data:
MIT. Renderer: `@napi-rs/canvas` (MIT); bundled unmodified Liberation Sans fonts:
OFL 1.1. No patient reports or external datasets are included.

Node >=22, native prebuilt renderer, one runtime dependency, no peer dependencies.
No extraction engine, private terminology package, cloud client, paid calls or
credentials. Not a browser library. Initial release is prepared for publication;
until then, install the tarball built with `pnpm pack`.

```sh
npm install @precisa-saude/lab-report-fixtures
npx lab-report-fixtures --out output --locale all
```

```js
import { makeCase, renderCase } from '@precisa-saude/lab-report-fixtures';
const { pdf, entry } = renderCase(makeCase('history', 42, 1, 'en-US'), 'typical');
// pdf: Buffer; entry.expected: current printed readings; entry.fields: annotations.
```

CommonJS is supported. The default corpus has 104 PDFs / 216 pages: six layout
families, digital/clean/typical/difficult paired variants, mixed pages, distinct
15/30-page documents and unreadable negatives in each locale. pt-BR uses A4,
decimal commas, dd/mm/yyyy and localized labels/units; en-US uses Letter.
Variants and translations share pairId/split. Hold out whole families and pairs.
Simulated scans contain images only, without hidden source text.

Each PDF has `.expected.json` and `.fields.json` sidecars. Schema-3 manifest includes
hashes, seed, scan settings, dimensions, page kinds and annotations. `textChars`
counts drawn source span characters on digital pages, not parser-extracted length.

Fields include semantic role/code, text, page (1-based), sourceQuad, transformed
quad, box, visibleBox and clipped. Coordinates use **PDF points from the top left**.
Quads contain four ordered corner pairs; boxes are `[left, top, right, bottom]`.
Source geometry includes 0.5 pt ink padding; scan geometry accounts for rotation,
pixel rounding and final scaling. Blur/JPEG can spread pixels beyond geometry.
Wrapped spans share a field id: group by `(page, id)`. Current and historical values
have separate roles. Empty cells have no text annotations. No OCR inference is used.

Use `renderGeometry` for your own layouts, assigning `cell.field` tags; untagged
spans receive role `other`. Input drawing y coordinates start at the bottom.
Legacy Helvetica/Courier/Times names all map to bundled Sans regular/bold fonts.

Values/ranges are invented adversarial test data, not validated clinical guidance.
No guarantee of real-world extraction accuracy; physical scans remain useful.
Bytes are deterministic for a fixed runtime/platform and pinned renderer version,
not guaranteed identical across OS/native versions. Run `pnpm check` and
`pnpm test:package`; see the Portuguese README for the complete API/data contract,
provenance, reproduction and contribution instructions.
