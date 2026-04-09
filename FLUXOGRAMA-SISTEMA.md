# Radar Insight Dashboard — Fluxograma Detalhado do Sistema

---

## Atores do Sistema

```mermaid
flowchart LR
    subgraph Usuários
        U1[Administrador\nGerencia usuários,\nsetores e permissões]
        U2[Auditor\nAvalia atendimentos\ne gera relatórios]
        U3[Analista de Crédito\nConsulta SPC e\nanálise documental]
        U4[Gestor\nVisualiza rankings,\nbônus e performance]
    end
```

---

## Fluxo 1 — Autenticação

```mermaid
flowchart TD
    A([Usuário acessa radarinsight.tech]) --> B[Tela de Login]
    B --> C{Credenciais válidas?}
    C -- Não --> D[Exibe erro\nTenta novamente]
    C -- Sim --> E{Primeiro acesso?}
    E -- Sim --> F[Força troca de senha]
    F --> G[Hub Central]
    E -- Não --> G
    G --> H{Qual módulo\ntem acesso?}
    H --> I[Auditoria]
    H --> J[Mentoria]
    H --> K[Crédito]
    H --> L[Admin]
```

**Exemplo prático:**
> Eduardo cadastra um novo atendente no sistema. O sistema envia email com senha temporária. No primeiro login, o atendente é obrigado a criar uma senha nova antes de acessar qualquer módulo.

---

## Fluxo 2 — Auditoria de Atendimento

```mermaid
flowchart TD
    A([Auditor faz upload do PDF]) --> B[Sistema extrai texto do PDF]
    B --> C{PDF válido?}
    C -- Não --> D[Exibe erro de formato]
    C -- Sim --> E[IA analisa o atendimento]
    E --> F[Gera nota de 0 a 10]
    F --> G{Qual faixa da nota?}
    G -- 0 a 5 --> H[Classificação: Crítico\nMentoria obrigatória]
    G -- 5 a 7 --> I[Classificação: Regular\nMentoria sugerida]
    G -- 7 a 9 --> J[Classificação: Bom\nAcompanhamento]
    G -- 9 a 10 --> K[Classificação: Excelente\nReferência para equipe]
    H --> L[Salva avaliação no banco]
    I --> L
    J --> L
    K --> L
    L --> M[Atualiza ranking do atendente]
```

**Exemplo prático:**
> Auditor faz upload do PDF da chamada de Ana Santos do dia 15/03. A IA detecta que ela não seguiu o script de abertura e não ofereceu solução alternativa. Nota: 5,8 — Classificação: Regular. Sistema sugere mentoria sobre "Abordagem e Resolução".

---

## Fluxo 3 — Mentoria Lab (Lote)

```mermaid
flowchart TD
    A([Gestor faz upload do ZIP]) --> B{ZIP válido?\nAté 1.000 arquivos}
    B -- Não --> C[Erro: formato inválido]
    B -- Sim --> D[Sistema descompacta os arquivos]
    D --> E[Identifica atendente por arquivo]
    E --> F[IA processa cada atendimento]
    F --> G[Agrupa por competência]
    G --> H{Atendente tem\nmínimo de avaliações?}
    H -- Não --> I[Marcado como não elegível]
    H -- Sim --> J[Calcula média do período]
    J --> K{Média maior ou igual a 7?}
    K -- Sim --> L[Elegível para bônus]
    K -- Não --> M[Gera plano de mentoria]
    L --> N[Salva no banco]
    M --> N
    N --> O[Relatório disponível para export PDF]
```

**Exemplo prático:**
> No fechamento de março, gestor faz upload de um ZIP com 320 PDFs de atendimento. O sistema processa, identifica 12 atendentes, calcula as médias e detecta que 8 são elegíveis para bônus e 4 precisam de mentoria obrigatória antes do próximo ciclo.

---

## Fluxo 4 — Ranking e Bônus

```mermaid
flowchart TD
    A([Início do fechamento mensal]) --> B[Sistema coleta todas\nas avaliações do mês]
    B --> C[Calcula nota média por atendente]
    C --> D{Tem mínimo de\n6 mentorias válidas?}
    D -- Não --> E[Excluído do ranking de bônus]
    D -- Sim --> F{Qual a nota média?}
    F -- 9 a 10 --> G[Bônus: 100%]
    F -- 7 a 9 --> H[Bônus: 75%]
    F -- 5 a 7 --> I[Bônus: 50%]
    F -- 0 a 5 --> J[Sem bônus]
    G --> K[Snapshot do ranking salvo]
    H --> K
    I --> K
    J --> K
    K --> L[Relatório de fechamento gerado]
```

**Exemplo prático:**
> No fechamento de março, João Silva teve média 8,4 com 7 mentorias válidas — elegível, bônus de 75%. Maria Costa teve média 9,1 com 8 mentorias — elegível, bônus de 100%. Pedro Alves teve média 7,2 mas apenas 4 mentorias — excluído do bônus.

---

## Fluxo 5 — Análise de Crédito

```mermaid
flowchart TD
    A([Analista insere CPF ou CNPJ]) --> B[Sistema consulta SPC\nProduto 643]
    B --> C{Cliente tem\nrestrição?}
    C -- Sim --> D[Exibe negativações\ne score]
    C -- Não --> E[Score positivo]
    D --> F{Aplica política\nBanda Turbo}
    E --> F
    F --> G{Decisão automática}
    G -- Aprovado --> H[Libera crédito\nRegistra no banco]
    G -- Análise manual --> I[Analista revisa\ndocumentos]
    G -- Reprovado --> J[Registra recusa\ncom motivo]
    I --> K[Upload de documentos]
    K --> L[IA faz OCR + validação]
    L --> M{Documentos\nautênticos?}
    M -- Sim --> H
    M -- Suspeita de fraude --> N[Alerta de fraude\nBloqueio automático]
```

**Exemplo prático:**
> Analista consulta CPF 123.456.789-00. Sistema retorna score 720, sem negativações. Política Banda Turbo aprova automaticamente para crédito até R$ 5.000. Para valores acima, solicita upload de comprovante de renda — IA valida o documento e confirma autenticidade.

---

## Fluxo 6 — Deploy (Como uma melhoria chega à produção)

```mermaid
flowchart TD
    A([Eduardo tem uma ideia\nde melhoria]) --> B[Abre Radar Insights — SEMI-PRODUÇÃO\nno Lovable]
    B --> C[Descreve a melhoria para a IA]
    C --> D[Lovable gera o código]
    D --> E{Testou e aprovou?}
    E -- Não --> F[Ajusta e testa novamente]
    F --> E
    E -- Sim --> G[GitHub: merge\nSEMI-PRODUÇÃO para main]
    G --> H[Radar Insights — PRODUÇÃO\natualiza automaticamente]
    H --> I([radarinsight.tech\nAtualizado para os clientes])
```

**Exemplo prático:**
> Eduardo quer adicionar um filtro por setor na tela de ranking. Abre o SEMI-PRODUÇÃO, descreve para o Lovable, testa com dados reais, aprova. Faz o merge no GitHub. Em minutos, o filtro está disponível em radarinsight.tech sem nenhuma interrupção para os clientes.

---

## Infraestrutura Completa

```mermaid
flowchart LR
    subgraph Cliente
        A[Navegador\nradarinsight.tech]
    end

    subgraph Namecheap
        B[Domínio DNS\nradarinsight.tech]
    end

    subgraph Lovable
        C[Frontend\nReact + TypeScript]
    end

    subgraph Supabase
        D[Autenticação]
        E[Banco PostgreSQL]
        F[Edge Functions IA]
        G[Armazenamento\nPDFs e ZIPs]
    end

    subgraph GitHub
        H[Código-fonte\nBackup + Versões]
        I[Branch main\nProdução]
        J[Branch dev\nDesenvolvimento]
    end

    subgraph SPC
        K[Produto 643\nConsulta crédito]
    end

    A --> B --> C
    C --> D
    C --> E
    C --> F
    C --> G
    F --> K
    C --> H
    H --> I
    H --> J
```

---

*Documento criado em: 2026-03-28*
*Versão: 1.0*
