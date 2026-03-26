import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { CalendarIcon, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

export interface CreditFilterValues {
  usuario: string;
  decisao: string;
  busca: string;
  periodoInicio?: string;
  periodoFim?: string;
}

interface Props {
  usuarios: string[];
  filters: CreditFilterValues;
  onChange: (filters: CreditFilterValues) => void;
  disabled?: boolean;
}

const CreditFilters = ({ usuarios, filters, onChange, disabled = false }: Props) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      onChange({
        ...filters,
        periodoInicio: format(range.from, "dd/MM/yyyy"),
        periodoFim: format(range.to, "dd/MM/yyyy"),
      });
      setCalendarOpen(false);
    } else if (range?.from) {
      onChange({
        ...filters,
        periodoInicio: format(range.from, "dd/MM/yyyy"),
        periodoFim: undefined,
      });
    }
  };

  const clearDate = () => {
    setDateRange(undefined);
    onChange({ ...filters, periodoInicio: undefined, periodoFim: undefined });
  };

  const dateLabel = () => {
    if (dateRange?.from) {
      if (dateRange.to) {
        return `${format(dateRange.from, "dd/MM/yy")} — ${format(dateRange.to, "dd/MM/yy")}`;
      }
      return `${format(dateRange.from, "dd/MM/yy")} — ...`;
    }
    return "Selecione um período";
  };

  const hasDateFilter = dateRange?.from;

  return (
    <div className="flex flex-wrap gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-primary/80">Buscar (nome ou CPF/CNPJ)</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nome ou CPF/CNPJ..."
            value={filters.busca}
            onChange={(e) => onChange({ ...filters, busca: e.target.value })}
            className="pl-9 w-[220px] bg-card"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-primary/80">Usuário</Label>
        <Select value={filters.usuario} onValueChange={(v) => onChange({ ...filters, usuario: v })}>
          <SelectTrigger className="w-[180px] bg-card">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {usuarios.map((u) => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-primary/80">Faixa final</Label>
        <Select value={filters.decisao} onValueChange={(v) => onChange({ ...filters, decisao: v })}>
          <SelectTrigger className="w-[180px] bg-card">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="ISENTAR">Isenção</SelectItem>
            <SelectItem value="TAXA_R$100">R$ 100</SelectItem>
            <SelectItem value="TAXA_R$200">R$ 200</SelectItem>
            <SelectItem value="TAXA_R$300">R$ 300</SelectItem>
            <SelectItem value="TAXA_R$1000">R$ 1.000</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-primary/80">Data da consulta</Label>
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
            </PopoverContent>
          </Popover>
          {hasDateFilter && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={clearDate}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditFilters;
