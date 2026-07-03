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
  const animationRef = useRef(null);
  
  // Feature State Management
  const [markers, setMarkers] = useState([]);
  const [lines, setLines] = useState([]); 
  const [currentLine, setCurrentLine] = useState([]); 
  const [selectedHero, setSelectedHero] = useState(HERO_DATABASE[0]);
  const [activeTheater, setActiveTheater] = useState(THEATER_MAPS[0]);
  
  // Mode Matrix
  const [toolMode, setToolMode] = useState('node'); 
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState(null);

  // Playback Animation Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);

  // Analytics Layer: Cross-Session Global Heatmap Points array
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [globalHeatmapPoints, setGlobalHeatmapPoints] = useState([]);

  // Fusion Sandbox State
  const [fusionParentA, setFusionParentA] = useState('vanguard');
  const [fusionParentB, setFusionParentB] = useState('phantom');

  // Hook 1: Fetch baseline saved snapshots from Postgres tables on load
  useEffect(() => {
    fetchCloudData();
    if (showHeatmap) fetchGlobalAnalytics();
    cancelAnimationFrame(animationRef.current);
    setIsSimulating(false);
    setSimProgress(0);
  }, [activeTheater]);

  // Hook 2: Redraw canvas whenever state modifications occur
  useEffect(() => {
    drawCanvasMatrix();
  }, [markers, lines, currentLine, activeTheater, isSimulating, simProgress, showHeatmap, globalHeatmapPoints]);

  // Hook 3: Run the continuous route simulation playback loop
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

  // Hook 4: Live WebSocket listener stream
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
          // FIX 2: Explicit Manual Serialization Translation (Parsing text string back into multi-dimensional matrix)
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

  // Hook 5: Fetch global heatmap metrics when turned on
  useEffect(() => {
    if (showHeatmap) {
      fetchGlobalAnalytics();
    }
  }, [showHeatmap, activeTheater]);

  const fetchCloudData = async () => {
    const nodeRes = await supabase.from('tactical_nodes').select('*').eq('theater_id', activeTheater.id);
    if (nodeRes.data) {
      setMarkers(nodeRes.data.map(row => ({
        id: row.id, x: row.x, y: row.y, heroName: row.hero_name, color: row.color
      })));
    }

    const pathRes = await supabase.from('tactical_paths').select('*').eq('theater_id', activeTheater.id);
    if (pathRes.data) {
      setLines(pathRes.data.map(row => {
        // FIX 2: Explicit manual fallback parse
        const pointsArray = typeof row.points === 'string' ? JSON.parse(row.points) : row.points;
        return { id: row.id, points: pointsArray };
      }));
    }
  };

  // FIX 1: Fetch from global analytics table spanning ALL history & sessions
  const fetchGlobalAnalytics = async () => {
    const { data, error } = await supabase
      .from('global_analytics_logs')
      .select('x, y')
      .eq('theater_id', activeTheater.id);
    
    if (data) setGlobalHeatmapPoints(data);
  };

  const getXYAtProgress = (points, progress) => {
    if (!points || points.length === 0) return null;
    if (points.length === 1) return points[0];
    const totalSegments = points.length - 1;
    const targetSegment = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);
    const segmentStart = points[targetSegment];
    const segmentEnd = points[targetSegment + 1];
    const segmentProgress = (progress * totalSegments) - targetSegment;
    return {
      x: segmentStart.x + (segmentEnd.x - segmentStart.x) * segmentProgress,
      y: segmentStart.y + (segmentEnd.y - segmentStart.y) * segmentProgress
    };
  };

  const drawCanvasMatrix = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = activeTheater.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = activeTheater.gridColor;
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // --- RENDER LOW-LEVEL GLOBAL HEATMAP ---
    if (showHeatmap) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      
      // FIX 1: Render utilizing the Cross-Session historical database arrays
      globalHeatmapPoints.forEach((pt) => {
        const gradient = ctx.createRadialGradient(pt.x, pt.y, 2, pt.x, pt.y, 40);
        gradient.addColorStop(0, 'rgba(255, 30, 30, 0.6)');   
        gradient.addColorStop(0.5, 'rgba(255, 140, 0, 0.25)'); 
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');        
        
        ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 40, 0, 2 * Math.PI); ctx.fill();
      });
      ctx.restore();
    }

    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const drawPath = (points, strokeColor) => {
      if (!points || points.length < 2) return;
      ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.strokeStyle = strokeColor; ctx.stroke();
    };

    ctx.shadowBlur = 8;
    lines.forEach(line => drawPath(line.points, '#646cff'));
    if (currentLine.length > 0) drawPath(currentLine, '#ff3333');
    ctx.shadowBlur = 0; 

    // Find animated trajectory coordinates for active hero node traversal simulation
    let dynamicMovingHeroPos = null;
    if (isSimulating && lines.length > 0) {
      const activePathPoints = lines[lines.length - 1].points;
      dynamicMovingHeroPos = getXYAtProgress(activePathPoints, simProgress);
    }

    // Draw Hero markers
    markers.forEach((marker) => {
      // FIX 3: Check if this specific agent node is the one undergoing route simulation traversal
      const isThisHeroSimulating = isSimulating && marker.heroName === selectedHero.name;
      const renderX = isThisHeroSimulating && dynamicMovingHeroPos ? dynamicMovingHeroPos.x : marker.x;
      const renderY = isThisHeroSimulating && dynamicMovingHeroPos ? dynamicMovingHeroPos.y : marker.y;

      ctx.fillStyle = marker.color;
      ctx.shadowBlur = isThisHeroSimulating ? 24 : 12; 
      ctx.shadowColor = marker.color;
      
      ctx.beginPath(); 
      ctx.arc(renderX, renderY, isThisHeroSimulating ? 13 : 10, 0, 2 * Math.PI); 
      ctx.fill();
      
      if (isThisHeroSimulating) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.shadowBlur = 0; 
      ctx.fillStyle = isThisHeroSimulating ? '#000' : '#fff';
      ctx.font = 'bold 9px sans-serif'; 
      ctx.textAlign = 'center';
      ctx.fillText(marker.heroName.substring(0, 2).toUpperCase(), renderX, renderY + 3);
    });
  };

  const getCanvasCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top) };
  };

  const handleMouseDown = async (e) => {
    if (isSimulating) return;
    const coords = getCanvasCoords(e);

    if (toolMode === 'draw') {
      setIsDragging(true);
      setCurrentLine([coords]);
    } else {
      const clickedNode = markers.find(m => Math.hypot(m.x - coords.x, m.y - coords.y) < 15);
      if (clickedNode) {
        setIsDragging(true);
        setDraggedNodeId(clickedNode.id);
      } else {
        // Log to Active Session Table
        const newNodeData = { x: coords.x, y: coords.y, hero_name: selectedHero.name, color: selectedHero.iconColor, theater_id: activeTheater.id };
        const { data } = await supabase.from('tactical_nodes').insert([newNodeData]).select();
        
        // FIX 1: Record permanently to Global Cross-Session Analytics table
        await supabase.from('global_analytics_logs').insert([{ theater_id: activeTheater.id, x: coords.x, y: coords.y }]);

        if (data) {
          setMarkers([...markers, { id: data[0].id, x: data[0].x, y: data[0].y, heroName: data[0].hero_name, color: data[0].color }]);
          if (showHeatmap) fetchGlobalAnalytics();
        }
      }
    }
  };

  const handleMouseMove = async (e) => {
    if (!isDragging) return;
    const coords = getCanvasCoords(e);
    if (toolMode === 'draw') {
      setCurrentLine([...currentLine, coords]);
    } else if (draggedNodeId) {
      setMarkers(markers.map(m => m.id === draggedNodeId ? { ...m, x: coords.x, y: coords.y } : m));
      await supabase.from('tactical_nodes').update({ x: coords.x, y: coords.y }).eq('id', draggedNodeId);
    }
  };
  
  const handleMouseUp = async () => {
    if (!isDragging) return;
    if (toolMode === 'draw') {
      if (currentLine.length > 1) {
        // FIX 2: Explicit manual serialization translation via stringify onto standard serialization format
        const serializedStringifiedPoints = JSON.stringify(currentLine);

        const { data } = await supabase
          .from('tactical_paths')
          .insert([{ theater_id: activeTheater.id, points: serializedStringifiedPoints }])
          .select();

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
    // Ensure there is a path to trace, and that the chosen hero is currently placed on the grid map
    const isHeroPlaced = markers.some(m => m.heroName === selectedHero.name);
    if (lines.length === 0) {
      alert("Please draw a path line first!");
      return;
    }
    if (!isHeroPlaced) {
      alert(`Place ${selectedHero.name} onto the canvas grid before initiating their route movement execution simulation!`);
      return;
    }
    setSimProgress(0); setIsSimulating(true);
  };

  const calculateFusion = () => {
    const pA = HERO_DATABASE.find(h => h.id === fusionParentA); const pB = HERO_DATABASE.find(h => h.id === fusionParentB);
    return {
      name: `${pA.name.substring(0, 4)}-${pB.name.substring(pB.name.length - 4)} Core`,
      health: Math.round((pA.health + pB.health) / 2), speed: ((pA.speed + pB.speed) / 2).toFixed(1)
    };
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

      {/* CANVAS VIEW */}
      <div style={{ background: '#16161a', padding: '25px', borderRadius: '8px', border: '1px solid #333', textAlign: 'center' }}>
        <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
          {HERO_DATABASE.map(hero => (
            <button key={hero.id} onClick={() => setSelectedHero(hero)} style={{ background: selectedHero.id === hero.id ? hero.iconColor : '#222', color: selectedHero.id === hero.id ? '#000' : '#fff', border: '1px solid #444', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
              {hero.name} (Spd: {hero.speed})
            </button>
          ))}
        </div>

        <canvas ref={canvasRef} width={600} height={350} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} style={{ border: '2px solid #444', borderRadius: '4px', cursor: isSimulating ? 'wait' : (toolMode === 'draw' ? 'brush' : 'crosshair'), display: 'block', margin: '0 auto' }} />
      </div>

      {/* SANDBOX */}
      <div style={{ background: '#16161a', padding: '25px', borderRadius: '8px', border: '1px solid #333' }}>
        <h3>Hero Fusion Core Sandbox</h3>
        <div style={{ display: 'flex', gap: '15px', margin: '15px 0' }}>
          <select value={fusionParentA} onChange={(e) => setFusionParentA(e.target.value)} style={{ background: '#222', color: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #444', flex: 1 }}>
            {HERO_DATABASE.map(h => <option key={h.id} value={h.id}>Agent A: {h.name}</option>)}
          </select>
          <select value={fusionParentB} onChange={(e) => setFusionParentB(e.target.value)} style={{ background: '#222', color: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #444', flex: 1 }}>
            {HERO_DATABASE.map(h => <option key={h.id} value={h.id}>Agent B: {h.name}</option>)}
          </select>
        </div>
      </div>

    </div>
  );
}