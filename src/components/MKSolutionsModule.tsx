import { useState, useRef } from "react";
import { Upload, X, Loader2, FileUp, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface MKRow {
  'Protocolo': string;
  'Abertura': string;
  'Op. Abertura': string;
  'Cidade': string;
  'Processo': string;
  [key: string]: string;
}

interface MKSolutionsModuleProps {
  onDataLoaded?: (data: MKRow[]) => void;
}

export default function MKSolutionsModule({ onDataLoaded }: MKSolutionsModuleProps) {
  const [data, setData] = useState<MKRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [displayRows, setDisplayRows] = useState(10);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const requiredColumns = ['Protocolo', 'Abertura', 'Op. Abertura', 'Cidade', 'Processo'];

  const handleFileSelect = async (file: File) => {
    if (!file) return;

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

      // Support large files: only keep first 4792 rows in memory for display
      const maxDisplayRows = 4792;
      const trimmedData = jsonData.slice(0, maxDisplayRows);
      
      setData(trimmedData);
      setTotalRows(jsonData.length);
      setDisplayRows(Math.min(10, trimmedData.length));

      toast.success(
        `✅ ${jsonData.length.toLocaleString()} linhas carregadas com sucesso! ${jsonData.length > maxDisplayRows ? `(Exibindo primeiras ${maxDisplayRows} linhas)` : ''}`
      );

      if (onDataLoaded) {
        onDataLoaded(trimmedData);
      }
    } catch (error: any) {
      console.error("Erro ao processar arquivo:", error);
      toast.error(`Erro ao processar arquivo: ${error?.message || 'Desconhecido'}`);
      setData([]);
      setTotalRows(0);
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
    setDisplayRows(10);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayedData = data.slice(0, displayRows);
  const hasMoreData = displayRows < data.length;

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <Card
        ref={dragRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer transition-all ${
          loading ? 'opacity-50' : 'hover:border-primary/50 hover:bg-primary/2'
        }`}
        onClick={() => !loading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
          className="hidden"
          disabled={loading}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="font-medium">Processando arquivo...</p>
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

      {/* File Info */}
      {fileName && (
        <div className="flex items-center justify-between p-4 bg-accent/10 rounded-lg border border-accent/30">
          <div className="flex items-center gap-3">
            <FileUp className="h-5 w-5 text-accent" />
            <div>
              <p className="font-medium text-sm">{fileName}</p>
              <p className="text-xs text-muted-foreground">
                {totalRows.toLocaleString()} linhas carregadas
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
      )}

      {/* Preview Table */}
      {data.length > 0 && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                📊 Visualização Temporária ({displayedData.length} de {totalRows.toLocaleString()} linhas)
              </h3>
              <div className="text-xs text-muted-foreground">
                {data.length > 0 && (
                  <>
                    {displayRows < data.length && (
                      <span>Exibindo {displayRows} de {data.length}...</span>
                    )}
                    {totalRows > data.length && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Arquivo tem {totalRows.toLocaleString()} linhas (mostrando {data.length})
                      </span>
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
                  // TODO: Implement save to database
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
