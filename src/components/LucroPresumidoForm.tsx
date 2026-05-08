import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface MonthlyRow {
  mes: string;
  entrada: number;
  credito_icms: number;
  compras_tributadas: number;
  icms_st: number;
  receita_bruta: number;
  receita_tributada_pis_cofins: number;
  receita_monofasica: number;
  total: number;
  pis: number;
  cofins: number;
  icms: number;
  icms_pagar: number;
}

interface QuarterData {
  bc_csll: number;
  csll_retido: number;
  csll_pagar: number;
  bc_irpj: number;
  adicional_irpj: number;
  irpj_15: number;
  irrf_retido: number;
  irpj_pagar: number;
}

export const LucroPresumidoForm = ({ planning, onSave }: { planning: any, onSave: (data: any) => void }) => {
  const [activityType, setActivityType] = useState(planning?.data?.activityType || 'comercio');
  const [year, setYear] = useState(planning?.data?.year || new Date().getFullYear().toString());

  const [params, setParams] = useState({
    aliquota_icms: 0.23,
    csll_comercio: 0.12,
    csll_servico: 0.32,
    irpj_comercio: 0.08,
    irpj_servico: 0.32,
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
      compras_tributadas: 0,
      icms_st: 0,
      receita_bruta: 0,
      receita_tributada_pis_cofins: 0,
      receita_monofasica: 0,
      total: 0,
      pis: 0,
      cofins: 0,
      icms: 0,
      icms_pagar: 0
    }))
  );

  const [quarterlyRetentions, setQuarterlyRetentions] = useState(
    planning?.data?.quarterlyRetentions || 
    [1, 2, 3, 4].map(() => ({ csll_retido: 0, irrf_retido: 0 }))
  );

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const calculateRow = (row: MonthlyRow) => {
    const r = { ...row };
    r.receita_tributada_pis_cofins = r.receita_bruta - r.receita_monofasica;
    r.total = r.receita_tributada_pis_cofins + r.receita_monofasica;
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

  // Totals
  const totals = monthlyData.reduce((acc, curr) => ({
    entrada: acc.entrada + curr.entrada,
    credito_icms: acc.credito_icms + curr.credito_icms,
    receita_bruta: acc.receita_bruta + curr.receita_bruta,
    pis: acc.pis + curr.pis,
    cofins: acc.cofins + curr.cofins,
    icms_pagar: acc.icms_pagar + curr.icms_pagar,
  }), { entrada: 0, credito_icms: 0, receita_bruta: 0, pis: 0, cofins: 0, icms_pagar: 0 });

  // Quarterly calculation
  const getQuarterlyData = (qIndex: number): QuarterData => {
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
      // Mixed - simplifying for now to 50/50 if not specified, but usually user would split revenue
      // For this implementation, we follow the rule of separation if specified
      bc_csll = qRevenue * params.csll_servico; // Defaulting to service for safety in mixed if not split
      bc_irpj = qRevenue * params.irpj_servico;
    }

    const csll_calc = bc_csll * 0.09;
    const irpj_15 = bc_irpj * 0.15;
    const adicional_irpj = Math.max(0, bc_irpj - 60000) * 0.10;
    
    const retentions = quarterlyRetentions[qIndex];
    
    return {
      bc_csll,
      csll_retido: retentions.csll_retido,
      csll_pagar: Math.max(0, csll_calc - retentions.csll_retido),
      bc_irpj,
      adicional_irpj,
      irpj_15,
      irrf_retido: retentions.irrf_retido,
      irpj_pagar: Math.max(0, irpj_15 + adicional_irpj - retentions.irrf_retido)
    };
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between gap-6">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Dados do Planejamento</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Ano de Apuração</Label>
              <Input value={year} onChange={e => setYear(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Regime</Label>
              <Input value="Lucro Presumido" disabled />
            </div>
            <div className="space-y-2">
              <Label>Atividade</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger>
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

        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Presunções e Alíquotas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <Label className="text-[10px]">Alíquota ICMS (%)</Label>
              <Input type="number" step="0.01" value={params.aliquota_icms * 100} onChange={e => setParams({...params, aliquota_icms: parseFloat(e.target.value)/100})} />
            </div>
            <div>
              <Label className="text-[10px]">PIS (%)</Label>
              <Input value="0,65%" disabled />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tabela Mensal de Apuração</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-muted/50 border-y">
                <th className="p-2 border-r text-left">Mês</th>
                <th className="p-2 border-r text-right">Entrada</th>
                <th className="p-2 border-r text-right">Créd. ICMS</th>
                <th className="p-2 border-r text-right">Rec. Bruta</th>
                <th className="p-2 border-r text-right">PIS (8109)</th>
                <th className="p-2 border-r text-right">COFINS (2172)</th>
                <th className="p-2 border-r text-right">ICMS</th>
                <th className="p-2 text-right">ICMS a Pagar</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((m, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-2 font-medium border-r">{m.mes}</td>
                  <td className="p-1 border-r"><Input className="h-7 text-right text-[11px]" type="number" value={m.entrada || ''} onChange={e => handleInputChange(idx, 'entrada', e.target.value)} /></td>
                  <td className="p-1 border-r"><Input className="h-7 text-right text-[11px]" type="number" value={m.credito_icms || ''} onChange={e => handleInputChange(idx, 'credito_icms', e.target.value)} /></td>
                  <td className="p-1 border-r"><Input className="h-7 text-right text-[11px]" type="number" value={m.receita_bruta || ''} onChange={e => handleInputChange(idx, 'receita_bruta', e.target.value)} /></td>
                  <td className="p-2 border-r text-right text-green-600 font-medium">{formatCurrency(m.pis)}</td>
                  <td className="p-2 border-r text-right text-green-600 font-medium">{formatCurrency(m.cofins)}</td>
                  <td className="p-2 border-r text-right">{formatCurrency(m.icms)}</td>
                  <td className="p-2 text-right font-bold">{formatCurrency(m.icms_pagar)}</td>
                </tr>
              ))}
              <tr className="bg-primary/5 font-bold">
                <td className="p-2 border-r">TOTAL</td>
                <td className="p-2 border-r text-right">{formatCurrency(totals.entrada)}</td>
                <td className="p-2 border-r text-right">{formatCurrency(totals.credito_icms)}</td>
                <td className="p-2 border-r text-right">{formatCurrency(totals.receita_bruta)}</td>
                <td className="p-2 border-r text-right">{formatCurrency(totals.pis)}</td>
                <td className="p-2 border-r text-right">{formatCurrency(totals.cofins)}</td>
                <td className="p-2 border-r text-right">--</td>
                <td className="p-2 text-right">{formatCurrency(totals.icms_pagar)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Impostos Trimestrais</CardTitle>
          <CardDescription>Cálculos de IRPJ e CSLL</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-muted/50 border-y">
                <th className="p-2 border-r text-left">Trimestre</th>
                <th className="p-2 border-r text-right">BC CSLL</th>
                <th className="p-2 border-r text-right">CSLL Ret.</th>
                <th className="p-2 border-r text-right">CSLL Pagar</th>
                <th className="p-2 border-r text-right">BC IRPJ</th>
                <th className="p-2 border-r text-right">Add 10%</th>
                <th className="p-2 border-r text-right">IRPJ 15%</th>
                <th className="p-2 border-r text-right">IRRF Ret.</th>
                <th className="p-2 text-right">IRPJ Pagar</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((q, idx) => {
                const data = getQuarterlyData(idx);
                return (
                  <tr key={idx} className="border-b">
                    <td className="p-2 font-medium border-r">{q}º Trim</td>
                    <td className="p-2 border-r text-right bg-muted/20">{formatCurrency(data.bc_csll)}</td>
                    <td className="p-1 border-r">
                      <Input 
                        className="h-7 text-right text-[11px]" 
                        type="number" 
                        value={quarterlyRetentions[idx].csll_retido || ''} 
                        onChange={e => {
                          const newRet = [...quarterlyRetentions];
                          newRet[idx].csll_retido = parseFloat(e.target.value) || 0;
                          setQuarterlyRetentions(newRet);
                        }} 
                      />
                    </td>
                    <td className="p-2 border-r text-right text-green-600 font-bold">{formatCurrency(data.csll_pagar)}</td>
                    <td className="p-2 border-r text-right bg-muted/20">{formatCurrency(data.bc_irpj)}</td>
                    <td className="p-2 border-r text-right">{formatCurrency(data.adicional_irpj)}</td>
                    <td className="p-2 border-r text-right">{formatCurrency(data.irpj_15)}</td>
                    <td className="p-1 border-r">
                      <Input 
                        className="h-7 text-right text-[11px]" 
                        type="number" 
                        value={quarterlyRetentions[idx].irrf_retido || ''} 
                        onChange={e => {
                          const newRet = [...quarterlyRetentions];
                          newRet[idx].irrf_retido = parseFloat(e.target.value) || 0;
                          setQuarterlyRetentions(newRet);
                        }} 
                      />
                    </td>
                    <td className="p-2 text-right text-green-600 font-bold">{formatCurrency(data.irpj_pagar)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      
      <div className="flex justify-end">
        <button 
          onClick={() => onSave({ activityType, year, params, monthlyData, quarterlyRetentions })}
          className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-bold shadow-lg hover:opacity-90 transition-opacity"
        >
          Salvar Planejamento
        </button>
      </div>
    </div>
  );
};
