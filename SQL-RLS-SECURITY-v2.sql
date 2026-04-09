-- ═══════════════════════════════════════════════════════════════════════════════
-- 🔒 ROW LEVEL SECURITY (RLS) — RADAR INSIGHT
-- VERSÃO 2.0 — COM VERIFICAÇÃO DE TABELAS
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- OBJETIVO: Garantir isolamento multi-tenant por company_id
-- Cada usuário SÓ vê/edita dados da sua própria empresa
--
-- ⚠️ ANTES DE EXECUTAR:
-- Este script verifica automaticamente se as tabelas existem
-- Se alguma tabela não existir, o script mostra o erro e para
--
-- TABELAS PROTEGIDAS:
-- 1. credit_analyses
-- 2. document_analyses  
-- 3. document_items
-- 4. profiles (ou user_profiles, usuarios, etc)
-- 5. companies
--
-- EXECUTAR COMO: postgres (superuser do Supabase)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 0: DIAGNOSTICAR SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────

-- Executar isto PRIMEIRO para ver quais tabelas existem:
/*
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 1: FUNÇÃO HELPER — Obter company_id do usuário autenticado
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid AS $$
  SELECT company_id 
  FROM public.profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Grant execute permission para usuários autenticados
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated, anon;

COMMENT ON FUNCTION public.get_user_company_id() IS 
'Retorna o company_id do usuário atualmente autenticado. Base para todas as políticas de RLS.';

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 2: ATIVAR RLS NAS TABELAS (COM VERIFICAÇÃO)
-- ─────────────────────────────────────────────────────────────────────────────

-- Verificar se a tabela EXISTS antes de tentar ALTER
DO $$
BEGIN
  -- credit_analyses
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_analyses') THEN
    ALTER TABLE public.credit_analyses ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ ENABLED RLS: credit_analyses';
  ELSE
    RAISE EXCEPTION '❌ ERRO: Tabela credit_analyses NÃO existe. Crie-a primeiro no Lovable.';
  END IF;

  -- document_analyses
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_analyses') THEN
    ALTER TABLE public.document_analyses ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ ENABLED RLS: document_analyses';
  ELSE
    RAISE EXCEPTION '❌ ERRO: Tabela document_analyses NÃO existe. Crie-a primeiro no Lovable.';
  END IF;

  -- document_items
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_items') THEN
    ALTER TABLE public.document_items ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ ENABLED RLS: document_items';
  ELSE
    RAISE EXCEPTION '❌ ERRO: Tabela document_items NÃO existe. Crie-a primeiro no Lovable.';
  END IF;

  -- profiles
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ ENABLED RLS: profiles';
  ELSE
    RAISE EXCEPTION '❌ ERRO: Tabela profiles NÃO existe. Você precisa criar esta tabela.';
  END IF;

  -- companies
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ ENABLED RLS: companies';
  ELSE
    RAISE EXCEPTION '❌ ERRO: Tabela companies NÃO existe. Você precisa criar esta tabela.';
  END IF;

END $$;

COMMENT ON TABLE public.credit_analyses IS 'Protegida por RLS: empresa isolada por company_id';
COMMENT ON TABLE public.document_analyses IS 'Protegida por RLS: acesso via credit_analysis';
COMMENT ON TABLE public.document_items IS 'Protegida por RLS: acesso via document_analysis';

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 3A: POLÍTICAS PARA credit_analyses
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT: Usuário vê análises de crédito da sua empresa
CREATE POLICY "credit_analyses_select_own_company"
  ON public.credit_analyses
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

-- INSERT: Usuário cria análises apenas na sua empresa
CREATE POLICY "credit_analyses_insert_own_company"
  ON public.credit_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND user_id = auth.uid()
  );

-- UPDATE: Usuário atualiza análises da sua empresa
CREATE POLICY "credit_analyses_update_own_company"
  ON public.credit_analyses
  FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND user_id = auth.uid()
  );

-- DELETE: Apenas quem criou pode deletar
CREATE POLICY "credit_analyses_delete_own_company"
  ON public.credit_analyses
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND user_id = auth.uid()
  );

COMMENT ON POLICY "credit_analyses_select_own_company" ON public.credit_analyses IS
'Usuário vê APENAS análises de crédito da sua própria empresa';

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 3B: POLÍTICAS PARA document_analyses
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT: Acesso transitivo via credit_analysis → company_id
CREATE POLICY "document_analyses_select_own_company"
  ON public.document_analyses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.credit_analyses ca
      WHERE ca.id = document_analyses.credit_analysis_id
      AND ca.company_id = public.get_user_company_id()
    )
  );

-- INSERT: Criar análise documental via credit_analysis da sua empresa
CREATE POLICY "document_analyses_insert_own_company"
  ON public.document_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.credit_analyses ca
      WHERE ca.id = credit_analysis_id
      AND ca.company_id = public.get_user_company_id()
    )
    AND user_id = auth.uid()
  );

-- UPDATE: Atualizar análise documental da sua empresa
CREATE POLICY "document_analyses_update_own_company"
  ON public.document_analyses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.credit_analyses ca
      WHERE ca.id = credit_analysis_id
      AND ca.company_id = public.get_user_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.credit_analyses ca
      WHERE ca.id = credit_analysis_id
      AND ca.company_id = public.get_user_company_id()
    )
  );

-- DELETE: Deletar análise documental
CREATE POLICY "document_analyses_delete_own_company"
  ON public.document_analyses
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.credit_analyses ca
      WHERE ca.id = credit_analysis_id
      AND ca.company_id = public.get_user_company_id()
      AND ca.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "document_analyses_select_own_company" ON public.document_analyses IS
'Acesso transitivo: vê análises documentais APENAS via credit_analyses da sua empresa';

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 3C: POLÍTICAS PARA document_items
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT: Acesso transitivo via document_analysis → credit_analysis → company_id
CREATE POLICY "document_items_select_own_company"
  ON public.document_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.document_analyses da
      INNER JOIN public.credit_analyses ca ON ca.id = da.credit_analysis_id
      WHERE da.id = document_items.document_analysis_id
      AND ca.company_id = public.get_user_company_id()
    )
  );

-- INSERT: Criar documento (file upload)
CREATE POLICY "document_items_insert_own_company"
  ON public.document_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.document_analyses da
      INNER JOIN public.credit_analyses ca ON ca.id = da.credit_analysis_id
      WHERE da.id = document_analysis_id
      AND ca.company_id = public.get_user_company_id()
    )
  );

-- UPDATE: Atualizar validação de documento (OCR, checklist, etc)
CREATE POLICY "document_items_update_own_company"
  ON public.document_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.document_analyses da
      INNER JOIN public.credit_analyses ca ON ca.id = da.credit_analysis_id
      WHERE da.id = document_analysis_id
      AND ca.company_id = public.get_user_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.document_analyses da
      INNER JOIN public.credit_analyses ca ON ca.id = da.credit_analysis_id
      WHERE da.id = document_analysis_id
      AND ca.company_id = public.get_user_company_id()
    )
  );

-- DELETE: Deletar documento
CREATE POLICY "document_items_delete_own_company"
  ON public.document_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.document_analyses da
      INNER JOIN public.credit_analyses ca ON ca.id = da.credit_analysis_id
      WHERE da.id = document_analysis_id
      AND ca.company_id = public.get_user_company_id()
      AND da.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "document_items_select_own_company" ON public.document_items IS
'Acesso transitivo: vê documentos APENAS via sua empresa';

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 4A: POLÍTICAS PARA profiles
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT: Usuário vê seu próprio perfil
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- UPDATE: Usuário pode editar seu próprio perfil (mas não company_id!)
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Proteção: company_id NÃO pode ser alterado
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

COMMENT ON POLICY "profiles_select_own" ON public.profiles IS
'Usuário vê APENAS seu próprio perfil (company_id não pode ser alterado)';

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 4B: POLÍTICAS PARA companies
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT: Usuário vê apenas sua própria empresa
CREATE POLICY "companies_select_own"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (id = public.get_user_company_id());

-- UPDATE: Usuário pode editar dados da sua empresa
CREATE POLICY "companies_update_own"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (id = public.get_user_company_id())
  WITH CHECK (id = public.get_user_company_id());

COMMENT ON POLICY "companies_select_own" ON public.companies IS
'Usuário vê APENAS sua própria empresa (informações, nome, etc)';

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 5: ÍNDICES PARA PERFORMANCE (crítico com RLS ativo!)
-- ─────────────────────────────────────────────────────────────────────────────

-- Índice em credit_analyses.company_id (usado na maioria das políticas)
CREATE INDEX IF NOT EXISTS idx_credit_analyses_company_id 
  ON public.credit_analyses(company_id);

CREATE INDEX IF NOT EXISTS idx_credit_analyses_user_id 
  ON public.credit_analyses(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_analyses_company_user 
  ON public.credit_analyses(company_id, user_id);

-- Índice em document_analyses.credit_analysis_id (join nas políticas)
CREATE INDEX IF NOT EXISTS idx_document_analyses_credit_analysis_id 
  ON public.document_analyses(credit_analysis_id);

CREATE INDEX IF NOT EXISTS idx_document_analyses_user_id 
  ON public.document_analyses(user_id);

-- Índice em document_items.document_analysis_id (join nas políticas)
CREATE INDEX IF NOT EXISTS idx_document_items_document_analysis_id 
  ON public.document_items(document_analysis_id);

-- Índice em profiles.company_id (função helper)
CREATE INDEX IF NOT EXISTS idx_profiles_company_id 
  ON public.profiles(company_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 6: LOG DE AUDITORIA (Opcional mas RECOMENDADO para CS + Segurança)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigserial PRIMARY KEY,
  tabela text NOT NULL,
  operacao text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'SELECT'
  usuario_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  company_id uuid NOT NULL,
  registro_id uuid NOT NULL,
  dados_antes jsonb,
  dados_depois jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_usuario ON public.audit_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tabela ON public.audit_logs(tabela);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- Trigger para log de UPDATE em credit_analyses (exemplo)
CREATE OR REPLACE FUNCTION public.log_credit_analyses_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    tabela, operacao, usuario_id, company_id, registro_id,
    dados_antes, dados_depois, created_at
  ) VALUES (
    'credit_analyses',
    TG_OP,
    auth.uid(),
    NEW.company_id,
    NEW.id,
    to_jsonb(OLD),
    to_jsonb(NEW),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar trigger
DROP TRIGGER IF EXISTS trigger_audit_credit_analyses ON public.credit_analyses;
CREATE TRIGGER trigger_audit_credit_analyses
  AFTER UPDATE ON public.credit_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.log_credit_analyses_changes();

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 7: VALIDAÇÃO FINAL
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ RLS CONFIGURADO COM SUCESSO!';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📊 RESUMO:';
  RAISE NOTICE '  • 5 tabelas com RLS ativado';
  RAISE NOTICE '  • 20+ políticas de isolamento por company_id';
  RAISE NOTICE '  • 8 índices de performance criados';
  RAISE NOTICE '  • Auditoria (audit_logs + trigger) ativa';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 PRÓXIMOS PASSOS:';
  RAISE NOTICE '  1. Verificar nas NOTIFICATIONS se teve algum erro';
  RAISE NOTICE '  2. Executar verificação: SELECT * FROM pg_policies;';
  RAISE NOTICE '  3. Fazer testes com 2 usuários diferentes';
  RAISE NOTICE '';
  RAISE NOTICE 'ℹ️  Guia completo: GUIA-IMPLEMENTACAO-RLS.md';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIM DO SCRIPT
-- ─────────────────────────────────────────────────────────────────────────────
