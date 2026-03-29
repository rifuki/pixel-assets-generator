/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Pencil, 
  Eraser, 
  Pipette, 
  Download, 
  Trash2, 
  Sparkles, 
  Grid3X3, 
  Layers, 
  Undo2, 
  Redo2,
  Maximize2,
  Minimize2,
  Image as ImageIcon,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Settings2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { geminiService } from './services/geminiService';
import { Grid, PixelData, DEFAULT_COLORS } from './types';

export default function App() {
  const [gridSize, setGridSize] = useState(256);
  const [cellSize, setCellSize] = useState(2);
  const [grid, setGrid] = useState<Grid>(() => 
    Array(256).fill(null).map(() => Array(256).fill({ color: 'transparent' }))
  );
  const [history, setHistory] = useState<Grid[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [activeTool, setActiveTool] = useState<'pencil' | 'eraser' | 'picker'>('pencil');
  const [isDrawing, setIsDrawing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedAngle, setSelectedAngle] = useState('front');
  const [selectedPose, setSelectedPose] = useState('idle');
  const [frameCount, setFrameCount] = useState(1);
  const [isTileable, setIsTileable] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg' | 'jpeg' | 'svg' | 'avif'>('png');

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animation preview loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnimating && grid[0]?.length > gridSize) {
      interval = setInterval(() => {
        setPreviewFrame(prev => (prev + 1) % (grid[0].length / gridSize));
      }, 150);
    }
    return () => clearInterval(interval);
  }, [isAnimating, grid, gridSize]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      
      switch (e.key.toLowerCase()) {
        case 'b': setActiveTool('pencil'); break;
        case 'e': setActiveTool('eraser'); break;
        case 'i': setActiveTool('picker'); break;
        case 'g': setShowGrid(prev => !prev); break;
        case 'z': if (e.ctrlKey || e.metaKey) undo(); break;
        case 'y': if (e.ctrlKey || e.metaKey) redo(); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // History management
  const saveToHistory = useCallback((newGrid: Grid) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newGrid)));
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setGrid(JSON.parse(JSON.stringify(prev)));
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setGrid(JSON.parse(JSON.stringify(next)));
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    const gridHeight = grid.length;
    const gridWidth = grid[0]?.length || 0;

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const pixel = grid[y][x];
        const startX = x * cellSize;
        const startY = y * cellSize;

        for (let py = 0; py < cellSize; py++) {
          for (let px = 0; px < cellSize; px++) {
            const idx = ((startY + py) * canvas.width + (startX + px)) * 4;
            if (!pixel || pixel.color === 'transparent') {
              data[idx] = 0;
              data[idx + 1] = 0;
              data[idx + 2] = 0;
              data[idx + 3] = 0;
            } else {
              // Convert hex to RGB
              const r = parseInt(pixel.color.slice(1, 3), 16);
              const g = parseInt(pixel.color.slice(3, 5), 16);
              const b = parseInt(pixel.color.slice(5, 7), 16);
              data[idx] = r;
              data[idx + 1] = g;
              data[idx + 2] = b;
              data[idx + 3] = 255;
            }
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [grid]);

  const handlePixelAction = (x: number, y: number) => {
    const gridHeight = grid.length;
    const gridWidth = grid[0]?.length || 0;
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return;

    if (activeTool === 'pencil') {
      if (grid[y][x].color === selectedColor) return;
      setGrid(prev => {
        const newGrid = [...prev];
        newGrid[y] = [...newGrid[y]];
        newGrid[y][x] = { color: selectedColor };
        return newGrid;
      });
    } else if (activeTool === 'eraser') {
      if (grid[y][x].color === 'transparent') return;
      setGrid(prev => {
        const newGrid = [...prev];
        newGrid[y] = [...newGrid[y]];
        newGrid[y][x] = { color: 'transparent' };
        return newGrid;
      });
    } else if (activeTool === 'picker') {
      const color = grid[y][x].color;
      if (color !== 'transparent') {
        setSelectedColor(color);
        setActiveTool('pencil');
      }
      return;
    }
  };

  const handleMouseDown = (e: React.MouseEvent, x: number, y: number) => {
    setIsDrawing(true);
    handlePixelAction(x, y);
  };

  const handleMouseEnter = (x: number, y: number) => {
    if (isDrawing) {
      handlePixelAction(x, y);
    }
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveToHistory(grid);
    }
  };

  const clearCanvas = () => {
    if (window.confirm('Clear canvas?')) {
      const newGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill({ color: 'transparent' }));
      setGrid(newGrid);
      saveToHistory(newGrid);
    }
  };

  const handleResize = (newSize: number) => {
    if (window.confirm(`Resize canvas to ${newSize}x${newSize}? This will clear your current work.`)) {
      const newGrid = Array(newSize).fill(null).map(() => Array(newSize).fill({ color: 'transparent' }));
      setGridSize(newSize);
      setGrid(newGrid);
      setHistory([newGrid]);
      setHistoryIndex(0);
    }
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const gridHeight = grid.length;
    const gridWidth = grid[0]?.length || 0;

    if (exportFormat === 'svg') {
      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gridWidth} ${gridHeight}" shape-rendering="crispEdges">`;
      grid.forEach((row, y) => {
        row.forEach((pixel, x) => {
          if (pixel.color !== 'transparent') {
            svgContent += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pixel.color}" />`;
          }
        });
      });
      svgContent += '</svg>';
      
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `pixelforge-art.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    // Create a temporary canvas for the actual pixel size (no scaling)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = gridWidth;
    tempCanvas.height = gridHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // For formats that don't support transparency, fill with white
    if (exportFormat === 'jpg' || exportFormat === 'jpeg') {
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, gridWidth, gridHeight);
    }

    grid.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel.color !== 'transparent') {
          tempCtx.fillStyle = pixel.color;
          tempCtx.fillRect(x, y, 1, 1);
        }
      });
    });

    const mimeType = exportFormat === 'png' ? 'image/png' : 
                     (exportFormat === 'jpg' || exportFormat === 'jpeg') ? 'image/jpeg' : 
                     'image/avif';

    const link = document.createElement('a');
    link.download = `pixelforge-art.${exportFormat}`;
    link.href = tempCanvas.toDataURL(mimeType);
    link.click();
  };

  const handleAIResponse = async (type: 'sprite' | 'tileset' | 'sheet') => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      let imageUrl = '';
      if (type === 'sprite') {
        imageUrl = await geminiService.generatePixelArt(prompt, selectedAngle, selectedPose, gridSize, frameCount);
      } else if (type === 'tileset') {
        imageUrl = await geminiService.generateTileset(prompt, isTileable);
      } else if (type === 'sheet') {
        imageUrl = await geminiService.generateCharacterSheet(prompt);
      }
      
      // Process image to grid
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      img.onload = () => {
        const actualWidth = type === 'sprite' ? gridSize * frameCount : gridSize;
        const actualHeight = gridSize;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = actualWidth;
        tempCanvas.height = actualHeight;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        tempCtx.drawImage(img, 0, 0, actualWidth, actualHeight);
        const imageData = tempCtx.getImageData(0, 0, actualWidth, actualHeight);
        const data = imageData.data;

        const newGrid: Grid = [];
        for (let y = 0; y < actualHeight; y++) {
          const row: PixelData[] = [];
          for (let x = 0; x < actualWidth; x++) {
            const i = (y * actualWidth + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // If it's pure white or transparent, make it transparent
            // (Gemini often generates on white background)
            if (a < 128 || (r > 240 && g > 240 && b > 240)) {
              row.push({ color: 'transparent' });
            } else {
              const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              row.push({ color: hex });
            }
          }
          newGrid.push(row);
        }
        setGrid(newGrid);
        saveToHistory(newGrid);
        setIsGenerating(false);
      };
    } catch (error) {
      console.error(error);
      setIsGenerating(false);
      alert('Failed to generate art. Please try again.');
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#121212] text-[#e0e0e0] font-mono select-none overflow-hidden">
      {/* Left Toolbar */}
      <div className="w-14 aseprite-panel flex flex-col items-center py-4 gap-4 z-20">
        <div className="p-2 bg-[#3a3a3a] rounded-lg mb-4">
          <Grid3X3 className="w-6 h-6 text-blue-400" />
        </div>
        
        <ToolButton 
          active={activeTool === 'pencil'} 
          onClick={() => setActiveTool('pencil')} 
          icon={<Pencil className="w-5 h-5" />} 
          label="Pencil (B)"
        />
        <ToolButton 
          active={activeTool === 'eraser'} 
          onClick={() => setActiveTool('eraser')} 
          icon={<Eraser className="w-5 h-5" />} 
          label="Eraser (E)"
        />
        <ToolButton 
          active={activeTool === 'picker'} 
          onClick={() => setActiveTool('picker')} 
          icon={<Pipette className="w-5 h-5" />} 
          label="Picker (I)"
        />
        
        <div className="h-px w-8 bg-[#3a3a3a] my-2" />
        
        <ToolButton 
          onClick={undo} 
          icon={<Undo2 className="w-5 h-5" />} 
          label="Undo (Ctrl+Z)"
          disabled={historyIndex <= 0}
        />
        <ToolButton 
          onClick={redo} 
          icon={<Redo2 className="w-5 h-5" />} 
          label="Redo (Ctrl+Y)"
          disabled={historyIndex >= history.length - 1}
        />
        
        <div className="mt-auto flex flex-col gap-2">
          <ToolButton 
            onClick={() => setZoom(prev => Math.min(prev + 0.2, 3))} 
            icon={<Maximize2 className="w-5 h-5" />} 
            label="Zoom In"
          />
          <ToolButton 
            onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.5))} 
            icon={<Minimize2 className="w-5 h-5" />} 
            label="Zoom Out"
          />
          <ToolButton 
            onClick={clearCanvas} 
            icon={<Trash2 className="w-5 h-5 text-red-400" />} 
            label="Clear All"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Header */}
        <header className="h-12 aseprite-panel flex items-center justify-between px-6 border-t-0 border-x-0">
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold tracking-widest text-gray-500 uppercase">PixelForge AI v1.0</span>
            <div className="h-4 w-px bg-[#3a3a3a]" />
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <span className="bg-[#3a3a3a] px-1.5 py-0.5 rounded">{gridSize}x{gridSize}</span>
              <span className="bg-[#3a3a3a] px-1.5 py-0.5 rounded">RGBA</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#3a3a3a] rounded border border-[#4a4a4a] overflow-hidden">
              <button 
                onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
                className="p-1.5 hover:bg-[#4a4a4a] transition-colors text-gray-400 hover:text-white border-r border-[#4a4a4a]"
                title="Zoom Out"
              >
                <Minimize2 className="w-3 h-3" />
              </button>
              <div className="px-2 text-[10px] font-bold text-gray-400 min-w-[40px] text-center">
                {Math.round(zoom * 100)}%
              </div>
              <button 
                onClick={() => setZoom(prev => Math.min(5, prev + 0.1))}
                className="p-1.5 hover:bg-[#4a4a4a] transition-colors text-gray-400 hover:text-white border-l border-[#4a4a4a]"
                title="Zoom In"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center bg-[#3a3a3a] rounded border border-[#4a4a4a] overflow-hidden">
              {(['png', 'jpg', 'jpeg', 'svg', 'avif'] as const).map((format) => (
                <button
                  key={format}
                  onClick={() => setExportFormat(format)}
                  className={`px-2 py-1 text-[10px] uppercase font-bold transition-colors ${
                    exportFormat === format ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {format}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowGrid(!showGrid)}
              className={`text-xs flex items-center gap-2 px-3 py-1 rounded border transition-all ${showGrid ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-[#3a3a3a] border-transparent text-gray-400'}`}
            >
              <Grid3X3 className="w-3 h-3" />
              Grid
            </button>
            <button 
              onClick={downloadImage}
              className="aseprite-button flex items-center gap-2 text-xs"
            >
              <Download className="w-3 h-3" />
              Export {exportFormat.toUpperCase()}
            </button>
          </div>
        </header>

        {/* Canvas Area */}
        <main 
          className="flex-1 bg-[#0a0a0a] overflow-auto flex items-center justify-center p-20 relative"
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Canvas Container */}
          <div 
            className="relative shadow-2xl cursor-crosshair"
            style={{ 
              width: (grid[0]?.length || gridSize) * cellSize, 
              height: grid.length * cellSize,
              transform: `scale(${zoom})`,
              transition: 'transform 0.1s ease-out'
            }}
            onMouseDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = Math.floor((e.clientX - rect.left) / (cellSize * zoom));
              const y = Math.floor((e.clientY - rect.top) / (cellSize * zoom));
              handleMouseDown(e, x, y);
            }}
            onMouseMove={(e) => {
              if (isDrawing) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = Math.floor((e.clientX - rect.left) / (cellSize * zoom));
                const y = Math.floor((e.clientY - rect.top) / (cellSize * zoom));
                handleMouseEnter(x, y);
              }
            }}
          >
            {/* Checkerboard Background */}
            <div className="absolute inset-0 bg-[#1a1a1a] pixel-grid opacity-20" />
            
            {/* Main Drawing Canvas */}
            <canvas 
              ref={canvasRef} 
              width={(grid[0]?.length || gridSize) * cellSize} 
              height={grid.length * cellSize} 
              className="absolute inset-0 w-full h-full image-pixelated"
              style={{ backgroundColor: '#ffffff' }}
            />

            {/* Grid Overlay (only visible when zoomed in or toggled) */}
            {showGrid && zoom > 0.5 && (
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), 
                                  linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)`,
                  backgroundSize: `${cellSize}px ${cellSize}px`
                }}
              />
            )}
          </div>
        </main>

        {/* Bottom AI Panel */}
        <div className="h-24 aseprite-panel border-b-0 border-x-0 flex flex-col p-4 gap-3">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
              <input 
                type="text" 
                placeholder="Describe your character (e.g. 'cyberpunk knight')..."
                className="w-full aseprite-input pl-10 h-10"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAIResponse('sprite')}
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleAIResponse('sheet')}
                disabled={isGenerating || !prompt}
                className="aseprite-button h-10 bg-purple-600 hover:bg-purple-500 border-purple-400 flex items-center gap-2 min-w-[160px] justify-center"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Grid3X3 className="w-4 h-4" />}
                Generate Sheet
              </button>
              <button 
                onClick={() => handleAIResponse('sprite')}
                disabled={isGenerating || !prompt}
                className="aseprite-button h-10 bg-[#3a3a3a] hover:bg-[#4a4a4a] border-[#4a4a4a] flex items-center gap-2 min-w-[140px] justify-center"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                Single Sprite
              </button>
              <button 
                onClick={() => handleAIResponse('tileset')}
                disabled={isGenerating || !prompt}
                className="aseprite-button h-10 bg-blue-600 hover:bg-blue-500 border-blue-400 flex items-center gap-2 min-w-[140px] justify-center"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                Generate Tileset
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            <div className="flex items-center gap-3">
              <span>Single Sprite Angle:</span>
              <div className="flex bg-[#1a1a1a] rounded p-0.5 border border-[#3a3a3a]">
                {['front', 'back', 'side', '3/4'].map(angle => (
                  <button
                    key={angle}
                    onClick={() => setSelectedAngle(angle)}
                    className={`px-2 py-1 rounded transition-colors ${selectedAngle === angle ? 'bg-purple-600 text-white' : 'hover:bg-[#2a2a2a]'}`}
                  >
                    {angle}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span>Pose:</span>
              <div className="flex bg-[#1a1a1a] rounded p-0.5 border border-[#3a3a3a]">
                {['idle', 'walking', 'jumping', 'attacking', 'damaged'].map(pose => (
                  <button
                    key={pose}
                    onClick={() => setSelectedPose(pose)}
                    className={`px-2 py-1 rounded transition-colors ${selectedPose === pose ? 'bg-purple-600 text-white' : 'hover:bg-[#2a2a2a]'}`}
                  >
                    {pose}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span>Frames:</span>
              <div className="flex bg-[#1a1a1a] rounded p-0.5 border border-[#3a3a3a]">
                {[1, 2, 4, 6, 8].map(count => (
                  <button
                    key={count}
                    onClick={() => {
                      setFrameCount(count);
                      if (count === 1) setIsAnimating(false);
                    }}
                    className={`px-2 py-1 rounded transition-colors ${frameCount === count ? 'bg-purple-600 text-white' : 'hover:bg-[#2a2a2a]'}`}
                  >
                    {count}
                  </button>
                ))}
              </div>
              {frameCount > 1 && (
                <button
                  onClick={() => setIsAnimating(!isAnimating)}
                  className={`p-2 rounded border transition-all ${isAnimating ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-[#1a1a1a] border-[#3a3a3a] text-gray-400'}`}
                >
                  {isAnimating ? 'Stop' : 'Play'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span>Tileset:</span>
              <button
                onClick={() => setIsTileable(!isTileable)}
                className={`px-3 py-1 rounded border transition-all ${isTileable ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-[#1a1a1a] border-[#3a3a3a] text-gray-400'}`}
              >
                {isTileable ? 'Tileable ON' : 'Tileable OFF'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            className="w-64 aseprite-panel border-y-0 border-r-0 flex flex-col"
          >
            <div className="p-4 border-b border-[#3a3a3a] flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-gray-400 flex items-center gap-2">
                <Settings2 className="w-3 h-3" />
                Properties
              </span>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-white">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-6">
              {/* Canvas Settings */}
              <section>
                <h3 className="text-[10px] uppercase text-gray-500 font-bold mb-3 tracking-wider">Canvas Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1.5">Resolution</label>
                    <select 
                      value={gridSize}
                      onChange={(e) => handleResize(Number(e.target.value))}
                      className="w-full bg-[#1a1a1a] border border-[#3a3a3a] rounded p-1.5 text-[10px] text-white outline-none focus:border-blue-500"
                    >
                      {[16, 32, 64, 128, 256].map(size => (
                        <option key={size} value={size}>{size}x{size}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1.5">Pixel Size: {cellSize}px</label>
                    <input 
                      type="range"
                      min="1"
                      max="16"
                      value={cellSize}
                      onChange={(e) => setCellSize(Number(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                  </div>
                </div>
              </section>

              {/* Animation Preview */}
              {grid[0]?.length > gridSize && (
                <section>
                  <h3 className="text-[10px] uppercase text-gray-500 font-bold mb-3 tracking-wider">Animation Preview</h3>
                  <div className="bg-[#1a1a1a] border border-[#3a3a3a] rounded p-4 flex items-center justify-center relative overflow-hidden aspect-square">
                    <div 
                      className="image-pixelated"
                      style={{
                        width: gridSize * 2,
                        height: gridSize * 2,
                        backgroundImage: `url(${canvasRef.current?.toDataURL()})`,
                        backgroundPosition: `-${previewFrame * gridSize * 2}px 0`,
                        backgroundSize: `${(grid[0].length / gridSize) * gridSize * 2}px ${gridSize * 2}px`,
                        backgroundRepeat: 'no-repeat'
                      }}
                    />
                  </div>
                </section>
              )}

              {/* Color Palette */}
              <section>
                <h3 className="text-[10px] uppercase text-gray-500 font-bold mb-3 tracking-wider">Palette</h3>
                <div className="grid grid-cols-6 gap-1">
                  {DEFAULT_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-full aspect-square rounded-sm border-2 transition-transform active:scale-90 ${selectedColor === color ? 'border-white scale-110 z-10' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div className="col-span-6 mt-2 flex items-center gap-2">
                    <input 
                      type="color" 
                      value={selectedColor} 
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="w-8 h-8 bg-transparent border-none cursor-pointer"
                    />
                    <span className="text-[10px] text-gray-400 font-mono uppercase">{selectedColor}</span>
                  </div>
                </div>
              </section>

              {/* Layers (Mock) */}
              <section>
                <h3 className="text-[10px] uppercase text-gray-500 font-bold mb-3 tracking-wider">Layers</h3>
                <div className="space-y-1">
                  <div className="flex items-center justify-between p-2 bg-blue-500/20 border border-blue-500/30 rounded text-[10px]">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3 h-3" />
                      <span>Layer 1</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-[#1a1a1a] border border-transparent rounded text-[10px] opacity-50">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3 h-3" />
                      <span>Background</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* AI History (Mock) */}
              <section>
                <h3 className="text-[10px] uppercase text-gray-500 font-bold mb-3 tracking-wider">AI Suggestions</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="aspect-square bg-[#1a1a1a] rounded border border-[#3a3a3a] flex items-center justify-center group cursor-pointer hover:border-purple-500/50">
                      <ImageIcon className="w-4 h-4 text-gray-600 group-hover:text-purple-400" />
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="p-4 bg-[#1a1a1a] border-t border-[#3a3a3a]">
              <div className="flex items-center justify-between text-[10px] text-gray-500">
                <span>Memory: 1.2MB</span>
                <span>FPS: 60</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!sidebarOpen && (
        <button 
          onClick={() => setSidebarOpen(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-12 bg-[#252525] border border-r-0 border-[#3a3a3a] rounded-l-lg flex items-center justify-center text-gray-500 hover:text-white z-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function ToolButton({ 
  icon, 
  label, 
  active = false, 
  onClick, 
  disabled = false 
}: { 
  icon: React.ReactNode, 
  label: string, 
  active?: boolean, 
  onClick?: () => void,
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-2.5 rounded-lg transition-all relative group ${
        active 
          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
          : 'text-gray-400 hover:bg-[#3a3a3a] hover:text-gray-200'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {icon}
      {/* Tooltip */}
      <div className="absolute left-full ml-3 px-2 py-1 bg-black text-[10px] text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity border border-[#3a3a3a]">
        {label}
      </div>
    </button>
  );
}

