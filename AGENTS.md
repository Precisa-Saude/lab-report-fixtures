# lab-report-fixtures

Siga as instruções compartilhadas em
https://github.com/Precisa-Saude/tooling/blob/main/packages/agent-instructions/AGENTS.md.

Biblioteca pública MIT. Nunca incluir laudos reais, dados de pacientes, credenciais,
catálogos privados nem código de extração da API. Referências impressas são dados
fictícios de teste; não ajustar para reproduzir a resposta de um extrator.

Use Node >=22 e pnpm. `pnpm check` verifica formatação, lint, tipos, cobertura >=80%
e build ESM/CJS. `pnpm test:package` instala o tarball em pasta externa e testa os
exports e CLI. Revise visualmente PDFs de ambas as línguas e as caixas após mudar
layout, fonte ou transformação. Não adicionar renderer com copyleft.

Desenhos usam y contado do rodapé; anotações usam pontos PDF com origem superior
esquerda e páginas a partir de 1. Fragmentos quebrados compartilham id sem fundir
campos vizinhos. Mudanças no renderer/arquivos exigem nova versão e novo tarball
no consumidor. Nunca editar o tarball do consumidor manualmente.

Peça aprovação explícita antes de criar commits assinados. Nunca publique no npm
ou empurre para main diretamente. Não executar chamadas pagas ou tocar Prod para
validar esta biblioteca.
