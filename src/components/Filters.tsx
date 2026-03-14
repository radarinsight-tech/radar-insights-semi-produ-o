import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FiltersProps {
  atendentes: string[];
  tipos: string[];
  filters: { atendente: string; periodo: string; tipo: string; diaExato?: string };
  onChange: (filters: { atendente: string; periodo: string; tipo: string; diaExato?: string }) => void;
}

const Filters = ({ atendentes, tipos, filters, onChange }: FiltersProps) => {
  const [dateMode, setDateMode] = useState<"month" | "day">("month");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);

    if (dateMode === "month") {
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      onChange({ ...filters, periodo: yearMonth, diaExato: undefined });
    } else {
      const dayStr = format(date, "dd/MM/yyyy");
      onChange({ ...filters, periodo: "", diaExato: dayStr });
    }
    setCalendarOpen(false);
  };

  const clearDate = () => {
    setSelectedDate(undefined);
    onChange({ ...filters, periodo: "", diaExato: undefined });
  };

  const dateLabel = () => {
    if (!selectedDate) return "Selecione uma data";
    if (dateMode === "month") return format(selectedDate, "MMMM/yyyy", { locale: ptBR });
    return format(selectedDate, "dd/MM/yyyy");
  };

  return (
    <div className="flex flex-wrap gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Usuários ou atendentes</Label>
        <Select value={filters.atendente} onValueChange={(v) => onChange({ ...filters, atendente: v })}>
          <SelectTrigger className="w-[200px] bg-card">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {atendentes.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tipos de atendimento</Label>
        <Select value={filters.tipo} onValueChange={(v) => onChange({ ...filters, tipo: v })}>
          <SelectTrigger className="w-[200px] bg-card">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {tipos.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Data do atendimento</Label>
        <div className="flex items-center gap-1">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[200px] justify-start text-left font-normal bg-card",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateLabel()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex border-b border-border">
                <button
                  className={cn(
                    "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                    dateMode === "month"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => setDateMode("month")}
                >
                  Mês/Ano
                </button>
                <button
                  className={cn(
                    "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                    dateMode === "day"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => setDateMode("day")}
                >
                  Dia específico
                </button>
              </div>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
                initialFocus
              />
              {dateMode === "month" && (
                <p className="px-3 pb-2 text-[11px] text-muted-foreground">
                  Selecione qualquer dia para filtrar pelo mês inteiro.
                </p>
              )}
            </PopoverContent>
          </Popover>
          {selectedDate && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={clearDate} aria-label="Limpar filtro de data">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Filters;
