import type { Page } from './geometry.js';
import type { FieldAnnotation, PageSize } from './geometry.js';
import type { LabReading as SyntheticResult } from './reading.js';

export type Family = 'ruled' | 'borderless' | 'wrapped' | 'range-below' | 'history' | 'continued';
export type Quality = 'digital' | 'clean' | 'typical' | 'difficult' | 'mixed' | 'unreadable';
export type Split = 'development' | 'holdout';
export type Locale = 'en-US' | 'pt-BR';

export interface CorpusCase {
  collectionDate: string;
  expected: SyntheticResult[];
  family: Family;
  id: string;
  locale: Locale;
  pages: Page[];
  pairId: string;
  seed: number;
  split: Split;
}

export interface ScanSettings {
  blur: boolean;
  contrast: number;
  dpi: number;
  jpegQuality?: number;
  noise: number;
  rotation: number;
  shadow: number;
}

export interface CorpusEntry {
  behavior: 'complete' | 'reject-or-review-empty';
  bytes: number;
  collectionDate: string;
  expected: SyntheticResult[];
  family: Family;
  fields: FieldAnnotation[];
  file: string;
  id: string;
  locale: Locale;
  pageCount: number;
  pageHashes: string[];
  pageKinds: ('digital' | 'scan')[];
  pageSizes: PageSize[];
  pairId: string;
  quality: Quality;
  review: 'required' | 'not-required';
  scan?: ScanSettings;
  seed: number;
  sha256: string;
  split: Split;
  textChars: number[];
}

export interface CorpusManifest {
  entries: CorpusEntry[];
  synthetic: true;
  version: 3;
}
