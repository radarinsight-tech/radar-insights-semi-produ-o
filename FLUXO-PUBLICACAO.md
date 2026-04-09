# 🚀 FLUXO DE PUBLICAÇÃO — RADAR INSIGHT

---

## 📋 REGRA DE OURO
> **Nunca publique sem testar na branch `dev` primeiro.**

---

## 🔄 FLUXO COMPLETO

```
1. MELHORIA
   └── Abrir Lovable → trocar para branch DEV
   └── Colar o prompt → aguardar rodar

2. TESTAR
   └── Clicar em "Preview" no topo do Lovable
   └── Testar tudo com calma (não é teste rápido)
   └── Se não ficou bom → corrigir antes de avançar

3. APROVAR
   └── Gerar protocolo de mudança (arquivo abaixo)
   └── Definir horário estratégico para publicar
       (preferencialmente fora do horário de uso)

4. MERGE (dev → principal)
   └── Acessar: github.com/radarinsight-tech/radar-insights-semi-produ-o
   └── Clicar em "Compare & pull request"
   └── Título: descrever o que foi feito
   └── Clicar "Merge pull request"

5. PUBLICAR
   └── Voltar ao Lovable
   └── Settings → GitHub → Filial → trocar para "principal"
   └── Clicar "Publicar" (botão azul no canto superior direito)
   └── Aguardar "Atualizado"

6. CONFIRMAR
   └── Acessar radarinsight.tech e verificar se está ok
   └── Se algo errou → ver passo EMERGÊNCIA abaixo
```

---

## 🗂️ COMO TROCAR DE BRANCH NO LOVABLE

```
1. Abrir projeto RADAR INSIGHT.TECH no Lovable
2. Clicar no nome do projeto (canto superior esquerdo)
3. Clicar em "Settings"
4. No menu lateral → clicar em "GitHub"
5. Seção "Filial" → clicar no dropdown
6. Selecionar a branch desejada:
   ├── desenvolvedor → para melhorias e testes
   └── principal     → para publicar aos usuários
```

---

## 🆘 EMERGÊNCIA — COMO VOLTAR VERSÃO ANTERIOR

```
1. Abrir Lovable no projeto RADAR INSIGHT.TECH
2. Clicar no ícone de RELÓGIO 🕐 (histórico) no topo
3. Localizar a versão anterior que funcionava
4. Clicar em "Restaurar esta versão"
5. Publicar novamente
```

---

## 📄 MODELO DE PROTOCOLO DE MUDANÇA

```
DATA: ___/___/______
HORÁRIO: ___:___
RESPONSÁVEL: Eduardo Neves Trichez

O QUE FOI ALTERADO:
- 

MÓDULOS IMPACTADOS:
- 

TESTADO EM PREVIEW: ( ) Sim  ( ) Não
APROVADO POR: 

COMO REVERTER SE ERRAR:
→ Histórico do Lovable → restaurar versão anterior de: ___/___/______

OBSERVAÇÕES:
```

---

## 🔑 LINKS RÁPIDOS

| O que | Link |
|---|---|
| Sistema produção | https://radarinsight.tech |
| Lovable editor | https://lovable.dev/projects/a1a9b7f3-6a43-4b42-8097-4d0b816d08f7 |
| GitHub repositório | https://github.com/radarinsight-tech/radar-insights-semi-produ-o |
| Guia UX/UI local | file:///C:/Users/edune/.verdent/verdent-projects/hoje-minha-estrutura-assim/guia-ux-radar-insight.html |
| Mockup local | file:///C:/Users/edune/.verdent/verdent-projects/hoje-minha-estrutura-assim/mockup-mentoria-lab.html |

---

## ⚠️ NUNCA FAÇA

- ❌ Clicar em "Remix this project" (cria banco de dados novo e perde dados)
- ❌ Publicar direto na branch principal sem testar no dev
- ❌ Publicar no horário de pico de uso das meninas
