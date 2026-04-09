import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Checkbox } from "@/components/ui/checkbox";

export interface FilterValues {
  atendentes: string[];
  periodo: string;
  periodoInicio?: string;
  periodoFim?: string;
}

interface FiltersProps {
  atendentes: string[];
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
}

const Filters = ({ atendentes, filters, onChange }: FiltersProps) => {
  const [dateMode, setDateMode] = useState<"month" | "range">("month");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [atendentesOpen, setAtendentesOpen] = useState(false);

  const selectedAttendants = useMemo(
    () => (filters.atendentes.length > 0 ? filters.atendentes : atendentes),
    [filters.atendentes, atendentes]
  );
  const allSelected = selectedAttendants.length === atendentes.length && atendentes.length > 0;

  const handleToggleAttendant = (name: string) => {
    const next = filters.atendentes.includes(name)
      ? filters.atendentes.filter((item) => item !== name)
      : [...filters.atendentes, name];
    onChange({ ...filters, atendentes: next });
  };

  const handleSelectAll = () => {
    onChange({ ...filters, atendentes: atendentes.slice() });
  };

  const handleSelectNone = () => {
    onChange({ ...filters, atendentes: [] });
  };

  const handleMonthSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setDateRange(undefined);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    onChange({ ...filters, periodo: yearMonth, periodoInicio: undefined, periodoFim: undefined });
    setCalendarOpen(false);
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    setSelectedDate(undefined);
    if (range?.from && range?.to) {
      onChange({
        ...filters,
        periodo: "",
        periodoInicio: format(range.from, "dd/MM/yyyy"),
        periodoFim: format(range.to, "dd/MM/yyyy"),
      });
      setCalendarOpen(false);
    } else if (range?.from) {
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

  const hasDateFilter = !!selectedDate || !!dateRange?.from;

  return (
    <div className="flex flex-wrap gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-primary/80">Atendentes</Label>
        <Popover open={atendentesOpen} onOpenChange={setAtendentesOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[260px] justify-between bg-card">
              <span>{allSelected ? "Todos atendentes" : `${selectedAttendants.length} selecionado${selectedAttendants.length !== 1 ? "s" : ""}`}</span>
              <span className="text-xs text-muted-foreground">Abrir</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-3">
            <div className="flex items-center justify-between mb-3 gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleSelectAll}>
                Marcar todos
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleSelectNone}>
                Desmarcar
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {atendentes.map((name) => {
                const checked = selectedAttendants.includes(name);
                return (
                  <label key={name} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-muted">
                    <Checkbox checked={checked} onCheckedChange={() => handleToggleAttendant(name)} />
                    <span className="text-sm">{name}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-primary/80">Período</Label>
        <div className="flex items-center gap-1">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[260px] justify-start text-left font-normal bg-card",
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
