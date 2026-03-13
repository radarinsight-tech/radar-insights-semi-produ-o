import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface FiltersProps {
  atendentes: string[];
  tipos: string[];
  filters: { atendente: string; periodo: string; tipo: string };
  onChange: (filters: { atendente: string; periodo: string; tipo: string }) => void;
}

const Filters = ({ atendentes, tipos, filters, onChange }: FiltersProps) => (
  <div className="flex flex-wrap gap-3">
    <Select value={filters.atendente} onValueChange={(v) => onChange({ ...filters, atendente: v })}>
      <SelectTrigger className="w-[180px] bg-card">
        <SelectValue placeholder="Atendente" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos</SelectItem>
        {atendentes.map((a) => (
          <SelectItem key={a} value={a}>{a}</SelectItem>
        ))}
      </SelectContent>
    </Select>

    <Select value={filters.tipo} onValueChange={(v) => onChange({ ...filters, tipo: v })}>
      <SelectTrigger className="w-[180px] bg-card">
        <SelectValue placeholder="Tipo" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos</SelectItem>
        {tipos.map((t) => (
          <SelectItem key={t} value={t}>{t}</SelectItem>
        ))}
      </SelectContent>
    </Select>

    <Input
      type="month"
      value={filters.periodo}
      onChange={(e) => onChange({ ...filters, periodo: e.target.value })}
      className="w-[180px] bg-card"
      placeholder="Período"
    />
  </div>
);

export default Filters;
