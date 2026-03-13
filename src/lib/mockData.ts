export interface HistoryEntry {
  data: string;
  protocolo: string;
  atendente: string;
  nota: number;
  classificacao: string;
  bonus: boolean;
  tipo: string;
  pdf_url?: string;
}

const atendentes = ["Ana Silva", "Carlos Lima", "Maria Souza", "João Santos", "Bruna Costa"];
const tipos = ["Suporte Técnico", "Financeiro", "Cancelamento", "Informação", "Reclamação"];

function classify(nota: number) {
  if (nota >= 9) return "Excelente";
  if (nota >= 8) return "Ótimo";
  if (nota >= 7) return "Bom";
  return "Regular";
}

function randomDate(monthsBack: number) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * 30 * monthsBack));
  return d.toLocaleDateString("pt-BR");
}

export function generateMockHistory(count = 20): HistoryEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const nota = +(6.5 + Math.random() * 3.5).toFixed(1);
    return {
      data: randomDate(3),
      protocolo: `ATD-${(1000 + i).toString()}`,
      atendente: atendentes[Math.floor(Math.random() * atendentes.length)],
      nota,
      classificacao: classify(nota),
      bonus: nota >= 9,
      tipo: tipos[Math.floor(Math.random() * tipos.length)],
    };
  });
}

export const mockAtendentes = atendentes;
export const mockTipos = tipos;
