import { useId } from 'react';

// Numero aleatorio repetivel: a mesma seed sempre gera o mesmo carimbo
const rng = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// 3 niveis de pressao x 4 desenhos de falha de tinta
export function InkFilters() {
  const f = [];
  for (let p = 1; p <= 3; p++) for (let s = 0; s < 4; s++) {
    const T = [5.4, 4.2, 3][p - 1], D = [2.6, 2.1, 1.6][p - 1];
    f.push(
      <filter key={`${p}${s}`} id={`ink${p}${s}`} colorInterpolationFilters="sRGB" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed={s + 3} result="w" />
        <feDisplacementMap in="SourceGraphic" in2="w" scale={D} result="d" />
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed={s * 7 + 11} result="n" />
        <feColorMatrix in="n" type="matrix" values={`0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 12 0 0 0 -${T}`} result="h" />
        <feComposite in="d" in2="h" operator="in" />
      </filter>);
  }
  return <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>{f}</defs></svg>;
}

export default function Stamp({ c, size = 120 }) {
  const id = useId().replace(/:/g, '');
  const r = rng(c.seed), rot = r() * 20 - 10, p = 1 + ((r() * 3) | 0), s = (r() * 4) | 0;
  const k = c.especial === 'turma' ? 't' : c.parceiro ? 'o' : c.forma;
  const cor = c.especial === 'turma' ? 'jeni' : c.parceiro ? 'folha' : c.cor;
  const d = new Date(c.criado_em);
  const hm = d.toTimeString().slice(0, 5);
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase();
  const nome = c.tag_nome.toUpperCase();
  const T = (y, z, txt) => <text x="60" y={y} fontSize={z} textAnchor="middle">{txt}</text>;
  let g;
  if (k === 'r') g = <><rect x="6" y="12" width="108" height="96" rx="14" strokeWidth="3" /><rect x="14" y="20" width="92" height="80" rx="9" strokeWidth="1.5" />{T(42, 9, nome)}{T(80, 38, c.ordem)}{T(95, 10, hm)}</>;
  else if (k === 'o') g = <><ellipse cx="60" cy="60" rx="56" ry="38" strokeWidth="3" /><ellipse cx="60" cy="60" rx="48" ry="30" strokeWidth="1.5" />{T(48, 9, 'PARADA')}{T(69, 11, nome)}{T(84, 8, `${hm} · ${data}`)}</>;
  else if (k === 't') g = <><polygon points="36,5 84,5 115,36 115,84 84,115 36,115 5,84 5,36" strokeWidth="3" /><polygon points="40,15 80,15 105,40 105,80 80,105 40,105 15,80 15,40" strokeWidth="1.5" />{T(40, 10, 'TURMA')}{T(80, 32, '×')}{T(96, 9, data)}</>;
  else g = <><circle cx="60" cy="60" r="56" strokeWidth="3" /><circle cx="60" cy="60" r="40" strokeWidth="1.5" />
    <path id={id + 'a'} d="M13,60A47,47 0 0,1 107,60" stroke="none" /><path id={id + 'b'} d="M9,60A51,51 0 0,0 111,60" stroke="none" />
    <text fontSize="9" letterSpacing="1" textAnchor="middle"><textPath href={`#${id}a`} startOffset="50%">{nome}</textPath></text>
    <text fontSize="8" letterSpacing="1" textAnchor="middle"><textPath href={`#${id}b`} startOffset="50%">{data}</textPath></text>
    {T(47, 8, 'PONTO')}{T(76, 32, c.ordem)}{T(91, 9, hm)}</>;
  return (
    <svg className="st" viewBox="0 0 120 120" fill="none" stroke="currentColor" role="img" aria-label={`Carimbo: ${c.tag_nome}`}
      style={{ width: size, color: `var(--${cor})`, filter: `url(#ink${p}${s})`, transform: `rotate(${rot}deg)` }}>{g}</svg>
  );
}
