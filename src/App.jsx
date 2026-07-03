import React from 'react';
import Matchmaker from './components/Matchmaker';
import TacticalMap from './components/TacticalMap'; // Import the map planner

function App() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', color: '#646cff' }}>Project Chimera Strategy Hub</h1>
        <p style={{ color: '#666' }}>Tactical Dashboard & Algorithmic Analysis Engine</p>
      </header>

      <main>
        <Matchmaker />
        <TacticalMap /> {/* Added directly below matchmaking panel */}
      </main>
    </div>
  );
}

export default App;