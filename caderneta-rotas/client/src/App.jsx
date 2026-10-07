import { useCallback, useEffect, useState } from 'react';
import { api, entrar, token } from './api.js';
import Stamp, { InkFilters } from './Stamp.jsx';

function Entrar({ onOk }) {
  const [apelido, setApelido] = useState('');
  const [turma, setTurma] = useState(new URLSearchParams(location.search).get('turma') || '');
  const [erro, setErro] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    try { await entrar({ apelido, turma }); onOk(); } catch { setErro(true); }
  };
  return (
    <form className="card" onSubmit={enviar}>
      <h2>Abra sua caderneta</h2>
      <p className="mut">Só um apelido. Sem senha e sem cadastro.</p>
      <input value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Seu apelido" minLength={2} maxLength={30} required />
      <input value={turma} onChange={(e) => setTurma(e.target.value)} placeholder="Código da turma (opcional)" />
      {erro && <p className="mut">Não deu certo. Confira o apelido e tente de novo.</p>}
      <button className="btn">Abrir caderneta</button>
    </form>
  );
}

function TagPage({ codigo }) {
  const [estado, setEstado] = useState(token() ? 'carimbando' : 'entrar');
  const [r, setR] = useState(null);
  const carimbar = useCallback(async () => {
    setEstado('carimbando');
    try {
      setR(await api(`/tags/${codigo}/carimbar`, { method: 'POST' }));
      setEstado('ok');
      navigator.vibrate?.([15, 35]);
    } catch (e) { setEstado(e.status === 401 ? 'entrar' : e.status === 404 ? 'inexistente' : 'erro'); }
  }, [codigo]);
  useEffect(() => { if (token()) carimbar(); }, [carimbar]);

  if (estado === 'entrar') return <Entrar onOk={carimbar} />;
  if (estado === 'carimbando') return <p className="mut center">Carimbando…</p>;
  if (estado !== 'ok') return (
    <div className="card">
      <p>{estado === 'inexistente' ? 'Essa tag não está cadastrada.' : 'Sem sinal agora. Encoste de novo ou tente outra vez.'}</p>
      {estado === 'erro' && <button className="btn" onClick={carimbar}>Tentar de novo</button>}
    </div>
  );
  const t = r.turma;
  return (
    <>
      <p className="center"><span className="chip">{r.rota.nome}</span></p>
      <div className="sw"><Stamp c={r.carimbo} size={220} /></div>
      <h1>{r.repetido ? 'Já está na página' : 'Carimbado!'}</h1>
      <p className="mut center">{r.rota.feitos} de {r.rota.total} pontos da rota</p>
      {r.certificado && <div className="card">🎖️ Rota completa! O certificado está na sua caderneta.</div>}
      {t && <div className="card">{t.formou ? '👥 Carimbo de Turma!' : `👥 ${t.presentes} da turma aqui. Faltam ${Math.max(0, t.necessarios - t.presentes)} em até 4 minutos para o Carimbo de Turma.`}</div>}
      {r.guardiao && <div className="card">🌿 Guardião do ponto: <b>{r.guardiao.apelido}</b>, {r.guardiao.passagens} passagens</div>}
      <p className="mut center">{r.hoje} carimbos hoje neste ponto</p>
      <a className="btn" href="/">Ver minha caderneta</a>
    </>
  );
}

function Caderneta() {
  const [d, setD] = useState(null);
  const [entrando, setEntrando] = useState(!token());
  const carregar = useCallback(() => api('/caderneta').then((x) => { setD(x); setEntrando(false); }).catch(() => setEntrando(true)), []);
  useEffect(() => { if (token()) carregar(); }, [carregar]);
  if (entrando) return <Entrar onOk={carregar} />;
  if (!d) return <p className="mut center">Abrindo a caderneta…</p>;
  return (
    <>
      <h1>Caderneta</h1>
      <p className="mut center">{d.usuario.apelido}</p>
      {d.rotas.map((r) => (
        <div className="card" key={r.id}>
          <h2>{r.nome}</h2>
          <p className="mut">{r.km} km · {r.pontos.filter((p) => p.carimbo).length} de {r.pontos.length} carimbos{r.completa && ' · 🎖️ completa'}</p>
          <div className="grid">
            {r.pontos.map((p) => (
              <div className={'slot' + (p.carimbo ? ' n' : '')} key={p.ordem}>{p.carimbo ? <Stamp c={p.carimbo} size={92} /> : p.ordem}</div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default function App() {
  const m = location.pathname.match(/^\/t\/([\w-]+)/);
  return <main><InkFilters />{m ? <TagPage codigo={m[1]} /> : <Caderneta />}</main>;
}
