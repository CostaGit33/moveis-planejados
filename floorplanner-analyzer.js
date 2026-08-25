// floorplanner-analyzer.js
// Lê JSON do Floorplanner (FML) e extrai paredes, aberturas e móveis em formato padronizado

function extractWalls(fml) {
  // Estrutura fictícia: fml.state.walls[]
  if (!fml || !fml.state || !Array.isArray(fml.state.walls)) return [];
  return fml.state.walls.map(w => ({
    id: w.id,
    length: w.length || (Math.hypot((w.x2 - w.x1), (w.y2 - w.y1)) || 0),
    height: w.height || 2800,
    start: { x: w.x1, y: w.y1 },
    end: { x: w.x2, y: w.y2 }
  }));
}

function extractOpenings(fml) {
  if (!fml || !fml.state || !Array.isArray(fml.state.openings)) return [];
  return fml.state.openings.map(o => ({ id: o.id, type: o.type, width: o.width, height: o.height, wallId: o.wallId }));
}

function extractFurniture(fml) {
  if (!fml || !fml.state || !Array.isArray(fml.state.furniture)) return [];
  return fml.state.furniture.map(f => ({ id: f.id, name: f.name, x: f.x, y: f.y, rotation: f.rotation || 0, width: f.width, depth: f.depth, height: f.height }));
}

function analyzeFML(fml) {
  return {
    meta: { projectId: fml.id || null, name: fml.name || 'unnamed' },
    walls: extractWalls(fml),
    openings: extractOpenings(fml),
    furniture: extractFurniture(fml),
  };
}

module.exports = {
  analyzeFML,
  extractWalls,
  extractOpenings,
  extractFurniture,
};
