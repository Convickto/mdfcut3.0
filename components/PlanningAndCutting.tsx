import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sheet, Piece, PlacedPiece, MaterialType, ShapeType, CurrentPlanState } from '../types';
import Button from './Button';
import Modal from './Modal';
import MaterialSelector from './MaterialSelector';
import CuttingCanvas from './CuttingCanvas';
import OnboardingSteps from './OnboardingSteps';
import { calculatePieceBoundingBox, createCuttingPlan } from '../services/nestingService';
import { storageService } from '../services/storageService';
import { SHAPE_TYPES, STANDARD_MATERIALS, DEFAULT_CUT_PLAN_NAME } from '../constants';
import { v4 as uuidv4 } from 'uuid';

interface PlanningAndCuttingProps {
  onPlanUpdate: (plan: CurrentPlanState) => void;
  currentPlan: CurrentPlanState;
  onConfirmPlan: () => void;
  sheets: Sheet[];
  remnants: Sheet[];
  loadingCutPlan: boolean;
  cutPlanProgress: string;
}

// Helper function to convert radians to degrees (used in old DXF generation, but good for context)
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Função para gerar a string DXF a partir de uma chapa simulada.
 * Adaptada da lógica do index.html original.
 */
function generateDxfString(chapa: Sheet, placedPieces: PlacedPiece[]): string {
    let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLTYPE\n70\n1\n0\nLTYPE\n2\nContinuous\n70\n64\n1\n\n0\nENDTAB\n0\nTABLE\n2\nLAYER\n70\n1\n0\nLAYER\n2\n0\n70\n0\n6\nContinuous\n62\n7\n0\nENDTAB\n0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nENTITIES\n";

    const LARGURA_CHAPA = chapa.width;
    const ALTURA_CHAPA = chapa.length;

    // Desenha a borda da chapa
    dxf += "0\nLWPOLYLINE\n5\n" + uuidv4().substring(0, 8).toUpperCase() + "\n330\n" + uuidv4().substring(0, 8).toUpperCase() + "\n100\nAcDbEntity\n8\nCHAPA\n100\nAcDbPolyline\n90\n4\n70\n1\n";
    dxf += "10\n0\n20\n0\n";
    dxf += "10\n" + LARGURA_CHAPA + "\n20\n0\n";
    dxf += "10\n" + LARGURA_CHAPA + "\n20\n" + ALTURA_CHAPA + "\n";
    dxf += "10\n0\n20\n" + ALTURA_CHAPA + "\n";
    dxf += "10\n0\n20\n0\n"; // Fecha a polilinha
    dxf += "0\nENDSEC\n";

    placedPieces.forEach(p => {
        const x_canvas = p.x;
        const y_canvas_top = p.y;
        const w_bbox = p.boundingBox.width;
        const h_bbox = p.boundingBox.height;

        // Transform canvas Y (top-left origin, Y-down) to DXF Y (bottom-left origin, Y-up)
        const y_dxf_bottom_for_piece = ALTURA_CHAPA - (y_canvas_top + h_bbox);

        // Apply rotation for DXF coordinates
        let currentX = x_canvas;
        let currentY = y_dxf_bottom_for_piece;
        let currentWidth = w_bbox;
        let currentHeight = h_bbox;

        if (p.rotation === 90) {
            currentX = x_canvas;
            currentY = ALTURA_CHAPA - (y_canvas_top + w_bbox);
            currentWidth = h_bbox;
            currentHeight = w_bbox;
        }

        if (p.shape === ShapeType.RECTANGLE) {
            dxf += "0\nLWPOLYLINE\n5\n" + uuidv4().substring(0, 8).toUpperCase() + "\n330\n" + uuidv4().substring(0, 8).toUpperCase() + "\n100\nAcDbEntity\n8\nPECA_RETANGULAR\n100\nAcDbPolyline\n90\n4\n70\n1\n";
            dxf += "10\n" + currentX + "\n20\n" + currentY + "\n";
            dxf += "10\n" + (currentX + currentWidth) + "\n20\n" + currentY + "\n";
            dxf += "10\n" + (currentX + currentWidth) + "\n20\n" + (currentY + currentHeight) + "\n";
            dxf += "10\n" + currentX + "\n20\n" + (currentY + currentHeight) + "\n";
            dxf += "10\n" + currentX + "\n20\n" + currentY + "\n"; // Close polyline
            dxf += "0\nENDSEC\n";
        } else if (p.shape === ShapeType.CIRCLE) {
            const centerX = x_canvas + w_bbox / 2;
            const centerY = ALTURA_CHAPA - (y_canvas_top + h_bbox / 2); // Center Y in DXF coords
            const radius = p.dimensions.radius || 0;

            dxf += "0\nCIRCLE\n8\nPECA_CIRCULO\n10\n" + centerX + "\n20\n" + centerY + "\n30\n0\n40\n" + radius + "\n";
        } else if (p.shape === ShapeType.SEMICIRCLE) {
            const L = p.dimensions.length || 0; // Straight side
            const R_semi = p.dimensions.radius || 0; // Radius

            let arcCenterX, arcCenterY, startAngleRad, endAngleRad;
            let baseStartX, baseStartY, baseEndX, baseEndY; // Coordinates for the straight line (base)

            const isHorizontalBase = (p.rotation === 0);

            if (isHorizontalBase) { // Base is horizontal (L along X, R_semi along Y in original piece orientation)
                arcCenterX = x_canvas + L / 2;
                arcCenterY = y_dxf_bottom_for_piece; // Base at bottom of bounding box in DXF
                baseStartX = x_canvas;
                baseStartY = y_dxf_bottom_for_piece;
                baseEndX = x_canvas + L;
                baseEndY = y_dxf_bottom_for_piece;
                startAngleRad = Math.PI; // 180 deg
                endAngleRad = 0;         // 0 deg
            } else { // Base is vertical (R_semi along X, L along Y in original piece orientation, rotated 90 deg)
                arcCenterX = x_canvas;
                arcCenterY = ALTURA_CHAPA - (y_canvas_top + L/2);
                baseStartX = x_canvas;
                baseStartY = ALTURA_CHAPA - (y_canvas_top + L);
                baseEndX = x_canvas;
                baseEndY = ALTURA_CHAPA - y_canvas_top;
                startAngleRad = Math.PI * 1.5; // 270 deg
                endAngleRad = Math.PI * 0.5;   // 90 deg
            }

            // Draw the straight line (base)
            dxf += "0\nLINE\n8\nPECA_SEMICIRCULO\n10\n" + baseStartX + "\n20\n" + baseStartY + "\n30\n0\n11\n" + baseEndX + "\n21\n" + baseEndY + "\n31\n0\n";

            // Draw the arc
            let startDeg = toDegrees(startAngleRad);
            let endDeg = toDegrees(endAngleRad);

            // DXF arcs are always anti-clockwise from start to end.
            // Adjust if end < start for continuous drawing across 0/360.
            if (endDeg < startDeg) {
                endDeg += 360;
            }

            dxf += "0\nARC\n8\nPECA_SEMICIRCULO\n10\n" + arcCenterX + "\n20\n" + arcCenterY + "\n30\n0\n40\n" + R_semi + "\n50\n" + startDeg + "\n51\n" + endDeg + "\n";
        }
    });

    dxf += "0\nENDSEC\n0\nEOF\n";
    return dxf;
}

/**
 * Desenha uma chapa específica em um canvas temporário com alta resolução para exportação PNG.
 * Adaptada da lógica do index.html original.
 */
function desenharChapaParaExportacao(chapa: Sheet, placedPieces: PlacedPiece[]): HTMLCanvasElement | null {
  if (!chapa) {
      return null;
  }

  const exportCanvas = document.createElement('canvas');
  const exportCtx = exportCanvas.getContext('2d');
  if (!exportCtx) return null;

  const EXPORT_WIDTH = 4000; // Define uma largura fixa para a exportação de alta resolução
  const s = EXPORT_WIDTH / chapa.width; // Calcula a escala baseada na largura da chapa

  exportCanvas.width = chapa.width * s;
  exportCanvas.height = chapa.length * s;

  exportCtx.fillStyle = "#f0f0f0"; // Cor de fundo da chapa
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  exportCtx.strokeStyle = '#333';
  exportCtx.lineWidth = 2 * s; // Linhas mais grossas para exportação de alta resolução
  exportCtx.strokeRect(0, 0, exportCanvas.width, exportCanvas.height); // Borda da chapa

  placedPieces.forEach(p => {
      const x = p.x;
      const y = p.y;
      const w = p.boundingBox.width;
      const h = p.boundingBox.height;

      const color = '#A7D9D9'; // Consistent color for placed pieces
      exportCtx.fillStyle = color;
      exportCtx.strokeStyle = '#555';
      exportCtx.lineWidth = 1 * s;

      exportCtx.save();
      exportCtx.translate(x * s, y * s);
      if (p.rotation === 90) {
          exportCtx.rotate(90 * Math.PI / 180);
          exportCtx.translate(0, -w * s);
      }

      exportCtx.beginPath();
      switch (p.shape) {
          case ShapeType.CIRCLE: {
              const radius = (p.dimensions.radius || 0) * s;
              exportCtx.arc((w / 2) * s, (h / 2) * s, radius, 0, 2 * Math.PI);
              break;
          }
          case ShapeType.SEMICIRCLE: {
              const L = (p.dimensions.length || 0); // Use original dimensions, not scaled for calculation
              const R_semi = (p.dimensions.radius || 0); // Use original dimensions

              const isHorizontalBase = (p.rotation === 0);

              let centerX, centerY, startAngle, endAngle, counterClockwise;

              if (isHorizontalBase) {
                  centerX = (L / 2) * s;
                  centerY = R_semi * s;
                  startAngle = Math.PI;
                  endAngle = 0;
                  counterClockwise = false;

                  exportCtx.moveTo(0, R_semi * s);
                  exportCtx.lineTo(L * s, R_semi * s);
                  exportCtx.arc(centerX, centerY, R_semi * s, startAngle, endAngle, counterClockwise);
              } else { // Base vertical
                  centerX = R_semi * s;
                  centerY = (L / 2) * s;
                  startAngle = Math.PI * 0.5;
                  endAngle = Math.PI * 1.5;
                  counterClockwise = true;

                  exportCtx.moveTo(R_semi * s, 0);
                  exportCtx.lineTo(R_semi * s, L * s);
                  exportCtx.arc(centerX, centerY, R_semi * s, startAngle, endAngle, counterClockwise);
              }
              break;
          }
          case ShapeType.RECTANGLE:
          default:
              exportCtx.rect(0, 0, w * s, h * s);
              break;
      }
      exportCtx.closePath();

      exportCtx.fill();
      exportCtx.stroke();

      // Text
      if (w * s > 30 && h * s > 15) {
          exportCtx.fillStyle = "#000";
          exportCtx.font = `${Math.max(8, Math.min(w, h) / 8) * s}px Arial`;
          exportCtx.textAlign = 'center';
          exportCtx.textBaseline = 'middle';
          let textContent = p.name;
          exportCtx.fillText(textContent, (w / 2) * s, (h / 2) * s);
      }
      exportCtx.restore();
  });

  return exportCanvas;
}


const PlanningAndCutting: React.FC<PlanningAndCuttingProps> = ({
  onPlanUpdate,
  currentPlan,
  onConfirmPlan,
  sheets,
  remnants,
  loadingCutPlan,
  cutPlanProgress,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPiece, setEditingPiece] = useState<Piece | null>(null);

  const [onboardingStep, setOnboardingStep] = useState(0); // 0 means not showing, 1-3 for steps
  const onboardingMessages = useMemo(() => [
    {
      title: 'Bem-vindo ao Planejador de Corte de Chapas!',
      description: 'Vamos te guiar na criação do seu primeiro plano de corte, passo a passo.',
    },
    {
      title: 'Passo 1: Definição da Chapa Base',
      description: 'Primeiro, você pode informar as dimensões e o tipo de material da chapa que será utilizada. Isso pode ser uma chapa nova ou um retalho do estoque, ou você pode definir uma nova.',
    },
    {
      title: 'Passo 2: Definição das Peças a Cortar',
      description: 'Agora, adicione as peças que você deseja cortar. Especifique a quantidade, a forma e as dimensões de cada uma. O sistema irá otimizar o encaixe.',
    },
    {
      title: 'Passo 3: Visualização do Plano de Corte',
      description: 'Após definir as chapas e peças, visualize a simulação do encaixe (Nesting) na chapa. Verifique o aproveitamento do material e os retalhos gerados. Você pode navegar entre as chapas usadas.',
    },
  ], []);

  useEffect(() => {
    const onboardingCompleted = storageService.getOnboardingCompleted();
    if (!onboardingCompleted) {
      setOnboardingStep(1); // Start onboarding
    }
  }, []);

  const handleNextOnboardingStep = () => {
    if (onboardingStep < onboardingMessages.length) {
      setOnboardingStep(onboardingStep + 1);
    } else {
      storageService.setOnboardingCompleted(true);
      setOnboardingStep(0); // Finish onboarding
    }
  };

  const handleSkipOnboarding = () => {
    storageService.setOnboardingCompleted(true);
    setOnboardingStep(0); // Finish onboarding
  };

  // --- Sheet Definition ---
  // State for user-defined sheet (if not selecting from stock)
  const [currentSheetConfig, setCurrentSheetConfig] = useState<{
    id?: string;
    materialId?: string;
    thickness?: number;
    length: number | '';
    width: number | '';
    price: number | '';
    isRemnant?: boolean;
  }>(() => {
    // Initialize from currentPlan's first simulated sheet if available, or default to manual entry
    if (currentPlan.simulatedSheetsUsed?.length > 0) {
      const sheet = currentPlan.simulatedSheetsUsed[0];
      return {
        id: sheet.id,
        materialId: sheet.materialId,
        thickness: sheet.thickness,
        length: sheet.length,
        width: sheet.width,
        price: sheet.price,
        isRemnant: sheet.isRemnant,
      };
    }
    return {
      length: 1850, // Default based on original index.html
      width: 2750, // Default based on original index.html
      price: 250.00, // Default based on original index.html
      materialId: STANDARD_MATERIALS[0].id, // Default to first material
      thickness: STANDARD_MATERIALS[0].standardThicknesses[0], // Default to first thickness
    };
  });

  const [selectedSheetFromStockId, setSelectedSheetFromStockId] = useState<string | undefined>(undefined);
  const [currentViewedSheetIndex, setCurrentViewedSheetIndex] = useState(0);

  const availableBaseSheets = useMemo(() => [...sheets, ...remnants], [sheets, remnants]);

  // Sync state when currentPlan.simulatedSheetsUsed changes
  useEffect(() => {
    if (currentPlan.simulatedSheetsUsed.length > 0) {
      const firstSimulatedSheet = currentPlan.simulatedSheetsUsed[0];
      // Check if this sheet exists in available stock
      const foundInStock = availableBaseSheets.find(s => s.id === firstSimulatedSheet.id);
      setSelectedSheetFromStockId(foundInStock ? firstSimulatedSheet.id : undefined);

      setCurrentSheetConfig({
        id: firstSimulatedSheet.id,
        materialId: firstSimulatedSheet.materialId,
        thickness: firstSimulatedSheet.thickness,
        length: firstSimulatedSheet.length,
        width: firstSimulatedSheet.width,
        price: firstSimulatedSheet.price,
        isRemnant: firstSimulatedSheet.isRemnant,
      });
      setCurrentViewedSheetIndex(0);
    } else {
      setSelectedSheetFromStockId(undefined);
      setCurrentSheetConfig({
        length: '', width: '', price: '',
        materialId: STANDARD_MATERIALS[0].id,
        thickness: STANDARD_MATERIALS[0].standardThicknesses[0],
      });
      setCurrentViewedSheetIndex(0);
    }
  }, [currentPlan.simulatedSheetsUsed, availableBaseSheets]);


  const handleSheetSelection = (id: string | undefined) => {
    setSelectedSheetFromStockId(id);
    if (id) {
      const selected = availableBaseSheets.find(s => s.id === id);
      if (selected) {
        setCurrentSheetConfig({
          id: selected.id,
          materialId: selected.materialId,
          thickness: selected.thickness,
          length: selected.length,
          width: selected.width,
          price: selected.price,
          isRemnant: selected.isRemnant,
        });
      }
    } else {
      // User chose "Definir Nova Chapa"
      setCurrentSheetConfig({
        length: 1850, // Default based on original index.html
        width: 2750, // Default based on original index.html
        price: 250.00, // Default based on original index.html
        materialId: STANDARD_MATERIALS[0].id, // Default to first material
        thickness: STANDARD_MATERIALS[0].standardThicknesses[0], // Default to first thickness
      });
    }
  };

  const isSheetFromStockSelected = useMemo(() => {
    return !!selectedSheetFromStockId && availableBaseSheets.some(s => s.id === selectedSheetFromStockId);
  }, [selectedSheetFromStockId, availableBaseSheets]);


  // --- Piece Definition ---
  const addOrUpdatePiece = (piece: Piece) => {
    const calculatedBoundingBox = calculatePieceBoundingBox(piece);
    const updatedPiece = { ...piece, boundingBox: calculatedBoundingBox };

    let updatedPieces: Piece[];
    if (editingPiece) {
      updatedPieces = currentPlan.pieces.map((p) =>
        p.id === editingPiece.id ? updatedPiece : p,
      );
    } else {
      updatedPieces = [...currentPlan.pieces, { ...updatedPiece, id: uuidv4() }];
    }
    onPlanUpdate({ ...currentPlan, pieces: updatedPieces });
    setIsModalOpen(false);
    setEditingPiece(null);
  };

  const deletePiece = (id: string) => {
    onPlanUpdate({
      ...currentPlan,
      pieces: currentPlan.pieces.filter((p) => p.id !== id),
    });
  };

  const startEditPiece = (piece: Piece) => {
    setEditingPiece(piece);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingPiece(null);
  };

  // --- Nesting & Visualization ---
  const runNestingSimulation = useCallback(() => {
    if (currentPlan.pieces.length === 0) {
      // FIX: Removed sheetBeingViewedId from CurrentPlanState update as it's not part of it.
      onPlanUpdate({
        ...currentPlan,
        simulatedPlacedPieces: [],
        simulatedRemnants: [],
        simulatedSheetsUsed: [],
        simulatedCost: 0,
        loading: false,
        progress: 'Adicione peças para iniciar a simulação.',
      });
      return;
    }

    // Construct the initial sheet for the simulation based on user selection/input
    let initialSheetForSimulation: Sheet | undefined;
    if (selectedSheetFromStockId) {
      initialSheetForSimulation = availableBaseSheets.find(s => s.id === selectedSheetFromStockId);
    } else if (currentSheetConfig.length && currentSheetConfig.width && currentSheetConfig.materialId && currentSheetConfig.thickness && currentSheetConfig.price) {
      const material = STANDARD_MATERIALS.find(m => m.id === currentSheetConfig.materialId);
      if (material) {
        initialSheetForSimulation = {
          id: uuidv4(), // Give a temporary ID for simulation
          materialId: currentSheetConfig.materialId,
          type: material.type,
          length: currentSheetConfig.length as number,
          width: currentSheetConfig.width as number,
          thickness: currentSheetConfig.thickness as number,
          price: currentSheetConfig.price as number,
          isRemnant: false,
        };
      }
    }

    if (!initialSheetForSimulation) {
      // FIX: Removed sheetBeingViewedId from CurrentPlanState update as it's not part of it.
      onPlanUpdate({
        ...currentPlan,
        simulatedPlacedPieces: [],
        simulatedRemnants: [],
        simulatedSheetsUsed: [],
        simulatedCost: 0,
        loading: false,
        progress: 'Defina uma chapa base válida para iniciar a simulação.',
      });
      return;
    }

    onPlanUpdate({ ...currentPlan, loading: true, progress: 'Iniciando simulação de corte...' });

    setTimeout(() => {
      // Prioritize the initialSheetForSimulation, then existing stock
      const allAvailableSheetsForNesting: Sheet[] = [];
      if (initialSheetForSimulation) {
        allAvailableSheetsForNesting.push(initialSheetForSimulation);
      }
      // Add other sheets/remnants from stock, excluding the initial if it came from stock
      allAvailableSheetsForNesting.push(...availableBaseSheets.filter(s => s.id !== initialSheetForSimulation?.id));


      const { cutPlan, unplacedPieces } = createCuttingPlan(
        currentPlan.pieces,
        allAvailableSheetsForNesting.filter(s => s.isRemnant), // Only remnants from all available
        allAvailableSheetsForNesting.filter(s => !s.isRemnant), // Only new sheets from all available
      );

      const cost = cutPlan.sheetsUsed.reduce((total, s) => total + s.price, 0);

      // FIX: Removed sheetBeingViewedId from CurrentPlanState update as it's not part of it.
      onPlanUpdate({
        ...currentPlan,
        simulatedPlacedPieces: cutPlan.placedPieces,
        simulatedRemnants: cutPlan.newRemnants,
        simulatedSheetsUsed: cutPlan.sheetsUsed,
        simulatedCost: cost,
        loading: false,
        progress: unplacedPieces.length > 0
          ? `Não foi possível encaixar ${unplacedPieces.length} peças.`
          : 'Simulação concluída com sucesso!',
      });
      setCurrentViewedSheetIndex(0); // Reset viewed sheet to the first one
    }, 500);
  }, [currentPlan, onPlanUpdate, availableBaseSheets, currentSheetConfig, selectedSheetFromStockId, sheets, remnants]); // Dependencies changed

  useEffect(() => {
    runNestingSimulation();
  }, [currentPlan.pieces, currentSheetConfig, selectedSheetFromStockId, runNestingSimulation]); // Re-run when sheet/pieces change

  const pieceNameMap = useMemo(() => {
    const map = new Map<string, string>();
    currentPlan.pieces.forEach(p => map.set(p.id, p.name));
    return map;
  }, [currentPlan.pieces]);


  const currentSimulatedSheet = useMemo(() => {
    if (currentPlan.simulatedSheetsUsed.length === 0) return undefined;
    return currentPlan.simulatedSheetsUsed[currentViewedSheetIndex];
  }, [currentPlan.simulatedSheetsUsed, currentViewedSheetIndex]);

  const currentSheetPlacedPieces = useMemo(() => {
    if (!currentSimulatedSheet) return [];
    return currentPlan.simulatedPlacedPieces.filter(p => p.usedInSheetId === currentSimulatedSheet.id);
  }, [currentSimulatedSheet, currentPlan.simulatedPlacedPieces]);

  const currentSheetNewRemnants = useMemo(() => {
    if (!currentSimulatedSheet) return [];
    return currentPlan.simulatedRemnants.filter(r => r.parentId === currentSimulatedSheet.id);
  }, [currentSimulatedSheet, currentPlan.simulatedRemnants]);

  const handlePreviousSheet = () => {
    setCurrentViewedSheetIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextSheet = () => {
    setCurrentViewedSheetIndex(prev => Math.min(currentPlan.simulatedSheetsUsed.length - 1, prev + 1));
  };

  // FIX: Moved generatePng from ReportAndBudget.tsx
  const generatePng = useCallback(() => {
    const sheetToExport = currentSimulatedSheet;
    if (!sheetToExport || currentSheetPlacedPieces.length === 0) {
      alert('Não há chapa selecionada ou peças encaixadas para exportar.');
      return;
    }

    const exportCanvas = desenharChapaParaExportacao(sheetToExport, currentSheetPlacedPieces);

    if (exportCanvas) {
        const link = document.createElement('a');
        link.download = `chapa-${sheetToExport.id.substring(0,8)}-HR.png`; // HR para High Resolution
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    } else {
        alert('Erro ao gerar a imagem para exportação.');
    }
  }, [currentSimulatedSheet, currentSheetPlacedPieces]);

  // FIX: Moved generateDxf from ReportAndBudget.tsx
  const generateDxf = useCallback(() => {
    const sheetToExport = currentSimulatedSheet;
    if (!sheetToExport || currentSheetPlacedPieces.length === 0) {
      alert('Não há chapa selecionada ou peças encaixadas para exportar em DXF.');
      return;
    }

    const dxfString = generateDxfString(sheetToExport, currentSheetPlacedPieces);

    const blob = new Blob([dxfString], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chapa-${sheetToExport.id.substring(0,8)}.dxf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('Exportação DXF concluída. Este é um formato DXF simplificado para retângulos, círculos e semicírculos.');
  }, [currentSimulatedSheet, currentSheetPlacedPieces]);


  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {onboardingStep > 0 && (
        <OnboardingSteps
          currentStep={onboardingStep}
          totalSteps={onboardingMessages.length}
          onNext={handleNextOnboardingStep}
          onSkip={handleSkipOnboarding}
          title={onboardingMessages[onboardingStep - 1].title}
          description={onboardingMessages[onboardingStep - 1].description}
        />
      )}

      <h2 className="text-2xl font-bold text-[var(--title-color)] mb-6">Planejamento e Corte</h2>

      {/* Sheet Definition */}
      <section className="neumorphic-card p-6 mb-8">
        <h3 className="text-xl font-semibold text-[var(--title-color)] mb-4">1. Definição da Chapa Base</h3>
        <div className="mb-4">
          <label htmlFor="select-sheet" className="block text-sm font-medium text-gray-700 mb-1">
            Selecionar Chapa do Estoque / Definir Nova
          </label>
          <select
            id="select-sheet"
            className="neumorphic-select"
            value={selectedSheetFromStockId || ''}
            onChange={(e) => handleSheetSelection(e.target.value === '' ? undefined : e.target.value)}
          >
            <option value="">Definir Nova Chapa</option>
            <optgroup label="Chapas em Estoque">
              {sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.type} {s.thickness}mm - {s.width}x{s.length}mm
                </option>
              ))}
            </optgroup>
            <optgroup label="Retalhos em Estoque">
              {remnants.map((r) => (
                <option key={r.id} value={r.id}>
                  RETALHO {r.type} {r.thickness}mm - {r.width}x{r.length}mm
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="input-group mb-4">
          <div>
            <label htmlFor="sheet-width" className="block text-sm font-medium text-gray-700 mb-1">
              Largura (mm)
            </label>
            <input
              type="number"
              id="sheet-width"
              className="neumorphic-input"
              value={currentSheetConfig.width}
              onChange={(e) => setCurrentSheetConfig(prev => ({ ...prev, width: parseFloat(e.target.value) || '' }))}
              disabled={isSheetFromStockSelected}
              required
              aria-disabled={isSheetFromStockSelected}
            />
          </div>
          <div>
            <label htmlFor="sheet-length" className="block text-sm font-medium text-gray-700 mb-1">
              Comprimento (mm)
            </label>
            <input
              type="number"
              id="sheet-length"
              className="neumorphic-input"
              value={currentSheetConfig.length}
              onChange={(e) => setCurrentSheetConfig(prev => ({ ...prev, length: parseFloat(e.target.value) || '' }))}
              disabled={isSheetFromStockSelected}
              required
              aria-disabled={isSheetFromStockSelected}
            />
          </div>
          <div>
            <label htmlFor="sheet-price" className="block text-sm font-medium text-gray-700 mb-1">
              Preço por Chapa (R$)
            </label>
            <input
              type="number"
              id="sheet-price"
              className="neumorphic-input"
              value={currentSheetConfig.price}
              onChange={(e) => setCurrentSheetConfig(prev => ({ ...prev, price: parseFloat(e.target.value) || '' }))}
              disabled={isSheetFromStockSelected}
              required
              aria-disabled={isSheetFromStockSelected}
            />
          </div>
        </div>
        <MaterialSelector
          selectedMaterialId={currentSheetConfig.materialId}
          onSelectMaterial={(id) => setCurrentSheetConfig(prev => ({ ...prev, materialId: id }))}
          selectedThickness={currentSheetConfig.thickness}
          onSelectThickness={(t) => setCurrentSheetConfig(prev => ({ ...prev, thickness: t }))}
          className="mb-4"
          disabled={isSheetFromStockSelected}
        />
      </section>

      {/* Pieces Definition */}
      <section className="neumorphic-card p-6 mb-8">
        <h3 className="text-xl font-semibold text-[var(--title-color)] mb-4">2. Definição das Peças a Cortar</h3>
        <Button onClick={() => setIsModalOpen(true)} variant="primary" className="mb-4">
          Adicionar Nova Peça
        </Button>

        {currentPlan.pieces.length === 0 ? (
          <p className="text-gray-600">Nenhuma peça adicionada ainda.</p>
        ) : (
          <ul className="neumorphic-list grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentPlan.pieces.map((piece) => (
              <li key={piece.id} className="neumorphic-list-item flex flex-col items-start">
                <div className="flex justify-between w-full mb-1">
                  <h4 className="font-semibold text-gray-800">{piece.name}</h4>
                  <div className="flex gap-2">
                    <Button onClick={() => startEditPiece(piece)} variant="secondary" size="sm">
                      Editar
                    </Button>
                    <Button onClick={() => deletePiece(piece.id)} variant="danger" size="sm">
                      Excluir
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-600">Qtd: {piece.quantity} | Forma: {piece.shape}</p>
                <p className="text-xs text-gray-500">
                  Dimensões: {piece.boundingBox.width}x{piece.boundingBox.height}mm
                </p>
              </li>
            ))}
          </ul>
        )}
        <h3 className="text-xl font-semibold text-[var(--title-color)] mb-4 mt-8">MARGEM</h3>
        <p className="text-gray-600">Padrão: 5mm de margem para o corte (serra).</p>
      </section>

      {/* Progress Bar for simulation */}
      <div className="progress-container" style={{ display: loadingCutPlan ? 'block' : 'none' }} role="progressbar" aria-valuenow={parseFloat(cutPlanProgress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-bar" style={{ width: cutPlanProgress }}></div>
      </div>
      {loadingCutPlan && (
          <div className="neumorphic-card flex items-center justify-center p-4 mb-8 text-blue-600 font-semibold">
            <svg className="animate-spin h-5 w-5 mr-3 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {cutPlanProgress}
          </div>
        )}

      {/* Visualization */}
      <section className="neumorphic-card p-6 mb-8">
        <h3 className="text-xl font-semibold text-[var(--title-color)] mb-4">3. Visualização do Plano de Corte</h3>

        {!loadingCutPlan && currentSimulatedSheet && (
          <div className="mb-4">
            <p className="text-gray-700 mb-2">
              Visualizando Chapa {currentViewedSheetIndex + 1} de {currentPlan.simulatedSheetsUsed.length}:{' '}
              {currentSimulatedSheet.isRemnant ? 'Retalho' : 'Nova Chapa'} de{' '}
              {currentSimulatedSheet.type} {currentSimulatedSheet.thickness}mm -{' '}
              {currentSimulatedSheet.width}x{currentSimulatedSheet.length}mm
            </p>
            <CuttingCanvas
              sheet={currentSimulatedSheet}
              placedPieces={currentSheetPlacedPieces}
              newRemnants={currentSheetNewRemnants}
              pieceNameMap={pieceNameMap}
            />
            <div className="button-group justify-center mt-4">
              <Button onClick={handlePreviousSheet} disabled={currentViewedSheetIndex === 0}>
                Anterior
              </Button>
              <Button onClick={handleNextSheet} disabled={currentViewedSheetIndex === currentPlan.simulatedSheetsUsed.length - 1}>
                Próxima
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8">
                <p className="text-gray-600 text-sm italic">Só é permitido baixar um arquivo por chapa visualizada.</p>
                {/* FIX: Use local generatePng/Dxf functions instead of window.open */}
                <Button onClick={generatePng} variant="outline" disabled={!currentSimulatedSheet}>
                    Exportar PNG
                </Button>
                <Button onClick={generateDxf} variant="outline" disabled={!currentSimulatedSheet}>
                    Exportar DXF
                </Button>
            </div>
          </div>
        )}
        {!loadingCutPlan && !currentSimulatedSheet && (
          <p className="text-gray-600 text-center py-8">
            Selecione ou defina uma chapa base e adicione peças para visualizar o plano de corte.
          </p>
        )}
      </section>

      {/* Persistent Call-to-Action for Confirm Plan */}
      <div className="sticky bottom-0 bg-white p-4 border-t border-gray-200 shadow-lg flex justify-end z-20">
        <Button
          onClick={onConfirmPlan}
          variant="primary"
          size="lg"
          disabled={currentPlan.simulatedSheetsUsed.length === 0 || currentPlan.simulatedPlacedPieces.length === 0 || loadingCutPlan}
        >
          Confirmar Plano
        </Button>
      </div>


      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title={editingPiece ? 'Editar Peça' : 'Adicionar Nova Peça'}
      >
        <PieceForm piece={editingPiece} onSave={addOrUpdatePiece} />
      </Modal>
    </div>
  );
};

interface PieceFormProps {
  piece: Piece | null;
  onSave: (piece: Piece) => void;
}

const PieceForm: React.FC<PieceFormProps> = ({ piece, onSave }) => {
  const [name, setName] = useState(piece?.name || '');
  const [quantity, setQuantity] = useState(piece?.quantity || 1);
  const [shape, setShape] = useState<ShapeType>(piece?.shape || ShapeType.RECTANGLE);
  const [dimensions, setDimensions] = useState(
    // FIX: Initialize numeric dimensions with undefined instead of empty string.
    piece?.dimensions || { length: undefined, width: undefined, radius: undefined, sideCount: undefined, sideLength: undefined, height: undefined, orient: 'top' },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newPiece: Piece = {
      id: piece?.id || uuidv4(),
      name,
      quantity,
      shape,
      dimensions: { ...dimensions },
      boundingBox: { width: 0, height: 0 }, // Will be calculated by nesting service
    };
    onSave(newPiece);
  };

  const handleDimensionChange = (key: string, value: number | string | undefined) => {
    // FIX: Handle empty string input as undefined for numeric fields
    if (typeof value === 'string' && value === '') {
      setDimensions((prev) => ({ ...prev, [key]: undefined }));
    } else {
      setDimensions((prev) => ({ ...prev, [key]: value }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="piece-name" className="block text-sm font-medium text-gray-700">
          Nome da Peça
        </label>
        <input
          type="text"
          id="piece-name"
          className="neumorphic-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="piece-quantity" className="block text-sm font-medium text-gray-700">
          Quantidade
        </label>
        <input
          type="number"
          id="piece-quantity"
          className="neumorphic-input"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          min="1"
          required
        />
      </div>
      <div>
        <label htmlFor="piece-shape" className="block text-sm font-medium text-gray-700">
          Tipo de Corte (Forma)
        </label>
        <select
          id="piece-shape"
          className="neumorphic-select"
          value={shape}
          onChange={(e) => setShape(e.target.value as ShapeType)}
          required
        >
          {SHAPE_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Dimension Inputs based on Shape */}
      {shape === ShapeType.RECTANGLE && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="dim-length" className="block text-sm font-medium text-gray-700">
              Comprimento (mm)
            </label>
            <input
              type="number"
              id="dim-length"
              className="neumorphic-input"
              // FIX: Use optional chaining and handle undefined for number inputs
              value={dimensions.length === undefined ? '' : dimensions.length}
              onChange={(e) => handleDimensionChange('length', e.target.value === '' ? undefined : parseFloat(e.target.value))}
              required
            />
          </div>
          <div>
            <label htmlFor="dim-width" className="block text-sm font-medium text-gray-700">
              Largura (mm)
            </label>
            <input
              type="number"
              id="dim-width"
              className="neumorphic-input"
              // FIX: Use optional chaining and handle undefined for number inputs
              value={dimensions.width === undefined ? '' : dimensions.width}
              onChange={(e) => handleDimensionChange('width', e.target.value === '' ? undefined : parseFloat(e.target.value))}
              required
            />
          </div>
        </div>
      )}

      {shape === ShapeType.SEMICIRCLE && (
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label htmlFor="dim-l-side" className="block text-sm font-medium text-gray-700">
                    Lado Reto L (mm)
                </label>
                <input
                    type="number"
                    id="dim-l-side"
                    className="neumorphic-input"
                    // FIX: Use optional chaining and handle undefined for number inputs
                    value={dimensions.length === undefined ? '' : dimensions.length} // Use 'length' for L in Piece interface
                    onChange={(e) => handleDimensionChange('length', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                    required
                />
            </div>
            <div>
                <label htmlFor="dim-radius" className="block text-sm font-medium text-gray-700">
                    Raio R (mm)
                </label>
                <input
                    type="number"
                    id="dim-radius"
                    className="neumorphic-input"
                    // FIX: Use optional chaining and handle undefined for number inputs
                    value={dimensions.radius === undefined ? '' : dimensions.radius}
                    onChange={(e) => handleDimensionChange('radius', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                    required
                />
            </div>
            {/* The original 'orient' was mostly for drawing. For nesting bounding box,
                we primarily use L and R.
                <div className="col-span-2">
                    <label htmlFor="dim-orient" className="block text-sm font-medium text-gray-700">
                        Orientação da Curva
                    </label>
                    <select
                        id="dim-orient"
                        className="neumorphic-select"
                        value={dimensions.orient || 'top'}
                        onChange={(e) => handleDimensionChange('orient', e.target.value)}
                    >
                        <option value="top">Curva em cima</option>
                        <option value="bottom">Curva embaixo</option>
                    </select>
                </div>
            */}
        </div>
      )}

      {shape === ShapeType.CIRCLE && (
        <div>
          <label htmlFor="dim-radius" className="block text-sm font-medium text-gray-700">
            Raio (mm)
          </label>
          <input
            type="number"
            id="dim-radius"
            className="neumorphic-input"
            // FIX: Use optional chaining and handle undefined for number inputs
            value={dimensions.radius === undefined ? '' : dimensions.radius}
            onChange={(e) => handleDimensionChange('radius', e.target.value === '' ? undefined : parseFloat(e.target.value))}
            required
          />
        </div>
      )}

      {shape === ShapeType.TRIANGLE && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="dim-base-width" className="block text-sm font-medium text-gray-700">
              Base (mm)
            </label>
            <input
              type="number"
              id="dim-base-width"
              className="neumorphic-input"
              // FIX: Use optional chaining and handle undefined for number inputs
              value={dimensions.width === undefined ? '' : dimensions.width}
              onChange={(e) => handleDimensionChange('width', e.target.value === '' ? undefined : parseFloat(e.target.value))}
              required
            />
          </div>
          <div>
            <label htmlFor="dim-height" className="block text-sm font-medium text-gray-700">
              Altura (mm)
            </label>
            <input
              type="number"
              id="dim-height"
              className="neumorphic-input"
              // FIX: Use optional chaining and handle undefined for number inputs
              value={dimensions.height === undefined ? '' : dimensions.height}
              onChange={(e) => handleDimensionChange('height', e.target.value === '' ? undefined : parseFloat(e.target.value))}
              required
            />
          </div>
        </div>
      )}

      {shape === ShapeType.POLYGON && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="dim-side-count" className="block text-sm font-medium text-gray-700">
              Número de Lados
            </label>
            <input
              type="number"
              id="dim-side-count"
              className="neumorphic-input"
              // FIX: Use optional chaining and handle undefined for number inputs
              value={dimensions.sideCount === undefined ? '' : dimensions.sideCount}
              onChange={(e) => handleDimensionChange('sideCount', e.target.value === '' ? undefined : parseInt(e.target.value))}
              min="3"
              required
            />
          </div>
          <div>
            <label htmlFor="dim-side-length" className="block text-sm font-medium text-gray-700">
              Comprimento do Lado (mm)
            </label>
            <input
              type="number"
              id="dim-side-length"
              className="neumorphic-input"
              // FIX: Use optional chaining and handle undefined for number inputs
              value={dimensions.sideLength === undefined ? '' : dimensions.sideLength}
              onChange={(e) => handleDimensionChange('sideLength', e.target.value === '' ? undefined : parseFloat(e.target.value))}
              required
            />
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button type="submit" variant="primary">
          {piece ? 'Salvar Alterações' : 'Adicionar Peça'}
        </Button>
      </div>
    </form>
  );
};

export default PlanningAndCutting;