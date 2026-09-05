import { useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  FileImage,
  Gauge,
  ImagePlus,
  Loader2,
  PanelLeft,
  RefreshCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UploadCloud,
  Zap,
} from "lucide-react";

const API_ENDPOINT = import.meta.env.VITE_SPORTS_API_URL || "https://opencv.novaagencian8n.online/process-sports-image";

const STAT_LABELS: Record<string, { label: string; icon: typeof Activity }> = {
  attacks: { label: "Ataques", icon: Activity },
  dangerous_attacks: { label: "Ataques perigosos", icon: Zap },
  possession: { label: "Posse de bola", icon: Gauge },
  shots: { label: "Finalizações", icon: Target },
  shots_on_target: { label: "Chutes no gol", icon: ScanLine },
  corners: { label: "Escanteios", icon: BarChart3 },
  yellow_cards: { label: "Cartões amarelos", icon: ShieldCheck },
  red_cards: { label: "Cartões vermelhos", icon: ShieldCheck },
};

const SAMPLE_RESULT = {
  teams: { home: "12 de Junio de Villa Hayes", away: "Deportivo Santaní" },
  score: { home: 0, away: 0 },
  statistics: {
    attacks: [104, 113],
    dangerous_attacks: [57, 62],
    possession: [48, 52],
    shots: [4, 8],
    shots_on_target: [0, 4],
  },
};

type SportsResult = typeof SAMPLE_RESULT & {
  mode?: string;
  confidence?: number;
  validation?: {
    possession_sum?: number | null;
    issues?: string[];
    requires_manual_review?: boolean;
  };
  evidence?: Record<string, { confidence?: number; raw?: string }>;
};

function formatConfidence(value?: number) {
  if (typeof value !== "number") return "—";
  return `${Math.round(value * 100)}%`;
}

function StatCard({ statKey, values }: { statKey: string; values: unknown }) {
  const config = STAT_LABELS[statKey];
  if (!config || !Array.isArray(values) || values.length < 2) return null;
  const Icon = config.icon;
  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="stat-icon"><Icon size={16} strokeWidth={2.2} /></div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{config.label}</span>
        </div>
        <ChevronRight size={15} className="text-muted-foreground/50 transition-transform group-hover:translate-x-1" />
      </div>
      <div className="mt-5 flex items-end justify-between gap-5">
        <div className="text-right">
          <div className="text-3xl font-bold tracking-[-0.05em] text-foreground">{values[0] as string | number}</div>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">mandante</span>
        </div>
        <div className="mb-2 h-px flex-1 bg-gradient-to-r from-lime/50 via-border to-cyan/50" />
        <div>
          <div className="text-3xl font-bold tracking-[-0.05em] text-foreground">{values[1] as string | number}</div>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">visitante</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<SportsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeResult = result || (file ? null : null);
  const confidence = useMemo(() => formatConfidence(result?.confidence), [result]);

  function selectFile(nextFile?: File) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("image/")) {
      setError("Selecione uma imagem JPG, PNG ou WEBP.");
      return;
    }
    setError(null);
    setResult(null);
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function analyze() {
    if (!file) {
      setError("Envie uma captura para iniciar a leitura.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch(API_ENDPOINT, { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || `O servidor retornou ${response.status}.`);
      setResult(payload as SportsResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível processar a captura.";
      setError(`${message} Verifique se o endpoint esportivo já está publicado e permite acesso pelo navegador.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <aside className="side-rail">
        <div className="brand-mark"><Activity size={20} strokeWidth={2.5} /></div>
        <div className="side-line" />
        <div className="side-tool active"><ScanLine size={19} /></div>
        <div className="side-tool"><BarChart3 size={19} /></div>
        <div className="side-tool"><Trophy size={19} /></div>
        <div className="mt-auto side-tool"><CircleHelp size={19} /></div>
      </aside>

      <main className="relative z-10 ml-0 min-h-screen lg:ml-[76px]">
        <header className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="brand-mark small"><Activity size={17} /></div>
            <span className="font-display text-sm font-bold tracking-tight">ANALITY<span className="text-lime">SPORT</span></span>
          </div>
          <div className="hidden items-center gap-3 lg:flex">
            <div className="eyebrow-dot" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Vision analytics / workspace 01</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[11px] font-medium text-muted-foreground sm:block">API conectada</span>
            <span className="status-pill"><span className="status-pulse" /> OCR online</span>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-5 pb-14 sm:px-8 lg:px-12">
          <section className="hero-grid mb-10 pt-7 lg:pt-12">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-lime/20 bg-lime/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.19em] text-lime">
                <Sparkles size={13} /> Computer vision para esporte
              </div>
              <h1 className="font-display text-[clamp(2.7rem,6vw,5.8rem)] font-semibold leading-[0.93] tracking-[-0.075em] text-foreground">
                Transforme uma captura em <span className="text-gradient">leitura de jogo.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Envie a tela de estatísticas. O AnalitySport identifica placar, equipes e indicadores da partida em segundos — com evidências para você revisar.
              </p>
            </div>
            <div className="hero-signal hidden lg:block">
              <div className="signal-label"><span /> LIVE SIGNAL</div>
              <div className="signal-number">01<span>/04</span></div>
              <div className="signal-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
              <p>captura → OCR → contexto</p>
            </div>
          </section>

          <div className="workspace-grid">
            <section className="panel upload-panel">
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">01 / input</div>
                  <h2 className="panel-title">Carregar captura</h2>
                </div>
                <FileImage className="text-muted-foreground/60" size={21} />
              </div>

              {!preview ? (
                <button
                  type="button"
                  className={`dropzone ${dragging ? "dragging" : ""}`}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files?.[0]); }}
                >
                  <div className="upload-orbit"><UploadCloud size={24} /></div>
                  <span className="mt-5 text-sm font-semibold text-foreground">Arraste a imagem aqui</span>
                  <span className="mt-2 text-xs leading-5 text-muted-foreground">ou clique para selecionar uma captura<br />JPG, PNG ou WEBP · até 20 MB</span>
                  <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-lime/40 hover:text-lime"><ImagePlus size={14} /> Escolher arquivo</span>
                </button>
              ) : (
                <div className="preview-wrap">
                  <img src={preview} alt="Pré-visualização da captura selecionada" className="preview-image" />
                  <button type="button" onClick={reset} className="preview-reset"><RefreshCcw size={14} /> Trocar captura</button>
                </div>
              )}
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} />

              {error && <div className="error-box mt-4"><AlertCircle size={16} /><span>{error}</span></div>}
              <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><ShieldCheck size={14} className="text-lime" /> Processamento seguro</div>
                <button type="button" onClick={analyze} disabled={!file || loading} className="primary-button">
                  {loading ? <><Loader2 size={15} className="animate-spin" /> Lendo imagem...</> : <><Zap size={15} /> Analisar captura</>}
                </button>
              </div>
            </section>

            <section className="panel context-panel">
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">02 / context</div>
                  <h2 className="panel-title">Leitura em contexto</h2>
                </div>
                <span className="mini-counter">{result ? "RESULTADO" : "AGUARDANDO"}</span>
              </div>
              {result ? (
                <div className="match-card">
                  <div className="match-meta"><span>PARTIDA IDENTIFICADA</span><span className="confidence-tag">confiança {confidence}</span></div>
                  <div className="teams-row">
                    <div className="team-name">{result.teams?.home || "Mandante"}</div>
                    <div className="score-display"><strong>{result.score?.home ?? "–"}</strong><span>:</span><strong>{result.score?.away ?? "–"}</strong></div>
                    <div className="team-name away">{result.teams?.away || "Visitante"}</div>
                  </div>
                  <div className="match-divider"><span /> <span>FULL TIME DATA</span> <span /></div>
                  <div className="quick-checks">
                    <div><span>posse validada</span><strong>{result.validation?.possession_sum ?? "–"}%</strong></div>
                    <div><span>campos lidos</span><strong>{Object.keys(result.statistics || {}).length}</strong></div>
                    <div><span>revisão</span><strong className={result.validation?.requires_manual_review ? "warning-text" : "success-text"}>{result.validation?.requires_manual_review ? "manual" : "ok"}</strong></div>
                  </div>
                </div>
              ) : (
                <div className="context-empty">
                  <div className="empty-icon"><PanelLeft size={22} /></div>
                  <h3>Seu relatório aparece aqui</h3>
                  <p>Quando a imagem for processada, equipes, placar e estatísticas serão organizados neste painel.</p>
                  <div className="empty-steps"><span><b>1</b> envie</span><span><b>2</b> analise</span><span><b>3</b> revise</span></div>
                </div>
              )}
            </section>
          </div>

          <section className="results-section mt-6">
            <div className="results-header">
              <div><div className="section-kicker">03 / indicators</div><h2 className="panel-title">Indicadores da partida</h2></div>
              {result && <span className="result-live"><CheckCircle2 size={14} /> dados extraídos</span>}
            </div>
            {result ? (
              <div className="stats-grid">{Object.entries(result.statistics || {}).map(([key, values]) => <StatCard key={key} statKey={key} values={values} />)}</div>
            ) : (
              <div className="stats-placeholder"><div className="placeholder-line long" /><div className="placeholder-line medium" /><div className="placeholder-line short" /><span>Sem dados ainda — carregue uma captura para começar</span></div>
            )}
          </section>

          <footer className="mt-10 flex flex-col gap-3 border-t border-border/70 pt-5 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2"><span className="footer-mark">A</span> <span>AnalitySport / leitura assistida por visão computacional</span></div>
            <span>OCR é evidência. Sempre revise antes de tomar decisões.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export { SAMPLE_RESULT };
