import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface MonthlyRow {
  mes: string;
  entrada: number;
  credito_icms: number;
  compras_tributadas_icms: number;
  icms_st: number;
  receita_bruta: number;
  receita_tributada_pis_cofins: number;
  receita_monofasica_pis_cofins: number;
  total: number;
  pis: number;
  cofins: number;
  icms: number;
  icms_pagar: number;
}

interface QuarterlyRetention {
  csll_retido: number;
  irrf_retido: number;
}

export const LucroPresumidoForm = ({ planning, onSave }: { planning: any, onSave?: (data: any) => void }) => {
  const [activityType, setActivityType] = useState(planning?.data?.activityType || 'comercio');
  const [year, setYear] = useState(planning?.data?.year || new Date().getFullYear().toString());

  const [params, setParams] = useState({
    aliquota_icms: planning?.data?.params?.aliquota_icms || 0.23,
    csll_comercio: 0.12,
    csll_servico: 0.32,
    csll_aliquota: 0.09,
    irpj_comercio: 0.08,
    irpj_servico: 0.32,
    irpj_aliquota: 0.15,
    irpj_adicional: 0.10,
    pis_rate: 0.0065,
    cofins_rate: 0.03,
  });

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>(
    planning?.data?.monthlyData || 
    months.map(m => ({
      mes: m,
      entrada: 0,
      credito_icms: 0,
      compras_tributadas_icms: 0,
      icms_st: 0,
      receita_bruta: 0,
      receita_tributada_pis_cofins: 0,
      receita_monofasica_pis_cofins: 0,
      total: 0,
      pis: 0,
      cofins: 0,
      icms: 0,
      icms_pagar: 0
    }))
  );

  const [quarterlyRetentions, setQuarterlyRetentions] = useState<QuarterlyRetention[]>(
    planning?.data?.quarterlyRetentions || 
    [1, 2, 3, 4].map(() => ({ csll_retido: 0, irrf_retido: 0 }))
  );

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const calculateRow = (row: MonthlyRow) => {
    const r = { ...row };
    r.receita_tributada_pis_cofins = r.receita_bruta - r.receita_monofasica_pis_cofins;
    r.total = r.receita_tributada_pis_cofins + r.receita_monofasica_pis_cofins;
    r.pis = r.receita_tributada_pis_cofins * params.pis_rate;
    r.cofins = r.receita_tributada_pis_cofins * params.cofins_rate;
    r.icms = r.receita_bruta * params.aliquota_icms;
    r.icms_pagar = Math.max(0, r.icms - r.credito_icms);
    return r;
  };

  const handleInputChange = (idx: number, field: keyof MonthlyRow, value: string) => {
    const numVal = parseFloat(value) || 0;
    const newData = [...monthlyData];
    newData[idx] = calculateRow({ ...newData[idx], [field]: numVal });
    setMonthlyData(newData);
  };

  const totals = monthlyData.reduce((acc, curr) => ({
    entrada: acc.entrada + curr.entrada,
    credito_icms: acc.credito_icms + curr.credito_icms,
    compras_tributadas_icms: acc.compras_tributadas_icms + curr.compras_tributadas_icms,
    icms_st: acc.icms_st + curr.icms_st,
    receita_bruta: acc.receita_bruta + curr.receita_bruta,
    receita_tributada_pis_cofins: acc.receita_tributada_pis_cofins + curr.receita_tributada_pis_cofins,
    receita_monofasica_pis_cofins: acc.receita_monofasica_pis_cofins + curr.receita_monofasica_pis_cofins,
    total: acc.total + curr.total,
    pis: acc.pis + curr.pis,
    cofins: acc.cofins + curr.cofins,
    icms: acc.icms + curr.icms,
    icms_pagar: acc.icms_pagar + curr.icms_pagar,
  }), {
    entrada: 0, credito_icms: 0, compras_tributadas_icms: 0, icms_st: 0,
    receita_bruta: 0, receita_tributada_pis_cofins: 0, receita_monofasica_pis_cofins: 0,
    total: 0, pis: 0, cofins: 0, icms: 0, icms_pagar: 0
  });

  const getQuarterlyData = (qIndex: number) => {
    const startMonth = qIndex * 3;
    const quarterMonths = monthlyData.slice(startMonth, startMonth + 3);
    const qRevenue = quarterMonths.reduce((sum, m) => sum + m.receita_bruta, 0);
    
    let bc_csll = 0;
    let bc_irpj = 0;
    
    if (activityType === 'comercio') {
      bc_csll = qRevenue * params.csll_comercio;
      bc_irpj = qRevenue * params.irpj_comercio;
    } else if (activityType === 'servico') {
      bc_csll = qRevenue * params.csll_servico;
      bc_irpj = qRevenue * params.irpj_servico;
    } else {
      bc_csll = qRevenue * params.csll_servico;
      bc_irpj = qRevenue * params.irpj_servico;
    }

    const csll_total = bc_csll * params.csll_aliquota;
    const irpj_15 = bc_irpj * params.irpj_aliquota;
    const adicional_irpj = Math.max(0, bc_irpj - 60000) * params.irpj_adicional;
    
    const ret = quarterlyRetentions[qIndex];
    
    return {
      bc_csll,
      csll_retido: ret.csll_retido,
      csll_pagar: Math.max(0, csll_total - ret.csll_retido),
      bc_irpj,
      adicional_irpj,
      irpj_15,
      irrf_retido: ret.irrf_retido,
      irpj_pagar: Math.max(0, irpj_15 + adicional_irpj - ret.irrf_retido)
    };
  };

  return (
    <div className="space-y-4 sm:space-y-6 text-foreground px-1 sm:px-0">
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        <Card className="flex-1 shadow-sm border-border/60">
          <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="text-[10px] sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">Dados Cadastrais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="space-y-1">
              <Label className="text-[8px] sm:text-[10px] uppercase font-bold text-muted-foreground">Ano</Label>
              <Input className="h-8 sm:h-9 text-xs sm:text-sm font-medium" value={year} onChange={e => setYear(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[8px] sm:text-[10px] uppercase font-bold text-muted-foreground">Atividade</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comercio">Comércio</SelectItem>
                  <SelectItem value="servico">Serviço</SelectItem>
                  <SelectItem value="misto">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1 shadow-sm border-border/60">
          <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="text-[10px] sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">Presunções e Alíquotas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="space-y-1">
              <Label className="text-[8px] sm:text-[10px] uppercase font-bold text-muted-foreground">ICMS (%)</Label>
              <Input 
                className="h-8 sm:h-9 text-xs sm:text-sm font-medium text-center" 
                type="number" 
                value={params.aliquota_icms * 100} 
                onChange={e => setParams({...params, aliquota_icms: (parseFloat(e.target.value) || 0)/100})} 
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[8px] sm:text-[10px] uppercase font-bold text-muted-foreground">PIS (%)</Label>
              <div className="h-8 sm:h-9 flex items-center justify-center font-bold text-[10px] sm:text-sm bg-muted/20 rounded-md border border-input">0,65%</div>
            </div>
            <div className="space-y-1">
              <Label className="text-[8px] sm:text-[10px] uppercase font-bold text-muted-foreground">COFINS (%)</Label>
              <div className="h-8 sm:h-9 flex items-center justify-center font-bold text-[10px] sm:text-sm bg-muted/20 rounded-md border border-input">3%</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border/60 overflow-hidden">
        <CardHeader className="bg-muted/10 border-b p-3 sm:py-4">
          <CardTitle className="text-[10px] sm:text-sm font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Tabela Mensal</span>
            <span className="text-[8px] sm:text-[10px] font-normal text-muted-foreground">Valores em R$</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {/* Desktop Table */}
          <table className="w-full border-collapse text-[10px] hidden sm:table">
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="p-2 border-r text-left w-20">MÊS</th>
                <th className="p-2 border-r text-right w-24">ENTRADA</th>
                <th className="p-2 border-r text-right w-24">CRÉD. ICMS</th>
                <th className="p-2 border-r text-right w-24">REC. BRUTA</th>
                <th className="p-2 border-r text-right w-24">REC. MONOF.</th>
                <th className="p-2 border-r text-right w-24 bg-primary/5 text-primary">PIS</th>
                <th className="p-2 border-r text-right w-24 bg-primary/5 text-primary">COFINS</th>
                <th className="p-2 border-r text-right w-24">ICMS TOTAL</th>
                <th className="p-2 text-right w-24 font-bold bg-green-50/50">ICMS PAGAR</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((m, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="p-2 font-bold border-r bg-muted/5 uppercase">{m.mes}</td>
                  <td className="p-1 border-r"><Input className="h-7 text-right text-[10px] border-transparent hover:border-input focus:border-primary transition-all p-1" type="number" value={m.entrada || ''} onChange={e => handleInputChange(idx, 'entrada', e.target.value)} /></td>
                  <td className="p-1 border-r"><Input className="h-7 text-right text-[10px] border-transparent hover:border-input focus:border-primary transition-all p-1" type="number" value={m.credito_icms || ''} onChange={e => handleInputChange(idx, 'credito_icms', e.target.value)} /></td>
                  <td className="p-1 border-r"><Input className="h-7 text-right text-[10px] border-transparent hover:border-input focus:border-primary transition-all p-1 font-bold" type="number" value={m.receita_bruta || ''} onChange={e => handleInputChange(idx, 'receita_bruta', e.target.value)} /></td>
                  <td className="p-1 border-r"><Input className="h-7 text-right text-[10px] border-transparent hover:border-input focus:border-primary transition-all p-1" type="number" value={m.receita_monofasica_pis_cofins || ''} onChange={e => handleInputChange(idx, 'receita_monofasica_pis_cofins', e.target.value)} /></td>
                  <td className="p-2 border-r text-right font-medium text-green-700 bg-primary/5">{formatCurrency(m.pis)}</td>
                  <td className="p-2 border-r text-right font-medium text-green-700 bg-primary/5">{formatCurrency(m.cofins)}</td>
                  <td className="p-2 border-r text-right text-muted-foreground">{formatCurrency(m.icms)}</td>
                  <td className="p-2 text-right font-bold text-green-800 bg-green-50/30">{formatCurrency(m.icms_pagar)}</td>
                </tr>
              ))}
              <tr className="bg-muted font-bold text-muted-foreground">
                <td className="p-2 border-r uppercase">TOTAL</td>
                <td className="p-2 border-r text-right">{formatCurrency(totals.entrada)}</td>
                <td className="p-2 border-r text-right">{formatCurrency(totals.credito_icms)}</td>
                <td className="p-2 border-r text-right">{formatCurrency(totals.receita_bruta)}</td>
                <td className="p-2 border-r text-right">{formatCurrency(totals.receita_monofasica_pis_cofins)}</td>
                <td className="p-2 border-r text-right text-primary">{formatCurrency(totals.pis)}</td>
                <td className="p-2 border-r text-right text-primary">{formatCurrency(totals.cofins)}</td>
                <td className="p-2 border-r text-right">{formatCurrency(totals.icms)}</td>
                <td className="p-2 text-right text-green-800">{formatCurrency(totals.icms_pagar)}</td>
              </tr>
            </tbody>
          </table>

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-2 p-2 bg-muted/5">
            {monthlyData.map((m, idx) => (
              <Card key={idx} className="overflow-hidden border-border/50 shadow-none bg-card">
                <div className="p-2 bg-muted/20 border-b flex items-center justify-between">
                  <span className="font-black text-[10px] uppercase tracking-tighter italic text-primary">{m.mes}</span>
                  <span className="font-black text-[10px] text-green-800">{formatCurrency(m.icms_pagar)} <span className="text-[8px] font-normal text-muted-foreground uppercase">(ICMS)</span></span>
                </div>
                <div className="p-2 grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[8px] uppercase font-black text-muted-foreground">Entrada</Label>
                    <Input className="h-7 text-xs p-1" type="number" value={m.entrada || ''} onChange={e => handleInputChange(idx, 'entrada', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] uppercase font-black text-muted-foreground">Rec. Bruta</Label>
                    <Input className="h-7 text-xs p-1 font-bold" type="number" value={m.receita_bruta || ''} onChange={e => handleInputChange(idx, 'receita_bruta', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] uppercase font-black text-muted-foreground">Créd. ICMS</Label>
                    <Input className="h-7 text-xs p-1" type="number" value={m.credito_icms || ''} onChange={e => handleInputChange(idx, 'credito_icms', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] uppercase font-black text-muted-foreground">Rec. Monof.</Label>
                    <Input className="h-7 text-xs p-1" type="number" value={m.receita_monofasica_pis_cofins || ''} onChange={e => handleInputChange(idx, 'receita_monofasica_pis_cofins', e.target.value)} />
                  </div>
                </div>
                <div className="p-2 bg-primary/5 grid grid-cols-2 gap-2 border-t text-[9px] font-bold">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PIS:</span>
                    <span className="text-green-700">{formatCurrency(m.pis)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">COFINS:</span>
                    <span className="text-green-700">{formatCurrency(m.cofins)}</span>
                  </div>
                </div>
              </Card>
            ))}
            <Card className="p-3 bg-muted border-none shadow-none">
              <div className="flex justify-between items-center mb-2 pb-1 border-b border-muted-foreground/20">
                <span className="text-[10px] font-black uppercase">Totais Anuais</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
                <div className="flex justify-between border-b border-muted-foreground/10 pb-1">
                  <span className="text-muted-foreground uppercase font-medium">Rec. Bruta:</span>
                  <span className="font-black">{formatCurrency(totals.receita_bruta)}</span>
                </div>
                <div className="flex justify-between border-b border-muted-foreground/10 pb-1">
                  <span className="text-muted-foreground uppercase font-medium text-primary">DAS (PIS/COF):</span>
                  <span className="font-black text-primary">{formatCurrency(totals.pis + totals.cofins)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground uppercase font-medium text-green-800">ICMS Pagar:</span>
                  <span className="font-black text-green-800">{formatCurrency(totals.icms_pagar)}</span>
                </div>
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/60 overflow-hidden">
        <CardHeader className="bg-muted/10 border-b p-3 sm:py-4">
          <CardTitle className="text-[10px] sm:text-sm font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Impostos Trimestrais (IRPJ & CSLL)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {/* Desktop Table */}
          <table className="w-full border-collapse text-[10px] hidden sm:table">
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="p-2 border-r text-left w-20">TRIMESTRE</th>
                <th className="p-2 border-r text-right w-24">BC CSLL</th>
                <th className="p-2 border-r text-right w-24">CSLL RET.</th>
                <th className="p-2 border-r text-right w-24 font-bold bg-green-50/50">CSLL PAGAR</th>
                <th className="p-2 border-r text-right w-24">BC IRPJ</th>
                <th className="p-2 border-r text-right w-20">ADD 10%</th>
                <th className="p-2 border-r text-right w-20">IRPJ 15%</th>
                <th className="p-2 border-r text-right w-24">IRRF RET.</th>
                <th className="p-2 text-right w-24 font-bold bg-green-50/50">IRPJ PAGAR</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((q, idx) => {
                const qData = getQuarterlyData(idx);
                return (
                  <tr key={idx} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-2 font-bold border-r bg-muted/5 uppercase">{q}º TRIM</td>
                    <td className="p-2 border-r text-right bg-muted/5">{formatCurrency(qData.bc_csll)}</td>
                    <td className="p-1 border-r">
                      <Input 
                        className="h-7 text-right text-[10px] border-transparent hover:border-input focus:border-primary transition-all p-1" 
                        type="number" 
                        value={quarterlyRetentions[idx].csll_retido || ''} 
                        onChange={e => {
                          const newRet = [...quarterlyRetentions];
                          newRet[idx].csll_retido = parseFloat(e.target.value) || 0;
                          setQuarterlyRetentions(newRet);
                        }} 
                      />
                    </td>
                    <td className="p-2 border-r text-right font-bold text-green-800 bg-green-50/20">{formatCurrency(qData.csll_pagar)}</td>
                    <td className="p-2 border-r text-right bg-muted/5">{formatCurrency(qData.bc_irpj)}</td>
                    <td className="p-2 border-r text-right text-red-600">{formatCurrency(qData.adicional_irpj)}</td>
                    <td className="p-2 border-r text-right">{formatCurrency(qData.irpj_15)}</td>
                    <td className="p-1 border-r">
                      <Input 
                        className="h-7 text-right text-[10px] border-transparent hover:border-input focus:border-primary transition-all p-1" 
                        type="number" 
                        value={quarterlyRetentions[idx].irrf_retido || ''} 
                        onChange={e => {
                          const newRet = [...quarterlyRetentions];
                          newRet[idx].irrf_retido = parseFloat(e.target.value) || 0;
                          setQuarterlyRetentions(newRet);
                        }} 
                      />
                    </td>
                    <td className="p-2 text-right font-bold text-green-800 bg-green-50/20">{formatCurrency(qData.irpj_pagar)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-2 p-2 bg-muted/5">
            {[1, 2, 3, 4].map((q, idx) => {
              const qData = getQuarterlyData(idx);
              return (
                <Card key={idx} className="overflow-hidden border-border/50 shadow-none bg-card">
                  <div className="p-2 bg-muted/20 border-b flex items-center justify-between">
                    <span className="font-black text-[10px] uppercase tracking-tighter italic text-primary">{q}º TRIMESTRE</span>
                  </div>
                  <div className="p-2 grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2 grid grid-cols-2 gap-2">
                       <div className="flex flex-col">
                         <span className="text-[8px] uppercase font-black text-muted-foreground">BC CSLL</span>
                         <span className="text-[10px] font-bold">{formatCurrency(qData.bc_csll)}</span>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[8px] uppercase font-black text-muted-foreground">BC IRPJ</span>
                         <span className="text-[10px] font-bold">{formatCurrency(qData.bc_irpj)}</span>
                       </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[8px] uppercase font-black text-muted-foreground">CSLL Retida</Label>
                      <Input 
                        className="h-7 text-xs p-1" 
                        type="number" 
                        value={quarterlyRetentions[idx].csll_retido || ''} 
                        onChange={e => {
                          const newRet = [...quarterlyRetentions];
                          newRet[idx].csll_retido = parseFloat(e.target.value) || 0;
                          setQuarterlyRetentions(newRet);
                        }} 
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[8px] uppercase font-black text-muted-foreground">IRRF Retido</Label>
                      <Input 
                        className="h-7 text-xs p-1" 
                        type="number" 
                        value={quarterlyRetentions[idx].irrf_retido || ''} 
                        onChange={e => {
                          const newRet = [...quarterlyRetentions];
                          newRet[idx].irrf_retido = parseFloat(e.target.value) || 0;
                          setQuarterlyRetentions(newRet);
                        }} 
                      />
                    </div>
                  </div>
                  <div className="p-2 bg-green-50/30 grid grid-cols-2 gap-2 border-t text-[9px] font-bold">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground uppercase text-[8px]">CSLL a Pagar:</span>
                      <span className="text-green-800 text-[10px]">{formatCurrency(qData.csll_pagar)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground uppercase text-[8px]">IRPJ a Pagar:</span>
                      <span className="text-green-800 text-[10px]">{formatCurrency(qData.irpj_pagar)}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-end pt-2 sm:pt-4">
        <Button 
          onClick={() => onSave({ activityType, year, params, monthlyData, quarterlyRetentions })}
          className="bg-primary text-primary-foreground h-10 sm:h-12 w-full sm:w-auto px-8 rounded-lg font-black uppercase tracking-widest shadow-lg hover:shadow-primary/20 transition-all text-xs sm:text-sm"
        >
          Salvar Apuração
        </Button>
      </div>
    </div>
  );
};