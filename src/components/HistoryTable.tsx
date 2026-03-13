import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { HistoryEntry } from "@/lib/mockData";

interface Props {
  entries: HistoryEntry[];
}

const classColor = (c: string) => {
  if (c === "Excelente" || c === "Ótimo") return "bg-accent text-accent-foreground";
  if (c === "Bom") return "bg-primary text-primary-foreground";
  return "bg-warning text-warning-foreground";
};

const HistoryTable = ({ entries }: Props) => (
  <Card className="p-6">
    <h2 className="text-lg font-semibold mb-4">Histórico de Avaliações</h2>
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Protocolo</TableHead>
            <TableHead>Atendente</TableHead>
            <TableHead className="text-right">Nota</TableHead>
            <TableHead>Classificação</TableHead>
            <TableHead>Bônus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhum registro encontrado
              </TableCell>
            </TableRow>
          ) : (
            entries.map((e) => (
              <TableRow key={e.protocolo}>
                <TableCell className="text-sm">{e.data}</TableCell>
                <TableCell className="text-sm font-medium">{e.protocolo}</TableCell>
                <TableCell className="text-sm">{e.atendente}</TableCell>
                <TableCell className="text-sm text-right font-semibold">{e.nota.toFixed(1)}</TableCell>
                <TableCell>
                  <Badge className={classColor(e.classificacao)}>{e.classificacao}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={e.bonus ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}>
                    {e.bonus ? "Sim" : "Não"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  </Card>
);

export default HistoryTable;
