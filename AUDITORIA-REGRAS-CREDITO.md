# 📋 AUDITORIA — Regras de Análise de Crédito

**Data**: 08 de Abril de 2026  
**Autor**: Sistema Radar Insight  
**Status**: ⚠️ AUDITORIA CRÍTICA

---

## 📑 Sumário Executivo

Esta auditoria compile todas as **5 regras de análise de crédito** codificadas no Radar Insight, analisa o caso de **Katia da Silva (CPF final 389-71)** e identifica **gatilhos fantasmas** que podem estar acionando taxas indevidamente.

### 🔍 Achado Crítico

> **Mesmo com Registros Negativos: 0 e Valor Total: R$ 0,00, a regra_04_taxa_300 foi aplicada.**
> 
> Possíveis causas:
> 1. ✅ **Regra de Fallback**: Regra 04 é acionada quando nenhuma das 3 primeiras se aplica
> 2. ⚠️ **Protesto Ativo**: Se `possui_protesto = true`, SEMPRE enquadra na Regra 04
> 3. 🚨 **Débito com Provedor**: Se `possui_debito_provedor = true`, ativa Regra Especial (R$1.000)

---

## 1️⃣ REGRA 01 — ISENÇÃO (Baixo Risco)

### Condição de Aplicação
- **Exatamente 1 registro negativo** (não 0, não 2+)
- Cliente de baixo risco com restrição de impacto mínimo

### Enquadramento por Categoria

| Categoria | Critério | Exemplo |
|-----------|----------|---------|
| `educacao` | 1 registro negativo | Universidade: -R$5.000 |
| `banco_financeira` | 1 registro ≤ R$10.000 + **antiguidade > 12 meses** | Banco: -R$3.000 (com 18 meses) |
| `empresa_cnpj_atividade_profissional` | 1 registro ligado à atividade profissional | Empresa de serviços: -R$2.000 |
| `comercio_varejo` | 1 registro ≤ R$300 + **antiguidade > 24 meses** | Loja: -R$150 (com 3 anos) |

### Taxas Aplicadas

```
✅ Com documento válido em nome do contratante
   • Taxa instalação: R$ 0,00
   • Taxa análise: R$ 0,00
   • TOTAL: R$ 0,00 (ISENTO)

❌ Sem documento válido
   • Taxa instalação: R$ 100,00
   • Taxa análise: R$ 0,00
   • TOTAL: R$ 100,00 (taxa_100_documentacao)
```

### Motivo Padrão
> "Cliente de baixo risco com restrição de baixo impacto para telecom."

### Classificação Final
- `isento` (com documento)
- `taxa_100_documentacao` (sem documento)

---

## 2️⃣ REGRA 02 — TAXA R$100 (Risco Leve)

### Condição de Aplicação
- **Exatamente 1 registro negativo** (igual à Regra 01)
- **MAS não elegível para Regra 01** (não atende aos critérios acima)
- Risco leve com condição de atenção

### Enquadramento por Categoria

| Categoria | Critério | Exemplo |
|-----------|----------|---------|
| `comercio_varejo` | 1 registro **> R$300** OU **antiguidade < 12 meses** | Loja: -R$500 (recente) |
| `banco_financeira` | 1 registro ≤ R$10.000 + **antiguidade < 12 meses** | Banco: -R$8.000 (com 6 meses) |
| `energia_agua` | 1 registro + **antiguidade < 12 meses** | Energia: -R$200 (recente) |
| `moradia_imobiliaria` | 1 registro ligado a aluguel/condomínio | Aluguel: -R$1.200 |

### Taxas Aplicadas

```
✅ Com documento válido
   • Taxa instalação: R$ 100,00
   • Taxa análise: R$ 0,00
   • TOTAL: R$ 100,00

❌ Sem documento válido
   • Taxa instalação: R$ 100,00
   • Taxa análise: R$ 100,00
   • TOTAL: R$ 200,00 (taxa_200_composta)
```

### Motivo Padrão
> "Risco leve com condição adicional de atenção."

### Classificação Final
- `taxa_100` (com documento)
- `taxa_200_composta` (sem documento)

---

## 3️⃣ REGRA 03 — TAXA R$200 (Risco Moderado Alto)

### Condição de Aplicação
- **Múltiplos registros (2-3)** (não elegível Regras 01 e 02)
- Risco moderado alto com múltiplos registros e maior exposição

### Enquadramento por Categoria

| Categoria | Critério | Exemplo |
|-----------|----------|---------|
| `comercio_varejo` | 2-3 registros + **valor total > R$1.500** + **antiguidade < 24 meses** | 2 lojas: -R$2.000 (recente) |
| `banco_financeira` | 2-3 registros + **valor total > R$5.000** + **antiguidade < 24 meses** | 2 empréstimos: -R$7.000 (recente) |
| `energia_agua` | 2 registros + **valor total > R$800** + **antiguidade < 12 meses** | 2 contas: -R$1.000 (recente) |

### Taxas Aplicadas

```
✅ Com documento válido
   • Taxa instalação: R$ 0,00
   • Taxa análise: R$ 200,00
   • TOTAL: R$ 200,00

❌ Sem documento válido
   • Taxa instalação: R$ 100,00
   • Taxa análise: R$ 200,00
   • TOTAL: R$ 300,00 (taxa_300_composta)
```

### Motivo Padrão
> "Risco moderado alto com múltiplos registros e maior exposição financeira."

### Classificação Final
- `taxa_200` (com documento)
- `taxa_300_composta` (sem documento)

---

## 4️⃣ REGRA 04 — TAXA R$300 (Risco Alto / FALLBACK)

### Condição de Aplicação

**REGRA DE FALLBACK**: Aplicada quando nenhuma das três regras anteriores se encaixa.

Acionada quando:
- ✅ 4+ registros (qualquer categoria)
- ✅ Também enquadra em critérios específicos por categoria
- ✅ **SEMPRE enquadra se houver PROTESTO em cartório**
- ✅ **Nenhuma outra regra se aplicou** (padrão)

### Enquadramento por Categoria

| Categoria | Critério | Exemplo |
|-----------|----------|---------|
| `comercio_varejo` | 4+ registros + **valor total > R$3.000** + **antiguidade < 36 meses** | 4 lojas: -R$5.000 |
| `banco_financeira` | 4+ registros + **valor total > R$10.000** + **antiguidade < 36 meses** | 4 créditos: -R$15.000 |
| `energia_agua` | 3+ registros + **valor total > R$1.200** + **antiguidade < 24 meses** | 3 contas: -R$1.500 |
| `protesto` | **QUALQUER protesto ativo** (NUNCA reprovar) | 1 protesto em cartório = Regra 04 |

### Taxas Aplicadas

```
✅ Com documento válido
   • Taxa instalação: R$ 0,00
   • Taxa análise: R$ 300,00
   • TOTAL: R$ 300,00

❌ Sem documento válido
   • Taxa instalação: R$ 100,00
   • Taxa análise: R$ 300,00
   • TOTAL: R$ 400,00 (taxa_400_composta)
```

### Motivo Padrão
> "Risco alto com múltiplos registros, alto valor negativado ou protesto ativo."

### Classificação Final
- `taxa_300` (com documento)
- `taxa_400_composta` (sem documento)

### ⚠️ Aviso Crítico
Esta é a **REGRA DE FALLBACK**. Se nenhuma das 3 primeiras regras se aplicar, o sistema força a Regra 04.

---

## 5️⃣ REGRA ESPECIAL — DÉBITO COM PROVEDOR (R$1.000)

### Condição de Aplicação
- Existe débito com provedor de internet ou telecomunicações
- **SOBREPÕE TODAS as outras regras** (não cumulativa)
- **NUNCA é reprovar**

### Critérios

- ✅ Provedor de internet/banda larga
- ✅ Operadora de telefonia
- ✅ Empresa do mesmo segmento de telecom/internet
- ✅ Qualquer débito com empresa de telecomunicações

### Taxas Aplicadas (FIXAS)

```
SEMPRE (sem exceções):
   • Taxa instalação: R$ 0,00
   • Taxa análise: R$ 1.000,00
   • TOTAL: R$ 1.000,00 (taxa_1000)

Nota: Não se aplicam variações por documentação aqui.
```

### Motivo Padrão
> "Débito identificado com provedor de internet ou empresa do mesmo segmento. Taxa fixa de R$1.000,00 aplicada, valor revertido em abatimento decrescente das parcelas do plano contratado."

### Classificação Final
- `taxa_1000` (sempre)

### 🔴 Prioridade
Se `possui_debito_provedor = true`, ignore TODAS as outras regras.

---

## 🎯 CASO DE ANÁLISE: KATIA DA SILVA (CPF final 389-71)

### Dados Apresentados

```json
{
  "nome": "KATIA DA SILVA",
  "cpf_cnpj": "XXX.XXX.XXX-389-71",
  "tipo_pessoa": "PF",
  
  // ⚠️ DADOS CRÍTICOS
  "quantidade_registros_negativos": 0,
  "valor_total_negativado": "R$ 0,00",
  "credores": [],
  
  // FLAGS
  "possui_protesto": false,
  "possui_debito_provedor": false,
  "documento_em_nome_do_contratante": false,
  "tipo_documento": "nao_apresentado",
  
  // TAXA APLICADA
  "taxa_instalacao": 0,
  "taxa_analise_credito": 300,
  "taxa_total": 300,
  
  "classificacao_final": "taxa_300",
  "regra_aplicada": "regra_04_taxa_300",
  "motivo_decisao": "?"
}
```

### Análise Lógica — Por que Regra 04?

#### ✅ **RESPOSTA: Esta é a sequência correta**

1. **Regra 01?** ❌ Requer exatamente 1 registro negativo. Tem 0. **NÃO APLICA.**
2. **Regra 02?** ❌ Requer exatamente 1 registro negativo. Tem 0. **NÃO APLICA.**
3. **Regra 03?** ❌ Requer 2-3 registros. Tem 0. **NÃO APLICA.**
4. **Regra Especial (Provedor)?** ❌ `possui_debito_provedor = false`. **NÃO APLICA.**
5. **Regra 04?** ✅ **FALLBACK padrão!** Como nenhuma outra regra se aplicou, a Regra 04 é acionada automaticamente.

### 🔴 Problema Identificado

A **Regra 04 é excessivamente genérica** quando aplicada como fallback. Um cliente com:
- ✅ 0 registros negativos
- ✅ R$ 0,00 em negativações
- ✅ Sem protesto
- ✅ Sem débito com provedor

**DEVERIA SER ISENTO OU TAXA MÍNIMA**, não R$300.

---

## 🚨 GATILHOS FANTASMAS IDENTIFICADOS

### 1️⃣ **O "Fallback" da Regra 04 sem Guardrails**

**Problema**: Se nenhuma regra específica se aplica, a Regra 04 é acionada automaticamente.

**Cenário problemático**:
```
quantidade_registros_negativos = 0
valor_total_negativado = R$ 0,00
score = 800 (excelente)

Resultado: Regra 04 (R$300) ← INCOERENTE
```

**Solução proposta**:
- Adicionar **Regra 00 — APROVAÇÃO AUTOMÁTICA** para:
  - 0 registros negativos E score ≥ 700 = Isento
  - 0 registros negativos E score 600-699 = Taxa R$50 (nova)
  - 0 registros negativos E score < 600 = Taxa R$100 (Regra 02)

---

### 2️⃣ **Campo "possui_protesto" Acionando Regra 04 sem Clareza**

**Problema**: Se `possui_protesto = true`, SEMPRE enquadra na Regra 04. Mas o motivo exato não é claro.

**Cenário**:
```
quantidade_registros_negativos = 0
possui_protesto = true

Resultado: Regra 04 (R$300) ← por protesto, não por negativações
```

**Recomendação**: Campo adicional `motivo_aplicacao` para especificar:
- `"por_quantidade_registros"`
- `"por_valor_total"`
- `"por_protesto_ativo"`
- `"por_nao_elegibilidade_regras_1_2_3"`

---

### 3️⃣ **"Débito com Provedor" Pode Estar Sendo Detectado Erroneamente**

**Problema**: Campo `possui_debito_provedor` é preenchido pela IA (Claude/Gemini 2.5 Flash). Pode haver falsos positivos.

**Cenário**:
```
Texto SPC: "Cliente tem débito com Telecom Brasil S.A."
IA interpreta como provedor de internet?

Se sim: Regra Especial (R$1.000)
Se não: Regra 04 (R$300)
```

**Recomendação**: 
- Adicionar campo `motivo_debito_provedor` (string) para rastreabilidade
- Implementar whitelist de provedores conhecidos vs. empresas de outro ramo que possam ser confundidas

---

### 4️⃣ **Falta de Validação de Dados de Entrada**

**Problema**: O SYSTEM_PROMPT não valida inconsistências nos dados.

**Cenário**:
```
quantidade_registros_negativos = 0
credores = [{"nome": "Itaú", "valor": "R$ 500", ...}]

Inconsistência: 0 registros mas tem 1 credor listado
```

**Recomendação**:
- Validação: `cantidad_registros_negativos` deve igualar `credores.length`
- Se diferentes, rejeitar e solicitar revisão manual

---

### 5️⃣ **Score Baixo Não Está Sendo Considerado Isoladamente**

**Problema**: Se `score = 200` (risco extremo) mas `quantidade_registros_negativos = 0`, qual é a taxa?

**Cenário**:
```
score = 200 (risco máximo)
quantidade_registros_negativos = 0
valor_total_negativado = R$ 0,00

Resultado: Regra 04? Ou deveria ter regra específica para score baixo?
```

**Recomendação**:
- Adicionar validação de score como critério independente
- Se score < 400, aplicar taxa mínima de R$150 (nova)

---

### 6️⃣ **"Nenhuma Informação no Documento" Pode Disparar Regra 04**

**Problema**: Se o texto SPC estiver vazio ou ilegível, a IA pode não conseguir extrair dados e recarregar para Regra 04 como fallback.

**Cenário**:
```
Texto SPC: "[PDF ilegível ou corrompido]"
IA retorna: quantidade_registros_negativos = "Não identificado"

Resultado: Interpretado como 0? Dispara Regra 04?
```

**Recomendação**:
- Rejeitar análises com `quantidade_registros_negativos = "Não identificado"`
- Pedir novo upload de documento

---

### 7️⃣ **Ausência de "Taxa de Consulta" (Mínima)**

**Problema**: Não há taxa mínima por simplesmente fazer a consulta.

**Cenário**:
```
Cliente com perfil impecável (score 800, 0 negativações)
Taxa: R$ 0,00 (completamente isento)

Mas empresa precisa de ROI mínimo nas consultas
```

**Recomendação**:
- Adicionar **Taxa de Consulta Mínima: R$25** como taxa de instalação reduzida
- Aplicar sempre, independentemente da regra

---

## 📊 MATRIZ DE DECISÃO COMPLETA

```
┌─ quantidade_registros = 0
│  ├─ score >= 700 → ✅ NOVO: Aprovação Automática (R$ 0,00) *
│  ├─ score 600-699 → ✅ NOVO: Taxa Mínima (R$ 50) *
│  └─ score < 600 → Regra 02 (R$ 100)
│
├─ quantidade_registros = 1
│  ├─ Elegível Regra 01 (por categoria) → Regra 01 (R$ 0-100)
│  └─ Não elegível Regra 01 → Regra 02 (R$ 100-200)
│
├─ quantidade_registros = 2-3
│  └─ Elegível Regra 03 → Regra 03 (R$ 200-300)
│
├─ quantidade_registros >= 4
│  └─ Regra 04 (R$ 300-400)
│
└─ possui_protesto = true OU possui_debito_provedor = true
   ├─ Débito provedor → Regra Especial (R$ 1.000)
   └─ Protesto → Regra 04 (R$ 300-400)

* Recomendações de melhoria
```

---

## ✅ RECOMENDAÇÕES DE CORREÇÃO

### **CURTO PRAZO** (Imediato)

1. **[ ] Revisar Caso Katia da Silva**
   - Confirmar se realmente deveria ser Regra 04
   - Verificar se há protesto oculto ou débito com provedor não detectado
   - Se não, aplicar taxa reduzida manualmente (R$100)

2. **[ ] Implementar Validação**
   - Se `quantidade_registros_negativos = 0` E `credores.length > 0` → ERRO
   - Se `score = "Não identificado"` → Rejeitar análise

3. **[ ] Adicionar Campo de Rastreabilidade**
   - Campo `motivo_aplicacao_regra` em cada resultado
   - Facilita auditoria como esta

---

### **MÉDIO PRAZO** (1-2 sprints)

4. **[ ] Criar Regra 00 — Aprovação Automática**
   - Para 0 registros negativos + score ≥ 700
   - Isenta de taxa ou taxa mínima (R$25)

5. **[ ] Refatorar Regra 04**
   - Deixar de ser "fallback" genérico
   - Passar a ser "risco alto confirmado"
   - Adicionar guardrails

6. **[ ] Whitelist de Provedores**
   - Enumerar provedores conhecidos
   - Reduzir falsos positivos de `possui_debito_provedor`

---

### **LONGO PRAZO** (Roadmap)

7. **[ ] Dashboard de Auditoria**
   - Mostrar distribuição de regras aplicadas
   - Alertar se > 30% das análises caem em Regra 04
   - Comparar score vs. regra aplicada

8. **[ ] Machine Learning**
   - Treinar modelo para detectar inconsistências
   - Alertar para revisão manual

---

## 📌 CONCLUSÃO

A **Regra 04 está sendo acionada corretamente como fallback** para o caso de Katia da Silva. Porém:

1. ⚠️ **Usando Regra 04 como fallback é arriscado**
   - Clientes com 0 negativações não deveriam pagar R$300

2. 🚨 **Possíveis gatilhos fantasmas são:**
   - ✅ Protesto oculto não mencionado
   - ✅ Débito com provedor sendo mal interpretado
   - ✅ Score baixo ignorado (se aplicável)
   - ✅ Falta de guardrails para Regra 04

3. ✅ **Recomendação: Implementar Regra 00**
   - Clientes sem registros negativos E score ≥ 700
   - Taxa mínima (R$0-50) em vez de Regra 04

---

## 📎 REFERÊNCIAS

- **Arquivo**: [supabase/functions/analyze-credit/index.ts](supabase/functions/analyze-credit/index.ts)
- **UI**: [src/components/credit/CreditAnalysisResult.tsx](src/components/credit/CreditAnalysisResult.tsx)
- **Motor**: Google Gemini 2.5 Flash via Lovable AI Gateway
- **Data da Auditoria**: 08/04/2026
