/**
 * Desenho de página em coordenadas de cima para baixo, como se lê um laudo.
 *
 * O PDF conta o `y` a partir do rodapé. Medir layout a partir do topo é o que
 * se faz olhando a página, e converter em cada chamada espalharia `792 - y`
 * pelo código inteiro. Aqui a conversão acontece uma vez, ao fechar a página.
 */
import { textWidth } from './fonts.js';
import type { Cell, FieldTag, Fill, FontName, Line, Page, Rgb, Rule, Stamp } from './geometry.js';

/** Carta, em pontos. */
export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;

export interface TextStyle {
  color?: Rgb;
  font: FontName;
  size: number;
}

export class Canvas {
  field?: FieldTag;
  private readonly cells = new Map<number, Cell[]>();
  private readonly fills: Fill[] = [];
  private readonly rules: Rule[] = [];
  private readonly stamps: Stamp[] = [];

  /** Texto com a linha de base em `top`, contado do alto da página. */
  text(x: number, top: number, text: string, style: TextStyle): void {
    if (text === '') return;
    const y = Math.round((PAGE_HEIGHT - top) * 100) / 100;
    const cell: Cell = {
      ...(this.field && { field: { ...this.field } }),
      font: style.font,
      size: style.size,
      text,
      x: Math.round(x * 100) / 100,
      ...(style.color && { color: style.color }),
    };
    const row = this.cells.get(y);
    if (row) row.push(cell);
    else this.cells.set(y, [cell]);
  }

  /** Texto alinhado à direita em `right`, como o número da coluna de resultado. */
  rightText(right: number, top: number, text: string, style: TextStyle): number {
    const x = right - textWidth(text, style.font, style.size);
    this.text(x, top, text, style);

    return x;
  }

  /** Texto centrado em `center`, como a coluna de unidade. */
  centerText(center: number, top: number, text: string, style: TextStyle): void {
    this.text(center - textWidth(text, style.font, style.size) / 2, top, text, style);
  }

  /** Sublinhado de um trecho, que é como o portal destaca valor alterado. */
  underline(x: number, top: number, text: string, style: TextStyle): void {
    const width = textWidth(text, style.font, style.size);
    this.rule(x, top + 1.6, x + width, top + 1.6, { width: 0.6 });
  }

  rule(x1: number, top1: number, x2: number, top2: number, style: Partial<Rule> = {}): void {
    this.rules.push({
      x1,
      x2,
      y1: PAGE_HEIGHT - top1,
      y2: PAGE_HEIGHT - top2,
      ...(style.color && { color: style.color }),
      ...(style.width !== undefined && { width: style.width }),
    });
  }

  /** Retângulo vazado, de quatro traços. */
  box(x1: number, top1: number, x2: number, top2: number, style: Partial<Rule>): void {
    this.rule(x1, top1, x2, top1, style);
    this.rule(x2, top1, x2, top2, style);
    this.rule(x1, top2, x2, top2, style);
    this.rule(x1, top1, x1, top2, style);
  }

  fill(points: readonly (readonly [number, number])[], color: Rgb): void {
    this.fills.push({ color, points: points.map(([x, top]) => [x, PAGE_HEIGHT - top] as const) });
  }

  rect(x: number, top: number, width: number, height: number, color: Rgb): void {
    this.fill(
      [
        [x, top],
        [x + width, top],
        [x + width, top + height],
        [x, top + height],
      ],
      color,
    );
  }

  stamp(stamp: Stamp): void {
    this.stamps.push(stamp);
  }

  /** As linhas em ordem de leitura: de cima para baixo, e da esquerda para a direita. */
  page(): Page {
    const lines: Line[] = [...this.cells.entries()]
      .sort(([a], [b]) => b - a)
      .map(([y, cells]) => ({ cells: [...cells].sort((a, b) => a.x - b.x), y }));

    return {
      ...(this.fills.length > 0 && { fills: this.fills }),
      lines,
      ...(this.rules.length > 0 && { rules: this.rules }),
      ...(this.stamps.length > 0 && { stamps: this.stamps }),
    };
  }
}

const WATERMARK: Rgb = [0.87, 0.87, 0.87];

/**
 * A marca de amostra sintética, atravessando a página.
 *
 * Em diagonal e no meio da folha, onde um recorte não a tira sem levar junto a
 * tabela de resultados. A linha de aviso do rodapé repete a mesma coisa em
 * texto pequeno, para quem imprime em preto e branco claro demais.
 */
export const watermark = (canvas: Canvas): void => {
  canvas.stamp({
    angle: 38,
    color: WATERMARK,
    field: { id: 'watermark-en', role: 'watermark' },
    font: 'Helvetica-Bold',
    size: 58,
    text: 'SYNTHETIC SAMPLE',
    x: 118,
    y: 205,
  });
  canvas.stamp({
    angle: 38,
    color: WATERMARK,
    field: { id: 'watermark-pt', role: 'watermark' },
    font: 'Helvetica-Bold',
    size: 30,
    text: 'AMOSTRA SINTÉTICA',
    x: 205,
    y: 175,
  });
};

/** Quebra um texto em linhas que caibam na largura, por palavra. */
export const wrap = (text: string, width: number, style: TextStyle): string[] => {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const next = current === '' ? word : `${current} ${word}`;
    if (current !== '' && textWidth(next, style.font, style.size) > width) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current !== '') lines.push(current);

  return lines;
};
