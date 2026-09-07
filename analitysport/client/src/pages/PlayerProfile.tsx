import { Link } from "wouter";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Clock3,
  Crosshair,
  Footprints,
  Goal,
  Medal,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

const profile = {
  name: "João Silva",
  handle: "@joaosilva",
  position: "Meia ofensivo",
  team: "12 de Junio de Villa Hayes",
  number: "10",
  foot: "Destro",
  age: "24 anos",
  height: "1,78 m",
  status: "Em atividade",
  initials: "JS",
  accent: "MEIA",
  rating: 8.4,
  rank: 3,
  matches: 18,
  starts: 15,
  minutes: 1234,
  goals: 9,
  assists: 7,
  shots: 42,
  shotsOnTarget: 24,
  passAccuracy: 86,
  keyPasses: 31,
  tackles: 18,
  interceptions: 12,
  yellowCards: 2,
  redCards: 0,
};

const form = [
  { opponent: "Deportivo Santaní", date: "06 SET", result: "V", score: "3–1", rating: "8.8", goal: true },
  { opponent: "Sportivo Luqueño", date: "30 AGO", result: "E", score: "1–1", rating: "7.9", goal: false },
  { opponent: "General Caballero", date: "22 AGO", result: "V", score: "2–0", rating: "8.6", goal: true },
  { opponent: "Club Olimpia", date: "15 AGO", result: "D", score: "0–2", rating: "6.8", goal: false },
  { opponent: "Nacional Asunción", date: "08 AGO", result: "V", score: "2–1", rating: "8.2", goal: true },
];

function Metric({ icon: Icon, label, value, helper, tone = "lime" }: { icon: typeof Activity; label: string; value: string | number; helper: string; tone?: "lime" | "cyan" }) {
  return (
    <div className="profile-metric">
      <div className={`profile-metric-icon ${tone}`}><Icon size={16} /></div>
      <div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>
    </div>
  );
}

function Bar({ label, value, display }: { label: string; value: number; display: string }) {
  return <div className="progress-row"><div><span>{label}</span><strong>{display}</strong></div><div className="progress-track"><i style={{ width: `${Math.min(value, 100)}%` }} /></div></div>;
}

export default function PlayerProfile() {
  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <aside className="side-rail">
        <Link href="/" className="brand-mark" aria-label="Voltar para o dashboard"><Activity size={20} strokeWidth={2.5} /></Link>
        <div className="side-line" />
        <Link href="/" className="side-tool" aria-label="Leitura de jogo"><Crosshair size={19} /></Link>
        <div className="side-tool active" aria-label="Perfil de jogador"><Trophy size={19} /></div>
        <div className="side-tool" aria-label="Relatórios"><BarChart3 size={19} /></div>
        <div className="mt-auto side-tool" aria-label="Ajuda"><CircleHelp size={19} /></div>
      </aside>

      <main className="relative z-10 ml-0 min-h-screen lg:ml-[76px]">
        <header className="profile-header mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <Link href="/" className="back-link"><ArrowLeft size={15} /> Voltar ao workspace</Link>
          <div className="flex items-center gap-3"><span className="hidden text-[11px] font-medium text-muted-foreground sm:block">Perfil atualizado hoje</span><span className="status-pill"><span className="status-pulse" /> DADOS ONLINE</span></div>
        </header>

        <div className="mx-auto max-w-[1440px] px-5 pb-14 sm:px-8 lg:px-12">
          <section className="profile-hero">
            <div className="player-identity"><div className="player-avatar"><span>{profile.initials}</span><b>{profile.number}</b></div><div><div className="section-kicker">PLAYER PROFILE / 001</div><h1 className="font-display profile-name">{profile.name}</h1><p className="profile-subtitle">{profile.position} <span>•</span> {profile.team}</p><div className="profile-tags"><span className="live-tag"><i /> {profile.status}</span><span>{profile.handle}</span><span>{profile.foot} · {profile.height}</span></div></div></div>
            <div className="profile-rating"><span>RATING GERAL</span><strong>{profile.rating}</strong><small>/ 10.0</small><div className="rating-stars">★★★★★</div><em>top {profile.rank} da equipe</em></div>
          </section>

          <section className="profile-metrics"><Metric icon={CalendarDays} label="Partidas" value={profile.matches} helper={`${profile.starts} como titular`} /><Metric icon={Clock3} label="Minutos" value={profile.minutes.toLocaleString("pt-BR")} helper="tempo em campo" tone="cyan" /><Metric icon={Goal} label="Gols" value={profile.goals} helper="últimos 18 jogos" /><Metric icon={Footprints} label="Assistências" value={profile.assists} helper="passes decisivos" tone="cyan" /></section>

          <div className="profile-grid">
            <section className="panel profile-panel"><div className="panel-heading"><div><div className="section-kicker">01 / performance</div><h2 className="panel-title">Produção ofensiva</h2></div><Sparkles className="text-lime" size={19} /></div><div className="profile-bars"><Bar label="Precisão de passe" value={profile.passAccuracy} display={`${profile.passAccuracy}%`} /><Bar label="Finalizações no alvo" value={57} display={`${profile.shotsOnTarget} / ${profile.shots}`} /><Bar label="Conversão de gols" value={21} display="21%" /><Bar label="Participação em gols" value={78} display={`${profile.goals + profile.assists} ações`} /></div><div className="mini-insight"><Zap size={16} /><span><strong>Momento forte:</strong> participou de 5 gols nos últimos 5 jogos.</span></div></section>
            <section className="panel profile-panel"><div className="panel-heading"><div><div className="section-kicker">02 / scout</div><h2 className="panel-title">Leitura de jogo</h2></div><Shield className="text-cyan" size={19} /></div><div className="scout-grid"><div><span>Passes-chave</span><strong>{profile.keyPasses}</strong><small>criados</small></div><div><span>Desarmes</span><strong>{profile.tackles}</strong><small>vencidos</small></div><div><span>Interceptações</span><strong>{profile.interceptions}</strong><small>recuperações</small></div><div><span>Cartões</span><strong>{profile.yellowCards}<small> amarelos</small></strong><small>{profile.redCards} vermelhos</small></div></div><div className="scout-footer"><Medal size={15} /><span>Perfil equilibrado · impacto acima da média</span><ChevronRight size={14} /></div></section>
          </div>

          <section className="panel form-panel"><div className="panel-heading"><div><div className="section-kicker">03 / match log</div><h2 className="panel-title">Forma recente</h2></div><span className="mini-counter">ÚLTIMOS 5</span></div><div className="form-list">{form.map((match) => <div className="form-row" key={match.opponent}><div className={`form-result ${match.result.toLowerCase()}`}>{match.result}</div><div className="form-opponent"><strong>{match.opponent}</strong><span>{match.date} · {match.score}</span></div><div className="form-event">{match.goal ? <><Goal size={14} /> gol</> : <span>—</span>}</div><div className="form-rating"><strong>{match.rating}</strong><span>rating</span></div><ChevronRight size={15} className="text-muted-foreground/40" /></div>)}</div></section>

          <section className="profile-footer"><div><div className="section-kicker">04 / data note</div><p>Perfil consolidado a partir das capturas processadas pelo AnalitySport. Os indicadores representam evidências extraídas e podem exigir revisão manual.</p></div><Link href="/" className="primary-button">Analisar nova partida <ArrowLeft size={14} className="rotate-180" /></Link></section>
        </div>
      </main>
    </div>
  );
}
