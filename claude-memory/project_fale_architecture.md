---
name: F.A.L.E Architecture & Documentation
description: Complete F.A.L.E system architecture (Fetch→Analyze→Lab→Export), OPA endpoint, 19-criteria matrix, scoring rules, table schemas, and key discrepancies between production code and documentation
type: project
originSessionId: 60933379-8e4c-4222-86cb-c5bc6079cc02
---
## F.A.L.E Flow
Fetch (OPA API) → Analyze (IA 19 criteria) → Lab (batch ZIP/PDF) → Export (ranking/bonus)

## OPA Endpoint
- URL: `https://opaixc.btempresas.com.br/api/v1/atendimento`
- Method: GET, Auth: Bearer OPA_SUITE_TOKEN
- Params: dataInicialAbertura, dataFinalAbertura, limit, atendente

## Key Tables
- `evaluations` — official audits with full_report JSON
- `mentoria_batches` / `mentoria_batch_files` — batch imports
- `monthly_closings` — month-end snapshots for bonus
- `attendants` — EMPTY in all envs, needs populating
- `preventive_mentorings` — preventive mentoring records

## Documentation vs Production Discrepancies (as of 2026-04-11 export)
The FALE doc shows OLD code versions:
- `mentoriaScoring.ts`: weights 25/30/28/17 (wrong) — production is 25/25/25/25
- `classify()`: thresholds 85/65/45 with "Crítico" — production uses 90/70/50 with "Regular"
- `scoreFromFullReport()`: maps FORA DO ESCOPO to PARCIAL — production maps correctly
- `analyze-attendance`: shows v3 without dual-backend — production has v3.2-mentor with Lovable+Anthropic support

## Architecture (updated 2026-04-16)

### Projetos Lovable
- **RADAR INSIGHT USUÁRIO FINAL** (produção): repo `radarinsight-tech/assist-analyst-20b54bfd` branch main
- **RADAR-AMBIENTE EVOLUÇÃO** (teste): repo `radarinsight-tech/project-compass-24` branch staging

### Supabase
- Production (USUÁRIO FINAL): `mzuuktfarwiagikzapti` (Lovable Cloud)
- Staging (AMBIENTE EVOLUÇÃO): `rozdmkodkneedrhfsgrk`
- Antigo (descontinuado): `vlwapbidozvgpfomrrfa`, `jxfyximlxtibshwhdhhl`

### Deploy Flow
- Desenvolve na branch `staging` do project-compass-24 → AMBIENTE EVOLUÇÃO + Vercel auto-deploy
- Merge staging → main no project-compass-24 → push origin main
- Sync para produção: `bash scripts/sync-to-production.sh` (push force para assist-analyst-20b54bfd)
- Remote `production` configurado localmente no project-compass-24

### URLs
- Produção: radarinsight.tech + assist-analyst.lovable.app (USUÁRIO FINAL)
- Staging: project-compass-24.lovable.app (AMBIENTE EVOLUÇÃO, com banner vermelho)
- All 14 Edge Functions deployed with --no-verify-jwt on staging

### Status (atualizado 2026-04-16)
- AMBIENTE EVOLUÇÃO: 50 atendentes, Edge Functions v3.2-mentor, testado end-to-end
- USUÁRIO FINAL: 50 atendentes, Edge Functions v3.2-mentor, testado end-to-end — FUNCIONANDO
- Ambos ambientes validados com avaliação real (BT202694496, nota 9.4, Dados confirmados)
- Repo mentoria-lab (radarinsight/mentoria-lab): descontinuado, substituído por project-compass-24

## Current Prompt Version: auditor_v3.2-mentor
- Mentor tone (not punitive fiscal)
- sugestao field per criterion (coaching tips)
- trechoEvidencia (literal quotes) + confiancaIA (alta/media/baixa)
- C5 balanced (one auto-corrected slip ≠ failure)
- C18 flexibilized (proactive complementary offer counts)
- C16 ordered ladder with error awareness
