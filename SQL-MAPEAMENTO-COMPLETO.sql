-- ═══════════════════════════════════════════════════════════════════════════════
-- 🔍 MAPEAMENTO COMPLETO — Todas as tabelas em TODOS os schemas
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- OBJETIVO: Descobrir EXATAMENTE onde os dados estão sendo gravados
-- Mostra TUDO: public, auth, storage, extensões, custom schemas
--
-- INSTRUÇÕES:
-- 1. Copiar TUDO este script
-- 2. Colar no Supabase SQL Editor
-- 3. Clicar RUN
-- 4. Analisar os resultados
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 1: LISTAR TODOS OS SCHEMAS
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  schema_name,
  'Schema' AS type
FROM information_schema.schemata
WHERE schema_name NOT LIKE 'pg_%'
ORDER BY schema_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 2: LISTAR TODAS AS TABELAS EM TODOS OS SCHEMAS
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema NOT LIKE 'pg_%'
ORDER BY table_schema, table_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 3: FOCAR NOS SCHEMAS PRINCIPAIS (supabase)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  t.table_schema,
  t.table_name,
  COUNT(c.column_name) AS num_columns,
  STRING_AGG(c.column_name || ' (' || c.data_type || ')', ', ') AS columns
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_schema = c.table_schema AND t.table_name = c.table_name
WHERE t.table_schema IN ('public', 'auth', 'storage', 'graphql_public')
GROUP BY t.table_schema, t.table_name
ORDER BY t.table_schema, t.table_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 4: PROCURAR TABELAS CHAVE (PROFILES, USUARIOS, USERS, etc)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  table_schema,
  table_name,
  'Possível tabela de usuários/perfis' AS possivel_uso
FROM information_schema.tables
WHERE table_name ILIKE '%profile%'
   OR table_name ILIKE '%user%'
   OR table_name ILIKE '%usuario%'
   OR table_name ILIKE '%conta%'
ORDER BY table_schema, table_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 5: PROCURAR TABELAS DE NEGÓCIO (CREDIT, DOCUMENT, EMPRESA, etc)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  table_schema,
  table_name,
  'Possível tabela de negócio' AS possivel_uso
FROM information_schema.tables
WHERE table_name ILIKE '%credit%'
   OR table_name ILIKE '%document%'
   OR table_name ILIKE '%empresa%'
   OR table_name ILIKE '%company%'
   OR table_name ILIKE '%client%'
   OR table_name ILIKE '%analysis%'
   OR table_name ILIKE '%analise%'
   OR table_name ILIKE '%atendente%'
   OR table_name ILIKE '%mentoria%'
   OR table_name ILIKE '%evaluation%'
ORDER BY table_schema, table_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 6: CHECAR SE AUTH.USERS EXISTE (Supabase padrão)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  table_schema,
  table_name,
  'Sistema de autenticação' AS tipo
FROM information_schema.tables
WHERE table_schema = 'auth' AND table_name = 'users';

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 7: INSPECIONAR SCHEMA DE TABELAS SUSPEITAS
-- ─────────────────────────────────────────────────────────────────────────────

-- Se houver tabelas que parecem as nossas, mostrar seus campos

-- Exemplo 1: Se houver uma tabela chamada "user_profiles"
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema NOT LIKE 'pg_%' AND table_name ILIKE '%profile%'
ORDER BY table_schema, table_name, ordinal_position;

-- Exemplo 2: Se houver tabelas de crédito
SELECT 
  table_schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema NOT LIKE 'pg_%' 
  AND (table_name ILIKE '%credit%' OR table_name ILIKE '%analise%' OR table_name ILIKE '%evaluation%')
ORDER BY table_schema, table_name, ordinal_position;

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 8: RESUMO VISUAL
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  '📊 RESUMO' AS info,
  'Total de schemas' AS metrica,
  COUNT(DISTINCT table_schema)::text AS valor
FROM information_schema.tables
WHERE table_schema NOT LIKE 'pg_%'

UNION ALL

SELECT 
  '📊 RESUMO',
  'Total de tabelas',
  COUNT(*)::text
FROM information_schema.tables
WHERE table_schema NOT LIKE 'pg_%'

UNION ALL

SELECT 
  '📊 RESUMO',
  'Schema "public"',
  COUNT(*)::text
FROM information_schema.tables
WHERE table_schema = 'public'

UNION ALL

SELECT 
  '📊 RESUMO',
  'Schema "auth"',
  COUNT(*)::text
FROM information_schema.tables
WHERE table_schema = 'auth'

UNION ALL

SELECT 
  '📊 RESUMO',
  'Schema "storage"',
  COUNT(*)::text
FROM information_schema.tables
WHERE table_schema = 'storage';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 📋 INTERPRETAÇÃO DOS RESULTADOS
-- ═══════════════════════════════════════════════════════════════════════════════

/*

PARTE 1 (SCHEMAS):
  Você verá uma lista como:
  ├─ public        ← Schema padrão (onde devem estar as tabelas)
  ├─ auth          ← Autenticação Supabase (auth.users, etc)
  ├─ storage       ← Armazenamento de arquivos
  └─ graphql_public ← GraphQL (opcional)

PARTE 2 (TABELAS GLOBAIS):
  Mostra TODAS as tabelas em TODOS os schemas
  Se não vê "profiles", "companies", "credit_analyses" aqui
  → Essas tabelas ainda não foram criadas!

PARTE 3 (SCHEMAS PRINCIPAIS):
  Detalha tabelas em public, auth, storage
  Mostra cada coluna e seu tipo
  IMPORTANTE: Procure por qualquer coisa que pareça com:
    - perfil / profile / usuario / user
    - empresa / company / tenant
    - creditanalysis / credit_analysis / analise
    - documento / document / documento

PARTE 4 (PROCURA POR KEYWORDS):
  Busca todas as tabelas com "profile", "user", "usuario" no nome
  Se encontrar algo como "user_profiles" ou "usuarios"
  → COPIE O NOME EXATO para usar no script SQL-RLS

PARTE 5 (BUSCA DE NEGÓCIO):
  Procura por tabelas de crédito, documentos, mentorias
  Se encontrar coisas como:
    - "evaluations" em vez de "profiles"
    - "mentoria_batch_files"
    - "credit_analyses"
  → Copie os nomes exatos

PARTE 6 (AUTH.USERS):
  Confirma se o Supabase tem o sistema de autenticação padrão
  Mostra se existe "auth.users" (deve existir sempre)

PARTE 7 (INSPEÇÃO DETALHADA):
  Se houver tabelas suspeitas, mostra todas as colunas
  Use isto para conferir se a tabela tem "company_id" ou similar

PARTE 8 (RESUMO):
  Contagem rápida de tabelas por schema
  Antes de executar RLS, certifique-se:
    ✅ Schema public tem > 0 tabelas
    ✅ As tabelas que você espera existem

═══════════════════════════════════════════════════════════════════════════════

O QUE FAZER COM OS RESULTADOS:

1. Se vê "profiles", "companies", "credit_analyses" existindo:
   → RLS pode ser aplicado diretamente
   → Use SQL-RLS-SECURITY-v2.sql

2. Se não vê essas tabelas em "public":
   → Procure em outras colunas (PARTE 4 e 5)
   → Anote os nomes EXATOS que encontrar
   → Avise Claude com os nomes reais

3. Se não vê NENHUMA das 5 tabelas esperadas:
   → Elas nunca foram criadas
   → Precisa criar no Lovable ou SQL
   → Depois aplicar RLS

═══════════════════════════════════════════════════════════════════════════════
*/
