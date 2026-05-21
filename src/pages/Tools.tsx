import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench } from "lucide-react";

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
          <Card className="opacity-60 border-dashed">
            <CardHeader>
              <Wrench className="h-8 w-8 mb-2 text-muted-foreground" />
              <CardTitle>Novas Ferramentas</CardTitle>
              <CardDescription>
                Em breve, novas ferramentas serão adicionadas aqui.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic">
                Estamos trabalhando para trazer as melhores soluções para você.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
