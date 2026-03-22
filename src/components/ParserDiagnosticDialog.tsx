/**
 * Parser Diagnostic Dialog — admin-only debug view showing exactly how the parser
 * processed each attendance: raw text, normalized text, parsed messages, detected events, and summary.
 */

import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { normalizeRawText, parseStructuredConversation, extractUraContext, type ParsedMessage, type StructuredConversation } from "@/lib/conversationParser";
import { classifyMessages, type ClassifiedMessage } from "@/lib/messageClassifier";
import { buildJourneyTimeline, type JourneyMilestone } from "@/lib/uraJourneyTimeline";
import { AlertTriangle, CheckCircle2, Clock, MessageSquare, Bot, User, Headphones, HelpCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rawText?: string;
  atendente?: string;
  protocolo?: string;
  preParsedMessages?: ParsedMessage[];
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: typeof Bot }> = {
  bot: { label: "URA/Bot", color: "bg-purple-100 text-purple-700", icon: Bot },
  cliente: { label: "Cliente", color: "bg-blue-100 text-blue-700", icon: User },
  atendente: { label: "Atendente", color: "bg-emerald-100 text-emerald-700", icon: Headphones },
  sistema: { label: "Sistema", color: "bg-gray-100 text-gray-600", icon: HelpCircle },
};

const EVENT_LABELS: Record<string, string> = {
  ura_start: "🟣 Início URA",
  greeting: "👋 Saudação",
  menu: "📋 Menu",
  invalid_option: "❌ Opção inválida",
  valid_option: "✅ Opção válida",
  auth_request: "🔐 Pedido autenticação",
  auth_received: "🔑 Autenticação recebida",
  problem_request: "❓ Pedido descrição",
  problem_informed: "💬 Problema informado",
  transfer: "🔄 Transferência",
  queue: "⏳ Fila",
  human_start: "👤 Início humano",
  survey: "⭐ Pesquisa",
  reminder: "🔔 Lembrete",
  client_interaction: "💬 Interação cliente",
  generic: "—",
};

export default function ParserDiagnosticDialog({ open, onOpenChange, rawText, atendente, protocolo, preParsedMessages }: Props) {
  const diagnostic = useMemo(() => {
    if (!rawText) return null;

    // Step 1: Normalize
    const { text: normalizedText, wasNormalized } = normalizeRawText(rawText);

    // Step 2: Parse from normalized text
    const structured = parseStructuredConversation(rawText, atendente);
    const messages = structured.messages;
    const classified = messages.length >= 2 ? classifyMessages(messages) : [];
    const journey = buildJourneyTimeline(rawText, atendente, messages.length >= 2 ? messages : undefined);

    // Step 3: Get URA context with state classification
    const { extractUraContext } = require("@/lib/conversationParser");
    let uraContext: { status: string; statusReason: string } | null = null;
    try {
      uraContext = extractUraContext(rawText, atendente);
    } catch { /* ignore */ }

    // Build per-message diagnostic
    const msgDiag = messages.map((msg, i) => {
      const cls = classified[i] as ClassifiedMessage | undefined;
      const hasTimestamp = !!msg.isoTimestamp || !!msg.time;
      const hasAuthor = !!msg.speaker && msg.speaker.length > 0;
      const milestone = journey.milestones.find(m =>
        m.time === msg.time && m.speaker === msg.speaker
      );

      return {
        index: i,
        speaker: msg.speaker || "⚠ NÃO RECONHECIDO",
        role: msg.role,
        time: msg.time || null,
        date: msg.date || null,
        isoTimestamp: msg.isoTimestamp || null,
        text: msg.text,
        textPreview: msg.text.length > 120 ? msg.text.slice(0, 120) + "…" : msg.text,
        category: cls?.category || null,
        eventType: milestone?.type || null,
        warnings: [
          ...(!hasTimestamp ? ["timestamp não reconhecido"] : []),
          ...(!hasAuthor ? ["autor não reconhecido"] : []),
          ...(msg.text.trim().length === 0 ? ["mensagem vazia"] : []),
        ],
      };
    });

    // Summary stats
    const uraCount = msgDiag.filter(m => m.role === "bot").length;
    const clienteCount = msgDiag.filter(m => m.role === "cliente").length;
    const atendenteCount = msgDiag.filter(m => m.role === "atendente").length;
    const sistemaCount = msgDiag.filter(m => m.role === "sistema").length;
    const validTimestamps = msgDiag.filter(m => m.isoTimestamp).length;
    const warnings = msgDiag.flatMap(m => m.warnings);
    const firstHuman = messages.find(m => m.role === "atendente");
    const firstHumanIdx = messages.findIndex(m => m.role === "atendente");

    // Pre/post human split
    const preHumanBotCount = firstHumanIdx >= 0 
      ? msgDiag.slice(0, firstHumanIdx).filter(m => m.role === "bot").length 
      : uraCount;
    const postHumanBotCount = firstHumanIdx >= 0 
      ? msgDiag.slice(firstHumanIdx + 1).filter(m => m.role === "bot").length 
      : 0;

    // Detect if raw text has URA signals but parser missed them
    const rawHasMarte = /\bmarte\b/i.test(rawText);
    const rawHasMenu = /em\s+que\s+posso\s+(?:lhe\s+)?auxili/i.test(rawText);
    const rawHasTransfer = /transferi(?:u|ndo)\s+(?:o\s+)?atendimento|assumiu\s+(?:o\s+)?atendimento/i.test(rawText);
    const parserFoundUra = uraCount > 0;

    return {
      structured,
      normalizedText,
      wasNormalized,
      messages: msgDiag,
      journey,
      uraContext,
      summary: {
        format: structured.format,
        normalized: wasNormalized,
        totalMessages: messages.length,
        uraCount,
        preHumanBotCount,
        postHumanBotCount,
        clienteCount,
        atendenteCount,
        sistemaCount,
        validTimestamps,
        firstTimestamp: structured.firstTimestamp || "—",
        lastTimestamp: structured.lastTimestamp || "—",
        firstHuman: firstHuman?.speaker || "—",
        entradaFila: journey.milestones.some(m => m.type === "transfer") ? "Sim" : "Não",
        totalWarnings: warnings.length,
      },
      integrity: {
        rawHasMarte,
        rawHasMenu,
        rawHasTransfer,
        parserFoundUra,
        mismatch: (rawHasMarte || rawHasMenu) && !parserFoundUra,
      },
      rawTextLength: rawText.length,
      rawTextLines: rawText.split("\n").length,
      normalizedLines: normalizedText.split("\n").length,
    };
  }, [rawText, atendente]);

  if (!diagnostic) return null;

  const { summary, integrity, messages: msgDiag, journey } = diagnostic;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            🔍 Diagnóstico do Parser {protocolo && <Badge variant="outline" className="font-mono text-xs">{protocolo}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 pb-4">

            {/* Integrity check */}
            {integrity.mismatch && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Divergência detectada
                </p>
                <p className="text-xs text-destructive/80 mt-1">
                  O texto bruto contém sinais de URA ({integrity.rawHasMarte ? "Marte" : ""}{integrity.rawHasMenu ? ", Menu" : ""}{integrity.rawHasTransfer ? ", Transferência" : ""}),
                  mas o parser não classificou nenhuma mensagem como URA/Bot ({summary.uraCount} msgs bot).
                </p>
              </div>
            )}

            {/* Technical summary */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Resumo Técnico</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Formato", value: summary.format },
                  { label: "Normalizado", value: summary.normalized ? "✅ Sim" : "— Não" },
                  { label: "Total mensagens", value: summary.totalMessages },
                  { label: "Msgs URA/Bot", value: summary.uraCount },
                  { label: "Msgs Cliente", value: summary.clienteCount },
                  { label: "Msgs Atendente", value: summary.atendenteCount },
                  { label: "Timestamps válidos", value: `${summary.validTimestamps}/${summary.totalMessages}` },
                  { label: "Primeiro timestamp", value: summary.firstTimestamp },
                  { label: "Último timestamp", value: summary.lastTimestamp },
                  { label: "1º atendente humano", value: summary.firstHuman },
                  { label: "Entrada em fila", value: summary.entradaFila },
                  { label: "Texto bruto", value: `${diagnostic.rawTextLines} linhas` },
                  { label: "Texto normalizado", value: `${diagnostic.normalizedLines} linhas` },
                  { label: "Alertas", value: summary.totalWarnings > 0 ? `⚠ ${summary.totalWarnings}` : "✅ 0" },
                ].map(item => (
                  <div key={item.label} className="p-2 rounded bg-muted/50 border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-medium text-foreground mt-0.5 truncate">{String(item.value)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Raw text signals */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Sinais no Texto Bruto</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Marte", found: integrity.rawHasMarte },
                  { label: "Menu URA", found: integrity.rawHasMenu },
                  { label: "Transferência", found: integrity.rawHasTransfer },
                ].map(s => (
                  <Badge key={s.label} className={s.found ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}>
                    {s.found ? "✅" : "❌"} {s.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Journey milestones from timeline */}
            {journey.milestones.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Marcos da Jornada ({journey.milestones.length})
                </h3>
                <div className="space-y-1">
                  {journey.milestones.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-border/50 last:border-0">
                      <span className="text-muted-foreground font-mono w-12 shrink-0">{m.time || "??:??"}</span>
                      <Badge className={`${ROLE_CONFIG[m.role || "sistema"].color} text-[10px] px-1.5 shrink-0`}>
                        {ROLE_CONFIG[m.role || "sistema"].label}
                      </Badge>
                      <span className="text-muted-foreground shrink-0">{EVENT_LABELS[m.type || "generic"]}</span>
                      <span className="text-foreground truncate">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Per-message details */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Mensagens Parseadas ({msgDiag.length})
              </h3>
              {msgDiag.length === 0 ? (
                <div className="p-4 text-center bg-destructive/5 rounded-lg border border-destructive/20">
                  <AlertTriangle className="h-5 w-5 text-destructive mx-auto mb-1" />
                  <p className="text-sm font-medium text-destructive">Parser não extraiu nenhuma mensagem</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    O texto bruto tem {diagnostic.rawTextLines} linhas mas o parser retornou 0 mensagens.
                    Verifique se o formato é compatível (inline ou bloco OPA).
                  </p>
                </div>
              ) : (
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {msgDiag.map((m) => (
                    <div
                      key={m.index}
                      className={`flex items-start gap-2 text-xs py-1.5 px-2 rounded ${
                        m.warnings.length > 0 ? "bg-warning/5 border border-warning/20" : "border border-transparent hover:bg-muted/30"
                      }`}
                    >
                      <span className="text-muted-foreground font-mono w-6 shrink-0 text-right">#{m.index}</span>
                      <span className="text-muted-foreground font-mono w-12 shrink-0">
                        {m.time || <span className="text-destructive">??:??</span>}
                      </span>
                      <Badge className={`${ROLE_CONFIG[m.role].color} text-[10px] px-1.5 shrink-0`}>
                        {ROLE_CONFIG[m.role].label}
                      </Badge>
                      <span className="font-medium text-foreground w-24 shrink-0 truncate" title={m.speaker}>
                        {m.speaker}
                      </span>
                      {m.eventType && (
                        <span className="text-muted-foreground shrink-0">{EVENT_LABELS[m.eventType]}</span>
                      )}
                      {m.category && (
                        <Badge variant="outline" className="text-[9px] px-1 shrink-0">{m.category}</Badge>
                      )}
                      <span className="text-muted-foreground truncate flex-1" title={m.text}>
                        {m.textPreview}
                      </span>
                      {m.warnings.length > 0 && (
                        <span className="text-warning shrink-0" title={m.warnings.join(", ")}>
                          ⚠ {m.warnings.join(", ")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Normalized text preview */}
            {diagnostic.wasNormalized && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  Texto Normalizado (primeiras 200 linhas)
                  <Badge className="bg-primary/15 text-primary text-[9px]">Pré-processado</Badge>
                </h3>
                <pre className="text-[11px] bg-primary/5 border border-primary/20 rounded-lg p-3 max-h-[250px] overflow-auto whitespace-pre-wrap font-mono text-foreground/80 leading-relaxed">
                  {diagnostic.normalizedText
                    .split("\n")
                    .slice(0, 200)
                    .map((line: string, i: number) => `${String(i + 1).padStart(4, " ")} │ ${line}`)
                    .join("\n")}
                </pre>
              </div>
            )}

            {/* Raw text preview */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Texto Bruto Original (primeiras 200 linhas)
              </h3>
              <pre className="text-[11px] bg-muted/50 border border-border rounded-lg p-3 max-h-[300px] overflow-auto whitespace-pre-wrap font-mono text-muted-foreground leading-relaxed">
                {rawText
                  ?.split("\n")
                  .slice(0, 200)
                  .map((line: string, i: number) => `${String(i + 1).padStart(4, " ")} │ ${line}`)
                  .join("\n")}
              </pre>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
