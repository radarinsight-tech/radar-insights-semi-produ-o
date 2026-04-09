import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileSearch, ShieldCheck, ShieldX, AlertTriangle, User, CreditCard,
  Building2, Lightbulb, CircleDollarSign, Search, Receipt, FileCheck,
  FileX, Wifi, Scale
} from "lucide-react";

export interface CreditCredor {
  nome: string;
  valor: string;
  categoria: string;
  data_registro: string;
  antiguidade_meses: number;
}

export interface CreditAnalysisData {
  nome: string;
  cpf_cnpj: string;
  tipo_pessoa: string;
  score: string;
  quantidade_registros_negativos: number;
  valor_total_negativado: string;
  credores: CreditCredor[];
  possui_protesto: boolean;
  possui_debito_provedor: boolean;
  documento_em_nome_do_contratante: boolean;
  tipo_documento: string;
  taxa_instalacao: number;
  taxa_analise_credito: number;
  taxa_total: number;
  classificacao_final: string;
  motivo_decisao: string;
  regra_aplicada: string;
  observacoes: string;
  resultado_rapido: string;
  // Legacy fields for backward compat
  cpf?: string;
  idade?: string;
  quantidadeRegistrosNegativos?: number;
  valorTotalDividas?: string;
  regraAplicada?: string;
  decisaoFinal?: string;
  valorTaxa?: string;
  orientacaoOperacional?: string;
  resultadoRapido?: string;
}

interface Props {
  data: CreditAnalysisData | null;
}

const categoriaLabels: Record<string, string> = {
  educacao: "Educação",
  banco_financeira: "Banco / Financeira",
  empresa_cnpj_atividade_profissional: "Atividade Profissional",
  comercio_varejo: "Comércio / Varejo",
  energia_agua: "Energia / Água",
  moradia_imobiliaria: "Moradia / Imobiliária",
  provedor_internet: "Provedor de Internet",
  protesto: "Protesto",
};

const categoriaIcons: Record<string, string> = {
  educacao: "🎓",
  banco_financeira: "🏦",
  empresa_cnpj_atividade_profissional: "🏢",
  comercio_varejo: "🏪",
  energia_agua: "💡",
  moradia_imobiliaria: "🏠",
  provedor_internet: "📡",
  protesto: "⚖️",
};

const regraLabels: Record<string, { label: string; color: string; bg: string; border: string }> = {
  regra_especial_debito_provedor: {
    label: "REGRA ESPECIAL — Débito Provedor",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive",
  },
  regra_00_isento: {
    label: "REGRA 00 — Isento",
    color: "text-green-600",
    bg: "bg-green-100",
    border: "border-green-600",
  },
  regra_01_isencao: {
    label: "REGRA 01 — Isenção",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent",
  },
  regra_02_taxa_100: {
    label: "REGRA 02 — Taxa R$100",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning",
  },
  regra_03_taxa_200: {
    label: "REGRA 03 — Taxa R$200",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary",
  },
  regra_04_taxa_300: {
    label: "REGRA 04 — Taxa R$300",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive",
  },
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CreditAnalysisResult = ({ data }: Props) => {
  if (!data) {
    return (
      <Card className="p-6 flex flex-col items-center justify-center text-center min-h-[320px]">
        <h2 className="text-lg font-bold text-primary mb-5">Resultado da Análise de Crédito</h2>
        <div className="p-3 rounded-full bg-primary/10 mb-4">
          <FileSearch className="h-8 w-8 text-primary/60" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-3">Radar Insight — Análise de Crédito</p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Envie uma consulta de CPF em PDF ou imagem para realizar a análise.
        </p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mt-2">
          O sistema irá ler o documento, aplicar o motor de decisão e exibir aqui o parecer técnico com taxas e justificativa.
        </p>
      </Card>
    );
  }

  // Support both new and legacy formats
  const nome = data.nome || "Não identificado";
  const cpfCnpj = data.cpf_cnpj || data.cpf || "Não identificado";
  const qtdNegativos = data.quantidade_registros_negativos ?? data.quantidadeRegistrosNegativos ?? 0;
  const valorTotal = data.valor_total_negativado || data.valorTotalDividas || "R$ 0,00";
  const regra = data.regra_aplicada || data.regraAplicada || "";
  const resultadoRapido = data.resultado_rapido || data.resultadoRapido || "";
  const observacoes = data.observacoes || "";
  const motivoDecisao = data.motivo_decisao || data.orientacaoOperacional || "";

  const regraConfig = regraLabels[regra] || {
    label: regra || "—",
    color: "text-muted-foreground",
    bg: "bg-secondary",
    border: "border-border",
  };

  const isNewFormat = !!data.regra_aplicada;

  return (
    <Card className="p-6 animate-in fade-in duration-300">
      <h2 className="text-lg font-bold text-primary mb-4">Resultado da Análise de Crédito</h2>

      {/* Decision highlight */}
      <div className={`rounded-lg border-2 ${regraConfig.border} ${regraConfig.bg} p-4 mb-5`}>
        <div className="flex items-center gap-3 mb-2">
          <Scale className={`h-7 w-7 ${regraConfig.color}`} />
          <Badge className={`text-sm px-3 py-1 ${regraConfig.bg} ${regraConfig.color} border ${regraConfig.border}`}>
            {regraConfig.label}
          </Badge>
        </div>
        <p className={`text-sm font-semibold ${regraConfig.color}`}>{resultadoRapido}</p>
      </div>

      {/* Personal info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="flex items-start gap-2">
          <User className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome</p>
            <p className="text-sm font-medium mt-0.5">{nome}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <CreditCard className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CPF/CNPJ</p>
            <p className="text-sm font-medium mt-0.5">{cpfCnpj}</p>
          </div>
        </div>
        {isNewFormat && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo / Score</p>
            <p className="text-sm font-medium mt-0.5">{data.tipo_pessoa} — {data.score}</p>
          </div>
        )}
        {!isNewFormat && data.idade && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Idade</p>
            <p className="text-sm font-medium mt-0.5">{data.idade}</p>
          </div>
        )}
      </div>

      {/* Negative records summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div className="rounded-lg bg-secondary p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Registros Negativos</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{qtdNegativos}</p>
        </div>
        <div className="rounded-lg bg-secondary p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor Total Negativado</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{valorTotal}</p>
        </div>
      </div>

      {/* Flags: Protesto + Débito Provedor + Documento */}
      {isNewFormat && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className={`rounded-lg p-3 flex items-center gap-2 ${data.possui_protesto ? "bg-destructive/10 border border-destructive" : "bg-secondary"}`}>
            <AlertTriangle className={`h-4 w-4 ${data.possui_protesto ? "text-destructive" : "text-muted-foreground"}`} />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Protesto</p>
              <p className={`text-sm font-bold ${data.possui_protesto ? "text-destructive" : "text-foreground"}`}>
                {data.possui_protesto ? "SIM" : "NÃO"}
              </p>
            </div>
          </div>
          <div className={`rounded-lg p-3 flex items-center gap-2 ${data.possui_debito_provedor ? "bg-destructive/10 border border-destructive" : "bg-secondary"}`}>
            <Wifi className={`h-4 w-4 ${data.possui_debito_provedor ? "text-destructive" : "text-muted-foreground"}`} />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Débito Provedor</p>
              <p className={`text-sm font-bold ${data.possui_debito_provedor ? "text-destructive" : "text-foreground"}`}>
                {data.possui_debito_provedor ? "SIM" : "NÃO"}
              </p>
            </div>
          </div>
          <div className={`rounded-lg p-3 flex items-center gap-2 ${data.documento_em_nome_do_contratante ? "bg-accent/10 border border-accent" : "bg-secondary"}`}>
            {data.documento_em_nome_do_contratante ? (
              <FileCheck className="h-4 w-4 text-accent" />
            ) : (
              <FileX className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Documento</p>
              <p className={`text-sm font-bold ${data.documento_em_nome_do_contratante ? "text-accent" : "text-foreground"}`}>
                {data.documento_em_nome_do_contratante ? "Válido" : "Não apresentado"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Taxa breakdown */}
      {isNewFormat && (
        <div className="mb-5 border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Composição de Taxas</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-secondary p-3 text-center">
              <p className="text-xs text-muted-foreground">Taxa Instalação</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(data.taxa_instalacao)}</p>
            </div>
            <div className="rounded-lg bg-secondary p-3 text-center">
              <p className="text-xs text-muted-foreground">Taxa Análise</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(data.taxa_analise_credito)}</p>
            </div>
            <div className={`rounded-lg p-3 text-center border-2 ${data.taxa_total > 0 ? "border-warning bg-warning/10" : "border-accent bg-accent/10"}`}>
              <p className="text-xs text-muted-foreground">Taxa Total</p>
              <p className={`text-xl font-bold ${data.taxa_total > 0 ? "text-warning" : "text-accent"}`}>
                {formatCurrency(data.taxa_total)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Credores */}
      {data.credores && data.credores.length > 0 && (
        <div className="mb-5 border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Credores Identificados</p>
          </div>
          <div className="space-y-2">
            {data.credores.map((c, i) => {
              const cat = (c as any).categoria || (c as any).tipo || "outros";
              const catLabel = categoriaLabels[cat] || cat;
              const catIcon = categoriaIcons[cat] || "📋";
              return (
                <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span>{catIcon}</span>
                    <span className="text-sm font-medium text-foreground truncate">{c.nome}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{catLabel}</Badge>
                    {(c as any).antiguidade_meses !== undefined && (
                      <span className="text-xs text-muted-foreground shrink-0">{(c as any).antiguidade_meses}m</span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-foreground shrink-0 ml-2">{c.valor}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Justificativa / Motivo */}
      <div className="mb-5 border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {isNewFormat ? "Justificativa da Decisão" : "Regra Aplicada"}
          </p>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{motivoDecisao}</p>
      </div>

      {/* Observações */}
      {observacoes && (
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Observações</p>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{observacoes}</p>
        </div>
      )}
    </Card>
  );
};

export default CreditAnalysisResult;
