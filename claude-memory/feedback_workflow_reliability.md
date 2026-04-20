---
name: Workflow reliability - commit por alteração e verificação real
description: Usuário frustrado com alterações incompletas e verificações falsas — exige commits incrementais, checklist visível e testes reais
type: feedback
originSessionId: e1dec31f-970a-41b1-a533-1522097ee06c
---
Nunca dizer "está tudo certo" sem verificar de fato. Fazer commit incremental a cada alteração, não em lote.

**Why:** Em conversas anteriores, de 10 alterações solicitadas, apenas 3-4 foram realmente feitas. Claude revisou e disse que estava tudo certo quando não estava. Usuário perdeu tempo testando e encontrando problemas.

**How to apply:**
- Ao receber lista de alterações, criar checklist (TodoWrite) e marcar cada item conforme concluído
- Fazer 1 commit por alteração para facilitar rastreamento e rollback
- Após cada alteração, verificar o arquivo editado relendo-o (não confiar que o Edit funcionou)
- Rodar build/dev server quando possível para confirmar que funciona
- Nunca dizer "pronto, tudo certo" sem evidência concreta
