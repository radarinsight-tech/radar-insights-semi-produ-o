
-- Trigger: prevent modification of confirmed official evaluations
-- Only admin can modify via excluded_from_ranking (already handled by RLS)
-- This trigger blocks changes to nota, classificacao, full_report on validated evals
CREATE OR REPLACE FUNCTION public.protect_official_evaluations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Only protect already-validated evaluations
  IF OLD.resultado_validado = true THEN
    -- Allow toggling excluded_from_ranking and exclusion fields (admin ops)
    -- Allow updating audit_log
    -- Block changes to core scoring fields
    IF (NEW.nota IS DISTINCT FROM OLD.nota) 
       OR (NEW.classificacao IS DISTINCT FROM OLD.classificacao)
       OR (NEW.full_report IS DISTINCT FROM OLD.full_report)
       OR (NEW.atendente IS DISTINCT FROM OLD.atendente)
       OR (NEW.protocolo IS DISTINCT FROM OLD.protocolo)
       OR (NEW.data IS DISTINCT FROM OLD.data)
       OR (NEW.tipo IS DISTINCT FROM OLD.tipo)
       OR (NEW.bonus IS DISTINCT FROM OLD.bonus AND NEW.resultado_validado = true)
    THEN
      -- Allow if resultado_validado is being set to false (un-validating)
      IF NEW.resultado_validado = false THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Não é permitido alterar campos de avaliações oficiais já confirmadas. Remova a validação antes de editar.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_official_evaluations
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_official_evaluations();

-- Trigger: prevent deletion of official evaluations (only admin via RLS can delete)
-- This adds an extra safety net
CREATE OR REPLACE FUNCTION public.prevent_official_eval_deletion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.resultado_validado = true THEN
    RAISE EXCEPTION 'Não é permitido excluir avaliações oficiais confirmadas.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_official_eval_deletion
  BEFORE DELETE ON public.evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_official_eval_deletion();

-- Trigger: prevent deletion of monthly_closings with status 'fechado'
CREATE OR REPLACE FUNCTION public.protect_closed_months()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = 'fechado' THEN
    -- Allow only status change (reopen) and reopen_history updates
    IF NEW.status = 'aberto' THEN
      RETURN NEW;
    END IF;
    -- Block any other changes on closed months
    IF (NEW.nota_media IS DISTINCT FROM OLD.nota_media)
       OR (NEW.total_mentorias IS DISTINCT FROM OLD.total_mentorias)
       OR (NEW.total_bonus IS DISTINCT FROM OLD.total_bonus)
       OR (NEW.snapshot IS DISTINCT FROM OLD.snapshot)
    THEN
      RAISE EXCEPTION 'Não é permitido alterar dados de meses fechados. Reabra o mês antes de fazer alterações.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_closed_months
  BEFORE UPDATE ON public.monthly_closings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_closed_months();
