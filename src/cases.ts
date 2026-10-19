/** Gabarito impresso: não passa pelo mapeador FHIR nem pela extração. */
import { Canvas, watermark, wrap } from './canvas.js';
import { dateText, localizeReading, onPaper } from './locales.js';
import markers from './markers.json' with { type: 'json' };
import type { LabReading } from './reading.js';
import type { CorpusCase, Family, Locale } from './types.js';

const STYLE = { font: 'Helvetica' as const, size: 9 };
const BOLD = { font: 'Helvetica-Bold' as const, size: 9 };
export const FAMILIES: readonly Family[] = [
  'ruled',
  'borderless',
  'wrapped',
  'range-below',
  'history',
  'continued',
];

/** Duas famílias inteiras reservadas; nenhuma variante troca de split. */
const splitOf = (family: Family) =>
  family === 'range-below' || family === 'continued'
    ? ('holdout' as const)
    : ('development' as const);

function readings(seed: number): LabReading[] {
  const codes = [
    'Glucose',
    'Creatinine',
    'Sodium',
    'WBC',
    'Hgb',
    'LDL',
    'AntiThyroglobulin',
    'Nitrite_Urine',
  ];
  return codes.map((code) => {
    const definition = markers.find((marker) => marker.code === code);
    if (!definition) throw new Error(`Marcador ausente: ${code}`);
    const row = structuredClone(definition.en) as LabReading;
    row.page = 1;
    if (['Glucose', 'Hgb', 'LDL'].includes(code) && typeof row.value === 'number') {
      const shift = ((Math.imul(seed, 1664525) >>> 0) % 11) - 5;
      const decimals = row.display.split('.')[1]?.length ?? 0;
      row.value = Number((row.value + shift * (code === 'Hgb' ? 0.1 : 1)).toFixed(decimals));
      row.display = row.value.toFixed(decimals);
      row.flag =
        row.referenceMin !== undefined && row.value < row.referenceMin
          ? 'L'
          : row.referenceMax !== undefined && row.value > row.referenceMax
            ? 'H'
            : '';
    }
    if (code === 'Creatinine')
      Object.assign(row, {
        display: seed % 2 ? '0.08' : '0.80',
        flag: seed % 2 ? 'L' : 'H',
        value: seed % 2 ? 0.08 : 0.8,
      });
    if (code === 'WBC' && seed % 2 === 0) {
      row.value = Number(row.value) / 1000;
      row.display = String(row.value);
      row.unit = 'Thousand/uL';
      if (row.referenceMin !== undefined) row.referenceMin /= 1000;
      if (row.referenceMax !== undefined) row.referenceMax /= 1000;
      row.referenceText = `${row.referenceMin}-${row.referenceMax} Thousand/uL`;
    }
    return row;
  });
}

/** Cada página longa contém marcadores distintos e fictícios. */
function continuedReadings(seed: number, pageCount: number): LabReading[] {
  const core = readings(seed);
  const seen = new Set(core.map((row) => row.code));
  return [
    ...core,
    ...markers
      .filter((marker) => !seen.has(marker.code))
      .map((marker) => structuredClone(marker.en) as LabReading),
  ].slice(0, pageCount * 8);
}

function drawPage(
  id: string,
  family: Family,
  rows: LabReading[],
  number: number,
  date: string,
  locale: Locale,
) {
  const c = new Canvas();
  c.field = { id: 'heading', role: 'heading' };
  const pt = locale === 'pt-BR';
  watermark(c);
  c.text(
    30,
    30,
    pt ? 'Laboratório Exemplo - AMOSTRA SINTÉTICA' : 'Placeholder Diagnostics - SYNTHETIC SAMPLE',
    BOLD,
  );
  c.field = { id: 'patient', role: 'patient' };
  c.text(
    30,
    47,
    pt
      ? 'PACIENTE: ALEX EXEMPLO | Nascimento: 01/01/1984 | Sexo: F'
      : 'PATIENT: ALEX EXAMPLE | DOB: 01/01/1984 | Sex: F',
    STYLE,
  );
  c.field = { id: 'collection', role: 'date' };
  c.text(30, 63, `${pt ? 'Coleta' : 'Collected'}: ${dateText(date, locale)}`, STYLE);
  c.field = { id: 'specimen', role: 'specimen' };
  c.text(
    170,
    63,
    `${pt ? 'Amostra' : 'Specimen'}: SYN-${id} | ${pt ? 'Página' : 'Page'} ${number}`,
    STYLE,
  );
  c.field = { id: 'specimen-note', role: 'note' };
  c.text(
    30,
    80,
    pt
      ? 'Coleta em jejum. Dados inventados para teste, sem orientação clínica.'
      : 'Fasting specimen. Invented test data, not clinical guidance.',
    STYLE,
  );
  c.field = { id: 'table-heading', role: 'heading' };
  const history = family === 'history';
  c.text(30, 108, pt ? 'EXAME' : 'TEST', BOLD);
  c.text(270, 108, pt ? 'ATUAL' : 'CURRENT', BOLD);
  c.text(335, 108, pt ? 'SINAL' : 'FLAG', BOLD);
  c.text(
    375,
    108,
    history
      ? pt
        ? 'ANTERIOR (01/01/2024)'
        : 'PREVIOUS (2024-01-01)'
      : pt
        ? 'UNIDADE / REFERÊNCIA'
        : 'UNIT / REFERENCE',
    BOLD,
  );
  let top = 135;
  for (const row of rows) {
    c.field = { code: row.code, id: row.code, role: 'label' };
    const label =
      family === 'wrapped'
        ? `${row.label} (${pt ? 'análise da amostra' : 'specimen analysis'})`
        : row.label;
    const names = wrap(label, family === 'wrapped' ? 150 : 220, STYLE);
    for (const [index, name] of names.entries()) c.text(30, top + index * 12, name, STYLE);
    c.field = { code: row.code, id: `${row.code}:value`, role: 'value' };
    c.rightText(315, top, row.display, BOLD);
    c.field = { code: row.code, id: `${row.code}:flag`, role: 'flag' };
    c.text(338, top, row.flag, BOLD);
    if (history) {
      c.field = { code: row.code, id: `${row.code}:previous`, role: 'previous' };
      c.text(375, top, row.previous?.display ?? (pt ? 'NÃO DISPONÍVEL' : 'NOT AVAILABLE'), STYLE);
      c.field = { code: row.code, id: `${row.code}:unit`, role: 'unit' };
      c.text(
        30,
        top + Math.max(1, names.length) * 12,
        `${pt ? 'Unidade' : 'Unit'}: ${row.unit}`,
        STYLE,
      );
      c.field = { code: row.code, id: `${row.code}:reference`, role: 'reference' };
      c.text(
        200,
        top + Math.max(1, names.length) * 12,
        `${pt ? 'Referência' : 'Reference'}: ${row.referenceText || (pt ? 'não informada' : 'not provided')}`,
        STYLE,
      );
    } else if (family === 'range-below') {
      c.field = { code: row.code, id: `${row.code}:unit`, role: 'unit' };
      c.text(375, top, row.unit, STYLE);
      c.field = { code: row.code, id: `${row.code}:reference`, role: 'reference' };
      c.text(
        45,
        top + Math.max(1, names.length) * 12,
        pt
          ? `Referência: ${row.referenceText || 'não informada'}`
          : `Reference: ${row.referenceText || 'not provided'}`,
        STYLE,
      );
    } else {
      c.field = { code: row.code, id: `${row.code}:unit`, role: 'unit' };
      c.text(375, top, row.unit, STYLE);
      c.field = { code: row.code, id: `${row.code}:reference`, role: 'reference' };
      const references = wrap(row.referenceText.replace(` ${row.unit}`, ''), 135, STYLE);
      for (const [index, reference] of references.entries())
        c.text(445, top + index * 12, reference, STYLE);
    }
    const height =
      Math.max(1, names.length, wrap(row.referenceText, 135, STYLE).length) * 12 +
      (history || family === 'range-below' ? 24 : 12);
    if (family === 'ruled' || family === 'continued')
      c.rule(30, top + height - 10, 580, top + height - 10);
    top += height;
  }
  c.field = { id: 'notes', role: 'note' };
  c.text(
    30,
    top + 20,
    pt
      ? 'Ferritina: CANCELADO (amostra insuficiente)'
      : 'Ferritin: CANCELED (insufficient specimen)',
    STYLE,
  );
  c.text(
    30,
    top + 36,
    pt ? 'Vitamina B12:           (resultado pendente)' : 'Vitamin B12:           (result pending)',
    STYLE,
  );
  c.text(
    30,
    top + 52,
    pt
      ? 'Nota do método: controles 0,08, 0,8 e 5 não são resultados do paciente.'
      : 'Method note: calibration controls 0.08, 0.8 and 5 are not patient results.',
    STYLE,
  );
  c.text(
    30,
    pt ? 805 : 755,
    pt
      ? 'AMOSTRA SINTÉTICA - sem dados reais de pacientes'
      : 'SYNTHETIC SAMPLE / AMOSTRA SINTETICA - no real patient data',
    STYLE,
  );
  return onPaper(c.page(), locale);
}

export function makeCase(
  family: Family,
  seed: number,
  pageCount = family === 'continued' ? 2 : 1,
  locale: Locale = 'en-US',
): CorpusCase {
  if (
    !Number.isSafeInteger(seed) ||
    !Number.isInteger(pageCount) ||
    pageCount < 1 ||
    pageCount > 30
  )
    throw new Error('Seed ou número de páginas inválido.');
  if (!FAMILIES.includes(family) || !['pt-BR', 'en-US'].includes(locale))
    throw new Error('Família ou locale inválido.');
  const pairId = `${family}-${seed}`;
  const id = locale === 'pt-BR' ? `br-${pairId}` : pairId;
  const collectionDate = '2026-01-15';
  const expected: LabReading[] = [];
  const all = family === 'continued' ? continuedReadings(seed, pageCount) : readings(seed);
  if (all.length < pageCount)
    throw new Error('Não há marcadores distintos suficientes para todas as páginas.');
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const rows = all
      .slice(
        Math.floor((index * all.length) / pageCount),
        Math.floor(((index + 1) * all.length) / pageCount),
      )
      .map((row) => ({ ...row, page: index + 1 }));
    // Resultado histórico tem data e valor diferentes; não pertence ao gabarito atual.
    if (family === 'history')
      for (const row of rows) {
        if (typeof row.value === 'number')
          row.previous = {
            date: '2024-01-01',
            display: (row.value + 11.13).toFixed(2),
            flag: '',
            value: Number((row.value + 11.13).toFixed(2)),
          };
      }
    const localized = rows.map((row) => localizeReading(row, locale));
    expected.push(...localized);
    return drawPage(id, family, localized, index + 1, collectionDate, locale);
  });
  return {
    collectionDate,
    expected,
    family,
    id,
    locale,
    pages,
    pairId,
    seed,
    split: splitOf(family),
  };
}

export const pairedCases = (locale: Locale = 'en-US'): CorpusCase[] =>
  FAMILIES.flatMap((family, index) => [
    makeCase(family, 529_000 + index * 10, undefined, locale),
    makeCase(family, 529_001 + index * 10, undefined, locale),
  ]);
