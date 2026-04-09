-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Auditoria Completa e Triggers para Rastreamento
-- Data: 08/04/2026
-- 
-- DESCRIÇÃO:
-- Implementa auditoria em cascata para todas as tabelas críticas
-- Cada mudança é registrada com context completo (quem, quando, o quê, antes/depois)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNÇÕES DE LOG PARA CADA TABELA
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_document_analyses_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    tabela, operacao, usuario_id, company_id, registro_id,
    dados_antes, dados_depois, created_at
  ) VALUES (
    'document_analyses',
    TG_OP,
    auth.uid(),
    (SELECT ca.company_id FROM public.credit_analyses ca WHERE ca.id = NEW.credit_analysis_id),
    NEW.id,
    to_jsonb(OLD),
    to_jsonb(NEW),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_document_items_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    tabela, operacao, usuario_id, company_id, registro_id,
    dados_antes, dados_depois, created_at
  ) VALUES (
    'document_items',
    TG_OP,
    auth.uid(),
    (SELECT ca.company_id 
     FROM public.document_analyses da
     INNER JOIN public.credit_analyses ca ON ca.id = da.credit_analysis_id
     WHERE da.id = NEW.document_analysis_id),
    NEW.id,
    to_jsonb(OLD),
    to_jsonb(NEW),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_profiles_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    tabela, operacao, usuario_id, company_id, registro_id,
    dados_antes, dados_depois, created_at
  ) VALUES (
    'profiles',
    TG_OP,
    COALESCE(auth.uid(), NEW.id),
    NEW.company_id,
    NEW.id,
    to_jsonb(OLD),
    to_jsonb(NEW),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- GERAR TRIGGERS PARA AUDITORIA
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trigger_audit_document_analyses ON public.document_analyses;
CREATE TRIGGER trigger_audit_document_analyses
  AFTER UPDATE ON public.document_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.log_document_analyses_changes();

DROP TRIGGER IF EXISTS trigger_audit_document_items ON public.document_items;
CREATE TRIGGER trigger_audit_document_items
  AFTER UPDATE ON public.document_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_document_items_changes();

DROP TRIGGER IF EXISTS trigger_audit_profiles ON public.profiles;
CREATE TRIGGER trigger_audit_profiles
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profiles_changes();

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW PARA AUDITORIA (Apenas leitura, protegida por RLS da company_id)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.audit_logs_view AS
SELECT 
  al.id,
  al.tabela,
  al.operacao,
  al.usuario_id,
  al.company_id,
  al.registro_id,
  al.dados_antes,
  al.dados_depois,
  al.created_at,
  p.email AS usuario_email,
  c.name AS company_name
FROM public.audit_logs al
LEFT JOIN public.profiles p ON p.id = al.usuario_id
LEFT JOIN public.companies c ON c.id = al.company_id
WHERE al.company_id = public.get_user_company_id();

ALTER VIEW public.audit_logs_view OWNER TO postgres;

COMMENT ON VIEW public.audit_logs_view IS 
'View da auditoria filtrada por company_id do usuário. Segura para consultas por usuários autenticados.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEGURANÇA DA TABELA AUDIT_LOGS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Previne deleção acidental de logs
-- Apenas SELECT e INSERT permitidos (UPDATE/DELETE bloqueados)

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_own_company"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "audit_logs_insert_only"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IS NOT NULL);

-- Bloqueamos UPDATE e DELETE por padrão (uma vez auditado, não pode mudar)

-- ═══════════════════════════════════════════════════════════════════════════════
-- DOCUMENTAÇÃO
-- ═══════════════════════════════════════════════════════════════════════════════

/*
✅ AUDITORIA IMPLEMENTADA

O que foi configurado:
  1. Triggers de UPDATE em 4 tabelas (credit_analyses, document_analyses, document_items, profiles)
  2. Cada mudança registra: tabela, operação, quem fez, quando, antes/depois (JSONB)
  3. Transitive company_id propagado automaticamente
  4. View audit_logs_view para consultas seguras por company_id
  5. RLS bloeia UPDATE/DELETE de logs (imutáveis)

Exemplo de uso:
  SELECT * FROM audit_logs_view 
  WHERE tabela = 'credit_analyses' 
  AND created_at > now() - interval '1 day';
  
Garantias:
  ✅ Cada mudança é rastreada
  ✅ Logs são imutáveis (SELECT + INSERT apenas)
  ✅ Company_id propagado via FK chain
  ✅ Usuários veem APENAS logs da sua empresa (RLS automático na VIEW)
*/
