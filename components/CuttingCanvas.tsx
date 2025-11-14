import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Sheet, PlacedPiece, Rectangle, ShapeType } from '../types';
import { SHEET_COLOR, PLACED_PIECE_COLOR, REMNANT_COLOR, BORDER_COLOR, TEXT_COLOR } from '../constants';

interface CuttingCanvasProps {
  sheet: Sheet;
  placedPieces: PlacedPiece[];
  newRemnants: Sheet[];
  scaleFactor?: number; // Optional, for scaling the canvas view
  className?: string;
  pieceNameMap: Map<string, string>; // Map piece ID to piece name
}

// Helper function to convert radians to degrees (used in old DXF generation, but good for context)
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Função interna para desenhar uma única peça em um contexto de canvas específico.
 * Adaptada do JS original no index.html.
 * @param {CanvasRenderingContext2D} ctx - O contexto 2D do canvas.
 * @param {Object} p - O objeto da peça a ser desenhada.
 * @param {number} s - O fator de escala.
 * @param {boolean} hideText - Oculta o texto das dimensões (útil para exportação de alta res).
 */
function drawPieceToContext(ctx: CanvasRenderingContext2D, p: PlacedPiece, s: number, hideText: boolean = false) {
  const x = p.x;
  const y = p.y;
  const w = p.boundingBox.width;
  const h = p.boundingBox.height;

  // Use uma cor consistente ou atribua uma aleatória se necessário
  const color = PLACED_PIECE_COLOR; // Usando a cor definida no constants.ts

  // Desenha a caixa de contorno para depuração (opcional, pode ser removido)
  // ctx.beginPath();
  // ctx.rect(x * s, y * s, w * s, h * s);
  // ctx.strokeStyle = "rgba(0, 0, 255, 0.5)";
  // ctx.lineWidth = 1 / s;
  // ctx.stroke();

  ctx.fillStyle = color;
  ctx.strokeStyle = BORDER_COLOR;
  ctx.lineWidth = 1 / s;

  ctx.save();
  ctx.translate(x, y); // Translate to piece's origin
  if (p.rotation === 90) {
    ctx.rotate(90 * Math.PI / 180);
    ctx.translate(0, -p.boundingBox.width); // Adjust translation after rotation
  }

  ctx.beginPath(); // Inicia um novo caminho de desenho

  // Lógica para desenhar as diferentes formas de peça (adaptada do index.html original)
  switch (p.shape) {
    case ShapeType.CIRCLE: {
      const radius = p.dimensions.radius || 0;
      if (radius > 0) {
        ctx.arc(w / 2, h / 2, radius, 0, 2 * Math.PI);
      }
      break;
    }
    case ShapeType.SEMICIRCLE: {
      // Assuming 'length' is 'L' (straight side) and 'radius' is 'R_semi'
      // This is a simplified interpretation based on the old HTML logic
      const L = p.dimensions.length || 0; // The straight side of the semicircle
      const R_semi = p.dimensions.radius || 0; // The radius of the curved part

      if (L > 0 && R_semi > 0) {
        // The old HTML logic for semicircles had 'orient' (top/bottom) and
        // dimensions 'L' (straight side) and 'R' (radius of curve).
        // It rotated the piece if largura !== altura.
        // The bounding box for semicircles was typically L x R_semi (for top/bottom orient).
        // If it was rotated, it became R_semi x L.

        // We need to determine the current orientation of the bounding box relative to its original shape.
        // For simplicity here, we assume the bounding box (w, h) already reflects the actual placed dimensions.

        // Original logic for 'top'/'bottom' (base horizontal) or rotated (base vertical)
        const isBaseHorizontal = (Math.abs(w - L) < 0.1 && Math.abs(h - R_semi) < 0.1);
        const isBaseVertical = (Math.abs(w - R_semi) < 0.1 && Math.abs(h - L) < 0.1);

        // This assumes 'top' or 'bottom' in `Piece.dimensions` as a string for original orientation,
        // which isn't directly in `Piece` interface. For now, infer based on bounding box rotation.
        // The nesting service does not carry 'orient' or 'L' explicitly.
        // We'll approximate based on piece dimensions. For example, if 'L' was the length, and 'R' was the radius.
        // The `boundingBox` might have `width=L` and `height=R`.
        const currentL = p.boundingBox.width;
        const currentR = p.boundingBox.height; // Assuming R is along height when base is horizontal

        let centerX, centerY, startAngle, endAngle, counterClockwise;

        // Try to infer orientation based on bounding box dimensions and original dimensions (if available in `p.dimensions`)
        // Defaulting to 'top' orientation if original orientation is not passed explicitly.
        if (L === currentL && R_semi === currentR) { // Base horizontal (original top/bottom)
          centerX = currentL / 2;
          centerY = currentR; // Base at bottom of bounding box
          startAngle = Math.PI; // 180 deg
          endAngle = 0;         // 0 deg
          counterClockwise = false; // Draw arc clockwise from 180 to 0 (top curve)

          ctx.moveTo(0, currentR); // Start of base
          ctx.lineTo(currentL, currentR); // End of base
          ctx.arc(centerX, centerY, R_semi, startAngle, endAngle, counterClockwise);
        } else if (L === currentR && R_semi === currentL) { // Base vertical (original top/bottom, rotated 90 deg)
            centerX = currentL;
            centerY = currentR / 2; // Base at left of bounding box
            startAngle = Math.PI * 0.5; // 90 deg (top)
            endAngle = Math.PI * 1.5;   // 270 deg (bottom)
            counterClockwise = true; // Draw arc anti-clockwise from 90 to 270 (right curve)

            ctx.moveTo(currentL, 0); // Start of base
            ctx.lineTo(currentL, currentR); // End of base
            ctx.arc(centerX, centerY, R_semi, startAngle, endAngle, counterClockwise);
        } else { // Fallback to rectangle if dimensions are ambiguous
            ctx.rect(0, 0, w, h);
        }
      }
      break;
    }
    case ShapeType.RECTANGLE:
    default:
      ctx.rect(0, 0, w, h);
      break;
  }
  ctx.closePath();

  ctx.fill();
  ctx.stroke();

  // Adiciona o texto das dimensões no centro da peça
  if (!hideText && w * s > 30 && h * s > 15) { // Ensure text is large enough to be readable
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `${Math.max(8, Math.min(w, h) / 8)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const pieceDisplayName = p.name; // Use piece name
    ctx.fillText(pieceDisplayName, w / 2, h / 2);
  }
  ctx.restore();
}


const CuttingCanvas: React.FC<CuttingCanvasProps> = ({
  sheet,
  placedPieces,
  newRemnants,
  className = '',
  pieceNameMap, // Not directly used here, but for consistency if `p.name` is missing.
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentScale, setCurrentScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const clientWidth = canvas.clientWidth;
    const clientHeight = canvas.clientHeight;

    canvas.width = clientWidth * ratio;
    canvas.height = clientHeight * ratio;
    ctx.scale(ratio, ratio);

    // Clear canvas
    ctx.clearRect(0, 0, clientWidth, clientHeight);

    // Apply pan and zoom
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(currentScale, currentScale);

    // Calculate actual sheet dimensions in display units for scaling
    const displayWidth = sheet.width;
    const displayHeight = sheet.length; // Using length as height for drawing convention

    // Draw the main sheet
    ctx.fillStyle = SHEET_COLOR; // From constants.ts
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    ctx.strokeStyle = BORDER_COLOR; // From constants.ts
    ctx.lineWidth = 2 / currentScale; // Scale line width
    ctx.strokeRect(0, 0, displayWidth, displayHeight);

    // Draw new remnants
    newRemnants.forEach((remnant) => {
      if (remnant.originArea) {
        ctx.fillStyle = REMNANT_COLOR; // From constants.ts
        ctx.fillRect(remnant.originArea.x, remnant.originArea.y, remnant.originArea.width, remnant.originArea.height);
        ctx.strokeStyle = BORDER_COLOR;
        ctx.lineWidth = 1 / currentScale;
        ctx.strokeRect(remnant.originArea.x, remnant.originArea.y, remnant.originArea.width, remnant.originArea.height);

        ctx.fillStyle = TEXT_COLOR; // From constants.ts
        ctx.font = `${12 / currentScale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          `Retalho (${remnant.width}x${remnant.length})`,
          remnant.originArea.x + remnant.originArea.width / 2,
          remnant.originArea.y + remnant.originArea.height / 2,
        );
      }
    });

    // Draw placed pieces
    placedPieces.forEach((piece) => {
      drawPieceToContext(ctx, piece, currentScale);
    });

    ctx.restore(); // Restore context after pan and zoom
  }, [sheet, placedPieces, newRemnants, currentScale, panOffset]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const scaleAmount = 1.1;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    let newScale = currentScale;
    if (event.deltaY < 0) {
      newScale *= scaleAmount; // Zoom in
    } else {
      newScale /= scaleAmount; // Zoom out
    }
    newScale = Math.max(0.1, Math.min(5, newScale)); // Clamp scale

    // Calculate new offset to zoom towards mouse
    setPanOffset(prev => ({
      x: mouseX - ((mouseX - prev.x) / currentScale) * newScale,
      y: mouseY - ((mouseY - prev.y) / currentScale) * newScale,
    }));
    setCurrentScale(newScale);
  }, [currentScale]);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (event.button === 0) { // Left click
      setIsPanning(true);
      lastMousePos.current = { x: event.clientX, y: event.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (isPanning) {
      const dx = event.clientX - lastMousePos.current.x;
      const dy = event.clientY - lastMousePos.current.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: event.clientX, y: event.clientY };
    }
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleMouseOut = useCallback(() => {
    setIsPanning(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseout', handleMouseOut);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseout', handleMouseOut);
    };
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseOut]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      draw(); // Redraw when container size changes
    });

    resizeObserver.observe(canvas.parentElement!); // Observe the parent element for resizing
    return () => resizeObserver.disconnect();
  }, [draw]);


  return (
    <div className={`cutting-canvas-container w-full h-96 shadow-inner ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      ></canvas>
      <div className="absolute top-2 left-2 p-2 bg-white rounded-md shadow-sm text-xs text-gray-700 opacity-80">
        Zoom: {Math.round(currentScale * 100)}%
      </div>
    </div>
  );
};

export default CuttingCanvas;