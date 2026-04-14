import { useState, useEffect, useCallback } from "react";
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Upload, Search, RefreshCw, ArrowUpRight, ArrowDownRight, Phone, Mail, MessageSquare, Eye, CheckCheck, Send, AlertTriangle, Users, FileText, LayoutDashboard, Database, ChevronLeft, ChevronRight, FileUp, Clock, Shield, TrendingUp, Loader2, UserPlus, CheckCircle, Download } from "lucide-react";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";

import type { ReactNode, ComponentType, CSSProperties } from "react";
import type { ParseResult } from "papaparse";

declare global {
  interface Window {
    ExcelJS?: typeof import("exceljs");
  }
}

type StatusFila =
  | "pendente"
  | "enviado"
  | "entregue"
  | "lido"
  | "respondido"
  | "pago"
  | "negativado"
  | "recebido"
  | "resposta_cliente"
  | string;

type FaseCobranca =
  | "inicial"
  | "lembrete"
  | "urgente"
  | "pre_negativacao"
  | string;

type TipoLog =
  | "disparo"
  | "lembrete"
  | "urgente"
  | "pre_negativacao"
  | "resposta_cliente"
  | "recebido"
  | string;

type StatusEntrega =
  | "pendente"
  | "enviado"
  | "entregue"
  | "lido"
  | "falhou"
  | string;

type Canal = "whatsapp" | "email" | "sms" | string;

type DevedorFila = {
  cpf?: string;
  nome?: string;
  telefone?: string;
  email?: string;
  prefeitura?: string;
  valor_divida?: string | number;
  valor_original?: string | number;
  contrato?: string;
  classificacao?: string;
  status?: StatusFila;
  tentativas?: number;
  fase_cobranca?: FaseCobranca;
  leu_mensagem?: boolean;
  ultimo_status_entrega?: string;
  created_at?: string;
};

type LogContato = {
  canal?: Canal;
  telefone?: string;
  tipo?: TipoLog;
  status_entrega?: StatusEntrega;
  timestamp_envio?: string;
  conteudo?: string;
};

type DataRepasse = {
  prefeitura?: string;
  data_repasse?: string;
  janela_dias?: number;
  mes_referencia?: string;
};

type AppData = {
  fila: DevedorFila[];
  logs: LogContato[];
  repasse: DataRepasse[];
};

type ImportRow = {
  cpf?: string;
  CPF?: string;
  nome?: string;
  Nome?: string;
  NOME?: string;
  telefone?: string;
  Telefone?: string;
  TELEFONE?: string;
  celular?: string;
  Celular?: string;
  email?: string;
  Email?: string;
  EMAIL?: string;
  valor_divida?: string | number;
  valor?: string | number;
  Valor?: string | number;
  VALOR?: string | number;
  prefeitura?: string;
  Prefeitura?: string;
  contrato?: string;
  Contrato?: string;
  CONTRATO?: string;
  classificacao?: string;
  Classificacao?: string;
  [key: string]: string | number | undefined;
};

type UploadResult = { ok: true; count: number } | { ok: false; error: string } | null;
type ManualResult = { ok: true; nome: string } | { ok: false; error: string } | null;

type MetricCardProps = {
  label: string;
  value: string | number;
  sub?: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  color: "blue" | "green" | "amber" | "red" | "purple" | "cyan";
  trend?: number;
};

type BadgeProps = {
  status?: string;
};

type ChannelIconProps = {
  canal?: string;
};

type ChartTooltipEntry = {
  name: string;
  value: string | number;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string;
};

type FieldProps = {
  label: string;
  required?: boolean;
  children: ReactNode;
};

type KanbanColumnProps = {
  title: string;
  items: DevedorFila[];
  color: string;
  icon: ComponentType<{ size?: number; style?: CSSProperties; className?: string }>;
  borderColor: string;
};

type StepStatus = "ativo" | "pendente" | "futuro";

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const toMoneyNumber = (value: string | number | undefined): number =>
  parseFloat(String(value ?? 0).replace(",", ".")) || 0;

const SUPABASE_URL = "https://ytvchpmlkvbgjimozfdd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dmNocG1sa3ZiZ2ppbW96ZmRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc1NDgzMSwiZXhwIjoyMDkxMzMwODMxfQ.k7h95OCf2Vw6YZaVVmFWjjjHkPCHhvIgAMIhlEGcCUg";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const supaFetch = async <T,>(table: string, query = ""): Promise<T> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers });
  return res.json();
};

const supaPost = async <T,>(table: string, body: T[]): Promise<unknown> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation, resolution=ignore-duplicates" },
    body: JSON.stringify(body),
  });
  return res.json();
};

async function loadExcelJS(): Promise<typeof import("exceljs")> {
  return new Promise((resolve, reject) => {
    if (window.ExcelJS) {
      resolve(window.ExcelJS);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
    script.onload = () => resolve(window.ExcelJS as typeof import("exceljs"));
    script.onerror = () => reject(new Error("Falha ao carregar ExcelJS"));
    document.head.appendChild(script);
  });
}

// ─── EXPORT XLSX — STYLED ────────────────────────────
async function exportToXLSX(data) {
  const ExcelJS = await loadExcelJS();
  const { fila, logs } = data;
  const devedoresRaw = await supaFetch("devedores", "select=cpf,classificacao&limit=500");
  const classMap = Object.fromEntries((Array.isArray(devedoresRaw) ? devedoresRaw : []).map(d => [d.cpf, d.classificacao]));
  const wb = new ExcelJS.Workbook();
  wb.creator = "Starbank";
  wb.created = new Date();
  const now = new Date();
  const dataHora = now.toLocaleString("pt-BR");

  // ── Platform palette (ARGB — no #, prefixed FF for full opacity) ──
  const C = {
    dark:    "FF403A2F",
    green:   "FF8AA696",
    greenDk: "FF6B887A",
    gray:    "FF818C84",
    midGray: "FF525952",
    light:   "FFF2F2F2",
    white:   "FFFFFFFF",
    amber:   "FFF59E0B",
    blue:    "FF3B82F6",
    rose:    "FFEF4444",
    cyan:    "FF06B6D4",
    violet:  "FF8B5CF6",
    emerald: "FF10B981",
    orange:  "FFF97316",
    border:  "FFE4E4E7",
  };

  // ── Reusable style helpers ──
  const applyTitle = (row) => {
    row.height = 32;
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.font   = { name: "Arial", bold: true, size: 14, color: { argb: C.white } };
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: C.dark } };
      cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    });
  };

  const applySubtitle = (row) => {
    row.height = 16;
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.font   = { name: "Arial", italic: true, size: 9, color: { argb: C.gray } };
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: C.light } };
      cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    });
  };

  const applySection = (row) => {
    row.height = 22;
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.font   = { name: "Arial", bold: true, size: 9, color: { argb: C.white } };
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: C.green } };
      cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    });
  };

  const applyHeader = (row) => {
    row.height = 22;
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.font   = { name: "Arial", bold: true, size: 9, color: { argb: C.white } };
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: C.green } };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = { bottom: { style: "medium", color: { argb: C.dark } } };
    });
  };

  const applyDataRow = (row, isEven) => {
    const bg = isEven ? C.light : C.white;
    row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (!cell.font?.bold && !cell.font?.color) {
        cell.font = { name: "Arial", size: 9, color: { argb: C.dark } };
      }
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.border = { bottom: { style: "thin", color: { argb: C.border } } };
      if (!cell.alignment) cell.alignment = { vertical: "middle" };
    });
  };

  const applyFooterTotal = (row) => {
    row.height = 22;
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.font   = { name: "Arial", bold: true, size: 9, color: { argb: C.white } };
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: C.dark } };
      cell.alignment = { vertical: "middle" };
    });
  };

  const coloredText = (color) => ({
    font: { name: "Arial", bold: true, size: 9, color: { argb: color } },
  });

  const STATUS_COLORS = {
    pendente:   C.amber,
    enviado:    C.blue,
    respondido: C.violet,
    lido:       C.green,
    pago:       C.emerald,
    negativado: C.rose,
  };

  const FASE_COLORS = {
    inicial:         C.gray,
    lembrete:        C.amber,
    urgente:         C.orange,
    pre_negativacao: C.rose,
  };

  const ENTREGA_COLORS = {
    lido:      C.green,
    entregue:  C.cyan,
    enviado:   C.blue,
    falhou:    C.rose,
  };

  // ── Calculations (same as before) ──
  const fmtBRL   = (v) => parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct      = (n, d) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "0%");
  const total      = fila.length;
  const pendentes  = fila.filter(f => f.status === "pendente").length;
  const enviados   = fila.filter(f => f.status === "enviado").length;
  const respondidos= fila.filter(f => f.status === "respondido").length;
  const pagos      = fila.filter(f => f.status === "pago").length;
  const disparos   = logs.filter(l => l.tipo === "disparo");
  const totalDisp  = disparos.length;
  const lidosLog   = disparos.filter(l => l.status_entrega === "lido").length;
  const falhou     = disparos.filter(l => l.status_entrega === "falhou").length;
  const entregues  = disparos.filter(l => l.status_entrega === "entregue" || l.status_entrega === "lido").length;
  const valorTotal = fila.reduce((s, f) => s + parseFloat(f.valor_divida || 0), 0);
  const valorPago  = fila.filter(f => f.status === "pago").reduce((s, f) => s + parseFloat(f.valor_divida || 0), 0);
  const valorAberto= valorTotal - valorPago;

  // ══════════════════════════════════════════════
  // ABA 1 — RESUMO EXECUTIVO
  // ══════════════════════════════════════════════
  const wsR = wb.addWorksheet("Resumo Executivo");
  wsR.columns = [{ width: 36 }, { width: 4 }, { width: 24 }];

  // Title + date
  wsR.mergeCells("A1:C1");
  applyTitle(wsR.addRow(["STARBANK — RELATÓRIO DE COBRANÇA"]));
  // Trick: addRow returns row 1 when sheet is empty → use getRow
  // Re-do properly:
  wsR.getRow(1).getCell(1).value = "STARBANK — RELATÓRIO DE COBRANÇA";
  applyTitle(wsR.getRow(1));

  wsR.mergeCells("A2:C2");
  wsR.getRow(2).getCell(1).value = `Gerado em: ${dataHora}`;
  applySubtitle(wsR.getRow(2));

  wsR.addRow([]); // spacer row 3

  // Helper: add section block
  const addResumoSection = (title, rows) => {
    const secRow = wsR.addRow([title, "", "VALOR"]);
    applySection(secRow);
    rows.forEach(([label, , value], idx) => {
      const r = wsR.addRow([label, "", value]);
      applyDataRow(r, idx % 2 === 0);
      // label style override
      r.getCell(1).font      = { name: "Arial", size: 9, color: { argb: C.midGray } };
      r.getCell(1).fill      = r.getCell(2).fill; // inherit bg
      // value style
      r.getCell(3).font      = { name: "Arial", bold: true, size: 9, color: { argb: C.dark } };
      r.getCell(3).alignment = { horizontal: "right", vertical: "middle" };
    });
    wsR.addRow([]); // spacer
  };

  addResumoSection("INDICADORES GERAIS", [
    ["Total de Devedores na Fila", "", total],
    ["Pendentes",                  "", pendentes],
    ["Enviados",                   "", enviados],
    ["Respondidos",                "", respondidos],
    ["Pagos / Recuperados",        "", pagos],
  ]);

  addResumoSection("MÉTRICAS DE ALCANCE", [
    ["Taxa de Alcance",     "", pct(total - pendentes, total)],
    ["Taxa de Leitura",     "", pct(lidosLog, totalDisp)],
    ["Taxa de Resposta",    "", pct(respondidos, total)],
    ["Total de Disparos",   "", totalDisp],
    ["Mensagens Entregues", "", entregues],
    ["Mensagens Lidas",     "", lidosLog],
    ["Falhou",              "", falhou],
  ]);

  addResumoSection("FINANCEIRO (R$)", [
    ["Carteira Total",     "", `R$ ${fmtBRL(valorTotal)}`],
    ["Valor Recuperado",   "", `R$ ${fmtBRL(valorPago)}`],
    ["Valor em Aberto",    "", `R$ ${fmtBRL(valorAberto)}`],
    ["Taxa de Recuperação","", pct(valorPago, valorTotal)],
  ]);

  addResumoSection("FASES DE COBRANÇA", [
    ["Inicial",          "", fila.filter(f => f.fase_cobranca === "inicial").length],
    ["Lembrete",         "", fila.filter(f => f.fase_cobranca === "lembrete").length],
    ["Urgente",          "", fila.filter(f => f.fase_cobranca === "urgente").length],
    ["Pré-negativação",  "", fila.filter(f => f.fase_cobranca === "pre_negativacao").length],
  ]);

  const prefMap = fila.reduce((acc, f) => {
    const k = f.prefeitura || "—";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  addResumoSection("DEVEDORES POR PREFEITURA", Object.entries(prefMap).map(([p, q]) => [p, "", q]));

  // ══════════════════════════════════════════════
  // ABA 2 — DEVEDORES
  // ══════════════════════════════════════════════
  const wsD = wb.addWorksheet("Devedores");
  wsD.columns = [
    { width: 30 }, { width: 14 }, { width: 16 }, { width: 28 }, { width: 16 },
    { width: 20 }, { width: 13 }, { width: 16 }, { width: 11 },
    { width: 9  }, { width: 18 }, { width: 14 },
  ];

  wsD.mergeCells("A1:L1");
  wsD.getRow(1).getCell(1).value = `STARBANK — LISTA DE DEVEDORES — ${dataHora}`;
  applyTitle(wsD.getRow(1));

  wsD.addRow([]); // spacer

  const devHeaders = ["Nome", "CPF", "Telefone", "E-mail", "Prefeitura",
    "Valor da Dívida (R$)", "Status", "Fase", "Tentativas", "Leu?", "Contrato", "Classificação"];
  const devHRow = wsD.addRow(devHeaders);
  applyHeader(devHRow);

  fila.forEach((f, i) => {
    const r = wsD.addRow([
      f.nome         || "",
      f.cpf          || "",
      f.telefone     || "",
      f.email        || "",
      f.prefeitura   || "",
      parseFloat(f.valor_divida || 0),
      f.status       || "",
      f.fase_cobranca|| "",
      f.tentativas   || 0,
      f.leu_mensagem ? "Sim" : "Não",
      f.contrato     || "",
      classMap[f.cpf] || f.classificacao || "",
    ]);

    applyDataRow(r, i % 2 === 0);

    // Currency format
    r.getCell(6).numFmt    = '"R$ "#,##0.00';
    r.getCell(6).alignment = { horizontal: "right", vertical: "middle" };
    r.getCell(9).alignment = { horizontal: "center", vertical: "middle" };
    r.getCell(10).alignment= { horizontal: "center", vertical: "middle" };

    // Status color
    if (STATUS_COLORS[f.status])
      r.getCell(7).font = { name: "Arial", bold: true, size: 9, color: { argb: STATUS_COLORS[f.status] } };

    // Fase color
    if (FASE_COLORS[f.fase_cobranca])
      r.getCell(8).font = { name: "Arial", bold: true, size: 9, color: { argb: FASE_COLORS[f.fase_cobranca] } };
  });

  // Total footer
  wsD.addRow([]);
  const devTotalRow = wsD.addRow([
    `TOTAL — ${fila.length} registros`, "", "", "", "",
    valorTotal, "", "", "", "", "", "",
  ]);
  applyFooterTotal(devTotalRow);
  devTotalRow.getCell(6).numFmt    = '"R$ "#,##0.00';
  devTotalRow.getCell(6).alignment = { horizontal: "right", vertical: "middle" };

  wsD.views = [{ state: "frozen", ySplit: 3 }];

  // ══════════════════════════════════════════════
  // ABA 3 — LOG DE CONTATOS
  // ══════════════════════════════════════════════
  const wsL = wb.addWorksheet("Log de Contatos");
  wsL.columns = [
    { width: 14 }, { width: 16 }, { width: 12 },
    { width: 18 }, { width: 22 }, { width: 60 },
  ];

  wsL.mergeCells("A1:F1");
  wsL.getRow(1).getCell(1).value = `STARBANK — LOG DE CONTATOS — ${dataHora}`;
  applyTitle(wsL.getRow(1));

  wsL.addRow([]);

  const logHeaders = ["Canal", "Telefone", "Tipo", "Status de Entrega", "Data/Hora", "Conteúdo da Mensagem"];
  const logHRow = wsL.addRow(logHeaders);
  applyHeader(logHRow);

  logs.forEach((l, i) => {
    const r = wsL.addRow([
      l.canal           || "",
      l.telefone        || "",
      l.tipo            || "",
      l.status_entrega  || "",
      l.timestamp_envio ? new Date(l.timestamp_envio).toLocaleString("pt-BR") : "",
      l.conteudo        || "",
    ]);
    applyDataRow(r, i % 2 === 0);

    // Delivery status color
    if (ENTREGA_COLORS[l.status_entrega])
      r.getCell(4).font = { name: "Arial", bold: true, size: 9, color: { argb: ENTREGA_COLORS[l.status_entrega] } };
  });

  wsL.views = [{ state: "frozen", ySplit: 3 }];

  // ── Download ──
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a");
  a.href       = url;
  a.download   = `Starbank_Cobranca_${now.toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════
// ── REST OF THE COMPONENT (unchanged) ────────────────────────
// ══════════════════════════════════════════════════════════════

function MetricCard({ label, value, sub, icon: Icon, color, trend }) {
  const colors = {
    blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20",
    green: "from-emerald-500/10 to-emerald-600/5 border-[#8AA696]/30",
    amber: "from-amber-500/10 to-amber-600/5 border-amber-500/20",
    red: "from-rose-500/10 to-rose-600/5 border-rose-500/20",
    purple: "from-violet-500/10 to-violet-600/5 border-violet-500/20",
    cyan: "from-cyan-500/10 to-cyan-600/5 border-cyan-500/20",
  };
  const iconColors = {
    blue: "text-blue-400", green: "text-[#8AA696]", amber: "text-amber-400",
    red: "text-rose-400", purple: "text-violet-400", cyan: "text-cyan-400",
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl bg-[#8AA696]/10 flex items-center justify-center ${iconColors[color]}`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? "text-[#8AA696]" : "text-rose-400"}`}>
            {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <div className="text-3xl font-bold text-[#403A2F] tracking-tight">{value}</div>
        <div className="text-xs text-[#818C84] mt-1">{label}</div>
      </div>
      {sub && <div className="text-[11px] text-[#818C84]">{sub}</div>}
    </div>
  );
}

function Badge({ status }) {
  const map = {
    pendente: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    enviado: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    entregue: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    lido: "bg-[#8AA696]/10 text-[#8AA696] border-[#8AA696]/30",
    respondido: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    pago: "bg-[#8AA696]/10 text-[#8AA696] border-[#8AA696]/30",
    negativado: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    inicial: "bg-zinc-500/10 text-[#818C84] border-zinc-500/20",
    lembrete: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    urgente: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    pre_negativacao: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${map[status] || "bg-zinc-500/10 text-[#818C84] border-zinc-500/20"}`}>
      {status?.replace("_", " ") || "—"}
    </span>
  );
}

function ChannelIcon({ canal }) {
  if (canal === "whatsapp") return <MessageSquare size={14} className="text-[#8AA696]" />;
  if (canal === "email") return <Mail size={14} className="text-blue-400" />;
  if (canal === "sms") return <Phone size={14} className="text-amber-400" />;
  return <Send size={14} className="text-[#818C84]" />;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#F2F2F2] border border-zinc-300 rounded-lg px-3 py-2 shadow-xl">
      <div className="text-xs text-[#818C84] mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-sm font-semibold text-[#403A2F]">{p.name}: {p.value}</div>
      ))}
    </div>
  );
}

function KanbanColumn({
  title,
  items,
  color,
  icon: Icon,
  borderColor,
}: {
  title: string;
  items: DevedorFila[];
  color: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>;
  borderColor: string;
}) {
  return (
    <div className="flex-1 min-w-[180px]">
      <div className={`rounded-2xl border ${borderColor} bg-white overflow-hidden`}>
        <div className={`px-4 py-3 flex items-center gap-2 border-b ${borderColor}`} style={{ background: color + "08" }}>
          <Icon size={15} style={{ color }} />
          <span className="text-sm font-semibold text-[#403A2F]">{title}</span>
          <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: color + "15", color }}>
            {items.length}
          </span>
        </div>
        <div className="p-2 space-y-1.5 max-h-[300px] overflow-y-auto">
          {items.length === 0 && <div className="text-center py-8 text-xs text-[#818C84]">Nenhum devedor</div>}
          {items.slice(0, 10).map((f: DevedorFila, i: number) => (
            <div
              key={i}
              className="bg-[#F7F7F6] border border-zinc-200 rounded-2xl px-3 py-2.5 hover:bg-white hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#403A2F] truncate flex-1">
                  {f.nome || "Sem nome"}
                </span>
                <span className="text-[11px] font-bold text-[#525952] whitespace-nowrap">
                  {parseFloat(f.valor_divida || 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2 text-[10px] text-[#818C84]">
                <span className="font-mono">
                  {f.telefone?.slice(-4) ? `••${f.telefone.slice(-4)}` : "—"}
                </span>
                <span>•</span>
                <span>Tent. {f.tentativas || 0}</span>
                {f.leu_mensagem && <Eye size={10} className="text-[#8AA696] ml-auto" />}
              </div>
            </div>
          ))}
          {items.length > 10 && <div className="text-center py-2 text-[10px] text-[#818C84]">+{items.length - 10} mais</div>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[#525952]">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-[#403A2F] placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 transition-colors";

function CadastroManual({ onRefresh }) {
  const empty = {
    cpf: "", nome: "", telefone: "", email: "",
    valor_divida: "", contrato: "", prefeitura: "Ponta Grossa", classificacao: "",
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
    setResult(null);
  };

  const fmtCPF = (v) => v.replace(/\D/g, "").slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  const fmtPhone = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 13);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  };

  const validate = () => {
    const e = {};
    if (!form.cpf.replace(/\D/g, "")) e.cpf = "CPF obrigatório";
    if (!form.nome.trim()) e.nome = "Nome obrigatório";
    if (!form.telefone.replace(/\D/g, "")) e.telefone = "Telefone obrigatório";
    if (!form.valor_divida || isNaN(parseFloat(form.valor_divida.replace(",", ".")))) e.valor_divida = "Valor inválido";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    setResult(null);
    try {
      const cpfClean = form.cpf.replace(/\D/g, "");
      const telefoneClean = form.telefone.replace(/\D/g, "");
      const valor = parseFloat(form.valor_divida.replace(",", "."));
      await supaPost("devedores", [{
        cpf: cpfClean, nome: form.nome.trim(), telefone: telefoneClean,
        email: form.email.trim(), valor_divida: valor, valor_original: valor,
        contrato: form.contrato.trim(), prefeitura: form.prefeitura,
        classificacao: form.classificacao.trim(), status: "ativo",
      }]);
      await supaPost("fila_cobranca", [{
        cpf: cpfClean, nome: form.nome.trim(), telefone: telefoneClean,
        email: form.email.trim(), valor_divida: valor,
        contrato: form.contrato.trim(), prefeitura: form.prefeitura,
        status: "pendente", tentativas: 0, fase_cobranca: "inicial",
      }]);
      setResult({ ok: true, nome: form.nome.trim() });
      setForm(empty);
      onRefresh();
    } catch (err) {
      setResult({ ok: false, error: err.message });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {result?.ok && (
        <div className="flex items-center gap-3 bg-emerald-500/5 border border-[#8AA696]/30 rounded-2xl px-5 py-4">
          <CheckCircle size={18} className="text-[#8AA696] flex-shrink-0" />
          <span className="text-sm text-[#525952]">
            <span className="font-semibold text-[#403A2F]">{result.nome}</span> adicionado à fila de cobrança com sucesso!
          </span>
        </div>
      )}
      {result?.ok === false && (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl px-5 py-4 text-sm text-rose-400">
          Erro: {result.error}
        </div>
      )}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-[#8AA696]/10 flex items-center justify-center">
            <UserPlus size={16} className="text-[#8AA696]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#403A2F]">Dados do Devedor</div>
            <div className="text-xs text-[#818C84]">Campos com * são obrigatórios</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="CPF" required>
            <input className={`${inputCls} ${errors.cpf ? "border-rose-400" : ""}`} placeholder="000.000.000-00"
              value={form.cpf} onChange={e => set("cpf", fmtCPF(e.target.value))} />
            {errors.cpf && <span className="text-xs text-rose-400">{errors.cpf}</span>}
          </Field>
          <Field label="Nome completo" required>
            <input className={`${inputCls} ${errors.nome ? "border-rose-400" : ""}`} placeholder="Ex: João da Silva"
              value={form.nome} onChange={e => set("nome", e.target.value)} />
            {errors.nome && <span className="text-xs text-rose-400">{errors.nome}</span>}
          </Field>
          <Field label="Telefone (WhatsApp)" required>
            <input className={`${inputCls} ${errors.telefone ? "border-rose-400" : ""}`} placeholder="(42) 99999-9999"
              value={form.telefone} onChange={e => set("telefone", fmtPhone(e.target.value))} />
            {errors.telefone && <span className="text-xs text-rose-400">{errors.telefone}</span>}
          </Field>
          <Field label="E-mail">
            <input className={inputCls} placeholder="joao@email.com" type="email"
              value={form.email} onChange={e => set("email", e.target.value)} />
          </Field>
          <Field label="Valor da dívida (R$)" required>
            <input className={`${inputCls} ${errors.valor_divida ? "border-rose-400" : ""}`} placeholder="1.250,00"
              value={form.valor_divida} onChange={e => set("valor_divida", e.target.value)} />
            {errors.valor_divida && <span className="text-xs text-rose-400">{errors.valor_divida}</span>}
          </Field>
          <Field label="Contrato">
            <input className={inputCls} placeholder="Ex: CTR-2024-00123"
              value={form.contrato} onChange={e => set("contrato", e.target.value)} />
          </Field>
          <Field label="Prefeitura">
            <select className={inputCls} value={form.prefeitura} onChange={e => set("prefeitura", e.target.value)}>
              <option value="Ponta Grossa">Ponta Grossa</option>
              <option value="Curitiba">Curitiba</option>
              <option value="Londrina">Londrina</option>
              <option value="Maringá">Maringá</option>
              <option value="Cascavel">Cascavel</option>
            </select>
          </Field>
          <Field label="Classificação">
            <select className={inputCls} value={form.classificacao} onChange={e => set("classificacao", e.target.value)}>
              <option value="">Sem classificação</option>
              <option value="A">A — Alta prioridade</option>
              <option value="B">B — Média prioridade</option>
              <option value="C">C — Baixa prioridade</option>
            </select>
          </Field>
        </div>
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-zinc-200">
          <button onClick={() => { setForm(empty); setErrors({}); setResult(null); }}
            className="text-sm text-[#818C84] hover:text-[#525952] transition-colors">
            Limpar campos
          </button>
          <button onClick={handleSave} disabled={saving}
            className="bg-[#8AA696] hover:bg-[#818C84] disabled:opacity-50 text-[#403A2F] px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {saving ? "Salvando..." : "Adicionar à fila"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadPage({ onRefresh }) {
  const [tab, setTab] = useState("manual");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const processFile = (f) => {
    setFile(f);
    setResult(null);
    const ext = f.name.split(".").pop().toLowerCase();
    if (ext === "csv" || ext === "txt") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const parsed = Papa.parse(e.target.result, { header: true, skipEmptyLines: true });
        setPreview(parsed.data.slice(0, 10));
      };
      reader.readAsText(f);
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        setPreview(data.slice(0, 10));
      };
      reader.readAsArrayBuffer(f);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!preview.length) return;
    setUploading(true);
    setResult(null);
    try {
      const devedores = preview.map(row => ({
        cpf: row.cpf || row.CPF || "",
        nome: row.nome || row.Nome || row.NOME || "",
        telefone: row.telefone || row.Telefone || row.TELEFONE || row.celular || row.Celular || "",
        email: row.email || row.Email || row.EMAIL || "",
        valor_divida: parseFloat(row.valor_divida || row.valor || row.Valor || row.VALOR || 0),
        prefeitura: row.prefeitura || row.Prefeitura || "Ponta Grossa",
        contrato: row.contrato || row.Contrato || row.CONTRATO || "",
        classificacao: row.classificacao || row.Classificacao || "",
      }));
      await supaPost("devedores", devedores.map(d => ({ ...d, valor_original: d.valor_divida, status: "ativo" })));
      await supaPost("fila_cobranca", devedores.map(d => ({
        cpf: d.cpf, telefone: d.telefone, email: d.email, nome: d.nome,
        prefeitura: d.prefeitura, valor_divida: d.valor_divida, contrato: d.contrato,
        status: "pendente", tentativas: 0, fase_cobranca: "inicial",
      })));
      setResult({ ok: true, count: devedores.length });
      onRefresh();
    } catch (err) {
      setResult({ ok: false, error: err.message });
    }
    setUploading(false);
  };

  const cols = preview.length > 0 ? Object.keys(preview[0]) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#403A2F]">Adicionar Devedores</h1>
        <p className="text-[#818C84] text-sm mt-1">Cadastre manualmente ou importe via arquivo</p>
      </div>
      <div className="flex gap-1 bg-white border border-zinc-200 rounded-xl p-1 w-fit">
        {[
          { id: "manual", label: "Cadastro Manual", icon: UserPlus },
          { id: "arquivo", label: "Importar Arquivo", icon: FileUp },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? "bg-[#8AA696]/15 text-[#403A2F]" : "text-[#818C84] hover:text-[#525952]"
            }`}>
            <t.icon size={15} />{t.label}
          </button>
        ))}
      </div>
      {tab === "manual" && <CadastroManual onRefresh={onRefresh} />}
      {tab === "arquivo" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white border border-zinc-200 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-[#525952] mb-3 flex items-center gap-2"><FileText size={16} /> Campos esperados</h3>
              <div className="space-y-2 text-xs">
                {["cpf *", "nome *", "telefone *", "email", "valor_divida *", "prefeitura", "contrato", "classificacao"].map(f => (
                  <div key={f} className={`flex items-center gap-2 ${f.includes("*") ? "text-[#403A2F]" : "text-[#818C84]"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${f.includes("*") ? "bg-emerald-400" : "bg-zinc-600"}`} />
                    <span className="font-mono">{f.replace(" *", "")}</span>
                    {f.includes("*") && <span className="text-rose-400 text-[10px]">obrigatório</span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2">
              <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${dragOver ? "border-blue-500 bg-blue-500/5" : "border-zinc-300 hover:border-zinc-500"}`}
                onClick={() => document.getElementById("fileInput").click()}>
                <input id="fileInput" type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden"
                  onChange={e => e.target.files[0] && processFile(e.target.files[0])} />
                <FileUp size={40} className="mx-auto text-[#818C84] mb-4" />
                <div className="text-[#403A2F] font-medium">
                  {file ? file.name : "Arraste o arquivo aqui ou clique para selecionar"}
                </div>
                <div className="text-[#818C84] text-xs mt-2">XLSX, CSV ou TXT — máximo 10MB</div>
              </div>
            </div>
          </div>
          {preview.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#525952]">Prévia — {preview.length} registros</h3>
                <button onClick={handleUpload} disabled={uploading}
                  className="bg-[#8AA696] hover:bg-[#818C84] disabled:opacity-50 text-[#403A2F] px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploading ? "Importando..." : `Importar ${preview.length} devedores`}
                </button>
              </div>
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[#818C84] uppercase tracking-wider bg-[#F2F2F2]">
                        {cols.map(c => <th key={c} className="text-left py-2.5 px-3">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t border-zinc-200">
                          {cols.map(c => <td key={c} className="py-2 px-3 text-[#818C84] max-w-[200px] truncate">{row[c]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {result && (
            <div className={`rounded-2xl p-5 border ${result.ok ? "bg-emerald-500/5 border-[#8AA696]/30" : "bg-rose-500/5 border-rose-500/20"}`}>
              <div className={`font-semibold ${result.ok ? "text-[#8AA696]" : "text-rose-400"}`}>
                {result.ok ? `${result.count} devedores importados com sucesso` : `Erro: ${result.error}`}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DashboardPage({ data }: { data: AppData }) {
  const { fila, logs } = data;
  const total = fila.length;
  const pendentes = fila.filter(f => f.status === "pendente").length;
  const enviados = fila.filter(f => f.status === "enviado").length;
  const respondidos = fila.filter(f => f.status === "respondido").length;
  const pagos = fila.filter(f => f.status === "pago").length;

  const disparos = logs.filter(l => l.tipo === "disparo");
  const totalDisparos = disparos.length;
  const entregues = disparos.filter(l => l.status_entrega === "entregue" || l.status_entrega === "lido").length;
  const lidosLog = disparos.filter(l => l.status_entrega === "lido").length;
  const falhou = disparos.filter(l => l.status_entrega === "falhou").length;

  const taxaAlcance = total > 0 ? Math.round(((total - pendentes) / total) * 100) : 0;
  const taxaLeitura = totalDisparos > 0 ? Math.round((lidosLog / totalDisparos) * 100) : 0;
  const taxaResposta = total > 0 ? Math.round((respondidos / total) * 100) : 0;

  const statusData = [
    { name: "Pendente", value: pendentes, color: "#f59e0b" },
    { name: "Enviado", value: enviados, color: "#3b82f6" },
    { name: "Respondido", value: respondidos, color: "#8b5cf6" },
    { name: "Pago", value: pagos, color: "#8AA696" },
  ].filter(d => d.value > 0);

  const entregaData = [
    { name: "Enviado", value: Math.max(0, totalDisparos - entregues - lidosLog - falhou), color: "#3b82f6" },
    { name: "Entregue", value: entregues, color: "#06b6d4" },
    { name: "Lido", value: lidosLog, color: "#8AA696" },
    { name: "Falhou", value: falhou, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const valorTotal = fila.reduce((s, f) => s + parseFloat(f.valor_divida || 0), 0);
  const valorPago = fila.filter(f => f.status === "pago").reduce((s, f) => s + parseFloat(f.valor_divida || 0), 0);

  const kanbanCols = [
    { title: "Inicial", items: fila.filter(f => f.fase_cobranca === "inicial" && f.status !== "pago"), color: "#3b82f6", icon: Send, borderColor: "border-blue-200" },
    { title: "Lembrete", items: fila.filter(f => f.fase_cobranca === "lembrete" && f.status !== "pago"), color: "#f59e0b", icon: Clock, borderColor: "border-amber-200" },
    { title: "Urgente", items: fila.filter(f => f.fase_cobranca === "urgente" && f.status !== "pago"), color: "#f97316", icon: AlertTriangle, borderColor: "border-orange-200" },
    { title: "Pré-negat.", items: fila.filter(f => f.fase_cobranca === "pre_negativacao" && f.status !== "pago"), color: "#ef4444", icon: Shield, borderColor: "border-rose-200" },
    { title: "Pago", items: fila.filter(f => f.status === "pago"), color: "#8AA696", icon: CheckCheck, borderColor: "border-[#8AA696]/30" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#403A2F]">Visão Geral</h1>
        <p className="text-[#818C84] text-sm mt-1">Métricas em tempo real da operação de cobrança</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard label="Total na fila" value={total} icon={Users} color="blue" sub="Devedores ativos" />
        <MetricCard label="Taxa de Alcance" value={`${taxaAlcance}%`} icon={Send} color="cyan" sub={`${total - pendentes} de ${total} notificados`} />
        <MetricCard label="Taxa de Leitura" value={`${taxaLeitura}%`} icon={Eye} color="green" sub={`${lidosLog} de ${totalDisparos} lidos`} />
        <MetricCard label="Taxa de Resposta" value={`${taxaResposta}%`} icon={MessageSquare} color="purple" sub={`${respondidos} respostas`} />
        <MetricCard label="Recuperados" value={pagos} icon={CheckCheck} color="green" sub={`R$ ${valorPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
        <MetricCard label="Valor em Aberto" value={`R$ ${(valorTotal - valorPago).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} icon={AlertTriangle} color="red" sub="Carteira inadimplente" />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[#525952] mb-3">Pipeline de Cobrança</h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {kanbanCols.map((col, i) => <KanbanColumn key={i} {...col} />)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[#525952] mb-4">Status da Fila</h3>
          <div className="flex items-center">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2.5 pl-4">
              {statusData.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-xs text-[#818C84] flex-1">{d.name}</span>
                  <span className="text-xs font-bold text-[#403A2F]">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[#525952] mb-4">Status de Entrega</h3>
          <div className="flex items-center">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie data={entregaData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {entregaData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2.5 pl-4">
              {entregaData.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-xs text-[#818C84] flex-1">{d.name}</span>
                  <span className="text-xs font-bold text-[#403A2F]">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-[#525952] mb-4">Últimos Contatos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#818C84] text-xs uppercase tracking-wider border-b border-zinc-200">
                <th className="text-left py-3 px-3">Canal</th>
                <th className="text-left py-3 px-3">Telefone</th>
                <th className="text-left py-3 px-3">Tipo</th>
                <th className="text-left py-3 px-3">Entrega</th>
                <th className="text-left py-3 px-3">Data</th>
                <th className="text-left py-3 px-3">Conteúdo</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 8).map((l, i) => (
                <tr key={i} className="border-b border-zinc-100 hover:bg-[#F2F2F2]/50 transition-colors">
                  <td className="py-2.5 px-3"><ChannelIcon canal={l.canal} /></td>
                  <td className="py-2.5 px-3 text-[#525952] font-mono text-xs">{l.telefone || "—"}</td>
                  <td className="py-2.5 px-3"><Badge status={l.tipo} /></td>
                  <td className="py-2.5 px-3"><Badge status={l.status_entrega} /></td>
                  <td className="py-2.5 px-3 text-[#818C84] text-xs">{l.timestamp_envio ? new Date(l.timestamp_envio).toLocaleString("pt-BR") : "—"}</td>
                  <td className="py-2.5 px-3 text-[#818C84] text-xs max-w-[300px] truncate">{l.conteudo?.substring(0, 60) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DevedoresPage({ data, onRefresh }: { data: AppData; onRefresh: () => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [exporting, setExporting] = useState(false);
  const { fila, logs } = data;
  const telefonesLeram = new Set(logs.filter(l => l.status_entrega === "lido").map(l => l.telefone));
  const filtered = fila.filter(f => {
    const matchSearch = !search || f.nome?.toLowerCase().includes(search.toLowerCase()) || f.cpf?.includes(search) || f.telefone?.includes(search);
    const matchStatus = filterStatus === "todos" || f.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToXLSX(data);
    } catch (err) {
      console.error("Export error:", err);
      alert("Erro ao gerar XLSX: " + err.message);
    }
    setExporting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#403A2F]">Devedores</h1>
          <p className="text-[#818C84] text-sm mt-1">{filtered.length} registros</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || fila.length === 0}
          className="flex items-center gap-2 bg-white border border-zinc-200 hover:border-[#8AA696] hover:bg-[#8AA696]/5 disabled:opacity-40 disabled:cursor-not-allowed text-[#525952] hover:text-[#403A2F] px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm"
        >
          {exporting
            ? <Loader2 size={15} className="animate-spin text-[#8AA696]" />
            : <Download size={15} className="text-[#8AA696]" />}
          {exporting ? "Gerando..." : "Exportar XLSX"}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#818C84]" />
          <input type="text" placeholder="Buscar por nome, CPF ou telefone..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#403A2F] placeholder:text-[#8AA696] focus:outline-none focus:border-zinc-600 transition-colors" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-[#403A2F] focus:outline-none focus:border-zinc-600">
          <option value="todos">Todos</option>
          <option value="pendente">Pendente</option>
          <option value="enviado">Enviado</option>
          <option value="respondido">Respondido</option>
          <option value="lido">Lido</option>
          <option value="pago">Pago</option>
        </select>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#818C84] text-xs uppercase tracking-wider bg-[#F2F2F2]">
                <th className="text-left py-3 px-4">Nome</th>
                <th className="text-left py-3 px-4">CPF</th>
                <th className="text-left py-3 px-4">Telefone</th>
                <th className="text-left py-3 px-4">Prefeitura</th>
                <th className="text-right py-3 px-4">Valor</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Fase</th>
                <th className="text-center py-3 px-4">Tent.</th>
                <th className="text-center py-3 px-4">Leu</th>
                <th className="text-left py-3 px-4">Contrato</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((f, i) => (
                <tr key={i} className="border-t border-zinc-200 hover:bg-[#F2F2F2]/50 transition-colors">
                  <td className="py-3 px-4 text-[#403A2F] font-medium">{f.nome || "—"}</td>
                  <td className="py-3 px-4 text-[#818C84] font-mono text-xs">{f.cpf || "—"}</td>
                  <td className="py-3 px-4 text-[#818C84] font-mono text-xs">{f.telefone || "—"}</td>
                  <td className="py-3 px-4 text-[#818C84] text-xs">{f.prefeitura || "—"}</td>
                  <td className="py-3 px-4 text-right text-[#403A2F] font-semibold">
                    {parseFloat(f.valor_divida || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="py-3 px-4"><Badge status={f.status} /></td>
                  <td className="py-3 px-4"><Badge status={f.fase_cobranca} /></td>
                  <td className="py-3 px-4 text-center text-[#818C84]">{f.tentativas || 0}</td>
                  <td className="py-3 px-4 text-center">
                    {(f.leu_mensagem || telefonesLeram.has(f.telefone)) ? <Eye size={14} className="text-[#8AA696] mx-auto" /> : <span className="text-[#818C84]">—</span>}
                  </td>
                  <td className="py-3 px-4 text-[#818C84] text-xs">{f.contrato || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SistemaPage({ data }: { data: AppData }) {
  const { repasse } = data;
  const repasseAtual = repasse?.[0];
  const steps = [
    { icon: Database, title: "Extração de Base", desc: "Banksoft + Hatch → importação via CSV/XLSX ou cadastro manual", status: "ativo", color: "emerald" },
    { icon: TrendingUp, title: "Simulação Financeira", desc: "Cálculo de dívida, parcelas e condições", status: "futuro", color: "zinc" },
    { icon: Send, title: "Disparo Multicanal", desc: "WhatsApp ativo · E-mail futuro · SMS futuro", status: "ativo", color: "emerald" },
    { icon: Clock, title: "Conciliação de Repasse", desc: repasseAtual ? `${repasseAtual.prefeitura} · ${repasseAtual.data_repasse} · Janela ${repasseAtual.janela_dias} dias` : "Sem repasse cadastrado", status: repasseAtual ? "ativo" : "pendente", color: repasseAtual ? "emerald" : "amber" },
    { icon: RefreshCw, title: "Follow-up & Baixa", desc: "Reativação a cada 3 dias · Baixa via operador WhatsApp", status: "ativo", color: "emerald" },
    { icon: AlertTriangle, title: "Negativação", desc: "Após trilha documentada · Cobrança continua", status: "futuro", color: "zinc" },
    { icon: Shield, title: "Jurídico", desc: "Trilha de contatos como prova extrajudicial", status: "ativo", color: "emerald" },
  ];
  const statusColors = { ativo: "bg-emerald-500", pendente: "bg-amber-500", futuro: "bg-zinc-600" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#403A2F]">Sistema de Cobrança</h1>
        <p className="text-[#818C84] text-sm mt-1">Visão completa do pipeline — Piloto Ponta Grossa</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-[#525952] mb-4">Pipeline Operacional</h3>
          {steps.map((s, i) => (
            <div key={i} className="flex gap-4 items-start">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-xl border border-zinc-300 flex items-center justify-center ${s.color === "emerald" ? "bg-[#8AA696]/10" : s.color === "amber" ? "bg-amber-500/10" : "bg-[#F2F2F2]"}`}>
                  <s.icon size={18} className={s.color === "emerald" ? "text-[#8AA696]" : s.color === "amber" ? "text-amber-400" : "text-[#818C84]"} />
                </div>
                {i < steps.length - 1 && <div className="w-px h-8 bg-[#F2F2F2]" />}
              </div>
              <div className="pb-6">
                <div className="flex items-center gap-2">
                  <span className="text-[#403A2F] font-medium text-sm">{s.title}</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${statusColors[s.status]}`} />
                </div>
                <div className="text-[#818C84] text-xs mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#525952] mb-4">Configuração Atual</h3>
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
            <div className="text-xs text-[#818C84] uppercase tracking-wider font-semibold">Proteções</div>
            {[
              { label: "Throttle Anti-Ban", value: "45-120s entre disparos", ok: true },
              { label: "Horário Comercial", value: "08:00 — 20:00 BRT", ok: true },
              { label: "Janela de Repasse", value: repasseAtual ? `${repasseAtual.janela_dias} dias` : "Não cadastrado", ok: !!repasseAtual },
              { label: "Máx. Tentativas", value: "5 por devedor", ok: true },
              { label: "Follow-up", value: "A cada 3 dias", ok: true },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-[#818C84] text-sm">{p.label}</span>
                <span className={`text-xs font-medium ${p.ok ? "text-[#8AA696]" : "text-amber-400"}`}>{p.value}</span>
              </div>
            ))}
          </div>
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
            <div className="text-xs text-[#818C84] uppercase tracking-wider font-semibold">Escalada de Pressão</div>
            {[
              { fase: "1ª — Inicial", tom: "Informativo, amigável", color: "bg-blue-500" },
              { fase: "2ª — Lembrete", tom: "Direto, lembrando", color: "bg-amber-500" },
              { fase: "3ª — Urgente", tom: "Firme, mencionando consequências", color: "bg-orange-500" },
              { fase: "4ª — Pré-negativação", tom: "Formal, último aviso", color: "bg-rose-500" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${f.color}`} />
                <div>
                  <div className="text-[#403A2F] text-xs font-medium">{f.fase}</div>
                  <div className="text-[#818C84] text-[11px]">{f.tom}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AppData>({ fila: [], logs: [], repasse: [] });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [fila, logs, repasse] = await Promise.all([
        supaFetch("fila_cobranca", "order=created_at.desc&limit=500"),
        supaFetch("log_contatos", "order=timestamp_envio.desc&limit=200"),
        supaFetch("datas_repasse", `prefeitura=eq.Ponta%20Grossa&mes_referencia=eq.${new Date().toISOString().slice(0, 7)}`),
      ]);

      setData({
        fila: Array.isArray(fila) ? (fila as DevedorFila[]) : [],
        logs: Array.isArray(logs) ? (logs as LogContato[]) : [],
        repasse: Array.isArray(repasse) ? (repasse as DataRepasse[]) : [],
      });
    } catch (e) {
      console.error("Fetch error:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "devedores", label: "Devedores", icon: Users },
    { id: "upload", label: "Adicionar", icon: Upload },
    { id: "sistema", label: "Sistema", icon: Database },
  ];

  return (
    <div className="flex h-screen bg-[#F2F2F2] text-[#403A2F] overflow-hidden" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <aside className={`${sidebarOpen ? "w-56" : "w-16"} flex-shrink-0 bg-white border-r border-zinc-200 flex flex-col transition-all duration-300 relative`}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-6 w-6 h-6 bg-white border border-zinc-200 rounded-full flex items-center justify-center text-[#818C84] hover:text-[#403A2F] hover:border-[#8AA696] shadow-sm z-10 transition-colors"
        >
          {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        <div className="p-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#8AA696]/10 border border-[#8AA696]/30 flex items-center justify-center text-[#8AA696] font-bold text-sm flex-shrink-0">
              S
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <div className="text-sm font-bold text-[#403A2F]">Starbank</div>
                <div className="text-[10px] text-[#818C84] uppercase tracking-wider">Cobrança</div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {nav.map(n => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                page === n.id
                  ? "bg-[#8AA696]/10 text-[#403A2F] font-medium"
                  : "text-[#818C84] hover:text-[#525952] hover:bg-[#F2F2F2]"
              }`}
            >
              <n.icon size={18} className="flex-shrink-0" />
              {sidebarOpen && n.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-zinc-200">
          <button
            onClick={fetchData}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#F2F2F2] hover:bg-zinc-200 text-[#818C84] text-xs transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {sidebarOpen && (loading ? "Atualizando..." : "Atualizar")}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          {loading && data.fila.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-[#818C84]">
              <Loader2 size={24} className="animate-spin mr-3" /> Carregando dados...
            </div>
          ) : (
            <>
              {page === "dashboard" && <DashboardPage data={data} />}
              {page === "devedores" && <DevedoresPage data={data} onRefresh={fetchData} />}
              {page === "upload" && <UploadPage onRefresh={fetchData} />}
              {page === "sistema" && <SistemaPage data={data} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}