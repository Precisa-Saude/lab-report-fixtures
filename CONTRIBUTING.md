# Contribuir

Use somente dados inventados. Não envie exames reais, mesmo anonimizados, nem
cópias de marcas/layouts proprietários ou datasets sem licença compatível.

Cada família nova deve ter exemplos pt-BR/en-US, gabarito do texto impresso,
tags de campos, layout reservado em split e variantes digital/scan. Diferencie
histórico, notas, cancelados e resultados atuais. Preserve o aviso sintético.

Antes do PR execute `pnpm check` e `pnpm test:package`, revise PDFs/boxes renderizados
e informe o que mudou na API pública e nos arquivos gerados. Não baixe o limite
de cobertura. Fixe seed e versões; alterações de desenho exigem nova versão.

Submissões são licenciadas sob MIT, incluindo dados sintéticos. Fontes mantêm OFL.
