---
name: Status integração API OPA
description: Estado atual — projeto migrado para Lovable Cloud (jxfyximlxtibshwhdhhl), 403 OPA pendente de resolução com time OPA
type: project
originSessionId: 60933379-8e4c-4222-86cb-c5bc6079cc02
---
**Projeto migrado para Lovable Cloud em 2026-04-14.**

Novo projeto Supabase: `jxfyximlxtibshwhdhhl` (Lovable Cloud)
Projeto antigo local: `vlwapbidozvgpfomrrfa`

**Estado atual:**
- 14 Edge Functions deployadas no novo projeto via Lovable
- Logos importados, banco criado com 15 tabelas, auth configurado
- Secrets OPA precisam ser configurados manualmente no dashboard (sem acesso CLI)
- OPA_SUITE_TOKEN: credencial `69dabd4bbcb025be4a0f87cd`
- OPA_SUITE_BASE_URL: `https://opaixc.btempresas.com.br`

**Status da integração OPA:**
- 401 gateway resolvido (--no-verify-jwt)
- Requisição chega no OPA via GET /api/v1/atendimento com query params
- OPA retorna 403 — time OPA confirma testes passando do lado deles
- Problema provavelmente está no formato dos parâmetros ou endpoint

**Why:** Time OPA confirma sucesso nos testes deles. O 403 é rejeição da nossa requisição — endpoint, formato de data ou headers podem estar errados.

**How to apply:** Confirmar com time OPA: endpoint exato, formato de data, nomes dos campos, método (GET/POST), headers obrigatórios além do Authorization.
