import React, { useRef, useState } from 'react';

export default function TacticalMap() {
  const canvasRef = useRef(null);
  const [markers, setMarkers] = useState([]);

  const handleMapClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    // Create a new coordinate object
    const newMarker = { x, y, id: Date.now(), type: 'Alpha Entry Point' };
    const updatedMarkers = [...markers, newMarker];
    setMarkers(updatedMarkers);

    // Draw coordinate marker directly on browser HTML5 canvas context
    const ctx = canvasRef.current.getContext('2d');
    ctx.fillStyle = '#646cff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#646cff';
    
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fill();
    
    // Reset shadow for text or future actions
    ctx.shadowBlur = 0;
  };

  const clearMap = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, 600, 400);
    setMarkers([]);
  };

  return (
    <div style={{ border: '1px solid #444', padding: '25px', borderRadius: '8px', margin: '20px 0', backgroundColor: '#16161a', color: '#fff' }}>
      <h2>Tactical Blueprint Planner</h2>
      <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Click anywhere on the tactical sector map to lock down strategic navigation coordinates.</p>
      
      <div style={{ margin: '15px 0' }}>
        <canvas 
          ref={canvasRef}
          width={600} 
          height={400} 
          onClick={handleMapClick}
          style={{ border: '2px dashed #444', backgroundColor: '#0f0f12', cursor: 'crosshair', display: 'block', margin: '0 auto', borderRadius: '4px' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <button onClick={clearMap} style={{ backgroundColor: '#242424', color: '#ff3333', padding: '8px 16px', border: '1px solid #ff3333', borderRadius: '4px', cursor: 'pointer' }}>
          Reset Map Matrix
        </button>
        <span style={{ color: '#646cff', fontWeight: 'bold' }}>Active Vectors Locked: {markers.length}</span>
      </div>

      {markers.length > 0 && (
        <div style={{ marginTop: '20px', textAlign: 'left', maxHeight: '120px', overflowY: 'auto', backgroundColor: '#0f0f12', padding: '10px', borderRadius: '4px', border: '1px solid #222' }}>
          <strong style={{ fontSize: '0.85rem', color: '#888' }}>Live Structural Telemetry Log:</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px', fontSize: '0.8rem', fontFamily: 'monospace', marginTop: '5px' }}>
            {markers.map((m, idx) => (
              <div key={m.id} style={{ color: '#4caf50' }}>
                📍 Node {idx + 1}: Vector [X: {m.x}, Y: {m.y}]
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}