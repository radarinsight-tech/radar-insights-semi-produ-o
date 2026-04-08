# Ajuste Edge Function fetch-opa-attendance e OpaSearchPanel

## Resumo das Alterações

### 1. **Edge Function: `fetch-opa-attendance`**
   - **Localização:** `supabase/functions/fetch-opa-attendance/index.ts`
   - **Objetivo:** Buscar atendimentos (records da tabela `evaluations`) respeitando as políticas de RLS do Supabase

### Principais Características:

#### ✅ Autenticação com Bearer Token
```typescript
const authHeader = req.headers.get("authorization");
// Valida se o usuário passou um Bearer token válido
```

#### ✅ Validação de Permissões
- Extrai o usuário autenticado da sessão Supabase
- Se falhar, retorna `403 "Invalid permissions profile"` (exatamente como solicitado)
- O cliente Supabase cria queries que respeitam automaticamente as políticas de RLS

#### ✅ Construção de Query com RLS
```typescript
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
});
// Isso garante que o Supabase aplique as políticas de RLS para esse usuário
```

#### ✅ Filtros Suportados
- `protocolo` — busca ILIKE (case-insensitive)
- `cliente` — busca ILIKE
- `atendente` — busca ILIKE
- `status_atendimento` — busca exata
- `status_auditoria` — busca exata

#### ✅ Paginação
- `limit` — quantidade de registros (padrão: 50)
- `offset` — deslocamento para paginação

#### ✅ Tratamento de Erros RLS
```typescript
if (error?.code === "42501" || error.message?.includes("permission")) {
  // Retorna 403 com mensagem clara
  return new Response({
    error: "Invalid permissions profile",
    ...
  }, { status: 403 })
}
```

---

### 2. **Componente React: `OpaSearchPanel.tsx`**
   - **Localização:** `src/components/OpaSearchPanel.tsx`
   - **Objetivo:** Interface para buscar atendimentos usando a edge function

### Principais Recursos:

#### ✅ Autenticação Automática
```typescript
const { data: { session } } = await supabase.auth.getSession();
// Passa o access_token do usuário no header Authorization
```

#### ✅ Campos de Busca
- Protocolo
- Cliente
- Atendente
- (campos adicionais podem ser adicionados)

#### ✅ Exibição de Resultados
- Tabela com protocolo, cliente, atendente, data, status e nota
- Badges coloridas para status do atendimento e auditoria
- Seleção de registro com callback `onSelectAttendance`

#### ✅ Paginação
- Botões "Anterior" e "Próxima"
- Exibição do número de página total

#### ✅ Tratamento de Erros
```typescript
if (response.status === 403) {
  // Exibe mensagem clara sobre erro de permissões
  toast.error(`Permission Error: ${errorMsg}`);
}
```

---

## Como Resolver o Erro 403

### O Problema:
- **Erro:** `403 Invalid permissions profile`
- **Causa:** As políticas de RLS do Supabase estavam bloqueando o acesso aos dados

### A Solução:

1. **Edge Function** garante que:
   - O `Authorization` header com Bearer token é obrigatório
   - O usuário é validado no contexto da sessão Supabase
   - As queries respeitam as políticas de RLS

2. **Componente** garante que:
   - Usa o `session.access_token` do usuário autenticado
   - Passa o token no header `Authorization: Bearer <token>`
   - Exibe erros 403 de forma clara

### Fluxo Correto:

```
[OpaSearchPanel.tsx]
    ↓
GET session.access_token
    ↓
POST /functions/v1/fetch-opa-attendance
    with Authorization: Bearer <access_token>
    ↓
[fetch-opa-attendance/index.ts]
    ↓
Extract Authorization header
    ↓
Create Supabase client with user's token
    ↓
Query aplicará automaticamente as políticas de RLS
    ↓
Retorna dados ou erro 403 esclarecedor
```

---

## Próximos Passos

1. **Publicar a Edge Function no Supabase**
   - O Supabase CLI detectará a nova função em `supabase/functions/fetch-opa-attendance/`
   - Execute: `supabase functions deploy fetch-opa-attendance`

2. **Integrar o Componente**
   - Importe `OpaSearchPanel` em uma página existente
   - Passe `onSelectAttendance` callback se precisar fazer algo com o registro selecionado

3. **Testar as Permissões RLS**
   - Verifique se as políticas foram aplicadas com `GRANT` statements
   - Teste com diferentes usuários para validar que as políticas estão funcionando

4. **Monitorar Logs**
   - Os erros 403 agora retornarão com `details: error.message` da edge function
   - Isso ajudará a debugar problemas de permissões no futuro

---

## Exemplo de Uso

```tsx
import OpaSearchPanel from "@/components/OpaSearchPanel";

function MyPage() {
  const handleSelectAttendance = (record) => {
    console.log("Selecionado:", record.protocolo);
    // Fazer algo com o atendimento selecionado
  };

  return (
    <OpaSearchPanel 
      onSelectAttendance={handleSelectAttendance}
      initialFilters={{ status_atendimento: "auditado" }}
    />
  );
}
```

---

## Arquivos Criados/Modificados

- ✅ `supabase/functions/fetch-opa-attendance/index.ts` — novo
- ✅ `src/components/OpaSearchPanel.tsx` — novo
- ✅ Commit: `0bdc80a` — mensagem explicando as mudanças
- ✅ Push: branch `main` atualizada no GitHub
