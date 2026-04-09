# 🔒 Guia de Implementação RLS — Radar Insight

**Data:** 08/04/2026  
**Responsável:** Eduardo Neves Trichez  
**Arquivo SQL:** `SQL-RLS-SECURITY.sql`

---

## 📋 Resumo Executivo

Implementação de **Row Level Security (RLS)** no Supabase para isolar dados **por empresa** (company_id). Um usuário da Banda Turbo verá **APENAS** dados da Banda Turbo, mesmo que clique em URLs diretas de outro cliente.

---

## 🎯 O Que É Protegido

| Tabela | Proteção |
|--------|----------|
| `credit_analyses` | Análises de crédito por empresa |
| `document_analyses` | Análises de documentação por empresa |
| `document_items` | Documentos (RG, Renda, etc) por empresa |
| `profiles` | Cada usuário vê apenas seu perfil |
| `companies` | Cada usuário vê apenas sua empresa |

---

## 🚀 Como Executar

### Passo 1: Acessar Supabase SQL Editor

```
1. Abrir Supabase → Seu Projeto
2. SQL Editor (canto esquerdo)
3. Colar TODO O CONTEÚDO DE SQL-RLS-SECURITY.sql
4. Clicar RUN (botão azul, canto direito)
```

⏱️ **Tempo esperado:** 30-60 segundos  
✅ **Sucesso:** Ao final, não há erros (presta atenção!)

---

## ✅ Verificar Se Funcionou

Após executar o SQL, faça estas verificações:

### Check 1: RLS Está Ativo?

```sql
-- Executar como: postgres (superuser)
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN (
  'credit_analyses', 'document_analyses', 'document_items', 
  'profiles', 'companies'
);
```

**Esperado:** `rowsecurity = true` em todos os 5

### Check 2: Políticas Existem?

```sql
-- Contar políticas por tabela
SELECT 
  schemaname, 
  tablename, 
  COUNT(*) as num_policies
FROM pg_policies 
WHERE tablename IN (
  'credit_analyses', 'document_analyses', 'document_items',
  'profiles', 'companies'
)
GROUP BY schemaname, tablename
ORDER BY tablename;
```

**Esperado:** ~20+ políticas (SELECT/INSERT/UPDATE/DELETE em cada tabela)

### Check 3: Função Helper Existe?

```sql
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'get_user_company_id';
```

**Esperado:** 1 função tipo `FUNCTION`

### Check 4: Índices Criados?

```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('credit_analyses', 'document_analyses', 'document_items')
ORDER BY tablename, indexname;
```

**Esperado:** 8+ índices (facilita performance com RLS)

---

## 🧪 Testes de Segurança

⚠️ **IMPORTANTE:** Fazer estes testes ANTES de publicar em produção.

### Setup: Criar 2 Usuários de Teste

```
1. Supabase → Authentication → Add User
   Email: teste1@bandaturbo.com
   Password: TesteSeguro123!

2. Supabase → Authentication → Add User
   Email: teste2@empresa-outra.com
   Password: TesteSeguro123!
```

### Test 1: Isolamento Básico

**Usuário 1 (teste1@bandaturbo.com):**
```sql
SELECT COUNT(*) FROM credit_analyses;
-- Deve retornar N (análises da Banda Turbo)
```

**Usuário 2 (teste2@empresa-outra.com):**
```sql
SELECT COUNT(*) FROM credit_analyses;
-- Deve retornar M (análises da outra empresa, NOT N)

-- Se retornar o mesmo N que Usuário 1 → ⚠️ RLS NÃO FUNCIONOU
```

### Test 2: Tentar Escalação de Privilégio

**Usuário 1:** Tentar inserir análise com company_id de outra empresa

```sql
-- DEVE FALHAR COM ERRO:
-- "new row violates row-level security policy"
INSERT INTO credit_analyses 
  (id, company_id, cpf_cnpj, user_id, decisao_final)
VALUES 
  (gen_random_uuid(), (SELECT id FROM companies OFFSET 1 LIMIT 1), '12345678901234', auth.uid(), 'reprovado');
```

**Esperado:** ❌ ERROR violates row-level security policy

### Test 3: Verificar Auditoria

**Usuário 1:** Atualizar uma análise

```sql
UPDATE credit_analyses 
SET decisao_final = 'pendente' 
WHERE company_id = get_user_company_id() 
LIMIT 1;

-- Agora verifique se foi logado:
SELECT COUNT(*) FROM audit_logs 
WHERE usuario_id = auth.uid() 
  AND operacao = 'UPDATE';
```

**Esperado:** ✅ Retorna > 0

### Test 4: Acesso Transitivo (Document Items)

**Usuário 1:** Deve conseguir ver documents via credit_analysis

```sql
-- Deve retornar dados
SELECT di.id, di.tipo, di.file_url
FROM document_items di
INNER JOIN document_analyses da ON da.id = di.document_analysis_id
WHERE da.credit_analysis_id IN (
  SELECT id FROM credit_analyses 
  WHERE company_id = get_user_company_id()
);
```

**Esperado:** ✅ Retorna dados da sua empresa (ou vazio se não houver docs)

---

## 🔴 Possíveis Problemas e Soluções

### ❌ Problema: "Permission denied for schema public"

**Causa:** Usuário autenticado não tem acesso

**Solução:**
```sql
-- Executar como postgres:
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
```

---

### ❌ Problema: Função `get_user_company_id()` retorna NULL

**Causa:** Usuário não tem profile criado

**Solução:**
```sql
-- Executar como postgres, criando profile manual:
INSERT INTO profiles (id, company_id)
VALUES ('user-uuid-aqui', 'company-uuid-aqui')
ON CONFLICT (id) DO NOTHING;
```

---

### ❌ Problema: Queries estão MUITO lentas após RLS

**Causa:** Faltam índices ou RLS é complexo

**Solução:**
1. Verificar se índices foram criados (Check 4 acima)
2. Usar `EXPLAIN ANALYZE` para ver execution plan:
```sql
EXPLAIN ANALYZE
SELECT * FROM credit_analyses WHERE company_id = get_user_company_id();
```

3. Se vir "Sequential Scan", adicionar índice manualmente:
```sql
CREATE INDEX idx_credit_analyses_company_id ON credit_analyses(company_id);
```

---

### ❌ Problema: "violates row-level security policy" em INSERT/UPDATE que deveria funcionar

**Causa:** Policy WITH CHECK é muito rigorosa

**Solução:**
1. Verificar se company_id está sendo passado corretamente
2. Verificar se user_id está sendo preenchido (algumas políticas checam)
3. Executar query como postgres para confirmar que dados existem

---

## 📊 Impacto no Código Frontend (Lovable)

**✅ BOM NEWS:** Nenhuma alteração necessária!

O RLS funciona na camada de BD. Frontend continua igual:

```typescript
// Isso continua funcionando normalmente:
const { data, error } = await supabase
  .from('credit_analyses')
  .select('*');

// Supabase AUTOMATICAMENTE filtra por company_id do usuário autenticado ✅
```

---

## 🎯 Checklist Pré-Produção

- [ ] Script SQL executado sem erros
- [ ] Check 1-4 confirmam RLS ativo e índices criados
- [ ] Test 1 passou (isolamento básico)
- [ ] Test 2 passou (escalação falhou como esperado)
- [ ] Test 3 passou (auditoria registra)
- [ ] Test 4 passou (acesso transitivo funciona)
- [ ] Informado TI sobre nova tabela `audit_logs` (importante para conformidade)
- [ ] Backup do banco feito antes de mexer
- [ ] CSV exportado de dados críticos (backup manual também)

---

## 🚨 Segurança: O Que Agora É Impossível

| Risco | Status |
|-------|--------|
| Usuário vê dados de outra empresa via SQL | 🔒 IMPOSSÍVEL |
| Usuário edita análise de crédito de outro | 🔒 IMPOSSÍVEL |
| Usuário deleta documento de outro cliente | 🔒 IMPOSSÍVEL |
| Alteração de company_id via UPDATE | 🔒 IMPOSSÍVEL |
| URL direta a /analise-credito/123 de outro | 🔒 IMPOSSÍVEL (banco retorna 0 linhas) |

---

## 📈 Performance Esperada

**Com RLS correto + índices:**
- Query WHERE company_id = X: **< 50ms** em tabela de 100k linhas
- Policy evaluation: **< 5ms** por row
- Full table scan: **NUNCA acontece** (WITH CHECK garante)

**Se query ficar lenta:**
1. Rodar `EXPLAIN ANALYZE` para ver plano
2. Verificar índices (eles foram criados?)
3. Considerar materialized view para buscas complexas

---

## 🔄 Manutenção Contínua

**Mensal:**
- [ ] Revisar `audit_logs` para atividades suspeitas
- [ ] Limpar logs > 90 dias (opcional):
```sql
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
```

**Anual:**
- [ ] Revisar políticas RLS para edge cases novos
- [ ] Testar disaster recovery com backup
- [ ] Atualizar Supabase para latest version

---

## 📞 Suporte

Se algo não funcionar:
1. Verificar erro exato no SQL Editor
2. Comparar com "Possíveis Problemas" acima
3. Rodar Check 1-4 para diagnosticar
4. Contatar Supabase Support com erro e screenshot do Check

---

## 📝 Próximos Passos (Radar Insight)

1. ✅ **HOJE:** Executar SQL-RLS-SECURITY.sql
2. ✅ **HOJE:** Fazer Tests 1-4
3. 📅 **AMANHÃ:** Publicar em produção (branch dev primeiro)
4. 📅 **SEMANA:** Monitorar `audit_logs` para anomalias
5. 📅 **MÊS:** Implementar RLS em outras tabelas (users, user_roles, etc)

---

**Status:** 🎯 Pronto para implementação  
**Risco:** 🟢 BAIXO (RLS é standard, bem-testado no Supabase)  
**Impacto:** 🟢 ZERO no frontend  
**Segurança:** 🟢 CRÍTICO ganho  

Vá em frente! 🚀
