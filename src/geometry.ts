export type FontName =
  | 'Helvetica'
  | 'Helvetica-Bold'
  | 'Courier'
  | 'Courier-Bold'
  | 'Times-Roman'
  | 'Times-Bold';
export type Rgb = readonly [number, number, number];
export type FieldRole =
  | 'label'
  | 'value'
  | 'unit'
  | 'flag'
  | 'reference'
  | 'previous'
  | 'patient'
  | 'date'
  | 'specimen'
  | 'note'
  | 'heading'
  | 'watermark'
  | 'other';

export interface FieldTag {
  code?: string;
  id: string;
  role: FieldRole;
}
export interface Cell {
  color?: Rgb;
  field?: FieldTag;
  font?: FontName;
  size?: number;
  text: string;
  x: number;
}
export interface Line {
  cells: Cell[];
  size?: number;
  y: number;
}
export interface Rule {
  color?: Rgb;
  width?: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}
export interface Fill {
  color: Rgb;
  points: readonly (readonly [number, number])[];
}
export interface Stamp {
  angle: number;
  color: Rgb;
  field?: FieldTag;
  font: FontName;
  size: number;
  text: string;
  x: number;
  y: number;
}
/** Geometria de entrada: y medido a partir do rodapé, em pontos PDF. */
export interface Page {
  fills?: Fill[];
  lines: Line[];
  rules?: Rule[];
  stamps?: Stamp[];
}
export type Quad = readonly [number, number, number, number, number, number, number, number];
export type Box = readonly [number, number, number, number];
/** Saída: pontos PDF, origem no canto superior esquerdo, páginas a partir de 1. */
export interface FieldAnnotation extends FieldTag {
  box: Box;
  clipped: boolean;
  page: number;
  quad: Quad;
  sourceQuad: Quad;
  text: string;
  visibleBox: Box;
}
export interface PageSize {
  height: number;
  width: number;
}
