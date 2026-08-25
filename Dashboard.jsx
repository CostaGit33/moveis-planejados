import React, { useEffect, useState } from 'react';

export default function Dashboard() {
  const [kpis, setKpis] = useState({ faturado: 0, pendente: 0, conversao: 0 });

  useEffect(() => {
    // Placeholder: pegar KPIs da API
    // fetch(process.env.REACT_APP_API_URL + '/api/kpis')...
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Dashboard</h2>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ padding: 12, border: '1px solid #ddd' }}>
          <h3>Faturado</h3>
          <div>R$ {kpis.faturado}</div>
        </div>
        <div style={{ padding: 12, border: '1px solid #ddd' }}>
          <h3>Pendente</h3>
          <div>R$ {kpis.pendente}</div>
        </div>
        <div style={{ padding: 12, border: '1px solid #ddd' }}>
          <h3>Taxa Conversão</h3>
          <div>{kpis.conversao}%</div>
        </div>
      </div>
    </div>
  );
}
