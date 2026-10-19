import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

import type { FontName } from './geometry.js';

const root = typeof __dirname === 'string' ? __dirname : dirname(fileURLToPath(import.meta.url));
const family = 'LabReportFixturesSans';
for (const weight of ['Regular', 'Bold']) {
  const path = resolve(root, `../assets/LiberationSans-${weight}.ttf`);
  if (!GlobalFonts.registerFromPath(path, family))
    throw new Error(`Não foi possível carregar a fonte distribuída: ${weight}`);
}
const context = createCanvas(1, 1).getContext('2d');

export const fontSpec = (name: FontName, size: number): string =>
  `${name.includes('Bold') ? 'bold ' : ''}${size}px ${family}`;

export function measure(text: string, name: FontName = 'Helvetica', size = 9) {
  context.font = fontSpec(name, size);
  return context.measureText(text);
}

export const textWidth = (text: string, name: FontName, size: number): number =>
  measure(text, name, size).width;
