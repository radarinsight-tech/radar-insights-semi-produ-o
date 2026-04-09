-- ═══════════════════════════════════════════════════════════════════════════════
-- 🔍 DIAGNÓSTICO — Descobrir quais tabelas existem no seu Supabase
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- OBJETIVO: Identificar o NOME EXATO das tabelas
-- Isto ajuda a customizar o script SQL-RLS-SECURITY
--
-- INSTRUÇÕES:
-- 1. Copiar TUDO este script
-- 2. Colar no Supabase SQL Editor
-- 3. Clicar RUN
-- 4. Notar quais tabelas aparecem
-- 5. Copiar os nomes EXATOS
-- 6. Informar a Claude qual é o nome correto
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 1: LISTAR TODAS AS TABELAS
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  table_schema,
  table_name,
  'Table exists' AS status
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 2: PROCURAR TABELAS ESPECÍFICAS (as que esperamos)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') 
      THEN '✅ EXISTE'
    ELSE '❌ NÃO EXISTE'
  END AS profiles_status,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') 
      THEN '✅ EXISTE'
    ELSE '❌ NÃO EXISTE'
  END AS companies_status,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_analyses') 
      THEN '✅ EXISTE'
    ELSE '❌ NÃO EXISTE'
  END AS credit_analyses_status,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_analyses') 
      THEN '✅ EXISTE'
    ELSE '❌ NÃO EXISTE'
  END AS document_analyses_status,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_items') 
      THEN '✅ EXISTE'
    ELSE '❌ NÃO EXISTE'
  END AS document_items_status;

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 3: INSPECIONAR SCHEMA DA TABELA 'profiles' (se existir)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 4: INSPECIONAR SCHEMA DA TABELA 'companies' (se existir)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'companies'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE 5: CHECAR RLS STATUS (já está ativado?)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'companies', 'credit_analyses', 'document_analyses', 'document_items')
ORDER BY tablename;

-- ─────────────────────────────────────────────────────────────────────────────
-- RESUMO PARA VOCÊ
-- ─────────────────────────────────────────────────────────────────────────────

/*
📋 COPIE OS RESULTADOS ACIMA E COMPARE COM ESTO AQUI:

Se você vê:
  ✅ profiles → Tabela EXISTE, use o script normal
  ✅ companies → Tabela EXISTE, use o script normal
  ✅ credit_analyses → Tabela EXISTE, use o script normal
  ✅ document_analyses → Tabela EXISTE, use o script normal
  ✅ document_items → Tabela EXISTE, use o script normal

Se você vê ❌ para alguma:
  → Aquela tabela NÃO foi criada ainda
  → Precisa criar primeiro no Lovable ou SQL
  → Depois rodar o RLS

SE ENCONTROU TABELAS COM NOMES DIFERENTES:
  Exemplo: "usuarios" em vez de "profiles"
  → Copie o nome EXATO
  → Avise Claude para customizar o script
*/
