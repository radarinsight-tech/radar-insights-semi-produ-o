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
import type { DateRange } from "react-day-picker";

export interface FilterValues {
  atendente: string;
  periodo: string;
  tipo: string;
  periodoInicio?: string;
  periodoFim?: string;
}

interface FiltersProps {
  atendentes: string[];
  tipos: string[];
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
}

const Filters = ({ atendentes, tipos, filters, onChange }: FiltersProps) => {
  const [dateMode, setDateMode] = useState<"month" | "range">("month");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleMonthSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    onChange({ ...filters, periodo: yearMonth, periodoInicio: undefined, periodoFim: undefined });
    setCalendarOpen(false);
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      onChange({
        ...filters,
        periodo: "",
        periodoInicio: format(range.from, "dd/MM/yyyy"),
        periodoFim: format(range.to, "dd/MM/yyyy"),
      });
      setCalendarOpen(false);
    } else if (range?.from) {
      // Only start selected, keep popover open
      onChange({
        ...filters,
        periodo: "",
        periodoInicio: format(range.from, "dd/MM/yyyy"),
        periodoFim: undefined,
      });
    }
  };

  const clearDate = () => {
    setSelectedDate(undefined);
    setDateRange(undefined);
    onChange({ ...filters, periodo: "", periodoInicio: undefined, periodoFim: undefined });
  };

  const dateLabel = () => {
    if (dateMode === "month" && selectedDate) {
      return format(selectedDate, "MMMM/yyyy", { locale: ptBR });
    }
    if (dateMode === "range" && dateRange?.from) {
      if (dateRange.to) {
        return `${format(dateRange.from, "dd/MM/yy")} — ${format(dateRange.to, "dd/MM/yy")}`;
      }
      return `${format(dateRange.from, "dd/MM/yy")} — ...`;
    }
    return "Selecione uma data";
  };

  const hasDateFilter = selectedDate || dateRange?.from;

  return (
    <div className="flex flex-wrap gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-primary/80">Atendentes</Label>
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
        <Label className="text-xs font-semibold text-primary/80">Tipos de atendimento</Label>
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
        <Label className="text-xs font-semibold text-primary/80">Data do atendimento</Label>
        <div className="flex items-center gap-1">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[220px] justify-start text-left font-normal bg-card",
                  !hasDateFilter && "text-muted-foreground"
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
                    dateMode === "range"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => setDateMode("range")}
                >
                  Período
                </button>
              </div>
              {dateMode === "month" ? (
                <>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleMonthSelect}
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                    initialFocus
                  />
                  <p className="px-3 pb-2 text-[11px] text-muted-foreground">
                    Selecione qualquer dia para filtrar pelo mês inteiro.
                  </p>
                </>
              ) : (
                <>
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={handleRangeSelect}
                    locale={ptBR}
                    numberOfMonths={2}
                    className={cn("p-3 pointer-events-auto")}
                    initialFocus
                  />
                  <p className="px-3 pb-2 text-[11px] text-muted-foreground">
                    Selecione a data inicial e a data final do período.
                  </p>
                </>
              )}
            </PopoverContent>
          </Popover>
          {hasDateFilter && (
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
