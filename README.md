# lab-report-fixtures

[English](README.en.md)

Gerador local de laudos laboratoriais **fictícios**, em pt-BR e en-US, com PDFs
vetoriais, scans simulados, gabaritos e bounding boxes por campo. Código e dados
sintéticos sob MIT; renderer `@napi-rs/canvas` sob MIT e fontes Liberation Sans sob
OFL 1.1. Nenhum laudo real ou corpus externo foi incorporado.

## Uso

Requer Node >=22. O pacote usa um binding nativo pré-compilado; não é destinado ao
browser. Uma dependência runtime, nenhuma peer dependency, sem AWS ou modelo.

```sh
npm install @precisa-saude/lab-report-fixtures
npx lab-report-fixtures --out ./output --locale all
# --locale pt-BR ou --locale en-US gera apenas um idioma
```

A versão inicial está preparada para publicação. Antes dela, instale o `.tgz`
produzido por `pnpm pack`; o mesmo artefato pode ser usado em CI privado.

```ts
import { makeCase, renderCase } from '@precisa-saude/lab-report-fixtures';
import { writeFileSync } from 'node:fs';

const fixture = makeCase('history', 42, 1, 'pt-BR');
const { pdf, entry } = renderCase(fixture, 'typical');
writeFileSync('report.pdf', pdf);
writeFileSync('fields.json', JSON.stringify(entry.fields, null, 2));
// entry.expected é o gabarito das leituras atuais impressas.
```

CommonJS: `const { makeCase, renderCase } = require('@precisa-saude/lab-report-fixtures')`.
`renderGeometry(pages, {paper: 'a4', quality: 'digital', seed: 42})` aceita desenhos
próprios; atribua `cell.field = {id, role, code?}` para manter a semântica. Sem tag,
o trecho recebe `role: 'other'`; não inferimos campos pelo texto. Os aliases de
fonte Helvetica/Courier/Times são compatibilidade de entrada: todos usam a fonte
Sans distribuída, com peso regular/bold. O gabarito externo não é inferido.

## Corpus e arquivos

O padrão gera **104 PDFs e 216 páginas**, 52 documentos por idioma. São 12 casos
base por idioma, cada qual em digital, clean (300 DPI), typical (170 DPI) e
difficult (110 DPI); mais um misto de seis páginas, scans de 15 e 30 páginas e
um caso ilegível por idioma. Os 83 marcadores das páginas longas são distintos.

As seis famílias são `ruled`, `borderless`, `wrapped`, `range-below`, `history` e
`continued`. `range-below` e `continued` ficam inteiramente no holdout. Variantes de
qualidade e idiomas compartilham `pairId`; não contam como casos independentes.
Separe por família/pairId ao treinar ou avaliar, inclusive entre idiomas.

Cada PDF tem `.expected.json` e `.fields.json`. `manifest.json` (schema 3) registra
locale, seed, família, split, data, qualidade, parâmetros de scan, tamanho, SHA-256,
pageKinds, dimensões e anotações. `textChars` conta caracteres dos trechos desenhados
nas páginas digitais, **não** o tamanho da extração de um parser; scans têm zero.

pt-BR usa A4, vírgulas decimais, datas dd/mm/aaaa, milhares por ponto e unidades
/µL, mil/µL e milhões/µL. en-US usa Letter. Inclui comparadores, qualitativos,
referências ausentes ou deliberadamente diferentes de catálogos, histórico,
cancelados, pendentes e números de calibração que não pertencem ao paciente.
Valores/referências são adversariais, sem validação clínica; não usar como
orientação médica. LOINC em metadados identifica conceitos, não inclui um catálogo.

## Coordenadas

Cada `FieldAnnotation` contém `id`, `role`, `code?`, `text`, `page`, `sourceQuad`,
`quad`, `box`, `visibleBox` e `clipped`. IDs identificam campos por página; trechos
quebrados compartilham id. Use `(page, id)` e a lista de fragmentos. As coordenadas
são **pontos PDF**, origem no canto superior esquerdo; páginas começam em 1.

- Quad: `[x1,y1,x2,y2,x3,y3,x4,y4]`, cantos superior esquerdo, superior direito,
  inferior direito, inferior esquerdo do texto antes da rotação.
- `sourceQuad` descreve a tinta do texto no layout original, com margem de 0,5 pt.
- `quad` aplica a rotação do scan, arredondamento de pixels e escala final do PDF.
- `box`: `[left,top,right,bottom]`, envelope alinhado aos eixos de `quad`.
- `visibleBox` limita esse envelope à página; `clipped` informa corte. O quad pode
  sair da página. Blur/JPEG podem espalhar pixels além do limite geométrico.

`role` distingue label/value/unit/flag/reference/previous/patient/date/specimen/
note/heading/watermark/other. Não existem boxes para células vazias ou resultados
pendentes/cancelados no gabarito atual. Valores históricos têm papel `previous`.
Anotações são ground truth do desenho, não saída de OCR. O scan contém somente
imagem, sem texto oculto. Scans simulados não substituem digitalização física.

## Desenvolvimento e reprodução

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test:package
pnpm pack --pack-destination /tmp
```

A biblioteca não lê credenciais, não usa rede e não chama extração. Instalação de
dependências pode acessar o registry. Seeds, datas, fontes e versões do renderer
são fixadas. Bytes são reproduzíveis no mesmo runtime/plataforma; não prometemos
igualdade binária entre sistemas operacionais ou versões nativas distintas.

Testes usam PDF.js (Apache-2.0, somente desenvolvimento) como leitor independente,
comparam pixels com boxes, verificam texto ausente em scans, paginação, gabaritos,
hashes e instalação externa ESM/CJS/CLI. CI está configurado para Linux/macOS e Node 22/24.
Revisão visual deve acompanhar mudanças de desenho. O gerador mede renderização;
a acurácia de um extrator precisa ser avaliada separadamente contra o gabarito.

[Licença MIT](LICENSE), [avisos e proveniência](NOTICE),
[licença das fontes](assets/LICENSE_LIBERATION), [contribuições](CONTRIBUTING.md).
