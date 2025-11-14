export enum MaterialType {
  MDF = 'MDF',
  MDP = 'MDP',
  PLYWOOD = 'Compensado',
  ACRYLIC = 'Acrílico',
  ALUMINUM = 'Alumínio',
}

export interface Material {
  id: string;
  type: MaterialType;
  description: string;
  standardThicknesses: number[]; // mm
}

export enum ShapeType {
  RECTANGLE = 'Retângulo',
  CIRCLE = 'Circular',
  SEMICIRCLE = 'Semicircular',
  TRIANGLE = 'Triangular',
  POLYGON = 'Poligonal',
}

export interface Sheet {
  id: string;
  materialId: string;
  type: MaterialType; // Redundant but useful for display without deep lookup
  length: number; // mm
  width: number; // mm
  thickness: number; // mm
  price: number; // R$
  isRemnant: boolean;
  parentId?: string; // ID of the sheet/remnant it was cut from
  originArea?: { x: number; y: number; width: number; height: number }; // Original position in parent
}

export interface Piece {
  id: string;
  name: string;
  quantity: number;
  shape: ShapeType;
  dimensions: {
    length?: number; // Used for rectangle length or semicircle straight side (L)
    width?: number;  // Used for rectangle width or triangle base
    radius?: number; // Used for circle radius or semicircle radius (R)
    sideCount?: number;
    sideLength?: number;
    sideLengths?: number[]; // For custom polygonal sides
    height?: number; // For triangle
    orient?: 'top' | 'bottom' | 'left' | 'right'; // For semicircle orientation, mainly for visualization
  };
  // For nesting algorithm, bounding box is often used
  boundingBox: {
    width: number;
    height: number;
  };
}

export interface PlacedPiece extends Piece {
  x: number; // x-coordinate on the sheet
  y: number; // y-coordinate on the sheet
  rotation: 0 | 90; // Rotation for rectangles/semicircles (0 or 90 degrees)
  usedInSheetId: string; // ID of the sheet/remnant it was placed on
}

export interface CutPlan {
  id: string;
  name: string;
  date: string;
  piecesToCut: Piece[];
  sheetsUsed: Sheet[]; // List of sheet/remnant IDs used
  newRemnantsGenerated: Sheet[]; // List of new remnants
  cost: number;
  visualizationData?: PlacedPiece[]; // Data for canvas rendering
  sheetBeingViewedId?: string; // ID of the sheet currently displayed in canvas
}

export interface CurrentPlanState {
  pieces: Piece[];
  // Temporary state for the current nesting simulation
  simulatedPlacedPieces: PlacedPiece[];
  simulatedRemnants: Sheet[];
  simulatedSheetsUsed: Sheet[]; // Refers to the original sheet IDs
  simulatedCost: number;
  loading: boolean;
  progress: string;
  // `sheetBeingViewedId` will now be managed internally by PlanningAndCutting component's state
  // as it's purely for UI display during simulation, not core plan data.
}

export interface Coordinates {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}