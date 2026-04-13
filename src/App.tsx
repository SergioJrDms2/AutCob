import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { Upload, Search, RefreshCw, ArrowUpRight, ArrowDownRight, Phone, Mail, MessageSquare, Eye, CheckCheck, Send, AlertTriangle, Users, FileText, LayoutDashboard, Database, ChevronRight, X, FileUp, Clock, Shield, TrendingUp, Loader2 } from "lucide-react";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";

const SUPABASE_URL = "https://ytvchpmlkvbgjimozfdd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dmNocG1sa3ZiZ2ppbW96ZmRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc1NDgzMSwiZXhwIjoyMDkxMzMwODMxfQ.k7h95OCf2Vw6YZaVVmFWjjjHkPCHhvIgAMIhlEGcCUg";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const supaFetch = async (table, query = "") => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers });
  return res.json();
};

const supaPost = async (table, body) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation, resolution=ignore-duplicates" },
    body: JSON.stringify(body),
  });
  return res.json();
};

// ─── Metric Card ─────────────────────────────────────
function MetricCard({ label, value, sub, icon: Icon, color, trend }) {
  const colors = {
    blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20",
    green: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20",
    amber: "from-amber-500/10 to-amber-600/5 border-amber-500/20",
    red: "from-rose-500/10 to-rose-600/5 border-rose-500/20",
    purple: "from-violet-500/10 to-violet-600/5 border-violet-500/20",
    cyan: "from-cyan-500/10 to-cyan-600/5 border-cyan-500/20",
  };
  const iconColors = {
    blue: "text-blue-400", green: "text-emerald-400", amber: "text-amber-400",
    red: "text-rose-400", purple: "text-violet-400", cyan: "text-cyan-400",
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${iconColors[color]}`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
        <div className="text-xs text-zinc-400 mt-1">{label}</div>
      </div>
      {sub && <div className="text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────
function Badge({ status }) {
  const map = {
    pendente: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    enviado: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    entregue: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    lido: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    respondido: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    pago: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    negativado: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    inicial: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    lembrete: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    urgente: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    pre_negativacao: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${map[status] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
      {status?.replace("_", " ") || "—"}
    </span>
  );
}

// ─── Channel Icon ────────────────────────────────────
function ChannelIcon({ canal }) {
  if (canal === "whatsapp") return <MessageSquare size={14} className="text-emerald-400" />;
  if (canal === "email") return <Mail size={14} className="text-blue-400" />;
  if (canal === "sms") return <Phone size={14} className="text-amber-400" />;
  return <Send size={14} className="text-zinc-400" />;
}

// ─── Custom Tooltip ──────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
      <div className="text-xs text-zinc-400 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-sm font-semibold text-white">{p.name}: {p.value}</div>
      ))}
    </div>
  );
}

// ─── DASHBOARD PAGE ──────────────────────────────────
function DashboardPage({ data }) {
  const { fila, logs } = data;
  const total = fila.length;
  const pendentes = fila.filter(f => f.status === "pendente").length;
  const enviados = fila.filter(f => f.status === "enviado").length;
  const respondidos = fila.filter(f => f.status === "respondido").length;
  const pagos = fila.filter(f => f.status === "pago").length;
  const lidos = fila.filter(f => f.leu_mensagem).length;

  const disparos = logs.filter(l => l.tipo === "disparo");
  const totalDisparos = disparos.length;
  const entregues = disparos.filter(l => l.status_entrega === "entregue" || l.status_entrega === "lido").length;
  const lidosLog = disparos.filter(l => l.status_entrega === "lido").length;
  const falhou = disparos.filter(l => l.status_entrega === "falhou").length;

  const taxaAlcance = total > 0 ? Math.round(((total - pendentes) / total) * 100) : 0;
  const taxaLeitura = totalDisparos > 0 ? Math.round((lidosLog / totalDisparos) * 100) : 0;
  const taxaResposta = total > 0 ? Math.round((respondidos / total) * 100) : 0;
  const taxaRecuperacao = total > 0 ? Math.round((pagos / total) * 100) : 0;

  const statusData = [
    { name: "Pendente", value: pendentes, color: "#f59e0b" },
    { name: "Enviado", value: enviados, color: "#3b82f6" },
    { name: "Respondido", value: respondidos, color: "#8b5cf6" },
    { name: "Pago", value: pagos, color: "#10b981" },
  ].filter(d => d.value > 0);

  const entregaData = [
    { name: "Enviado", value: totalDisparos - entregues - lidosLog - falhou, color: "#3b82f6" },
    { name: "Entregue", value: entregues, color: "#06b6d4" },
    { name: "Lido", value: lidosLog, color: "#10b981" },
    { name: "Falhou", value: falhou, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const faseData = [
    { fase: "Inicial", qtd: fila.filter(f => f.fase_cobranca === "inicial").length },
    { fase: "Lembrete", qtd: fila.filter(f => f.fase_cobranca === "lembrete").length },
    { fase: "Urgente", qtd: fila.filter(f => f.fase_cobranca === "urgente").length },
    { fase: "Pré-negat.", qtd: fila.filter(f => f.fase_cobranca === "pre_negativacao").length },
  ];

  const valorTotal = fila.reduce((s, f) => s + parseFloat(f.valor_divida || 0), 0);
  const valorPago = fila.filter(f => f.status === "pago").reduce((s, f) => s + parseFloat(f.valor_divida || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Visão Geral</h1>
        <p className="text-zinc-400 text-sm mt-1">Métricas em tempo real da operação de cobrança</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard label="Total na fila" value={total} icon={Users} color="blue" sub="Devedores ativos" />
        <MetricCard label="Taxa de Alcance" value={`${taxaAlcance}%`} icon={Send} color="cyan" sub={`${total - pendentes} de ${total} notificados`} />
        <MetricCard label="Taxa de Leitura" value={`${taxaLeitura}%`} icon={Eye} color="green" sub={`${lidosLog} de ${totalDisparos} lidos`} />
        <MetricCard label="Taxa de Resposta" value={`${taxaResposta}%`} icon={MessageSquare} color="purple" sub={`${respondidos} respostas`} />
        <MetricCard label="Recuperados" value={pagos} icon={CheckCheck} color="green" sub={`R$ ${valorPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
        <MetricCard label="Valor em Aberto" value={`R$ ${(valorTotal - valorPago).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} icon={AlertTriangle} color="red" sub="Carteira inadimplente" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Status da Fila</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-3 justify-center">
            {statusData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-400">
                <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                {d.name}: {d.value}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Status de Entrega</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={entregaData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {entregaData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-3 justify-center">
            {entregaData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-400">
                <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                {d.name}: {d.value}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Fases de Cobrança</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={faseData} barSize={32}>
              <XAxis dataKey="fase" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="qtd" name="Devedores" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Últimos Contatos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
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
                <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="py-2.5 px-3"><ChannelIcon canal={l.canal} /></td>
                  <td className="py-2.5 px-3 text-zinc-300 font-mono text-xs">{l.telefone || "—"}</td>
                  <td className="py-2.5 px-3"><Badge status={l.tipo} /></td>
                  <td className="py-2.5 px-3"><Badge status={l.status_entrega} /></td>
                  <td className="py-2.5 px-3 text-zinc-500 text-xs">{l.timestamp_envio ? new Date(l.timestamp_envio).toLocaleString("pt-BR") : "—"}</td>
                  <td className="py-2.5 px-3 text-zinc-400 text-xs max-w-[300px] truncate">{l.conteudo?.substring(0, 60) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── DEVEDORES PAGE ──────────────────────────────────
function DevedoresPage({ data, onRefresh }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const { fila } = data;

  const filtered = fila.filter(f => {
    const matchSearch = !search || f.nome?.toLowerCase().includes(search.toLowerCase()) || f.cpf?.includes(search) || f.telefone?.includes(search);
    const matchStatus = filterStatus === "todos" || f.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Devedores</h1>
          <p className="text-zinc-400 text-sm mt-1">{filtered.length} registros</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text" placeholder="Buscar por nome, CPF ou telefone..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600">
          <option value="todos">Todos</option>
          <option value="pendente">Pendente</option>
          <option value="enviado">Enviado</option>
          <option value="respondido">Respondido</option>
          <option value="pago">Pago</option>
        </select>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs uppercase tracking-wider bg-zinc-900/80">
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
                <tr key={i} className="border-t border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3 px-4 text-white font-medium">{f.nome || "—"}</td>
                  <td className="py-3 px-4 text-zinc-400 font-mono text-xs">{f.cpf || "—"}</td>
                  <td className="py-3 px-4 text-zinc-400 font-mono text-xs">{f.telefone || "—"}</td>
                  <td className="py-3 px-4 text-zinc-400 text-xs">{f.prefeitura || "—"}</td>
                  <td className="py-3 px-4 text-right text-white font-semibold">
                    {parseFloat(f.valor_divida || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="py-3 px-4"><Badge status={f.status} /></td>
                  <td className="py-3 px-4"><Badge status={f.fase_cobranca} /></td>
                  <td className="py-3 px-4 text-center text-zinc-400">{f.tentativas || 0}</td>
                  <td className="py-3 px-4 text-center">
                    {f.leu_mensagem ? <Eye size={14} className="text-emerald-400 mx-auto" /> : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="py-3 px-4 text-zinc-500 text-xs">{f.contrato || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── UPLOAD PAGE ─────────────────────────────────────
function UploadPage({ onRefresh }) {
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

      const devedoresPayload = devedores.map(d => ({
        ...d, valor_original: d.valor_divida, status: "ativo"
      }));
      await supaPost("devedores", devedoresPayload);

      const filaPayload = devedores.map(d => ({
        cpf: d.cpf, telefone: d.telefone, email: d.email, nome: d.nome,
        prefeitura: d.prefeitura, valor_divida: d.valor_divida, contrato: d.contrato,
        status: "pendente", tentativas: 0, fase_cobranca: "inicial",
      }));
      await supaPost("fila_cobranca", filaPayload);

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
        <h1 className="text-2xl font-bold text-white">Importar Devedores</h1>
        <p className="text-zinc-400 text-sm mt-1">Suba um arquivo XLSX, CSV ou TXT com a base de cobrança</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2"><FileText size={16} /> Campos esperados</h3>
          <div className="space-y-2 text-xs">
            {["cpf *", "nome *", "telefone *", "email", "valor_divida *", "prefeitura", "contrato", "classificacao"].map(f => (
              <div key={f} className={`flex items-center gap-2 ${f.includes("*") ? "text-white" : "text-zinc-500"}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${f.includes("*") ? "bg-emerald-400" : "bg-zinc-600"}`} />
                <span className="font-mono">{f.replace(" *", "")}</span>
                {f.includes("*") && <span className="text-rose-400 text-[10px]">obrigatório</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
              dragOver ? "border-blue-500 bg-blue-500/5" : "border-zinc-700 hover:border-zinc-500"
            }`}
            onClick={() => document.getElementById("fileInput").click()}
          >
            <input id="fileInput" type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden"
              onChange={e => e.target.files[0] && processFile(e.target.files[0])} />
            <FileUp size={40} className="mx-auto text-zinc-500 mb-4" />
            <div className="text-white font-medium">
              {file ? file.name : "Arraste o arquivo aqui ou clique para selecionar"}
            </div>
            <div className="text-zinc-500 text-xs mt-2">XLSX, CSV ou TXT — máximo 10MB</div>
          </div>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-300">Prévia — {preview.length} registros</h3>
            <button onClick={handleUpload} disabled={uploading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? "Importando..." : `Importar ${preview.length} devedores`}
            </button>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 uppercase tracking-wider bg-zinc-900/80">
                    {cols.map(c => <th key={c} className="text-left py-2.5 px-3">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-t border-zinc-800/50">
                      {cols.map(c => <td key={c} className="py-2 px-3 text-zinc-400 max-w-[200px] truncate">{row[c]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className={`rounded-2xl p-5 border ${result.ok ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}>
          <div className={`font-semibold ${result.ok ? "text-emerald-400" : "text-rose-400"}`}>
            {result.ok ? `${result.count} devedores importados com sucesso` : `Erro: ${result.error}`}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SISTEMA PAGE ────────────────────────────────────
function SistemaPage({ data }) {
  const { fila, logs, repasse } = data;
  const repasseAtual = repasse?.[0];

  const steps = [
    { icon: Database, title: "Extração de Base", desc: "Banksoft + Hatch → importação via CSV/XLSX", status: "ativo", color: "emerald" },
    { icon: TrendingUp, title: "Simulação Financeira", desc: "Cálculo de dívida, parcelas e condições", status: "futuro", color: "zinc" },
    { icon: Send, title: "Disparo Multicanal", desc: `WhatsApp ativo · E-mail futuro · SMS futuro`, status: "ativo", color: "emerald" },
    { icon: Clock, title: "Conciliação de Repasse", desc: repasseAtual ? `${repasseAtual.prefeitura} · ${repasseAtual.data_repasse} · Janela ${repasseAtual.janela_dias} dias` : "Sem repasse cadastrado", status: repasseAtual ? "ativo" : "pendente", color: repasseAtual ? "emerald" : "amber" },
    { icon: RefreshCw, title: "Follow-up & Baixa", desc: "Reativação a cada 3 dias · Baixa via operador WhatsApp", status: "ativo", color: "emerald" },
    { icon: AlertTriangle, title: "Negativação", desc: "Após trilha documentada · Cobrança continua", status: "futuro", color: "zinc" },
    { icon: Shield, title: "Jurídico", desc: "Trilha de contatos como prova extrajudicial", status: "ativo", color: "emerald" },
  ];

  const statusColors = { ativo: "bg-emerald-500", pendente: "bg-amber-500", futuro: "bg-zinc-600" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Sistema de Cobrança</h1>
        <p className="text-zinc-400 text-sm mt-1">Visão completa do pipeline — Piloto Ponta Grossa</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Pipeline Operacional</h3>
          {steps.map((s, i) => (
            <div key={i} className="flex gap-4 items-start">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-xl border border-zinc-700 flex items-center justify-center ${s.color === "emerald" ? "bg-emerald-500/10" : s.color === "amber" ? "bg-amber-500/10" : "bg-zinc-800"}`}>
                  <s.icon size={18} className={s.color === "emerald" ? "text-emerald-400" : s.color === "amber" ? "text-amber-400" : "text-zinc-500"} />
                </div>
                {i < steps.length - 1 && <div className="w-px h-8 bg-zinc-800" />}
              </div>
              <div className="pb-6">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-sm">{s.title}</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${statusColors[s.status]}`} />
                </div>
                <div className="text-zinc-500 text-xs mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Configuração Atual</h3>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Proteções</div>
            {[
              { label: "Throttle Anti-Ban", value: "45-120s entre disparos", ok: true },
              { label: "Horário Comercial", value: "08:00 — 20:00 BRT", ok: true },
              { label: "Janela de Repasse", value: repasseAtual ? `${repasseAtual.janela_dias} dias` : "Não cadastrado", ok: !!repasseAtual },
              { label: "Máx. Tentativas", value: "5 por devedor", ok: true },
              { label: "Follow-up", value: "A cada 3 dias", ok: true },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm">{p.label}</span>
                <span className={`text-xs font-medium ${p.ok ? "text-emerald-400" : "text-amber-400"}`}>{p.value}</span>
              </div>
            ))}
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Canais de Comunicação</div>
            {[
              { canal: "WhatsApp", icon: MessageSquare, status: "Ativo", color: "text-emerald-400" },
              { canal: "E-mail", icon: Mail, status: "Em breve", color: "text-zinc-500" },
              { canal: "SMS", icon: Phone, status: "Em breve", color: "text-zinc-500" },
            ].map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-300 text-sm">
                  <c.icon size={14} /> {c.canal}
                </div>
                <span className={`text-xs font-medium ${c.color}`}>{c.status}</span>
              </div>
            ))}
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Escalada de Pressão</div>
            {[
              { fase: "1ª — Inicial", tom: "Informativo, amigável", color: "bg-blue-500" },
              { fase: "2ª — Lembrete", tom: "Direto, lembrando", color: "bg-amber-500" },
              { fase: "3ª — Urgente", tom: "Firme, mencionando consequências", color: "bg-orange-500" },
              { fase: "4ª — Pré-negativação", tom: "Formal, último aviso", color: "bg-rose-500" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${f.color}`} />
                <div>
                  <div className="text-white text-xs font-medium">{f.fase}</div>
                  <div className="text-zinc-500 text-[11px]">{f.tom}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ fila: [], logs: [], repasse: [] });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [fila, logs, repasse] = await Promise.all([
        supaFetch("fila_cobranca", "order=created_at.desc&limit=500"),
        supaFetch("log_contatos", "order=timestamp_envio.desc&limit=200"),
        supaFetch("datas_repasse", `prefeitura=eq.Ponta Grossa&mes_referencia=eq.${new Date().toISOString().slice(0, 7)}`),
      ]);
      setData({
        fila: Array.isArray(fila) ? fila : [],
        logs: Array.isArray(logs) ? logs : [],
        repasse: Array.isArray(repasse) ? repasse : [],
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
    { id: "upload", label: "Importar", icon: Upload },
    { id: "sistema", label: "Sistema", icon: Database },
  ];

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-16"} flex-shrink-0 bg-zinc-900/50 border-r border-zinc-800 flex flex-col transition-all duration-300`}>
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm flex-shrink-0">
              S
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <div className="text-sm font-bold text-white">Starbank</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Cobrança</div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {nav.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                page === n.id ? "bg-white/5 text-white font-medium" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
              }`}>
              <n.icon size={18} className="flex-shrink-0" />
              {sidebarOpen && n.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-zinc-800">
          <button onClick={fetchData} disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs transition-colors">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {sidebarOpen && (loading ? "Atualizando..." : "Atualizar")}
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          {loading && data.fila.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-zinc-500">
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