# 🔧 Troubleshooting RLS — Erro "relation does not exist"

**Data:** 08/04/2026  
**Problema:** `ERROR: relation "public.profiles" does not exist`

---

## 🎯 Diagnóstico Rápido

Esse erro significa que a tabela `profiles` **não existe** no seu Supabase. Pode ser:

1. ✅ Tabela existe mas com **nome diferente** (ex: `user_profiles`, `usuarios`)
2. ❌ Tabela **nunca foi criada** (precisa criar no Lovable)
3. ⚠️ Tabela existe mas em um **schema diferente** (não em `public`)

---

## 🔍 Descobrir o Nome Correto

### Passo 1: Diagnosticar

```
1. Abrir Supabase → SQL Editor
2. Copiar TUDO de: SQL-DIAGNOSTICO-TABELAS.sql
3. Clicar RUN
```

Você verá uma lista com:
- ✅ Todas as tabelas que existem
- ⚠️ Quais das 5 tabelas esperadas existem ou não

---

## 📌 Cenários e Soluções

### Cenário 1: Tabela `profiles` NÃO EXISTE

**O que você verá:**
```
table_name
───────────
credit_analyses
document_analyses
document_items
(profiles não aparece na lista)
```

**Solução:**
1. Você precisa criar a tabela `profiles` no Lovable OU SQL
2. Mínimo necessário:

```sql
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);
```

3. Depois rodar o SQL-RLS-SECURITY-v2.sql novamente

---

### Cenário 2: Tabela `profiles` EXISTE mas o RLS script falha

**Teste isso primeiro:**
```sql
-- Executar como postgres
SELECT COUNT(*) FROM public.profiles;
```

**Se retorna um número → Tabela existe!**

Então o erro é provavelmente:
- Falta de permissão em alguma campo
- O campo `company_id` não existe em `profiles`

**Solução:**
Verificar schema da tabela:

```sql
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'profiles';
```

**Se não houver `company_id`**, adicione:

```sql
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS company_id uuid NOT NULL;
```

---

### Cenário 3: Outras Tabelas Faltam

Se `document_analyses` ou `document_items` não existem:

Você pode:
1. **Ignorar RLS nelas por enquanto** — comentar essas partes do script
2. **Criar as tabelas primeiro** — criar no Lovable
3. **Esperar por migrations** — se o Lovable cria automaticamente

---

## ✅ Teste de Validação

Após rodar o diagnóstico, você deve ver ALGO assim:

```
Resultado esperado:

table_schema │ table_name
─────────────┼──────────────────────
public       │ companies
public       │ credit_analyses
public       │ document_analyses
public       │ document_items
public       │ profiles
```

Se vê tudo isso → ✅ Próximo passo é rodar SQL-RLS-SECURITY-v2.sql

Se falta alguma → ❌ Precisa criar primeiro

---

## 🚨 Se Ainda der Erro

**Erro:** `Permission denied for schema public`

**Solução:**
```sql
-- Rodar como postgres:
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
```

---

**Erro:** `function get_user_company_id() does not exist`

**Solução:**
Você não rodou o script inteiro. Procure pela seção ETAPA 1 e execute apenas ela primeiro.

---

## 📋 Checklist

- [ ] Executar SQL-DIAGNOSTICO-TABELAS.sql
- [ ] Copiar os nomes EXATOS das tabelas que existem
- [ ] Informar Claude qual é o schema real
- [ ] Rodar SQL-RLS-SECURITY-v2.sql (que agora verifica automaticamente)
- [ ] Verificar NOTIFICATIONS para erros
- [ ] Fazer testes (Test 1-4 no GUIA-IMPLEMENTACAO-RLS.md)

---

## 💬 Próximos Passos

Após diagnosticar, volte com:

```
Tabela EXISTS?
├─ profiles: [SIM/NÃO]
├─ companies: [SIM/NÃO]
├─ credit_analyses: [SIM/NÃO]
├─ document_analyses: [SIM/NÃO]
└─ document_items: [SIM/NÃO]

Se SIM em todas → Rodar SQL-RLS-SECURITY-v2.sql
Se NÃO em alguma → Diz qual falta que adapto o script
```

---

## 🔗 Arquivos Relacionados

- `SQL-RLS-SECURITY-v2.sql` → Script com verificação automática
- `SQL-RLS-SECURITY.sql` → Versão original (sem verificação)
- `GUIA-IMPLEMENTACAO-RLS.md` → Guia completo com testes
- `SQL-DIAGNOSTICO-TABELAS.sql` → Este diagnóstico estendido
