import React, { useRef, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const HERO_DATABASE = [
  { id: 'vanguard', name: 'Vanguard', role: 'Tank', health: 600, speed: 3.0, iconColor: '#4caf50', ability: 'Barricade Shield' },
  { id: 'phantom', name: 'Phantom', role: 'Duelist', health: 200, speed: 6.0, iconColor: '#ff9800', ability: 'Phase Dash' },
  { id: 'horizon', name: 'Horizon', role: 'Support', health: 250, speed: 4.5, iconColor: '#00bcd4', ability: 'Healing Ward' },
  { id: 'glitch', name: 'Glitch', role: 'Controller', health: 300, speed: 4.0, iconColor: '#e91e63', ability: 'System EMP' }
];

const THEATER_MAPS = [
  { id: 'sector-alpha', name: 'Sector Alpha Grid (Default)', bgColor: '#0f0f12', gridColor: '#222' },
  { id: 'omega-facility', name: 'Omega Lab Complex', bgColor: '#181313', gridColor: '#3c1a1a' },
  { id: 'deep-space-outpost', name: 'Deep Space Station', bgColor: '#0b131a', gridColor: '#1a334d' }
];

export default function TacticalMap() {
  const canvasRef = useRef(null);
  const reactorCanvasRef = useRef(null); // Reference for the sandbox visualizer
  const animationRef = useRef(null);
  const reactorAnimationRef = useRef(null); // Reference for the sandbox particle loop
  
  const [markers, setMarkers] = useState([]);
  const [lines, setLines] = useState([]); 
  const [currentLine, setCurrentLine] = useState([]); 
  const [selectedHero, setSelectedHero] = useState(HERO_DATABASE[0]);
  const [activeTheater, setActiveTheater] = useState(THEATER_MAPS[0]);
  
  const [toolMode, setToolMode] = useState('node'); 
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState(null);

  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [globalHeatmapPoints, setGlobalHeatmapPoints] = useState([]);

  const [fusionParentA, setFusionParentA] = useState('vanguard');
  const [fusionParentB, setFusionParentB] = useState('phantom');

  useEffect(() => {
    fetchCloudData();
    if (showHeatmap) fetchGlobalAnalytics();
    cancelAnimationFrame(animationRef.current);
    setIsSimulating(false);
    setSimProgress(0);
  }, [activeTheater]);

  useEffect(() => {
    drawCanvasMatrix();
  }, [markers, lines, currentLine, activeTheater, isSimulating, simProgress, showHeatmap, globalHeatmapPoints]);

  // Hook for Loop Animation Playback
  useEffect(() => {
    if (!isSimulating) return;
    const updateAnimationFrame = () => {
      setSimProgress((prev) => {
        const increment = (selectedHero.speed / 1000);
        if (prev + increment >= 1) {
          setIsSimulating(false);
          return 0;
        }
        return prev + increment;
      });
      animationRef.current = requestAnimationFrame(updateAnimationFrame);
    };
    animationRef.current = requestAnimationFrame(updateAnimationFrame);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isSimulating, selectedHero]);

  // --- RECT REACTOR ANIMATION LOOP ---
  useEffect(() => {
    const canvas = reactorCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    
    const pA = HERO_DATABASE.find(h => h.id === fusionParentA);
    const pB = HERO_DATABASE.find(h => h.id === fusionParentB);

    const runReactorLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Spawn particles from both parent nodes flying into the center core
      if (particles.length < 40) {
        particles.push({
          x: Math.random() > 0.5 ? 40 : canvas.width - 40,
          y: canvas.height / 2 + (Math.random() * 20 - 10),
          targetX: canvas.width / 2,
          targetY: canvas.height / 2,
          color: Math.random() > 0.5 ? pA.iconColor : pB.iconColor,
          size: Math.random() * 3 + 1,
          speed: Math.random() * 2 + 1
        });
      }

      particles.forEach((p, i) => {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 4) {
          particles.splice(i, 1); // Absorbed into core energy matrix
        } else {
          p.x += (dx / dist) * p.speed;
          p.y += (dy / dist) * p.speed;
          
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
          ctx.fill();
        }
      });

      // Render Central Blended Energy Core Ring
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = pA.iconColor;
      ctx.strokeStyle = pA.iconColor;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, 25, 0, 2 * Math.PI); ctx.stroke();

      ctx.shadowColor = pB.iconColor;
      ctx.strokeStyle = pB.iconColor;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, 20 + Math.sin(Date.now() / 100) * 3, 0, 2 * Math.PI); ctx.stroke();
      ctx.restore();

      // Parent Node Terminals Indicators
      ctx.fillStyle = pA.iconColor;
      ctx.beginPath(); ctx.arc(40, canvas.height / 2, 12, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = pB.iconColor;
      ctx.beginPath(); ctx.arc(canvas.width - 40, canvas.height / 2, 12, 0, 2 * Math.PI); ctx.fill();

      reactorAnimationRef.current = requestAnimationFrame(runReactorLoop);
    };

    reactorAnimationRef.current = requestAnimationFrame(runReactorLoop);
    return () => cancelAnimationFrame(reactorAnimationRef.current);
  }, [fusionParentA, fusionParentB]);

  // Realtime Listeners Sync Hooks
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tactical_nodes' }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new.theater_id === activeTheater.id) {
          const incomingNode = { id: payload.new.id, x: payload.new.x, y: payload.new.y, heroName: payload.new.hero_name, color: payload.new.color };
          setMarkers((prev) => prev.some(m => m.id === incomingNode.id) ? prev : [...prev, incomingNode]);
        } else if (payload.eventType === 'UPDATE' && payload.new.theater_id === activeTheater.id) {
          setMarkers((prev) => prev.map(m => m.id === payload.new.id ? { ...m, x: payload.new.x, y: payload.new.y } : m));
        } else if (payload.eventType === 'DELETE') {
          fetchCloudData();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tactical_paths' }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new.theater_id === activeTheater.id) {
          const parsedPoints = typeof payload.new.points === 'string' ? JSON.parse(payload.new.points) : payload.new.points;
          const incomingLine = { id: payload.new.id, points: parsedPoints };
          setLines((prev) => prev.some(l => l.id === incomingLine.id) ? prev : [...prev, incomingLine]);
        } else if (payload.eventType === 'DELETE') {
          setLines([]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTheater]);

  useEffect(() => {
    if (showHeatmap) fetchGlobalAnalytics();
  }, [showHeatmap, activeTheater]);

  const fetchCloudData = async () => {
    const nodeRes = await supabase.from('tactical_nodes').select('*').eq('theater_id', activeTheater.id);
    if (nodeRes.data) {
      setMarkers(nodeRes.data.map(row => ({ id: row.id, x: row.x, y: row.y, heroName: row.hero_name, color: row.color })));
    }
    const pathRes = await supabase.from('tactical_paths').select('*').eq('theater_id', activeTheater.id);
    if (pathRes.data) {
      setLines(pathRes.data.map(row => {
        const pointsArray = typeof row.points === 'string' ? JSON.parse(row.points) : row.points;
        return { id: row.id, points: pointsArray };
      }));
    }
  };

  const fetchGlobalAnalytics = async () => {
    const { data } = await supabase.from('global_analytics_logs').select('x, y').eq('theater_id', activeTheater.id);
    if (data) setGlobalHeatmapPoints(data);
  };

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: Math.round(clientX - rect.left), y: Math.round(clientY - rect.top) };
  };

  const handleStartAction = async (coords) => {
    if (isSimulating) return;
    if (toolMode === 'draw') {
      setIsDragging(true); setCurrentLine([coords]);
    } else {
      const clickedNode = markers.find(m => Math.hypot(m.x - coords.x, m.y - coords.y) < 15);
      if (clickedNode) {
        setIsDragging(true); setDraggedNodeId(clickedNode.id);
      } else {
        const newNodeData = { x: coords.x, y: coords.y, hero_name: selectedHero.name, color: selectedHero.iconColor, theater_id: activeTheater.id };
        const { data } = await supabase.from('tactical_nodes').insert([newNodeData]).select();
        await supabase.from('global_analytics_logs').insert([{ theater_id: activeTheater.id, x: coords.x, y: coords.y }]);
        if (data) {
          setMarkers([...markers, { id: data[0].id, x: data[0].x, y: data[0].y, heroName: data[0].hero_name, color: data[0].color }]);
          if (showHeatmap) fetchGlobalAnalytics();
        }
      }
    }
  };

  const handleMoveAction = async (coords) => {
    if (!isDragging) return;
    if (toolMode === 'draw') {
      setCurrentLine([...currentLine, coords]);
    } else if (draggedNodeId) {
      setMarkers(markers.map(m => m.id === draggedNodeId ? { ...m, x: coords.x, y: coords.y } : m));
      await supabase.from('tactical_nodes').update({ x: coords.x, y: coords.y }).eq('id', draggedNodeId);
    }
  };
  
  const handleEndAction = async () => {
    if (!isDragging) return;
    if (toolMode === 'draw') {
      if (currentLine.length > 1) {
        const serializedStringifiedPoints = JSON.stringify(currentLine);
        const { data } = await supabase.from('tactical_paths').insert([{ theater_id: activeTheater.id, points: serializedStringifiedPoints }]).select();
        if (data) {
          const parsedPoints = typeof data[0].points === 'string' ? JSON.parse(data[0].points) : data[0].points;
          setLines([...lines, { id: data[0].id, points: parsedPoints }]);
        }
      }
      setCurrentLine([]);
    }
    setIsDragging(false); setDraggedNodeId(null);
  };

  const clearMap = async () => {
    cancelAnimationFrame(animationRef.current);
    setIsSimulating(false); setSimProgress(0); setLines([]); setMarkers([]);
    await supabase.from('tactical_nodes').delete().eq('theater_id', activeTheater.id);
    await supabase.from('tactical_paths').delete().eq('theater_id', activeTheater.id);
  };

  const startPlaybackSimulation = () => {
    const isHeroPlaced = markers.some(m => m.heroName === selectedHero.name);
    if (lines.length === 0) { alert("Please draw a path line first!"); return; }
    if (!isHeroPlaced) { alert(`Place ${selectedHero.name} onto the canvas grid before initiating simulation!`); return; }
    setSimProgress(0); setIsSimulating(true);
  };

  const calculateFusion = () => {
    const pA = HERO_DATABASE.find(h => h.id === fusionParentA); 
    const pB = HERO_DATABASE.find(h => h.id === fusionParentB);
    
    // Custom logic mapping unique combined strings for fused baseline tactical descriptors
    let customAbility = `${pA.ability.split(' ')[0]} ${pB.ability.split(' ')[1] || 'Pulse'}`;
    if (pA.id === pB.id) customAbility = `Overcharged ${pA.ability}`;

    return {
      name: `${pA.name.substring(0, 4)}-${pB.name.substring(pB.name.length - 4)} Core`,
      health: Math.round((pA.health + pB.health) / 2), 
      speed: ((pA.speed + pB.speed) / 2).toFixed(1),
      ability: customAbility
    };
  };

  const drawCanvasMatrix = () => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d');
    ctx.fillStyle = activeTheater.bgColor; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = activeTheater.gridColor; ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    if (showHeatmap) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      globalHeatmapPoints.forEach((pt) => {
        const gradient = ctx.createRadialGradient(pt.x, pt.y, 2, pt.x, pt.y, 40);
        gradient.addColorStop(0, 'rgba(255, 30, 30, 0.6)'); gradient.addColorStop(0.5, 'rgba(255, 140, 0, 0.25)'); gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');        
        ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(pt.x, pt.y, 40, 0, 2 * Math.PI); ctx.fill();
      });
      ctx.restore();
    }
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    lines.forEach(line => { if (line.points && line.points.length >= 2) { ctx.beginPath(); ctx.moveTo(line.points[0].x, line.points[0].y); line.points.forEach(p => ctx.lineTo(p.x, p.y)); ctx.strokeStyle = '#646cff'; ctx.stroke(); } });
    if (currentLine.length > 0) { ctx.beginPath(); ctx.moveTo(currentLine[0].x, currentLine[0].y); currentLine.forEach(p => ctx.lineTo(p.x, p.y)); ctx.strokeStyle = '#ff3333'; ctx.stroke(); }
    let dynamicMovingHeroPos = null;
    if (isSimulating && lines.length > 0) { dynamicMovingHeroPos = getXYAtProgress(lines[lines.length - 1].points, simProgress); }
    markers.forEach((marker) => {
      const isThisHeroSimulating = isSimulating && marker.heroName === selectedHero.name;
      const renderX = isThisHeroSimulating && dynamicMovingHeroPos ? dynamicMovingHeroPos.x : marker.x;
      const renderY = isThisHeroSimulating && dynamicMovingHeroPos ? dynamicMovingHeroPos.y : marker.y;
      ctx.fillStyle = marker.color; ctx.shadowBlur = isThisHeroSimulating ? 24 : 12; ctx.shadowColor = marker.color;
      ctx.beginPath(); ctx.arc(renderX, renderY, isThisHeroSimulating ? 13 : 10, 0, 2 * Math.PI); ctx.fill();
      if (isThisHeroSimulating) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.shadowBlur = 0; ctx.fillStyle = isThisHeroSimulating ? '#000' : '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(marker.heroName.substring(0, 2).toUpperCase(), renderX, renderY + 3);
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', color: '#fff' }}>
      
      {/* CONTROLS */}
      <div style={{ background: '#16161a', padding: '20px', borderRadius: '8px', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
        <div>
          <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Theater: </label>
          <select value={activeTheater.id} onChange={(e) => setActiveTheater(THEATER_MAPS.find(m => m.id === e.target.value))} style={{ background: '#222', color: '#fff', padding: '6px', borderRadius: '4px', border: '1px solid #444' }}>
            {THEATER_MAPS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px', background: '#0f0f12', padding: '4px', borderRadius: '6px', border: '1px solid #333' }}>
          <button onClick={() => setToolMode('node')} style={{ background: toolMode === 'node' ? '#646cff' : 'transparent', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>📍 Place Agents</button>
          <button onClick={() => setToolMode('draw')} style={{ background: toolMode === 'draw' ? '#646cff' : 'transparent', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>✏️ Draw Paths</button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowHeatmap(!showHeatmap)} style={{ background: showHeatmap ? '#e91e63' : '#222', color: '#fff', border: '1px solid #444', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            📊 {showHeatmap ? 'Hide Global Analytics' : 'Show Global Heatmap'}
          </button>
          <button onClick={startPlaybackSimulation} disabled={isSimulating} style={{ background: isSimulating ? '#444' : '#4caf50', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: isSimulating ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {isSimulating ? '⚡ Moving...' : '▶️ Simulate Hero Movement'}
          </button>
          <button onClick={clearMap} style={{ background: '#ff3333', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Reset Grid</button>
        </div>
      </div>

      {/* CANVAS VIEW CONTAINER */}
      <div style={{ background: '#16161a', padding: '25px', borderRadius: '8px', border: '1px solid #333', textAlign: 'center' }}>
        <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
          {HERO_DATABASE.map(hero => (
            <button key={hero.id} onClick={() => setSelectedHero(hero)} style={{ background: selectedHero.id === hero.id ? hero.iconColor : '#222', color: selectedHero.id === hero.id ? '#000' : '#fff', border: '1px solid #444', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
              {hero.name} (Spd: {hero.speed})
            </button>
          ))}
        </div>

        <canvas 
          ref={canvasRef} width={600} height={350} 
          onMouseDown={(e) => handleStartAction(getCanvasCoords(e))} onMouseMove={(e) => handleMoveAction(getCanvasCoords(e))} onMouseUp={handleEndAction} onMouseLeave={handleEndAction}
          onTouchStart={(e) => { e.preventDefault(); handleStartAction(getCanvasCoords(e)); }} onTouchMove={(e) => { e.preventDefault(); handleMoveAction(getCanvasCoords(e)); }} onTouchEnd={(e) => { e.preventDefault(); handleEndAction(); }}
          style={{ border: '2px solid #444', borderRadius: '4px', cursor: isSimulating ? 'wait' : (toolMode === 'draw' ? 'brush' : 'crosshair'), display: 'block', margin: '0 auto', touchAction: 'none' }} 
        />
      </div>

      {/* DYNAMIC FUSION CORE SANDBOX */}
      <div style={{ background: '#16161a', padding: '25px', borderRadius: '8px', border: '1px solid #333', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h3 style={{ marginTop: 0, color: '#646cff' }}>Hero Fusion Core Sandbox</h3>
          <p style={{ color: '#888', fontSize: '0.85rem' }}>Select two character profiles below to synthesize their matrix stats into a combined core prototype:</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '15px 0' }}>
            <select value={fusionParentA} onChange={(e) => setFusionParentA(e.target.value)} style={{ background: '#222', color: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #444', cursor: 'pointer' }}>
              {HERO_DATABASE.map(h => <option key={h.id} value={h.id}>Agent Alpha: {h.name}</option>)}
            </select>
            <select value={fusionParentB} onChange={(e) => setFusionParentB(e.target.value)} style={{ background: '#222', color: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #444', cursor: 'pointer' }}>
              {HERO_DATABASE.map(h => <option key={h.id} value={h.id}>Agent Beta: {h.name}</option>)}
            </select>
          </div>

          <div style={{ background: '#0f0f12', padding: '15px', borderRadius: '6px', border: '1px dashed #444' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#646cff', fontSize: '1.1rem' }}>⚡ Core Matrix: {calculateFusion().name}</h4>
            <p style={{ margin: '6px 0', fontSize: '0.9rem' }}><strong>Vitality Rating (HP):</strong> {calculateFusion().health}</p>
            <p style={{ margin: '6px 0', fontSize: '0.9rem' }}><strong>Velocity Index (Speed):</strong> {calculateFusion().speed} units/sec</p>
            <p style={{ margin: '6px 0', fontSize: '0.9rem', color: '#ff9800' }}><strong>Synthesized Ability:</strong> {calculateFusion().ability}</p>
          </div>
        </div>

        {/* HIGH-LEVEL PARTICLE ACCELERATOR REACTOR CANVAS CONTAINER */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#0f0f12', borderRadius: '6px', border: '1px solid #333', padding: '10px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#666', marginBottom: '8px', letterSpacing: '1px' }}>CORE DATA FUSION REACTOR VISUALIZER</span>
          <canvas ref={reactorCanvasRef} width={300} height={180} style={{ background: '#0b0b0d', border: '1px solid #222', borderRadius: '4px' }} />
        </div>
      </div>

    </div>
  );
}