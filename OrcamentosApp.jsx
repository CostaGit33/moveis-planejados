import React, { useState, useEffect } from 'react';

export default function OrcamentosApp() {
  const [orcamentos, setOrcamentos] = useState([]);

  useEffect(() => {
    fetch(process.env.REACT_APP_API_URL + '/api/orcamentos')
      .then(r => r.json())
      .then(setOrcamentos)
      .catch(err => console.error(err));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Orçamentos Recentes</h2>
      <ul>
        {orcamentos.map(o => (
          <li key={o.id}>{o.numero_proposta || 'PROP-' + o.id} — {o.status} — R$ {o.valor_total || '0.00'}</li>
        ))}
      </ul>
    </div>
  );
}
