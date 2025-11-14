import { Material, MaterialType, ShapeType } from './types';

export const STANDARD_MATERIALS: Material[] = [
  {
    id: 'mdf-white',
    type: MaterialType.MDF,
    description: 'Branco Texturizado',
    standardThicknesses: [15, 18, 25],
  },
  {
    id: 'mdp-oak',
    type: MaterialType.MDP,
    description: 'Carvalho Amadeirado',
    standardThicknesses: [15, 18],
  },
  {
    id: 'plywood-natural',
    type: MaterialType.PLYWOOD,
    description: 'Acabamento Natural',
    standardThicknesses: [10, 15, 20],
  },
  {
    id: 'acrylic-clear',
    type: MaterialType.ACRYLIC,
    description: 'Transparente',
    standardThicknesses: [3, 5, 8],
  },
  {
    id: 'aluminum-brushed',
    type: MaterialType.ALUMINUM,
    description: 'Prata Escovado',
    standardThicknesses: [1, 3, 5],
  },
];

export const MIN_REMNANT_WIDTH = 210; // mm (A4 width)
export const MIN_REMNANT_HEIGHT = 297; // mm (A4 height)
export const MIN_REMNANT_AREA = MIN_REMNANT_WIDTH * MIN_REMNANT_HEIGHT;

export const SHAPE_TYPES = Object.values(ShapeType);

export const DEFAULT_CUT_PLAN_NAME = 'Plano de Corte Sem Nome';

// Colors for canvas visualization
export const SHEET_COLOR = '#E0E0E0'; // Light grey for sheets
export const PLACED_PIECE_COLOR = '#A7D9D9'; // Light blue-green for placed pieces
export const REMNANT_COLOR = '#FFDDC1'; // Light orange for new remnants
export const BORDER_COLOR = '#333333'; // Dark grey for borders
export const TEXT_COLOR = '#333333'; // Dark grey for text
export const OVERLAY_COLOR = 'rgba(0, 0, 0, 0.5)'; // Dark overlay for onboarding
