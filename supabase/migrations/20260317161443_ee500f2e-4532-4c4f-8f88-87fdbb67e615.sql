
-- Drop the old check constraint and add new one with expanded statuses
ALTER TABLE public.mentoria_batches DROP CONSTRAINT IF EXISTS mentoria_batches_status_check;
ALTER TABLE public.mentoria_batches ADD CONSTRAINT mentoria_batches_status_check
  CHECK (status IN ('recebido', 'extraindo_arquivos', 'organizando_atendimentos', 'pronto_para_curadoria', 'em_analise', 'concluido', 'erro'));
-- Update any existing rows
UPDATE public.mentoria_batches SET status = 'recebido' WHERE status = 'imported';
UPDATE public.mentoria_batches SET status = 'pronto_para_curadoria' WHERE status = 'ready';
UPDATE public.mentoria_batches SET status = 'em_analise' WHERE status = 'analyzing';
UPDATE public.mentoria_batches SET status = 'concluido' WHERE status = 'completed';
UPDATE public.mentoria_batches SET status = 'erro' WHERE status = 'error';
