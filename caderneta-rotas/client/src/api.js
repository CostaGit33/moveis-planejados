const CHAVE = 'caderneta_token';
export const token = () => localStorage.getItem(CHAVE);

export async function api(caminho, { method = 'GET', body } = {}) {
  const r = await fetch('/api' + caminho, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token() && { Authorization: 'Bearer ' + token() }) },
    body: body && JSON.stringify(body),
  });
  if (!r.ok) throw Object.assign(new Error('erro_api'), { status: r.status });
  return r.json();
}

export async function entrar(dados) {
  const d = await api('/entrar', { method: 'POST', body: dados });
  localStorage.setItem(CHAVE, d.token);
  return d;
}
