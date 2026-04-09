import { useState, useRef, useEffect } from "react";
import { Upload, X, Loader2, FileUp, AlertCircle, CheckCircle, Shield } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MKRow {
  'Protocolo': string;
  'Abertura': string;
  'Op. Abertura': string;
  'Cidade': string;
  'Processo': string;
  [key: string]: string;
}

interface Attendant {
  id: string;
  name: string;
  nickname: string | null;
  participates_evaluation: boolean;
}

interface MKSolutionsModuleProps {
  onDataLoaded?: (data: MKRow[]) => void;
}

export default function MKSolutionsModule({ onDataLoaded }: MKSolutionsModuleProps) {
  const [data, setData] = useState<MKRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [importedRows, setImportedRows] = useState(0);
  const [displayRows, setDisplayRows] = useState(10);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [loadingAttendants, setLoadingAttendants] = useState(true);
  const [discardedRecords, setDiscardedRecords] = useState<Array<{ line: number; operator: string; reason: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const requiredColumns = ['Protocolo', 'Abertura', 'Op. Abertura', 'Cidade', 'Processo'];

  // Load attendants on component mount
  useEffect(() => {
    const fetchAttendants = async () => {
      try {
        console.log("MKSolutionsModule: Starting attendants fetch...");
        const { data, error } = await supabase
          .from("attendants")
          .select("id, name, nickname, participates_evaluation")
          .eq("participates_evaluation", true)
          .eq("active", true);

        if (error) {
          console.error("MKSolutionsModule: Database error loading attendants:", error);
          toast.error(`Erro ao carregar atendentes: ${error.message}`);
          setLoadingAttendants(false);
          return;
        }

        console.log("MKSolutionsModule: Attendants loaded successfully", {
          count: data?.length || 0,
          names: data?.slice(0, 5).map(a => ({ name: a.name, nickname: a.nickname })),
        });
        setAttendants(data || []);
      } catch (error) {
        console.error("MKSolutionsModule: Error fetching attendants:", error);
        toast.error("Erro na requisição de atendentes");
      } finally {
        setLoadingAttendants(false);
      }
    };

    fetchAttendants();
  }, []);

  // Validate if operator is in the attendants list
  const isOperatorValid = (operatorName: string): boolean => {
    if (!operatorName || operatorName.trim() === "") {
      console.warn("MKSolutionsModule: Empty operator name");
      return false;
    }
    
    // Normalize: lowercase, trim, collapse multiple spaces
    const normalizedInput = operatorName
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .join(' ');
    
    if (attendants.length === 0) {
      console.warn("MKSolutionsModule: Attendants list is empty!", {
        loadingAttendants,
        operatorName,
        normalizedInput,
      });
      return false;
    }
    
    const isValid = attendants.some(att => {
      // Normalize attendant name
      const normalizedName = att.name
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .join(' ');
      
      // Normalize nickname if present
      const normalizedNickname = att.nickname
        ? att.nickname
            .toLowerCase()
            .trim()
            .split(/\s+/)
            .join(' ')
        : null;
      
      const matchByName = normalizedName === normalizedInput;
      const matchByNickname = normalizedNickname === normalizedInput;
      
      if (matchByName || matchByNickname) {
        console.log("MKSolutionsModule: Match found", {
          input: operatorName,
          normalized: normalizedInput,
          matchedName: att.name,
          matchedNickname: att.nickname,
          matchType: matchByName ? "name" : "nickname",
        });
      }
      
      return matchByName || matchByNickname;
    });
    
    if (!isValid) {
      console.warn("MKSolutionsModule: Operator not found", {
        input: operatorName,
        normalized: normalizedInput,
        attendantsCount: attendants.length,
        attendantNames: attendants.slice(0, 3).map(a => a.name),
      });
    }
    
    return isValid;
  };

  // Process and filter imported data
  const filterAndValidateData = (importedData: MKRow[]): { filtered: MKRow[]; discarded: Array<{ line: number; operator: string; reason: string }> } => {
    const filtered: MKRow[] = [];
    const discarded: Array<{ line: number; operator: string; reason: string }> = [];

    importedData.forEach((row, index) => {
      const operator = row['Op. Abertura']?.trim() || "";
      
      if (!isOperatorValid(operator)) {
        discarded.push({
          line: index + 2, // +2 because index starts at 0 and headers are line 1
          operator: operator || "(vazio)",
          reason: "Operador não encontrado na lista de avaliáveis"
        });
        return;
      }

      filtered.push(row);
    });

    return { filtered, discarded };
  };

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Check if attendants are loaded
    if (loadingAttendants) {
      toast.error("Aguarde o carregamento da lista de atendentes...");
      return;
    }

    if (attendants.length === 0) {
      console.warn("MKSolutionsModule: No attendants with participates_evaluation=true", {
        loadingAttendants,
        attendantsLength: attendants.length,
      });
      toast.error("Nenhum atendente com status 'Avaliação: SIM' encontrado. Verifique a configuração no banco de dados.");
      return;
    }

    console.log("MKSolutionsModule: Starting file upload with attendants list", {
      attendantsCount: attendants.length,
      attendantNames: attendants.slice(0, 5).map(a => a.name),
    });

    // Validate file type
    const isCSV = file.name.toLowerCase().endsWith('.csv');
    const isXLSX = file.name.toLowerCase().endsWith('.xlsx');
    
    if (!isCSV && !isXLSX) {
      toast.error("Formato não suportado. Envie um arquivo .csv ou .xlsx");
      return;
    }

    setLoading(true);
    setFileName(file.name);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      let workbook;
      if (isCSV) {
        // For CSV, use XLSX to parse it
        const text = new TextDecoder().decode(arrayBuffer);
        workbook = XLSX.read(text, { type: 'string' });
      } else {
        // For XLSX
        workbook = XLSX.read(arrayBuffer, { type: 'array' });
      }

      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!worksheet) {
        toast.error("Nenhuma planilha encontrada no arquivo");
        setLoading(false);
        return;
      }

      // Convert sheet to JSON with headers
      const jsonData = XLSX.utils.sheet_to_json<MKRow>(worksheet);

      if (jsonData.length === 0) {
        toast.error("O arquivo está vazio. Verifique o conteúdo");
        setLoading(false);
        return;
      }

      // Validate required columns
      if (jsonData.length > 0) {
        const firstRow = jsonData[0];
        const missingColumns = requiredColumns.filter(col => !(col in firstRow));
        
        if (missingColumns.length > 0) {
          toast.error(`Colunas obrigatórias faltando: ${missingColumns.join(', ')}`);
          setLoading(false);
          return;
        }
      }

      // Apply security filter: validate Op. Abertura against attendants list
      console.log("MKSolutionsModule: Applying security filter", {
        attendantsCount: attendants.length,
        rowsToProcess: jsonData.length,
        firstAtendentes: attendants.slice(0, 3).map(a => ({ name: a.name, nickname: a.nickname })),
        sampleOps: jsonData.slice(0, 3).map(r => r['Op. Abertura']),
      });
      const { filtered, discarded } = filterAndValidateData(jsonData);

      // Support large files: only keep first 4792 rows in memory for display
      const maxDisplayRows = 4792;
      const trimmedData = filtered.slice(0, maxDisplayRows);
      
      setData(trimmedData);
      setTotalRows(jsonData.length);
      setImportedRows(filtered.length);
      setDiscardedRecords(discarded);
      setDisplayRows(Math.min(10, trimmedData.length));

      // Show summary
      const summary = `✅ Total lido: ${jsonData.length.toLocaleString()} | Importado (CS): ${filtered.length.toLocaleString()}`;
      if (discarded.length > 0) {
        toast.success(
          summary + ` | Descartado: ${discarded.length.toLocaleString()}`,
          { duration: 5000 }
        );
      } else {
        toast.success(summary);
      }

      if (onDataLoaded) {
        onDataLoaded(trimmedData);
      }
    } catch (error: any) {
      console.error("Erro ao processar arquivo:", error);
      toast.error(`Erro ao processar arquivo: ${error?.message || 'Desconhecido'}`);
      setData([]);
      setTotalRows(0);
      setImportedRows(0);
      setDiscardedRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current) {
      dragRef.current.classList.add('border-primary', 'bg-primary/5');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current) {
      dragRef.current.classList.remove('border-primary', 'bg-primary/5');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current) {
      dragRef.current.classList.remove('border-primary', 'bg-primary/5');
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleClear = () => {
    setData([]);
    setFileName("");
    setTotalRows(0);
    setImportedRows(0);
    setDisplayRows(10);
    setDiscardedRecords([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayedData = data.slice(0, displayRows);
  const hasMoreData = displayRows < data.length;

  return (
    <div className="space-y-4">
      {/* Loading Attendants Status */}
      {loadingAttendants && (
        <Card className="p-4 bg-blue-50/50 border border-blue-200">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
            <p className="text-sm text-blue-900">Carregando lista de atendentes com "Avaliação: SIM"...</p>
          </div>
        </Card>
      )}

      {/* Attendants Status Summary */}
      {!loadingAttendants && attendants.length > 0 && (
        <Card className="p-3 bg-green-50/50 border border-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <p className="text-xs text-green-900">
              <span className="font-semibold">{attendants.length}</span> atendentes com status "Avaliação: SIM" prontos para validação
            </p>
          </div>
        </Card>
      )}
      {/* Upload Section */}
      <Card
        ref={dragRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer transition-all ${
          loading || loadingAttendants ? 'opacity-50' : 'hover:border-primary/50 hover:bg-primary/2'
        }`}
        onClick={() => !loading && !loadingAttendants && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
          className="hidden"
          disabled={loading || loadingAttendants}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="font-medium">Processando arquivo...</p>
          </div>
        ) : loadingAttendants ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="font-medium">Carregando atendentes...</p>
          </div>
        ) : attendants.length === 0 ? (
          <div className="flex flex-col items-center gap-2">
            <AlertCircle className="h-12 w-12 text-destructive/60" />
            <p className="font-semibold text-foreground mb-1">
              Nenhum atendente disponível
            </p>
            <p className="text-sm text-muted-foreground">
              Não foram encontrados atendentes com status "Avaliação: SIM"
            </p>
          </div>
        ) : (
          <>
            <FileUp className="h-12 w-12 text-muted-foreground/60 mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-1">
              Arraste um arquivo aqui ou clique para selecionar
            </p>
            <p className="text-sm text-muted-foreground">
              Formatos suportados: CSV ou XLSX (máximo 4.792 linhas)
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Badge variant="secondary">Protocolo</Badge>
              <Badge variant="secondary">Abertura</Badge>
              <Badge variant="secondary">Op. Abertura</Badge>
              <Badge variant="secondary">Cidade</Badge>
              <Badge variant="secondary">Processo</Badge>
            </div>
          </>
        )}
      </Card>

      {/* File Info & Summary */}
      {fileName && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-accent/10 rounded-lg border border-accent/30">
            <div className="flex items-center gap-3">
              <FileUp className="h-5 w-5 text-accent" />
              <div>
                <p className="font-medium text-sm">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  Total de linhas lidas: {totalRows.toLocaleString()} | Linhas importadas (CS): {importedRows.toLocaleString()}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Security Filter Summary */}
          {discardedRecords.length > 0 && (
            <div className="p-4 bg-yellow-50/50 border border-yellow-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-yellow-600" />
                <p className="font-medium text-sm text-yellow-900">
                  Trava de Segurança: {discardedRecords.length.toLocaleString()} registros descartados
                </p>
              </div>
              <p className="text-xs text-yellow-800">
                Operadores não encontrados na lista de atendentes com "Avaliação: SIM"
              </p>
              
              {/* Collapsible Discarded Records */}
              <details className="pt-2">
                <summary className="cursor-pointer text-xs text-yellow-700 font-medium hover:text-yellow-800">
                  Mostrar {Math.min(5, discardedRecords.length)} primeiros descartados...
                </summary>
                <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                  {discardedRecords.slice(0, 5).map((record, idx) => (
                    <div key={idx} className="text-xs text-yellow-800 p-2 bg-yellow-100/30 rounded">
                      <span className="font-medium">Linha {record.line}:</span> "{record.operator}" — {record.reason}
                    </div>
                  ))}
                  {discardedRecords.length > 5 && (
                    <p className="text-xs text-yellow-700 italic pt-1">
                      ... e mais {discardedRecords.length - 5} registros
                    </p>
                  )}
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Preview Table */}
      {data.length > 0 && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <h3 className="font-semibold text-sm">
                  📊 Dados Filtrados: {data.length.toLocaleString()} linhas importadas
                </h3>
              </div>
              <div className="text-xs text-muted-foreground">
                {data.length > 0 && (
                  <>
                    {displayRows < data.length && (
                      <span>Exibindo {displayRows} de {data.length}...</span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Table Container */}
            <div className="border border-border rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 border-b border-border">
                  <tr>
                    {requiredColumns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-2 text-left font-semibold text-foreground whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayedData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/50 transition-colors">
                      {requiredColumns.map((col) => (
                        <td
                          key={`${idx}-${col}`}
                          className="px-4 py-2 text-muted-foreground max-w-xs truncate"
                          title={row[col] || '-'}
                        >
                          {row[col] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More Button */}
            {hasMoreData && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newDisplay = Math.min(displayRows + 10, data.length);
                    setDisplayRows(newDisplay);
                    toast.info(`Exibindo ${newDisplay} linhas`);
                  }}
                >
                  Carregar mais linhas ({Math.min(10, data.length - displayRows)} próximas)
                </Button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
              >
                Limpar dados
              </Button>
              <Button
                size="sm"
                disabled={data.length === 0}
                onClick={() => {
                  toast.info("Função de salvar em desenvolvimento");
                  // TODO: Implement save to database with imported data
                }}
              >
                Salvar no banco de dados
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!fileName && (
        <Card className="p-8 text-center border-dashed">
          <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhum arquivo carregado. Comece arrrastando um arquivo ou clicando acima.
          </p>
        </Card>
      )}
    </div>
  );
}
