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
import { toast } from "sonner";
import JSZip from "jszip";
 
 interface TaxPlanningProductXMLProps {
   planningId?: string;
   companyId?: string;
   companyCnpj?: string;
 }
 
 export function TaxPlanningProductXML({ planningId, companyId, companyCnpj }: TaxPlanningProductXMLProps) {
   const queryClient = useQueryClient();
   const [selectedXmlType, setSelectedXmlType] = useState<"AUTO" | "NF_EMITIDA" | "NF_RECEBIDA" | "NFC_EMITIDA">("AUTO");
   const [isUploading, setIsUploading] = useState(false);
   const [search, setSearch] = useState("");
 
   const { data: products = [], isLoading: isLoadingProducts } = useQuery({
     queryKey: ["tax_planning_products", planningId || companyId],
     queryFn: async () => {
       const query = supabase
         .from("tax_planning_products")
         .select("*")
         .order("emission_date", { ascending: false });
       
       if (planningId) {
         query.eq("planning_id", planningId);
       } else if (companyId) {
         query.eq("company_id", companyId);
       } else {
         return [];
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data;
     },
     enabled: !!(planningId || companyId),
   });
 
   const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
     const files = event.target.files;
     const targetCompanyId = companyId;
     const targetPlanningId = planningId;
 
     if (!files || files.length === 0 || !targetCompanyId) {
       if (!targetCompanyId) toast.error("Empresa não identificada");
       return;
     }
 
     setIsUploading(true);
     const formattedCnpj = companyCnpj?.replace(/\D/g, "");
 
     try {
      const processSingleXml = async (content: string, fileName: string) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        
        if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
          toast.error(`Arquivo ${fileName} é um XML inválido`);
          return;
        }
 
        let infNFe = xmlDoc.getElementsByTagName("infNFe")[0];
        
        if (!infNFe) {
          const nfe = xmlDoc.getElementsByTagName("NFe")[0];
          if (nfe) infNFe = nfe.getElementsByTagName("infNFe")[0];
        }
 
        if (!infNFe) {
          toast.error(`Arquivo ${fileName} não possui a tag <infNFe>. Verifique se é um XML de NF-e válido.`);
          return;
        }
 
        let xmlType: "NF_EMITIDA" | "NF_RECEBIDA" | "NFC_EMITIDA" = "NF_EMITIDA";
        const cnpjEmit = infNFe.getElementsByTagName("emit")[0]?.getElementsByTagName("CNPJ")[0]?.textContent;
        const cnpjDest = infNFe.getElementsByTagName("dest")[0]?.getElementsByTagName("CNPJ")[0]?.textContent;
        const mod = infNFe.getElementsByTagName("ide")[0]?.getElementsByTagName("mod")[0]?.textContent;
 
        if (selectedXmlType !== "AUTO") {
          xmlType = selectedXmlType;
        } else {
          if (mod === "65") {
            xmlType = "NFC_EMITIDA";
          } else if (cnpjEmit === companyCnpj) {
            xmlType = "NF_EMITIDA";
          } else if (cnpjDest === companyCnpj) {
            xmlType = "NF_RECEBIDA";
          } else {
            toast.error(`O CNPJ do XML (${cnpjEmit || cnpjDest || 'não encontrado'}) em ${fileName} não coincide com o da empresa selecionada (${companyCnpj}).`);
            return;
          }
        }
 
        const detNodes = infNFe.getElementsByTagName("det");
        if (detNodes.length === 0) {
          toast.error(`Arquivo ${fileName} não contém itens de produto (tag <det>)`);
          return;
        }
 
         const { data: uploadData, error: uploadError } = await supabase
           .from("tax_planning_xml_uploads")
           .insert([{
             company_id: targetCompanyId,
             planning_id: targetPlanningId,
             file_name: fileName,
             xml_type: xmlType
           }])
           .select()
           .single();
 
        if (uploadError) throw uploadError;
 
        const extractedProducts = [];
        const emissionDate = infNFe.getElementsByTagName("dhEmi")[0]?.textContent || 
                        infNFe.getElementsByTagName("dEmi")[0]?.textContent || 
                        new Date().toISOString();
 
        for (let i = 0; i < detNodes.length; i++) {
          const prod = detNodes[i].getElementsByTagName("prod")[0];
          const imposto = detNodes[i].getElementsByTagName("imposto")[0];
          
          if (!prod) continue;
 
           extractedProducts.push({
             company_id: targetCompanyId,
             planning_id: targetPlanningId,
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
      };
 
      for (const file of Array.from(files)) {
        if (file.name.toLowerCase().endsWith(".zip")) {
          const zip = await JSZip.loadAsync(file);
          const zipFiles = Object.keys(zip.files).filter(name => !zip.files[name].dir && name.toLowerCase().endsWith(".xml"));
          
          if (zipFiles.length === 0) {
            toast.error(`O arquivo ZIP ${file.name} não contém arquivos XML válidos.`);
            continue;
          }
 
          for (const name of zipFiles) {
            const content = await zip.files[name].async("text");
            await processSingleXml(content, name);
          }
        } else {
          const content = await file.text();
          await processSingleXml(content, file.name);
        }
      }
       
        toast.success("Arquivos válidos processados com sucesso!");
        queryClient.invalidateQueries({ queryKey: ["tax_planning_products", planningId || companyId] });
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
     <div className="space-y-4 sm:space-y-6 px-1 sm:px-0">
       <Card className="shadow-sm border-border/60">
         <CardHeader className="p-4 sm:p-6">
           <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
             <FileUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
             Importação de XMLs
           </CardTitle>
           <CardDescription className="text-[10px] sm:text-sm">
             Importe seus arquivos NF-e/NFC-e para análise.
           </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
             <div className="grid gap-4 md:grid-cols-2">
               <div className="grid gap-1.5">
                 <Label className="text-[10px] sm:text-xs font-bold uppercase text-muted-foreground">Tipo de XML</Label>
                 <Select 
                   value={selectedXmlType} 
                   onValueChange={(val: any) => setSelectedXmlType(val)}
                 >
                   <SelectTrigger className="h-9 text-xs sm:text-sm">
                     <SelectValue placeholder="Tipo de Nota" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="AUTO">Automático (CNPJ)</SelectItem>
                     <SelectItem value="NF_EMITIDA">NF-e Emitida</SelectItem>
                     <SelectItem value="NF_RECEBIDA">NF-e Recebida</SelectItem>
                     <SelectItem value="NFC_EMITIDA">NFC-e Emitida</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="grid gap-1.5">
                 <Label htmlFor="xml-upload" className="text-[10px] sm:text-xs font-bold uppercase text-muted-foreground">Arquivos XML</Label>
                 <div className="flex items-center gap-2">
                   <Input 
                     id="xml-upload" 
                     type="file" 
                     multiple 
                     accept=".xml,.zip" 
                     onChange={handleFileUpload}
                     className="h-9 text-xs sm:text-sm p-1 file:text-[10px] file:uppercase file:font-black"
                     disabled={!(planningId || companyId) || isUploading}
                   />
                   {isUploading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                 </div>
               </div>
             </div>
         </CardContent>
       </Card>
 
        {(planningId || companyId) && (
         <>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
             <Card className="shadow-sm border-border/60">
               <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6 pb-2">
                 <CardTitle className="text-[10px] sm:text-sm font-black uppercase tracking-widest text-muted-foreground">Mais Vendidos</CardTitle>
                 <TrendingUp className="h-4 w-4 text-emerald-500" />
               </CardHeader>
               <CardContent className="p-4 sm:p-6 pt-0">
                 <div className="space-y-3">
                   {stats.topSold.map((s, i) => (
                     <div key={i} className="flex items-center justify-between border-b border-muted last:border-0 pb-2 last:pb-0">
                       <div className="space-y-0.5">
                         <p className="text-[11px] sm:text-sm font-bold leading-none truncate max-w-[150px] sm:max-w-none">{s.name}</p>
                         <p className="text-[9px] sm:text-xs text-muted-foreground">{s.totalQty} un.</p>
                       </div>
                       <div className="font-black text-[11px] sm:text-sm text-emerald-600">
                         {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.totalValue)}
                       </div>
                     </div>
                   ))}
                   {stats.topSold.length === 0 && <p className="text-[10px] sm:text-sm text-muted-foreground italic">Sem dados de venda.</p>}
                 </div>
               </CardContent>
             </Card>
 
             <Card className="shadow-sm border-border/60">
               <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6 pb-2">
                 <CardTitle className="text-[10px] sm:text-sm font-black uppercase tracking-widest text-muted-foreground">Mais Comprados</CardTitle>
                 <TrendingDown className="h-4 w-4 text-rose-500" />
               </CardHeader>
               <CardContent className="p-4 sm:p-6 pt-0">
                 <div className="space-y-3">
                   {stats.topBought.map((s, i) => (
                     <div key={i} className="flex items-center justify-between border-b border-muted last:border-0 pb-2 last:pb-0">
                       <div className="space-y-0.5">
                         <p className="text-[11px] sm:text-sm font-bold leading-none truncate max-w-[150px] sm:max-w-none">{s.name}</p>
                         <p className="text-[9px] sm:text-xs text-muted-foreground">{s.totalQty} un.</p>
                       </div>
                       <div className="font-black text-[11px] sm:text-sm text-rose-600">
                         {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.totalValue)}
                       </div>
                     </div>
                   ))}
                   {stats.topBought.length === 0 && <p className="text-[10px] sm:text-sm text-muted-foreground italic">Sem dados de compra.</p>}
                 </div>
               </CardContent>
             </Card>
           </div>
 
           <Card className="shadow-lg border-border/60 overflow-hidden">
             <CardHeader className="p-4 sm:p-6 border-b bg-muted/10">
               <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                 <div>
                   <CardTitle className="text-sm sm:text-lg font-black uppercase tracking-widest">Itens Extraídos</CardTitle>
                   <CardDescription className="text-[10px] sm:text-sm uppercase font-bold text-muted-foreground/60">Extraídos dos XMLs importados</CardDescription>
                 </div>
                 <div className="relative w-full sm:w-64">
                   <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                   <Input 
                     placeholder="Filtrar por nome ou código..." 
                     className="pl-9 h-9 text-xs sm:text-sm font-medium" 
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                   />
                 </div>
               </div>
             </CardHeader>
             <CardContent className="p-0">
               {isLoadingProducts ? (
                 <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
               ) : (
                 <>
                  {/* Desktop Table */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow className="uppercase text-[10px] font-black">
                          <TableHead className="w-24">Data</TableHead>
                          <TableHead className="w-28">Tipo</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead className="w-24">NCM</TableHead>
                          <TableHead className="text-right w-24">Qtd</TableHead>
                          <TableHead className="text-right w-28">V. Unit</TableHead>
                          <TableHead className="text-right w-32">V. Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.slice(0, 50).map((p: any) => (
                          <TableRow key={p.id} className="hover:bg-primary/5 transition-colors">
                            <TableCell className="text-[11px] font-medium">
                              {p.emission_date ? new Date(p.emission_date).toLocaleDateString() : "-"}
                            </TableCell>
                            <TableCell>
                              {p.xml_type === "NF_RECEBIDA" ? (
                                <Badge variant="outline" className="text-[9px] uppercase font-black text-rose-600 border-rose-200 bg-rose-50/50 flex items-center gap-1 w-fit h-5">
                                  <ArrowDownRight className="h-2.5 w-2.5" /> Compra
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] uppercase font-black text-emerald-600 border-emerald-200 bg-emerald-50/50 flex items-center gap-1 w-fit h-5">
                                  <ArrowUpRight className="h-2.5 w-2.5" /> Venda
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[250px]">
                              <div className="text-[11px] font-bold truncate uppercase" title={p.product_name}>{p.product_name}</div>
                              <div className="text-[9px] font-black text-muted-foreground/60 uppercase">Cód: {p.product_code}</div>
                            </TableCell>
                            <TableCell className="text-[10px] font-mono">{p.ncm}</TableCell>
                            <TableCell className="text-right text-[11px] font-medium">{p.qcom} <span className="text-[9px] text-muted-foreground uppercase font-black">{p.ucom}</span></TableCell>
                            <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                              {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(p.vuncom)}
                            </TableCell>
                            <TableCell className="text-right font-black text-[12px] whitespace-nowrap text-foreground">
                              {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(p.vprod)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="sm:hidden space-y-2 p-2 bg-muted/5">
                    {filteredProducts.slice(0, 30).map((p: any) => (
                      <Card key={p.id} className="overflow-hidden border-border/50 shadow-none bg-card">
                        <div className="p-2 bg-muted/20 border-b flex items-center justify-between">
                          <span className="font-black text-[9px] uppercase tracking-tighter italic text-muted-foreground/80">
                            {p.emission_date ? new Date(p.emission_date).toLocaleDateString() : "-"}
                          </span>
                          {p.xml_type === "NF_RECEBIDA" ? (
                            <Badge variant="outline" className="text-[8px] uppercase font-black text-rose-600 border-rose-200 bg-rose-50 h-4">Compra</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] uppercase font-black text-emerald-600 border-emerald-200 bg-emerald-50 h-4">Venda</Badge>
                          )}
                        </div>
                        <div className="p-2 flex flex-col gap-2">
                          <div className="space-y-0.5">
                             <div className="text-[11px] font-black uppercase leading-tight truncate">{p.product_name}</div>
                             <div className="flex items-center gap-2 text-[8px] font-black text-muted-foreground/60 uppercase">
                               <span>Cód: {p.product_code}</span>
                               <span className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
                               <span>NCM: {p.ncm}</span>
                             </div>
                          </div>
                          <div className="flex items-end justify-between border-t pt-2 mt-1">
                             <div className="flex flex-col">
                               <span className="text-[8px] uppercase font-black text-muted-foreground">Quantidade</span>
                               <span className="text-[11px] font-black">{p.qcom} <span className="text-[9px] font-medium">{p.ucom}</span></span>
                             </div>
                             <div className="flex flex-col items-end">
                               <span className="text-[8px] uppercase font-black text-muted-foreground">Total</span>
                               <span className="text-[13px] font-black tracking-tighter">
                                 {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.vprod)}
                               </span>
                             </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {filteredProducts.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground text-xs uppercase font-bold italic">
                      Nenhum produto encontrado.
                    </div>
                  )}

                  {filteredProducts.length > 50 && (
                    <div className="p-3 bg-muted/10 border-t text-center">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                        Mostrando 50 de {filteredProducts.length} itens encontrados. Refine a busca para ver outros.
                      </p>
                    </div>
                  )}
                 </>
                )}
             </CardContent>
           </Card>
         </>
        )}
     </div>
   );
 }