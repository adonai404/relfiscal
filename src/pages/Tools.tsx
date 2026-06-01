import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Search, CalendarDays, TableProperties, Database } from "lucide-react";

export default function Tools() {
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
            
            <a 
              href="https://fiscal-planner.lovable.app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-primary/20 h-full">
                <CardHeader>
                  <CalendarDays className="h-8 w-8 mb-2 text-primary" />
                  <CardTitle>Fiscal Planner</CardTitle>
                  <CardDescription>
                    Planejamento e organização de rotinas fiscais e obrigações.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Ferramenta externa para gestão de prazos e tarefas do departamento fiscal.
                  </p>
                </CardContent>
              </Card>
            </a>

            <a 
              href="https://gerador-planilha.lovable.app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-primary/20 h-full">
                <CardHeader>
                  <TableProperties className="h-8 w-8 mb-2 text-primary" />
                  <CardTitle>Gerador de Planilhas</CardTitle>
                  <CardDescription>
                    Criação e exportação de planilhas personalizadas para controle fiscal.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Ferramenta externa para geração rápida de arquivos de dados estruturados.
                  </p>
                </CardContent>
              </Card>
            </a>

            <a 
              href="https://declaration-data.lovable.app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-primary/20 h-full">
                <CardHeader>
                  <Database className="h-8 w-8 mb-2 text-primary" />
                  <CardTitle>Declaration Data</CardTitle>
                  <CardDescription>
                    Gerenciamento e organização de dados de declarações fiscais.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Ferramenta externa para processamento e armazenamento estruturado de declarações.
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
