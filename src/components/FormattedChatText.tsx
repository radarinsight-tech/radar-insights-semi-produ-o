import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, ChevronDown, ChevronRight } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

export interface ParsedBlock {
  speaker: string;
  timestamp: string;
  text: string;
  role: "cliente" | "marte" | "atendente";
  isPostAuto: boolean;
}

// ─── Post-attendance detection ───────────────────────────────────

const POST_ATTENDANCE_PATTERNS = [
  /queremos\s+saber\s+como\s+foi/i,
  /pesquisa\s+de\s+satisfação/i,
  /avalie\s+(?:nosso|o)\s+atendimento/i,
  /notamos\s+que\s+voc[eê]\s+n[aã]o\s+finalizou/i,
  /pesquisa\s+não\s+respondida/i,
  /pesquisa\s+de\s+satisfa[cç][aã]o\s+encerrada/i,
  /excelente\s*[\/|]\s*bom\s*[\/|]\s*regular/i,
  /nota\s+de\s+\d+\s+a\s+\d+/i,
];

function isPostAttendanceAuto(text: string): boolean {
  return POST_ATTENDANCE_PATTERNS.some(p => p.test(text));
}

// ─── Date / Name helpers ─────────────────────────────────────────

const PT_MONTHS = "janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";
const PT_DATE_PATTERN = new RegExp(`(?:Lida\\s*-\\s*)?(\\d{1,2})\\s+de\\s+(${PT_MONTHS})\\s+de\\s+(\\d{4})\\s+(\\d{2}:\\d{2})`, "i");
const SHORT_DATE_PATTERN = /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/;

const HEADER_SKIP = /^(hor[aá]rio\s+de\s+abertura|in[ií]cio\s+do\s+atendimento|fim\s+do\s+atendimento|protocolo|cliente|atendente|data|canal|setor|tipo|status)\b/i;

function isRawDateLine(line: string): { time: string } | null {
  const cleaned = line.replace(/^Lida\s*-\s*/i, "").trim();
  const ptMatch = cleaned.match(PT_DATE_PATTERN);
  if (ptMatch) return { time: ptMatch[4] };
  const shortMatch = cleaned.match(SHORT_DATE_PATTERN);
  if (shortMatch) return { time: shortMatch[2] };
  return null;
}

function isRawNameLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 50 || trimmed.length < 2) return false;
  if (/^\d/.test(trimmed)) return false;
  if (!/^[A-Za-zÀ-ÿ]/.test(trimmed)) return false;
  if (HEADER_SKIP.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > 6) return false;
  if (isRawDateLine(trimmed)) return false;
  return true;
}

// ─── Parser ──────────────────────────────────────────────────────

export function parseRawTextBlocks(rawText: string, clientName?: string): ParsedBlock[] {
  let extractedClient = clientName;
  if (!extractedClient) {
    const clientMatch = rawText.match(/Cliente[:\s]+([^\n]+)/i);
    if (clientMatch) extractedClient = clientMatch[1].trim();
  }

  const lines = rawText.split("\n");
  const blocks: ParsedBlock[] = [];

  // Detect format
  let formatACount = 0, formatBCount = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    const t = lines[i].trim();
    if (isRawNameLine(t)) {
      let next = i + 1;
      while (next < lines.length && !lines[next].trim()) next++;
      if (next < lines.length) {
        if (isRawDateLine(lines[next].trim())) formatACount++;
        else formatBCount++;
      }
    }
  }

  const isFormatB = formatBCount > formatACount;

  if (isFormatB) {
    const nameIndices: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (isRawNameLine(lines[i].trim())) nameIndices.push(i);
    }

    for (let n = 0; n < nameIndices.length; n++) {
      const nameIdx = nameIndices[n];
      const speaker = lines[nameIdx].trim();
      const nextNameIdx = n + 1 < nameIndices.length ? nameIndices[n + 1] : lines.length;

      const contentLines: string[] = [];
      let timestamp = "";

      for (let j = nameIdx + 1; j < nextNameIdx; j++) {
        const trimmed = lines[j].trim();
        if (!trimmed) continue;
        const dateInfo = isRawDateLine(trimmed);
        if (dateInfo) {
          timestamp = dateInfo.time;
        } else {
          contentLines.push(trimmed);
        }
      }

      if (contentLines.length === 0) continue;

      let role: ParsedBlock["role"] = "atendente";
      const speakerLower = speaker.toLowerCase();
      if (/^marte$/i.test(speaker) || speakerLower.includes("marte")) {
        role = "marte";
      } else if (extractedClient) {
        const clientFirst = extractedClient.toLowerCase().split(/\s+/)[0];
        if (clientFirst && speakerLower.includes(clientFirst)) role = "cliente";
      }

      const text = contentLines.join("\n");
      const isPostAuto = role === "marte" && isPostAttendanceAuto(text);
      blocks.push({ speaker, timestamp, text, role, isPostAuto });
    }
  } else {
    const blockRegex = /^([A-ZÀ-Ü][A-ZÀ-Ü\s]+?)[\s]+(\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}|\d{1,2}:\d{2})\s*$/gm;
    const matches = [...rawText.matchAll(blockRegex)];

    if (matches.length > 0) {
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const speaker = match[1].trim();
        const timestamp = match[2].trim();
        const startIdx = match.index! + match[0].length;
        const endIdx = i + 1 < matches.length ? matches[i + 1].index! : rawText.length;
        const text = rawText.slice(startIdx, endIdx).trim();

        let role: ParsedBlock["role"] = "atendente";
        const speakerUpper = speaker.toUpperCase();
        if (speakerUpper === "MARTE" || speakerUpper.includes("MARTE")) role = "marte";
        else if (extractedClient && speaker.toLowerCase().includes(extractedClient.toLowerCase().split(" ")[0])) role = "cliente";

        const isPostAuto = role === "marte" && isPostAttendanceAuto(text);
        blocks.push({ speaker, timestamp, text, role, isPostAuto });
      }
    }
  }

  // Fallback
  if (blocks.length === 0) {
    const dateSplitRegex = new RegExp(`((?:Lida\\s*-\\s*)?\\d{1,2}\\s+de\\s+(?:${PT_MONTHS})\\s+de\\s+\\d{4}\\s+\\d{2}:\\d{2})`, "gi");
    const parts = rawText.split(dateSplitRegex).filter(Boolean);

    if (parts.length >= 2) {
      for (let i = 0; i < parts.length - 1; i += 2) {
        const content = parts[i].trim();
        const dateStr = parts[i + 1]?.trim() || "";
        const dateInfo = isRawDateLine(dateStr);
        if (!content || !dateInfo) continue;

        const firstNewline = content.indexOf("\n");
        let speaker = "Desconhecido";
        let text = content;
        if (firstNewline > 0 && firstNewline < 50) {
          const possibleName = content.slice(0, firstNewline).trim();
          if (isRawNameLine(possibleName)) {
            speaker = possibleName;
            text = content.slice(firstNewline + 1).trim();
          }
        }

        let role: ParsedBlock["role"] = "atendente";
        if (/^marte$/i.test(speaker)) role = "marte";
        else if (extractedClient && speaker.toLowerCase().includes(extractedClient.toLowerCase().split(" ")[0])) role = "cliente";

        const isPostAuto = role === "marte" && isPostAttendanceAuto(text);
        blocks.push({ speaker, timestamp: dateInfo.time, text, role, isPostAuto });
      }
    }
  }

  return blocks;
}

// ─── Rendering ───────────────────────────────────────────────────

function BlockRenderer({ blocks }: { blocks: ParsedBlock[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const nameColor = block.role === "cliente"
          ? "text-blue-600 dark:text-blue-400"
          : block.role === "marte"
            ? "text-gray-400"
            : "text-emerald-600 dark:text-emerald-400";
        const textStyle = block.role === "marte" ? "italic text-gray-400" : "text-foreground/80";

        return (
          <div key={i} className="text-[11px] leading-relaxed font-mono">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`font-bold ${nameColor}`}>{block.speaker}</span>
              {block.role === "marte" && (
                <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 text-gray-400 border-gray-300">URA</Badge>
              )}
              {block.isPostAuto && (
                <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 text-gray-400 border-gray-300">Pós-atendimento</Badge>
              )}
              <span className="text-muted-foreground/60 text-[10px]">{block.timestamp}</span>
            </div>
            <p className={`whitespace-pre-wrap break-words ${textStyle} ${block.isPostAuto ? "opacity-50" : ""}`}>
              {block.text}
            </p>
            {i < blocks.length - 1 && <hr className="border-border/30 mt-3" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Collapsible section (default export) ────────────────────────

interface FormattedChatTextProps {
  rawText: string;
  clientName?: string;
}

const FormattedChatText = ({ rawText, clientName }: FormattedChatTextProps) => {
  const [open, setOpen] = useState(false);

  const blocks = useMemo(() => parseRawTextBlocks(rawText, clientName), [rawText, clientName]);
  const hasBlocks = blocks.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full rounded-xl border border-border/50 bg-muted/10 px-4 py-2.5 hover:bg-muted/20 transition-colors">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">
          Acesso ao texto original do chat
        </span>
        <div className="ml-auto">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1.5 rounded-xl border border-border/40 bg-background/50 p-4 max-h-[40vh] overflow-y-auto">
          {hasBlocks ? (
            <BlockRenderer blocks={blocks} />
          ) : (
            <pre className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap break-words font-mono">
              {rawText}
            </pre>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default FormattedChatText;
