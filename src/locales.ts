/** Texto e notação impressos; as quantidades numéricas continuam numéricas. */
import type { Page } from './geometry.js';
import markers from './markers.json' with { type: 'json' };
import type { LabReading } from './reading.js';
import type { Locale } from './types.js';

const QUALITATIVE_PT: Record<string, string> = {
  ABSENT: 'AUSENTE',
  CLEAR: 'LÍMPIDO',
  FEW: 'RARAS',
  NEGATIVE: 'NEGATIVO',
  'NON-REACTIVE': 'NÃO REAGENTE',
  'NONE SEEN': 'NÃO OBSERVADO',
  NORMAL: 'NORMAL',
  POSITIVE: 'POSITIVO',
  PRESENT: 'PRESENTE',
  TRACE: 'TRAÇOS',
  YELLOW: 'AMARELO',
};
const UNITS_PT: Record<string, string> = {
  'cells/uL': '/µL',
  'Million/uL': 'milhões/µL',
  'million/uL': 'milhões/µL',
  'Thousand/uL': 'mil/µL',
};

export const dateText = (iso: string, locale: Locale): string =>
  locale === 'pt-BR' ? iso.split('-').reverse().join('/') : iso;

export function printedNumber(value: string, locale: Locale, group = false): string {
  if (locale === 'en-US') return value;
  if (group && /^\d+$/.test(value)) return new Intl.NumberFormat('pt-BR').format(Number(value));
  return value.replace(/(\d)\.(\d)/g, '$1,$2');
}

export function localizeReading(row: LabReading, locale: Locale): LabReading {
  if (locale === 'en-US') return row;
  const label = markers.find((marker) => marker.code === row.code)?.pt.label;
  if (!label) throw new Error(`Nome em português ausente: ${row.code}`);
  const unit = UNITS_PT[row.unit] ?? row.unit;
  const qualitative = (text: string) => {
    for (const [english, portuguese] of Object.entries(QUALITATIVE_PT)) {
      if (text.toUpperCase() === english || text.toUpperCase().startsWith(`${english} `))
        return portuguese + text.slice(english.length);
    }
    return text;
  };
  let referenceText = qualitative(row.referenceText);
  referenceText = printedNumber(referenceText, locale)
    .replace(row.unit, unit)
    .replace('(calc)', '(calculado)')
    .replace('> OR =', 'Maior ou igual a')
    .replace('< OR =', 'Menor ou igual a');
  if (row.code === 'Creatinine') referenceText = '0,30 a 0,70 mg/dL';
  if (row.code === 'AntiThyroglobulin') referenceText = 'Inferior a 5 IU/mL';
  return {
    ...row,
    display:
      typeof row.value === 'number'
        ? printedNumber(row.display, locale, unit === '/µL')
        : qualitative(row.display),
    label,
    referenceText,
    unit,
    value: typeof row.value === 'string' ? qualitative(row.value) : row.value,
    ...(row.previous && {
      previous: { ...row.previous, display: printedNumber(row.previous.display, locale) },
    }),
  };
}

/** O canvas usa carta; a versão A4 preserva as distâncias contadas do topo. */
export function onPaper(page: Page, locale: Locale): Page {
  if (locale === 'en-US') return page;
  const delta = 50;
  return {
    ...page,
    fills: page.fills?.map((fill) => ({
      ...fill,
      points: fill.points.map(([x, y]) => [x, y + delta] as const),
    })),
    lines: page.lines.map((line) => ({ ...line, y: line.y + delta })),
    rules: page.rules?.map((rule) => ({ ...rule, y1: rule.y1 + delta, y2: rule.y2 + delta })),
    stamps: page.stamps?.map((stamp) => ({ ...stamp, y: stamp.y + delta })),
  };
}
