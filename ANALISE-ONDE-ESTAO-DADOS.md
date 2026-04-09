# 🗺️ Mapeamento de Dados — Onde estão sendo gravados?

**Data:** 08/04/2026  
**Context:** Seu Supabase não tem as tabelas esperadas em `public`

---

## 🔍 O Que Está Acontecendo

O Radar Insight foi desenvolvido no **Lovable**, que _gera código automaticamente_. Isso significa:

1. **Tabelas podem estar em esquema diferente** (não `public`)
2. **Tabelas podem ter nomes diferentes** do esperado
3. **Lovable cria tabelas dinamicamente** quando você faz upload de dados
4. **Algumas tabelas ainda não foram criadas** (vazias, nunca usadas)

---

## 📊 Mapa de Dados Esperado vs. Realidade

### Esperado (Padrão)

```
Supabase
├─ auth.users ← Sistema de autenticação Supabase
├─ public.profiles ← Dados de usuários
├─ public.companies ← Empresa/Cliente
├─ public.credit_analyses ← Análises de crédito
├─ public.document_analyses ← Análise de documentos
└─ public.document_items ← Arquivos de documentos
```

### Possível Realidade (com Lovable)

```
Supabase
├─ auth.users ← ✅ Sempre existe
├─ public.user_profiles ← Nome diferente
├─ public.empresas ← Nome diferente
├─ public.analise_credito ← Nome diferente
├─ (tabelas vazias/não criadas ainda)
└─ (dados em Lovable cache, não no BD)
```

---

## 🧪 Como Descobrir

**Execute agora:** `SQL-MAPEAMENTO-COMPLETO.sql`

Ele vai:
1. Listar **TODOS** os schemas (auth, public, storage, etc)
2. Listar **TODAS** as tabelas (e aonde estão)
3. Procurar tabelas que parecem as nossas
4. Mostrar cada coluna e seu tipo

**Resultado:** Você saberá EXATAMENTE onde estão os dados.

---

## 🎯 Cenários Prováveis

### Cenário A: Dados em Schema Diferente

```sql
-- Se houver:
-- Schema: auth → Table: user_profiles
-- Schema: storage → Table: files

→ Solução: Ajustar referências no script RLS para auth.user_profiles
```

### Cenário B: Dados com Nomes Diferentes

```sql
-- Se houver:
-- public.usuarios (em vez de profiles)
-- public.empresas (em vez de companies)
-- public.creditanalysis (em vez de credit_analyses)

→ Solução: Customizar script RLS com nomes reais
```

### Cenário C: Tabelas Ainda Não Foram Criadas

```sql
-- Se NÃO houver nenhuma das 5 tabelas esperadas
-- profiles ❌
-- companies ❌
-- credit_analyses ❌
-- document_analyses ❌
-- document_items ❌

→ Solução: Criar primeiro no Lovable, depois aplicar RLS
```

### Cenário D: Dados em Lovable Cache (Não no BD)

Se o Lovable foi usado apenas em localhost/development:
- Dados podem estar em `localStorage` do navegador
- **Não foram salvos no Supabase** ainda
- Precisam fazer primeiro `upload` ou `sync` pro BD

→ Solução: Usar Lovable para fazer sync dos dados para Supabase

---

## 📝 O Que Fazer Agora

```
1️⃣  Executar SQL-MAPEAMENTO-COMPLETO.sql no Supabase
    └─ Copiar TUDO e colar no SQL Editor
    └─ Apertar RUN
    └─ Notar quais tabelas aparecem (e em qual schema)

2️⃣  Analisar PARTE 4 e PARTE 5 dos resultados
    └─ Procurar por nomes que parecem nossas tabelas
    └─ Copiar o nome EXATO (case-sensitive!)

3️⃣  Avisar Claude com:
    - Quais tabelas EXISTEM
    - Em qual SCHEMA estão
    - Nomes EXATOS
    
    Exemplo:
    ├─ auth.user_profiles (em vez de public.profiles)
    ├─ public.analise_credito (em vez de public.credit_analyses)
    └─ (nenhuma otra tabela encontrada)

4️⃣  Claude customiza o script SQL-RLS-SECURITY com os nomes reais
    └─ Você roda o script customizado
    └─ RLS fica ativo com nomes corretos
```

---

## 🔐 Proteção Temporária (Se Tabelas Não Existem)

Se descobrir que as tabelas não foram criadas:

```sql
-- Criar mínimo necessário para RLS funcionar:

CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.credit_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id),
  user_id UUID REFERENCES public.profiles(id),
  cpf_cnpj TEXT,
  decisao_final TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Depois rodar SQL-RLS-SECURITY-v2.sql
```

---

## 🚨 Verificação de Sanidade

Após executar o mapeamento, responda:

- [ ] Vi `auth.users`? **SIM/NÃO**
  - Se NÃO → Problém graveísmo com autenticação

- [ ] Vi alguma tabela relacionada a profiles/usuários? **SIM/NÃO**
  - Se SIM → Qual é o nome?
  
- [ ] Vi alguma tabela de crédito/documento? **SIM/NÃO**
  - Se SIM → Qual é o nome?

- [ ] Todas as 5 tabelas existem? **SIM/NÃO**
  - Se NÃO → Quantas faltam?

---

## 🎯 Próximos Passos (Depois de Descobrir)

```
IF (todas 5 tabelas existem em public):
  → Use SQL-RLS-SECURITY-v2.sql direto
  
ELSE IF (tabelas existem mas com nomes diferentes):
  → Claude faz versão customizada do script
  → Execute versão customizada
  
ELSE IF (tabelas não existem):
  → Criar tabelas (copia SQL acima)
  → Depois rodar SQL-RLS-SECURITY-v2.sql
  
ELSE IF (tabelas em schema diferente, ex: auth ou storage):
  → Claude ajusta referências de schema
  → Execute versão customizada
```

---

## 📞 Template de Resposta

Quando você executar o mapeamento, volte com:

```
RESULTADOS DO MAPEAMENTO:

TABELAS ENCONTRADAS:
├─ auth.users: ✅ SIM / ❌ NÃO
├─ public.profiles: ✅ SIM / ❌ NÃO (ou auth.user_profiles? ou usuarios?)
├─ public.companies: ✅ SIM / ❌ NÃO (ou empresas? ou clients?)
├─ public.credit_analyses: ✅ SIM / ❌ NÃO (ou credit_analysis? ou creditanalysis?)
├─ public.document_analyses: ✅ SIM / ❌ NÃO
└─ public.document_items: ✅ SIM / ❌ NÃO

OUTRAS TABELAS ENCONTRADAS:
(lista qualquer outra tabela que você viu)

SCHEMA ONDE ESTÃO:
(qual schema: public? auth? storage? outro?)

NOMES EXATOS (COPIAR DO RESULTADO):
(copiar e colar o nome EXATO da tabela, respeitando maiúsculas/minúsculas)
```

---

## ⚠️ Red Flags

Se você NÃO ver:
- `auth.users` → Supabase não está configurado corretamente
- Nenhuma tabela customizada → Dados não foram salvos
- Schema `public` vazio → Precisa criar tabelas

Se você VER:
- Muitas tabelas não reconhecidas → Lovable criou estrutura diferente
- Nomes em português E inglês → Projeto tem histórico de mudanças

---

**Próximo passo:** Execute `SQL-MAPEAMENTO-COMPLETO.sql` agora e reporte!
