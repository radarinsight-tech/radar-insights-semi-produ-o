import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR, classificarNota, classColorFromClassificacao } from "@/lib/utils";

interface AttendanceRecord {
  id: string;
  protocolo: string;
  cliente: string;
  atendente: string;
  data_atendimento: string;
  status_atendimento: string;
  nota_final: number;
  status_auditoria: string;
  created_at: string;
  updated_at: string;
}

interface SearchFilters {
  protocolo?: string;
  cliente?: string;
  atendente?: string;
  status_atendimento?: string;
  status_auditoria?: string;
}

interface OpaSearchPanelProps {
  onSelectAttendance?: (record: AttendanceRecord) => void;
  initialFilters?: SearchFilters;
}

const OpaSearchPanel = ({ 
  onSelectAttendance, 
  initialFilters = {} 
}: OpaSearchPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Fetch attendance records via edge function
  const fetchAttendances = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current session to ensure we have a valid token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        setError("Session expired. Please log in again.");
        toast.error("Session expired. Please log in again.");
        setLoading(false);
        return;
      }

      // Call edge function with user's Bearer token
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error("Supabase URL not configured");
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/fetch-opa-attendance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          filters: Object.fromEntries(
            Object.entries(filters).filter(([, v]) => v !== undefined && v !== "")
          ),
          limit,
          offset,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 403) {
          const errorMsg = errorData.message || "Invalid permissions profile";
          setError(errorMsg);
          toast.error(`Permission Error: ${errorMsg}`);
        } else if (response.status === 401) {
          setError("Unauthorized. Please log in again.");
          toast.error("Unauthorized. Please log in again.");
        } else {
          setError(errorData.message || `Error: HTTP ${response.status}`);
          toast.error(errorData.message || `Error: HTTP ${response.status}`);
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      setRecords(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
      toast.error(message);
      console.error("OpaSearchPanel fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when component mounts or filters change
  useEffect(() => {
    setOffset(0);
    fetchAttendances();
  }, [filters]);

  const handleProtocoloChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, protocolo: e.target.value }));
  };

  const handleClienteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, cliente: e.target.value }));
  };

  const handleAttendenteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, atendente: e.target.value }));
  };

  const handleClearFilters = () => {
    setFilters({});
    setOffset(0);
  };

  const handleRecordSelect = (record: AttendanceRecord) => {
    if (onSelectAttendance) {
      onSelectAttendance(record);
    }
  };

  const handlePreviousPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case "auditado":
        return "bg-green-100 text-green-900";
      case "em_analise":
        return "bg-yellow-100 text-yellow-900";
      case "fora_de_avaliacao":
        return "bg-gray-100 text-gray-900";
      default:
        return "bg-blue-100 text-blue-900";
    }
  };

  const getAuditoriaStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case "auditoria_realizada":
        return "bg-green-100 text-green-900";
      case "auditoria_bloqueada":
        return "bg-red-100 text-red-900";
      case "impedimento_detectado":
        return "bg-orange-100 text-orange-900";
      default:
        return "bg-gray-100 text-gray-900";
    }
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg border">
      {/* Search Filters */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg text-gray-900">
          <Search className="w-5 h-5 mr-2 inline" />
          Buscar Atendimentos
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Protocolo
            </label>
            <Input
              placeholder="ex: PT001"
              value={filters.protocolo || ""}
              onChange={handleProtocoloChange}
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cliente
            </label>
            <Input
              placeholder="Nome do cliente"
              value={filters.cliente || ""}
              onChange={handleClienteChange}
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Atendente
            </label>
            <Input
              placeholder="Nome do atendente"
              value={filters.atendente || ""}
              onChange={handleAttendenteChange}
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleClearFilters}
            variant="outline"
            disabled={loading}
            className="flex-1"
          >
            Limpar Filtros
          </Button>
          <Button
            onClick={fetchAttendances}
            disabled={loading}
            className="flex-1"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Buscar
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-900">Erro de Permissão</h4>
            <p className="text-sm text-red-700">{error}</p>
            <p className="text-xs text-red-600 mt-1">
              Verifique se as políticas de RLS foram aplicadas corretamente no Supabase e que você tem permissão para acessar esses dados.
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && records.length === 0 && (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="ml-2 text-gray-600">Carregando atendimentos...</p>
        </div>
      )}

      {/* Results */}
      {!loading && records.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Exibindo {offset + 1} a {Math.min(offset + limit, total)} de {total} resultados
          </p>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {records.map((record) => (
              <Card
                key={record.id}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary"
                onClick={() => handleRecordSelect(record)}
              >
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-start">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Protocolo</p>
                    <p className="font-semibold text-gray-900">{record.protocolo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Cliente</p>
                    <p className="text-sm text-gray-700">{record.cliente || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Atendente</p>
                    <p className="text-sm text-gray-700">{record.atendente || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Data</p>
                    <p className="text-sm text-gray-700">
                      {record.data_atendimento ? formatDateBR(record.data_atendimento) : "—"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge className={`text-xs w-fit ${getStatusColor(record.status_atendimento)}`}>
                      {record.status_atendimento || "desconhecido"}
                    </Badge>
                    <Badge className={`text-xs w-fit ${getAuditoriaStatusColor(record.status_auditoria)}`}>
                      {record.status_auditoria || "desconhecido"}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase">Nota</p>
                    <p className={`font-bold text-lg ${classColorFromClassificacao(classificarNota(record.nota_final))}`}>
                      {record.nota_final?.toFixed(1) || "—"}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              onClick={handlePreviousPage}
              disabled={loading || offset === 0}
              variant="outline"
            >
              ← Anterior
            </Button>
            <span className="text-sm text-gray-600">
              Página {Math.floor(offset / limit) + 1} de {Math.ceil(total / limit)}
            </span>
            <Button
              onClick={handleNextPage}
              disabled={loading || offset + limit >= total}
              variant="outline"
            >
              Próxima →
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && records.length === 0 && !error && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Nenhum atendimento encontrado.</p>
          <p className="text-sm text-gray-400">Ajuste os filtros e tente novamente.</p>
        </div>
      )}
    </div>
  );
};

export default OpaSearchPanel;
