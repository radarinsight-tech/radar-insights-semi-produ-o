# Radar Insight Dashboard — Documentação do Sistema

## Visão Geral
Plataforma SaaS de gestão de qualidade e desempenho para equipes de atendimento ao cliente.
Acesso em produção: https://radarinsight.tech

---

## Estrutura de Projetos (Lovable + GitHub)

| Projeto Lovable | Repositório GitHub | Função |
|---|---|---|
| Radar Insights — PRODUÇÃO | radar-insight-dashboard (main) | Versão live para clientes |
| Radar Insights — DEV | radar-insight-dashboard (dev) | Melhorias em desenvolvimento |
| Radar Insights — CRÉDITO LAB | radar-insight-hq | Testes integração SPC/Serasa |

---

## Stack Tecnológico

- **Frontend:** React 18 + TypeScript + Vite
- **UI:** Tailwind CSS + shadcn/ui
- **Roteamento:** React Router DOM v6
- **Estado/Cache:** TanStack React Query
- **Backend/Auth/DB:** Supabase (PostgreSQL + Edge Functions)
- **Gráficos:** Recharts
- **PDF:** jsPDF + pdfjs-dist
- **Testes:** Vitest + Playwright

---

## Módulos do Sistema

### 1. Auditoria de Atendimento
- Upload de PDF de atendimento
- IA extrai e avalia o atendente (nota 0–10)
- Gera classificação e sugestões de mentoria

### 2. Mentoria Lab
- Processa lotes ZIP com até 1.000 transcrições
- Organiza por atendente e competência
- Detecta elegibilidade e gera relatórios

### 3. Mentoria Preventiva
- Registra mentorias para atendentes com baixo desempenho
- Acompanhamento histórico

### 4. Ranking e Bônus
- Calcula bônus financeiro mensal por nota média
- Exige mínimo de 6 mentorias válidas para elegibilidade
- Fechamento mensal com snapshot do ranking

### 5. Performance Dashboard
- KPIs executivos
- Top e bottom performers
- Distribuição por faixa de desempenho
- Critérios que mais impactam a nota

### 6. Análise de Crédito
- Consulta CPF/CNPJ no SPC (Produto 643 — BETA)
- Upload de documentos com OCR + validação
- Detecção de fraude
- Política automática "Banda Turbo"

### 7. Gestão de Usuários
- Controle por módulo: `admin`, `auditoria`, `credito`, `credit_manual`, `credit_upload`
- Gestão de setores e empresas (multi-tenant)

---

## Banco de Dados (Supabase)

| Tabela | Conteúdo |
|---|---|
| companies | Empresas cadastradas |
| profiles | Perfis dos usuários |
| user_roles | Permissões por módulo |
| user_sectors | Setores habilitados por usuário |
| sectors | Setores das empresas |
| attendants | Cadastro de atendentes |
| attendant_exclusions | Exclusões do ranking |
| evaluations | Avaliações de atendimento |
| mentoria_batches | Lotes de mentoria importados |
| mentoria_batch_files | Arquivos individuais de cada lote |
| preventive_mentorings | Mentorias preventivas |
| monthly_closings | Fechamentos mensais |
| credit_analyses | Análises de crédito |
| document_analyses | Análises documentais |
| document_items | Itens de documentos com OCR |

---

## Fluxo de Trabalho (Deploy)


---

## Integrações Externas

- **Supabase:** Backend principal, autenticação e banco de dados
- **SPC Produto 643:** Consulta de crédito por CPF/CNPJ (em desenvolvimento)
- **Serasa:** Previsto para integração futura

---

*Documento criado em: 2026-03-28*
