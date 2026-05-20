import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

export const LucroPresumidoForm = ({ planning, onSave }: { planning: any, onSave: (data: any) => void }) => {
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
    r.icms = r.receita_bruta * params.aliquota_icms; // Base default is gross revenue as per rules
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
      // For mixed, we'd ideally need a split of revenue. 
      // Rule says: BC CSLL = Rec Comercio * 12% + Rec Serviço * 32%
      // Since we don't have the split in the monthly table yet, we default to service rate or let user edit BC.
      // For now, let's stick to simple activity type selection.
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
    <div className="space-y-6 text-foreground">
      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="flex-1 shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Dados Cadastrais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Ano de Apuração</Label>
              <Input className="h-9 font-medium" value={year} onChange={e => setYear(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Regime</Label>
              <Input className="h-9 font-medium bg-muted/30" value="Lucro Presumido" disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Atividade</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger className="h-9 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comercio">Comércio</SelectItem>
                  <SelectItem value="servico">Serviço</SelectItem>
                  <SelectItem value="misto">Comércio e Serviço</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1 shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Presunções e Alíquotas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">ICMS (%)</Label>
              <Input 
                className="h-9 font-medium text-center" 
                type="number" 
                value={params.aliquota_icms * 100} 
                onChange={e => setParams({...params, aliquota_icms: (parseFloat(e.target.value) || 0)/100})} 
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">PIS (%)</Label>
              <div className="h-9 flex items-center justify-center font-bold text-sm bg-muted/20 rounded-md border border-input">0,65%</div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">COFINS (%)</Label>
              <div className="h-9 flex items-center justify-center font-bold text-sm bg-muted/20 rounded-md border border-input">3%</div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">CSLL (%)</Label>
              <div className="h-9 flex items-center justify-center font-bold text-sm bg-muted/20 rounded-md border border-input">9%</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border/60 overflow-hidden">
        <CardHeader className="bg-muted/10 border-b py-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Tabela Mensal de Apuração</span>
            <span className="text-[10px] font-normal text-muted-foreground">Valores em R$</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="p-2 border-r text-left w-20">MÊS</th>
                <th className="p-2 border-r text-right w-24">ENTRADA</th>
                <th className="p-2 border-r text-right w-24">CRÉD. ICMS</th>
                <th className="p-2 border-r text-right w-24">REC. BRUTA</th>
                <th className="p-2 border-r text-right w-24">REC. MONOF.</th>
                <th className="p-2 border-r text-right w-24 bg-primary/5 text-primary">PIS (8109)</th>
                <th className="p-2 border-r text-right w-24 bg-primary/5 text-primary">COFINS (2172)</th>
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
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/60 overflow-hidden">
        <CardHeader className="bg-muted/10 border-b py-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Impostos Trimestrais (IRPJ & CSLL)</span>
            <div className="flex gap-4 text-[10px] font-normal uppercase">
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-100 rounded-full"></div> CSLL: 2372</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-100 rounded-full"></div> IRPJ: 2089</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full border-collapse text-[10px]">
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
        </CardContent>
      </Card>
      
      <div className="flex justify-end pt-4">
        <button 
          onClick={() => onSave({ activityType, year, params, monthlyData, quarterlyRetentions })}
          className="bg-primary text-primary-foreground px-8 py-2.5 rounded-lg font-bold shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all active:scale-95"
        >
          Salvar Dados da Apuração
        </button>
      </div>
    </div>
  );
};
