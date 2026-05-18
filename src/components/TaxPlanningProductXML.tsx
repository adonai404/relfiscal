 import { useState, useMemo } from "react";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { FileUp, Loader2, Package, Search, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Info } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Badge } from "@/components/ui/badge";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { supabase } from "@/integrations/supabase/client";
 import { useCompany } from "@/hooks/useCompany";
 import { toast } from "sonner";
 
 export function TaxPlanningProductXML() {
   const { companies } = useCompany();
   const queryClient = useQueryClient();
   const [selectedCompanyId, setSelectedCompanyId] = useState("");
   const [isUploading, setIsUploading] = useState(false);
   const [search, setSearch] = useState("");
 
   const { data: products = [], isLoading: isLoadingProducts } = useQuery({
     queryKey: ["tax_planning_products", selectedCompanyId],
     queryFn: async () => {
       if (!selectedCompanyId) return [];
       const { data, error } = await supabase
         .from("tax_planning_products")
         .select("*")
         .eq("company_id", selectedCompanyId)
         .order("emission_date", { ascending: false });
       if (error) throw error;
       return data;
     },
     enabled: !!selectedCompanyId,
   });
 
   const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
     const files = event.target.files;
     if (!files || files.length === 0 || !selectedCompanyId) {
       if (!selectedCompanyId) toast.error("Selecione uma empresa primeiro");
       return;
     }
 
     setIsUploading(true);
     const company = companies.find(c => c.id === selectedCompanyId);
     const companyCnpj = company?.cnpj?.replace(/\D/g, "");
 
     try {
       for (const file of Array.from(files)) {
         const content = await file.text();
         const parser = new DOMParser();
         const xmlDoc = parser.parseFromString(content, "text/xml");
         
         // Check for parsing errors
         if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
           toast.error(`Arquivo ${file.name} é um XML inválido`);
           continue;
         }
 
         // Basic NFe/NFCe structure check
         const infNFe = xmlDoc.getElementsByTagName("infNFe")[0];
         if (!infNFe) {
           toast.error(`Arquivo ${file.name} não parece ser uma NF-e ou NFC-e válida (falta tag infNFe)`);
           continue;
         }
 
         // Determine XML type
         let xmlType: "NF_EMITIDA" | "NF_RECEBIDA" | "NFC_EMITIDA" = "NF_EMITIDA";
         const cnpjEmit = xmlDoc.getElementsByTagName("emit")[0]?.getElementsByTagName("CNPJ")[0]?.textContent;
         const cnpjDest = xmlDoc.getElementsByTagName("dest")[0]?.getElementsByTagName("CNPJ")[0]?.textContent;
         const mod = xmlDoc.getElementsByTagName("ide")[0]?.getElementsByTagName("mod")[0]?.textContent;
 
         if (mod === "65") {
           xmlType = "NFC_EMITIDA";
         } else if (cnpjEmit === companyCnpj) {
           xmlType = "NF_EMITIDA";
         } else if (cnpjDest === companyCnpj) {
           xmlType = "NF_RECEBIDA";
         } else {
           toast.error(`Arquivo ${file.name} não pertence à empresa selecionada (CNPJ não coincide)`);
           continue;
         }
 
         // Extract products
         const detNodes = xmlDoc.getElementsByTagName("det");
         if (detNodes.length === 0) {
           toast.error(`Arquivo ${file.name} não contém itens de produto (tag det)`);
           continue;
         }
 
         // Log upload record
         const { data: uploadData, error: uploadError } = await supabase
           .from("tax_planning_xml_uploads")
           .insert([{
             company_id: selectedCompanyId,
             file_name: file.name,
             xml_type: xmlType
           }])
           .select()
           .single();
 
         if (uploadError) throw uploadError;
 
         const extractedProducts = [];
         const emissionDate = xmlDoc.getElementsByTagName("dhEmi")[0]?.textContent || 
                         xmlDoc.getElementsByTagName("dEmi")[0]?.textContent || 
                         new Date().toISOString();
 
         for (let i = 0; i < detNodes.length; i++) {
           const prod = detNodes[i].getElementsByTagName("prod")[0];
           const imposto = detNodes[i].getElementsByTagName("imposto")[0];
           
           if (!prod) continue;
 
           extractedProducts.push({
             company_id: selectedCompanyId,
             upload_id: uploadData.id,
             xml_type: xmlType,
             product_code: prod.getElementsByTagName("cProd")[0]?.textContent,
             product_name: prod.getElementsByTagName("xProd")[0]?.textContent || "Produto sem nome",
             ncm: prod.getElementsByTagName("NCM")[0]?.textContent,
             cfop: prod.getElementsByTagName("CFOP")[0]?.textContent,
             ucom: prod.getElementsByTagName("uCom")[0]?.textContent,
             qcom: parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent || "0"),
             vuncom: parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent || "0"),
             vprod: parseFloat(prod.getElementsByTagName("vProd")[0]?.textContent || "0"),
             vicms: parseFloat(imposto?.getElementsByTagName("vICMS")[0]?.textContent || "0"),
             vpis: parseFloat(imposto?.getElementsByTagName("vPIS")[0]?.textContent || "0"),
             vcofins: parseFloat(imposto?.getElementsByTagName("vCOFINS")[0]?.textContent || "0"),
             emission_date: emissionDate
           });
         }
 
         if (extractedProducts.length > 0) {
           const { error: productsError } = await supabase
             .from("tax_planning_products")
             .insert(extractedProducts);
           if (productsError) throw productsError;
         }
       }
       
       toast.success("Arquivos válidos processados com sucesso!");
       queryClient.invalidateQueries({ queryKey: ["tax_planning_products", selectedCompanyId] });
     } catch (error: any) {
       console.error(error);
       toast.error("Erro crítico ao processar XML: " + error.message);
     } finally {
       setIsUploading(false);
       event.target.value = "";
     }
   };
 
   const stats = useMemo(() => {
     const grouped: Record<string, { name: string, totalQty: number, totalValue: number, type: string, count: number }> = {};
     
     products.forEach((p: any) => {
       const key = `${p.product_code}-${p.xml_type}`;
       if (!grouped[key]) {
         grouped[key] = { name: p.product_name, totalQty: 0, totalValue: 0, type: p.xml_type, count: 0 };
       }
       grouped[key].totalQty += Number(p.qcom);
       grouped[key].totalValue += Number(p.vprod);
       grouped[key].count += 1;
     });
 
     const sorted = Object.values(grouped).sort((a, b) => b.totalValue - a.totalValue);
     const topSold = sorted.filter(s => s.type !== "NF_RECEBIDA").slice(0, 5);
     const topBought = sorted.filter(s => s.type === "NF_RECEBIDA").slice(0, 5);
 
     return { topSold, topBought };
   }, [products]);
 
   const filteredProducts = products.filter((p: any) => 
     p.product_name.toLowerCase().includes(search.toLowerCase()) ||
     p.product_code?.toLowerCase().includes(search.toLowerCase())
   );
 
   return (
     <div className="space-y-6">
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <FileUp className="h-5 w-5 text-primary" />
             Importação de XMLs
           </CardTitle>
           <CardDescription>
             Importe seus arquivos XML (NF-e/NFC-e) para extrair dados de produtos e impostos.
           </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           <div className="grid gap-4 md:grid-cols-2">
             <div className="grid gap-2">
               <Label>Empresa</Label>
               <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                 <SelectTrigger>
                   <SelectValue placeholder="Selecione a empresa" />
                 </SelectTrigger>
                 <SelectContent>
                   {companies.map((c) => (
                     <SelectItem key={c.id} value={c.id}>
                       {c.nome_fantasia}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             <div className="grid gap-2">
               <Label htmlFor="xml-upload">Arquivos XML</Label>
               <div className="flex items-center gap-2">
                 <Input 
                   id="xml-upload" 
                   type="file" 
                   multiple 
                   accept=".xml" 
                   onChange={handleFileUpload}
                   disabled={!selectedCompanyId || isUploading}
                 />
                 {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
               </div>
             </div>
           </div>
         </CardContent>
       </Card>
 
       {selectedCompanyId && (
         <>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card>
               <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle className="text-sm font-medium">Mais Vendidos (Receita)</CardTitle>
                 <TrendingUp className="h-4 w-4 text-emerald-500" />
               </CardHeader>
               <CardContent>
                 <div className="space-y-4">
                   {stats.topSold.map((s, i) => (
                     <div key={i} className="flex items-center justify-between">
                       <div className="space-y-1">
                         <p className="text-sm font-medium leading-none">{s.name}</p>
                         <p className="text-xs text-muted-foreground">{s.totalQty} unidades</p>
                       </div>
                       <div className="font-bold text-emerald-600">
                         {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.totalValue)}
                       </div>
                     </div>
                   ))}
                   {stats.topSold.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhum dado de venda disponível.</p>}
                 </div>
               </CardContent>
             </Card>
 
             <Card>
               <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle className="text-sm font-medium">Mais Comprados (Custo)</CardTitle>
                 <TrendingDown className="h-4 w-4 text-rose-500" />
               </CardHeader>
               <CardContent>
                 <div className="space-y-4">
                   {stats.topBought.map((s, i) => (
                     <div key={i} className="flex items-center justify-between">
                       <div className="space-y-1">
                         <p className="text-sm font-medium leading-none">{s.name}</p>
                         <p className="text-xs text-muted-foreground">{s.totalQty} unidades</p>
                       </div>
                       <div className="font-bold text-rose-600">
                         {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.totalValue)}
                       </div>
                     </div>
                   ))}
                   {stats.topBought.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhum dado de compra disponível.</p>}
                 </div>
               </CardContent>
             </Card>
           </div>
 
           <Card>
             <CardHeader>
               <div className="flex items-center justify-between">
                 <div>
                   <CardTitle>Listagem de Itens Extraídos</CardTitle>
                   <CardDescription>Produtos identificados nos arquivos importados.</CardDescription>
                 </div>
                 <div className="relative w-64">
                   <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                   <Input 
                     placeholder="Filtrar produtos..." 
                     className="pl-8" 
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                   />
                 </div>
               </div>
             </CardHeader>
             <CardContent>
               {isLoadingProducts ? (
                 <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
               ) : (
                 <div className="rounded-md border">
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Data</TableHead>
                         <TableHead>Tipo</TableHead>
                         <TableHead>Produto</TableHead>
                         <TableHead>NCM</TableHead>
                         <TableHead className="text-right">Qtd</TableHead>
                         <TableHead className="text-right">V. Unit</TableHead>
                         <TableHead className="text-right">V. Total</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {filteredProducts.slice(0, 50).map((p: any) => (
                         <TableRow key={p.id}>
                           <TableCell className="text-xs">
                             {p.emission_date ? new Date(p.emission_date).toLocaleDateString() : "-"}
                           </TableCell>
                           <TableCell>
                             {p.xml_type === "NF_RECEBIDA" ? (
                               <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 flex items-center gap-1 w-fit">
                                 <ArrowDownRight className="h-3 w-3" /> Compra
                               </Badge>
                             ) : (
                               <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 flex items-center gap-1 w-fit">
                                 <ArrowUpRight className="h-3 w-3" /> Venda
                               </Badge>
                             )}
                           </TableCell>
                           <TableCell className="max-w-[300px]">
                             <div className="font-medium truncate" title={p.product_name}>{p.product_name}</div>
                             <div className="text-xs text-muted-foreground">Cód: {p.product_code}</div>
                           </TableCell>
                           <TableCell className="text-xs">{p.ncm}</TableCell>
                           <TableCell className="text-right">{p.qcom} {p.ucom}</TableCell>
                           <TableCell className="text-right font-mono text-xs">
                             {new Intl.NumberFormat('pt-BR').format(p.vuncom)}
                           </TableCell>
                           <TableCell className="text-right font-bold whitespace-nowrap">
                             {new Intl.NumberFormat('pt-BR').format(p.vprod)}
                           </TableCell>
                         </TableRow>
                       ))}
                       {filteredProducts.length === 0 && (
                         <TableRow>
                           <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                             Nenhum produto importado para esta empresa.
                           </TableCell>
                         </TableRow>
                       )}
                     </TableBody>
                   </Table>
                   {filteredProducts.length > 50 && (
                     <div className="p-4 text-center text-xs text-muted-foreground border-t bg-muted/50">
                       Exibindo os 50 registros mais recentes de {filteredProducts.length}.
                     </div>
                   )}
                 </div>
               )}
             </CardContent>
           </Card>
         </>
       )}
     </div>
   );
 }