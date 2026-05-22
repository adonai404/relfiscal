import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Upload, FileText, Download, Trash2, CheckCircle2, AlertCircle, Search, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ExtractedData, processInBatches, normalizeCNPJ } from "@/lib/pdfParser";
import * as XLSX from 'xlsx';

interface UserListItem {
  name: string;
  cnpj: string;
  normalizedCnpj: string;
}

export default function Tools() {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ExtractedData[]>([]);
  const [userListInput, setUserListInput] = useState("");
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(f => f.type === "application/pdf");
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const clearData = () => {
    setFiles([]);
    setResults([]);
    setProgress(0);
    setIsProcessing(false);
  };

  const processFiles = async () => {
    if (files.length === 0) {
      toast({
        title: "Nenhum arquivo",
        description: "Selecione pelo menos um arquivo PDF.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    
    try {
      const extracted = await processInBatches(files, 5, (processed) => {
        setProgress((processed / files.length) * 100);
      });
      setResults(extracted);
      toast({
        title: "Processamento concluído",
        description: `${extracted.length} arquivos processados com sucesso.`,
      });
    } catch (error) {
      toast({
        title: "Erro no processamento",
        description: "Ocorreu um erro ao processar os arquivos.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const userList = useMemo((): UserListItem[] => {
    if (!userListInput.trim()) return [];
    return userListInput.split('\n').filter(line => line.trim()).map(line => {
      const parts = line.split(/\t|\s{2,}/);
      const cnpj = parts.find(p => /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/.test(p)) || "";
      const name = parts.find(p => p !== cnpj && p.trim().length > 0) || "Sem nome";
      return {
        name: name.trim(),
        cnpj: cnpj.trim(),
        normalizedCnpj: normalizeCNPJ(cnpj)
      };
    });
  }, [userListInput]);

  const stats = useMemo(() => {
    const processedCnpjs = new Set(results.map(r => normalizeCNPJ(r.cnpj)));
    const found = userList.filter(item => processedCnpjs.has(item.normalizedCnpj));
    const missing = userList.filter(item => !processedCnpjs.has(item.normalizedCnpj));
    return { found, missing };
  }, [results, userList]);

  const exportToExcel = () => {
    const dataToExport = results.map(r => ({
      'Arquivo': r.fileName,
      'Empresa': r.companyName,
      'CNPJ': r.cnpj,
      'Competência': r.period,
      'Receita Bruta': r.revenue,
      'Status': r.status === 'no_movement' ? 'Sem Movimento' : r.status === 'error' ? 'Erro' : 'Sucesso'
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultados");
    XLSX.writeFile(wb, `extracao_fiscal_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (!activeTool) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ferramentas</h1>
            <p className="text-muted-foreground">
              Acesse ferramentas úteis para auxiliar no seu dia a dia fiscal.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card 
              className="hover:bg-accent/50 transition-colors cursor-pointer border-primary/20"
              onClick={() => setActiveTool('pdf-extractor')}
            >
              <CardHeader>
                <FileDown className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Extrator Fiscal PDF</CardTitle>
                <CardDescription>
                  Extraia automaticamente dados de declarações fiscais de múltiplos arquivos PDF.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Suporta processamento em lote, conferência de listas e exportação para Excel.
                </p>
              </CardContent>
            </Card>

            <a 
              href="https://consulta-notas.lovable.app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-primary/20 h-full">
                <CardHeader>
                  <Search className="h-8 w-8 mb-2 text-primary" />
                  <CardTitle>Consulta de Notas Fiscais</CardTitle>
                  <CardDescription>
                    Pesquise e baixe XMLs de notas fiscais através da chave de acesso.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Ferramenta externa para consulta rápida de documentos fiscais eletrônicos.
                  </p>
                </CardContent>
              </Card>
            </a>

            <Card className="opacity-60 border-dashed">
              <CardHeader>
                <Wrench className="h-8 w-8 mb-2 text-muted-foreground" />
                <CardTitle>Em Breve</CardTitle>
                <CardDescription>
                  Novas ferramentas serão adicionadas aqui futuramente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">
                  Estamos trabalhando para trazer as melhores soluções.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setActiveTool(null)}>
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Extrator Fiscal PDF</h1>
              <p className="text-muted-foreground">
                Extraia automaticamente dados de declarações fiscais em lote.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {results.length > 0 && (
              <>
                <Button variant="outline" onClick={exportToExcel}>
                  <Download className="mr-2 h-4 w-4" />
                  Excel
                </Button>
                <Button variant="destructive" onClick={clearData}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpar
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload de Arquivos
              </CardTitle>
              <CardDescription>
                Selecione ou arraste os PDFs das declarações fiscais.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <FileText className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium">Clique para selecionar ou arraste os arquivos</p>
                <p className="text-xs text-muted-foreground mt-1">Apenas arquivos PDF são aceitos</p>
                {files.length > 0 && (
                  <Badge variant="secondary" className="mt-4">
                    {files.length} arquivos selecionados
                  </Badge>
                )}
              </div>
              
              {isProcessing && (
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Processando arquivos...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              <Button 
                className="w-full mt-6" 
                disabled={files.length === 0 || isProcessing}
                onClick={processFiles}
              >
                {isProcessing ? "Processando..." : "Iniciar Extração"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Conferência de Lista
              </CardTitle>
              <CardDescription>
                Cole aqui a lista de empresas (Nome e CNPJ) para conferência.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Ex: EMPRESA LTDA	00.000.000/0001-00"
                className="min-h-[160px] font-mono text-xs"
                value={userListInput}
                onChange={(e) => setUserListInput(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground mt-2">
                Dica: Você pode copiar colunas do Excel e colar aqui. O sistema identificará o CNPJ automaticamente.
              </p>
            </CardContent>
          </Card>
        </div>

        {results.length > 0 && (
          <Card>
            <CardHeader>
              <Tabs defaultValue="found" className="w-full">
                <div className="flex items-center justify-between mb-4">
                  <TabsList>
                    <TabsTrigger value="found" className="gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Encontrados
                      <Badge variant="secondary" className="ml-1">{stats.found.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="missing" className="gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Ausentes
                      <Badge variant="destructive" className="ml-1">{stats.missing.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="all">
                      Todos
                      <Badge variant="outline" className="ml-1">{results.length}</Badge>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="found">
                  <div className="rounded-md border max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead>CNPJ</TableHead>
                          <TableHead>Período</TableHead>
                          <TableHead>Receita</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.filter(r => userList.some(u => u.normalizedCnpj === normalizeCNPJ(r.cnpj))).map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{r.companyName}</TableCell>
                            <TableCell>{r.cnpj}</TableCell>
                            <TableCell>{r.period}</TableCell>
                            <TableCell>{r.revenue === 'Declarado sem movimento' ? r.revenue : `R$ ${r.revenue}`}</TableCell>
                            <TableCell>
                              {r.status === 'no_movement' ? (
                                <Badge variant="outline" className="text-orange-500 border-orange-500">Sem Movimento</Badge>
                              ) : (
                                <Badge variant="outline" className="text-green-500 border-green-500">Ok</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="missing">
                  <div className="rounded-md border max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead>Empresa (da lista)</TableHead>
                          <TableHead>CNPJ (da lista)</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.missing.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.cnpj}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">PDF não encontrado</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {stats.missing.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                              Todas as empresas da lista foram encontradas!
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="all">
                  <div className="rounded-md border max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead>Arquivo</TableHead>
                          <TableHead>Empresa</TableHead>
                          <TableHead>CNPJ</TableHead>
                          <TableHead>Período</TableHead>
                          <TableHead>Receita</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs text-muted-foreground">{r.fileName}</TableCell>
                            <TableCell className="font-medium">{r.companyName}</TableCell>
                            <TableCell>{r.cnpj}</TableCell>
                            <TableCell>{r.period}</TableCell>
                            <TableCell>
                              {r.status === 'error' ? (
                                <span className="text-destructive text-xs">{r.errorMessage}</span>
                              ) : (
                                r.revenue === 'Declarado sem movimento' ? r.revenue : `R$ ${r.revenue}`
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
