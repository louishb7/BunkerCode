# Fixtures editoriais do navegador

`legacy-courses/` preserva somente os cinco cursos demonstrativos retirados do acervo ativo na Integração Editorial 01. Eles sustentam testes existentes de leitor, navegação, ícones, avaliação JavaScript e seleção pública parcial. Não são conteúdo autoral nem candidatos à publicação.

Somente o supervisor `scripts/browser-backend.mjs` acrescenta essas fixtures à sua cópia temporária própria. Não são lidas por `pnpm dev`, pelo backend normal ou por `publication:prepare`. Não sobrescrevem cursos canônicos e não são acrescentadas a diretórios externos fornecidos explicitamente. Os testes de catálogo usam a identidade autoral nova; os testes de contratos antigos podem acessar suas fixtures diretamente.
