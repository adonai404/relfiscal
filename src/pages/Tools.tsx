import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Search, CalendarDays, TableProperties, FileDown } from "lucide-react";

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
                <FileDown className="h-8 w-8 mb-2 text-primary" />
                <CardTitle>Extrator de Declarações Fiscais</CardTitle>
                <CardDescription>
                  Extraia automaticamente dados de declarações fiscais em lote.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Ferramenta externa para processamento de PDFs, conferência de listas e exportação para Excel.
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