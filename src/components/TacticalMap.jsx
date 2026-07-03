import React, { useRef, useState, useEffect } from 'react';

// Centralized Mock Data
const HERO_DATABASE = [
  { id: 'vanguard', name: 'Vanguard', role: 'Tank', health: 600, speed: 4.5, iconColor: '#4caf50', ability: 'Barricade Shield' },
  { id: 'phantom', name: 'Phantom', role: 'Duelist', health: 200, speed: 6.0, iconColor: '#ff9800', ability: 'Phase Dash' },
  { id: 'horizon', name: 'Horizon', role: 'Support', health: 250, speed: 5.0, iconColor: '#00bcd4', ability: 'Healing Ward' },
  { id: 'glitch', name: 'Glitch', role: 'Controller', health: 300, speed: 4.8, iconColor: '#e91e63', ability: 'System EMP' }
];

const THEATER_MAPS = [
  { id: 'sector-alpha', name: 'Sector Alpha Grid (Default)', bgColor: '#0f0f12', gridColor: '#222' },
  { id: 'omega-facility', name: 'Omega Lab Complex', bgColor: '#181313', gridColor: '#3c1a1a' },
  { id: 'deep-space-outpost', name: 'Deep Space Station', bgColor: '#0b131a', gridColor: '#1a334d' }
];

export default function TacticalMap() {
  const canvasRef = useRef(null);
  
  // Feature State Management
  const [markers, setMarkers] = useState([]);
  const [selectedHero, setSelectedHero] = useState(HERO_DATABASE[0]);
  const [activeTheater, setActiveTheater] = useState(THEATER_MAPS[0]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState(null);

  // Fusion Sandbox State
  const [fusionParentA, setFusionParentA] = useState('vanguard');
  const [fusionParentB, setFusionParentB] = useState('phantom');

  // Trigger continuous re-drawing whenever state modifications occur
  useEffect(() => {
    drawCanvasMatrix();
  }, [markers, activeTheater]);

  const drawCanvasMatrix = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear & redraw background canvas bounds
    ctx.fillStyle = activeTheater.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Map Schematics (Grid lines)
    ctx.strokeStyle = activeTheater.gridColor;
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Draw placed nodes along tracking array
    markers.forEach((marker) => {
      ctx.fillStyle = marker.color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = marker.color;
      
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 10, 0, 2 * Math.PI);
      ctx.fill();

      // Render Hero tag initials inside circle
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(marker.heroName.substring(0, 2).toUpperCase(), marker.x, marker.y + 3);
    });
  };

  // Drag-and-Drop Math Handlers
  const getCanvasCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top)
    };
  };

  const handleMouseDown = (e) => {
    const coords = getCanvasCoords(e);
    // Proximity check: did user click within 15px radius of a node?
    const clickedNode = markers.find(m => Math.hypot(m.x - coords.x, m.y - coords.y) < 15);
    
    if (clickedNode) {
      setIsDragging(true);
      setDraggedNodeId(clickedNode.id);
    } else {
      // Place a fresh Node entry pinned to currently active Hero selection
      const newNode = {
        id: Date.now(),
        x: coords.x,
        y: coords.y,
        heroName: selectedHero.name,
        color: selectedHero.iconColor
      };
      setMarkers([...markers, newNode]);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !draggedNodeId) return;
    const coords = getCanvasCoords(e);
    setMarkers(markers.map(m => m.id === draggedNodeId ? { ...m, x: coords.x, y: coords.y } : m));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedNodeId(null);
  };

  // Run Character Fusion Sandbox Engine Logic
  const calculateFusion = () => {
    const pA = HERO_DATABASE.find(h => h.id === fusionParentA);
    const pB = HERO_DATABASE.find(h => h.id === fusionParentB);
    return {
      name: `${pA.name.substring(0, 4)}-${pB.name.substring(pB.name.length - 4)} Core`,
      health: Math.round((pA.health + pB.health) / 2),
      speed: ((pA.speed + pB.speed) / 2).toFixed(1),
      fusedAbility: `${pA.ability} + ${pB.ability}`
    };
  };

  const currentFusion = calculateFusion();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', color: '#fff' }}>
      
      {/* SECTION 4: MAP THEATER SWITCHER */}
      <div style={{ background: '#16161a', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
        <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Active Tactical Theater: </label>
        <select 
          value={activeTheater.id} 
          onChange={(e) => {
            setActiveTheater(THEATER_MAPS.find(m => m.id === e.target.value));
            setMarkers([]); // Clear matrix fields smoothly on landscape wipe
          }}
          style={{ background: '#222', color: '#fff', padding: '6px', borderRadius: '4px', border: '1px solid #444' }}
        >
          {THEATER_MAPS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* CANVAS DRAWING SPACE & INTERACTION HOOKS */}
      <div style={{ background: '#16161a', padding: '25px', borderRadius: '8px', border: '1px solid #333', textAlign: 'center' }}>
        
        {/* SECTION 1: HERO PORTRAIT SELECTOR BAR */}
        <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
          {HERO_DATABASE.map(hero => (
            <button
              key={hero.id}
              onClick={() => setSelectedHero(hero)}
              style={{
                background: selectedHero.id === hero.id ? hero.iconColor : '#222',
                color: selectedHero.id === hero.id ? '#000' : '#fff',
                border: '1px solid #444', padding: '8px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              {hero.name} ({hero.role})
            </button>
          ))}
        </div>

        <canvas 
          ref={canvasRef} width={600} height={350} 
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          style={{ border: '2px solid #444', borderRadius: '4px', cursor: isDragging ? 'grabbing' : 'crosshair' }}
        />

        {/* SECTION 3: REAL-TIME VECTOR TRACKING LOG */}
        <div style={{ marginTop: '15px', textAlign: 'left', background: '#0f0f12', padding: '15px', borderRadius: '4px', border: '1px solid #222' }}>
          <strong style={{ fontSize: '0.85rem', color: '#888' }}>Live Structural Telemetry Log (Hold & Drag Nodes to Re-vector):</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.8rem', fontFamily: 'monospace', marginTop: '10px' }}>
            {markers.map((m, idx) => (
              <div key={m.id} style={{ color: m.color }}>
                📍 Node {idx + 1} [{m.heroName}]: Vector [X: {m.x}, Y: {m.y}]
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2: LIVE CHARACTER FUSION SANDBOX ENGINE */}
      <div style={{ background: '#16161a', padding: '25px', borderRadius: '8px', border: '1px solid #333' }}>
        <h3>Hero Fusion Core Sandbox</h3>
        <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Combine the fundamental genetics and baseline stats profiles of two tactical agents.</p>
        
        <div style={{ display: 'flex', gap: '15px', margin: '15px 0' }}>
          <select value={fusionParentA} onChange={(e) => setFusionParentA(e.target.value)} style={{ background: '#222', color: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #444', flex: 1 }}>
            {HERO_DATABASE.map(h => <option key={h.id} value={h.id}>Agent A: {h.name}</option>)}
          </select>
          <select value={fusionParentB} onChange={(e) => setFusionParentB(e.target.value)} style={{ background: '#222', color: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #444', flex: 1 }}>
            {HERO_DATABASE.map(h => <option key={h.id} value={h.id}>Agent B: {h.name}</option>)}
          </select>
        </div>

        <div style={{ background: '#0f0f12', padding: '15px', borderRadius: '4px', border: '1px dashed #646cff' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#646cff' }}>⚡ Fusion Result Matrix: {currentFusion.name}</h4>
          <p style={{ margin: '5px 0', fontSize: '0.9rem' }}><strong>Combined Structural Vitality (HP):</strong> {currentFusion.health}</p>
          <p style={{ margin: '5px 0', fontSize: '0.9rem' }}><strong>Velocity Rate (Speed):</strong> {currentFusion.speed} units/sec</p>
          <p style={{ margin: '5px 0', fontSize: '0.9rem', color: '#4caf50' }}><strong>Synthesized Ability Module:</strong> {currentFusion.fusedAbility}</p>
        </div>
      </div>

    </div>
  );
}