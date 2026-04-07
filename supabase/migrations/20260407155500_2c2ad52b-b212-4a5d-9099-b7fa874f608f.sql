-- Fix 1: Restrict credit_analyses SELECT to own company
DROP POLICY IF EXISTS "Authenticated read credit analyses" ON credit_analyses;
CREATE POLICY "Users read own company credit analyses"
ON credit_analyses FOR SELECT TO authenticated
USING (
  company_id = get_my_company_id()
  OR company_id IS NULL
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix 2: Restrict evaluations SELECT to own company
DROP POLICY IF EXISTS "Authenticated read all evaluations" ON evaluations;
CREATE POLICY "Users read own company evaluations"
ON evaluations FOR SELECT TO authenticated
USING (
  company_id = get_my_company_id()
  OR company_id IS NULL
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix 3: Restrict document_analyses SELECT to own company or owner
DROP POLICY IF EXISTS "Authenticated read document analyses" ON document_analyses;
CREATE POLICY "Users read own document analyses"
ON document_analyses FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);