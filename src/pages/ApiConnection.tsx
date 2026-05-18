 import { useState, useEffect } from "react";
 import { useNavigate } from "react-router-dom";
 import { useCompany } from "@/hooks/useCompany";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { useToast } from "@/hooks/use-toast";
 import { supabase } from "@/integrations/supabase/client";
 import { ArrowLeft, Key, Copy, Check, Terminal, ExternalLink, Globe } from "lucide-react";
 
 export default function ApiConnection() {
   const { selectedCompany, refetch } = useCompany();
   const navigate = useNavigate();
   const { toast } = useToast();
   const [apiKey, setApiKey] = useState("");
   const [isCopied, setIsCopied] = useState(false);
   const [isLoading, setIsLoading] = useState(false);
 
   useEffect(() => {
     if (selectedCompany?.api_key) {
       setApiKey(selectedCompany.api_key);
     }
   }, [selectedCompany]);
 
   const handleSaveApiKey = async () => {
     if (!selectedCompany) return;
     setIsLoading(true);
     try {
       const { error } = await supabase
         .from("companies")
         .update({ api_key: apiKey })
         .eq("id", selectedCompany.id);
 
       if (error) throw error;
 
       toast({
         title: "Sucesso!",
         description: "Chave API atualizada com sucesso.",
       });
       refetch();
     } catch (error: any) {
       toast({
         variant: "destructive",
         title: "Erro ao salvar",
         description: error.message,
       });
     } finally {
       setIsLoading(false);
     }
   };
 
   const generateApiKey = () => {
     const array = new Uint8Array(32);
     window.crypto.getRandomValues(array);
     const hash = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
     setApiKey(hash);
   };
 
   const copyToClipboard = (text: string) => {
     navigator.clipboard.writeText(text);
     setIsCopied(true);
     toast({ title: "Copiado!", description: "Link copiado para a área de transferência." });
     setTimeout(() => setIsCopied(false), 2000);
   };
 
   const apiUrl = `https://oimxpuevlxfbpvryxkzy.supabase.co/functions/v1/api-movement`;
 
   if (!selectedCompany) {
     return (
       <div className="container py-8 text-center">
         <Card>
           <CardHeader>
             <CardTitle>Nenhuma empresa selecionada</CardTitle>
             <CardDescription>
               Por favor, selecione uma empresa para configurar a conexão API.
             </CardDescription>
           </CardHeader>
           <CardContent>
             <Button onClick={() => navigate("/empresas")}>Selecionar Empresa</Button>
           </CardContent>
         </Card>
       </div>
     );
   }
 
   return (
     <div className="container max-w-4xl py-8 space-y-8 animate-in fade-in duration-500">
       <div className="flex items-center gap-4 mb-2">
         <Button variant="ghost" size="icon" onClick={() => navigate("/app")}>
           <ArrowLeft className="h-4 w-4" />
         </Button>
         <h1 className="text-3xl font-bold tracking-tight">Conexão API</h1>
       </div>
 
       <div className="grid gap-6">
         <Card className="border-primary/20 shadow-lg">
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <Key className="h-5 w-5 text-primary" />
               Chave de Integração
             </CardTitle>
             <CardDescription>
               Esta chave é única para <strong>{selectedCompany.nome_fantasia}</strong> e deve ser enviada no cabeçalho <code>x-api-key</code> de cada requisição.
             </CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="flex flex-col sm:flex-row gap-3">
               <div className="flex-1">
                 <Input 
                   value={apiKey} 
                   onChange={(e) => setApiKey(e.target.value)}
                   placeholder="Insira sua chave ou gere uma nova"
                   className="font-mono"
                 />
               </div>
               <div className="flex gap-2">
                 <Button variant="outline" onClick={generateApiKey}>Gerar Nova</Button>
                 <Button onClick={handleSaveApiKey} disabled={isLoading}>
                   {isLoading ? "Salvando..." : "Salvar Chave"}
                 </Button>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <Globe className="h-5 w-5 text-primary" />
               Endpoint de Destino
             </CardTitle>
             <CardDescription>
               Envie seus dados (JSON ou XML) para este endereço via método <strong>POST</strong>.
             </CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="flex items-center gap-2 p-3 rounded-lg bg-muted font-mono text-sm overflow-x-auto">
               <span className="flex-1 truncate">{apiUrl}</span>
               <Button size="icon" variant="ghost" onClick={() => copyToClipboard(apiUrl)}>
                 {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
               </Button>
             </div>
           </CardContent>
         </Card>
 
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <Terminal className="h-5 w-5 text-primary" />
               Como integrar
             </CardTitle>
             <CardDescription>
               Abaixo estão exemplos de como enviar dados para o sistema.
             </CardDescription>
           </CardHeader>
           <CardContent className="space-y-6">
             <div className="space-y-2">
               <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Exemplo JSON</h4>
               <pre className="p-4 rounded-lg bg-slate-950 text-slate-50 text-xs overflow-x-auto">
 {`{
   "competencia": "2024-05-01",
   "nfe_saida": 15500.50,
   "nfe_entrada": 4200.00,
   "cupom": 800.00,
   "servico": 2000.00
 }`}
               </pre>
             </div>
 
             <div className="space-y-2">
               <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Exemplo XML (NF-e / NFC-e)</h4>
               <p className="text-sm text-muted-foreground">
                 Você pode enviar o conteúdo bruto do XML da nota fiscal. O sistema detectará automaticamente se é uma Entrada ou Saída comparando o CNPJ da empresa com o emissor da nota.
               </p>
               <div className="p-4 rounded-lg bg-muted border border-dashed flex flex-col items-center justify-center text-center gap-2">
                 <p className="text-sm font-medium">Suporte nativo a arquivos .xml individuais</p>
                 <p className="text-xs text-muted-foreground">Basta enviar o corpo do arquivo com Content-Type: application/xml</p>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }