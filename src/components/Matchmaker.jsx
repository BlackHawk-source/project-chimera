import React, { useState } from 'react';

const MOCK_QUEUE = [
  { id: 1, username: 'AlphaAce', mmr: 1420 },
  { id: 2, username: 'ShadowBlade', mmr: 1210 },
  { id: 3, username: 'NovaStrike', mmr: 1510 },
  { id: 4, username: 'QuantumGamer', mmr: 1380 },
  { id: 5, username: 'Vortex', mmr: 1190 },
  { id: 6, username: 'Cipher', mmr: 1450 },
  { id: 7, username: 'ApexPred', mmr: 1590 },
  { id: 8, username: 'Nexus', mmr: 1250 },
  { id: 9, username: 'GlitchHacker', mmr: 1320 },
  { id: 10, username: 'Zephyr', mmr: 1340 }
];

export default function Matchmaker() {
  const [teams, setTeams] = useState(null);

  const runMatchmaker = () => {
    const sorted = [...MOCK_QUEUE].sort((a, b) => b.mmr - a.mmr);
    const teamA = [];
    const teamB = [];

    sorted.forEach((player, idx) => {
      if (idx % 2 === 0) {
        if (teamA.length <= teamB.length) teamA.push(player);
        else teamB.push(player);
      } else {
        if (teamB.length <= teamA.length) teamB.push(player);
        else teamA.push(player);
      }
    });

    setTeams({ teamA, teamB });
  };

  return (
    <div style={{ border: '1px solid #444', padding: '25px', borderRadius: '8px', margin: '20px 0', backgroundColor: '#16161a', color: '#fff' }}>
      <h2>System Matchmaking Engine</h2>
      <button onClick={runMatchmaker} style={{ backgroundColor: '#646cff', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
        Execute 5v5 Balance Queue
      </button>

      {teams && (
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
          <div>
            <h4 style={{ color: '#4caf50' }}>Team Alpha</h4>
            <ul>{teams.teamA.map(p => <li key={p.id}>{p.username} ({p.mmr} MMR)</li>)}</ul>
            <p><strong>Avg MMR:</strong> {Math.round(teams.teamA.reduce((acc, p) => acc + p.mmr, 0) / teams.teamA.length)}</p>
          </div>
          <div>
            <h4 style={{ color: '#f44336' }}>Team Omega</h4>
            <ul>{teams.teamB.map(p => <li key={p.id}>{p.username} ({p.mmr} MMR)</li>)}</ul>
            <p><strong>Avg MMR:</strong> {Math.round(teams.teamB.reduce((acc, p) => acc + p.mmr, 0) / teams.teamB.length)}</p>
          </div>
        </div>
      )}
    </div>
  );
}