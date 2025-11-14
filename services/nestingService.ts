import { Sheet, Piece, PlacedPiece, Rectangle, ShapeType } from '../types';
import { MIN_REMNANT_WIDTH, MIN_REMNANT_HEIGHT } from '../constants';

// Helper to generate a unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * Rotates a piece's bounding box.
 */
function rotatePieceBoundingBox(piece: Piece, rotation: 0 | 90): { width: number; height: number } {
  const { width, height } = piece.boundingBox;
  return rotation === 90 ? { width: height, height: width } : { width, height };
}

/**
 * Basic "First Fit Decreasing" (FFD) heuristic for nesting rectangular pieces.
 * Prioritizes larger pieces and tries to fit them into available space.
 * This is a simplified version and doesn't achieve optimal packing for all scenarios.
 * It also includes remnant generation.
 */
export function performNesting(
  sheet: Sheet,
  piecesToPlace: Piece[],
): { placedPieces: PlacedPiece[]; newRemnants: Sheet[]; remainingPieces: Piece[] } {
  const placedPieces: PlacedPiece[] = [];
  let availableSpace: Rectangle[] = [{ x: 0, y: 0, width: sheet.width, height: sheet.length }];
  const remainingPieces = [...piecesToPlace];

  // Sort pieces by largest dimension (or area) to prioritize fitting them first
  remainingPieces.sort((a, b) => {
    const areaA = a.boundingBox.width * a.boundingBox.height;
    const areaB = b.boundingBox.width * b.boundingBox.height;
    return areaB - areaA; // Descending
  });

  const getFittingSpaces = (pieceWidth: number, pieceHeight: number, spaces: Rectangle[]) => {
    const fitting: { space: Rectangle; x: number; y: number }[] = [];
    for (const space of spaces) {
      // Check for horizontal fit
      if (space.width >= pieceWidth && space.height >= pieceHeight) {
        fitting.push({ space, x: space.x, y: space.y });
      }
    }
    return fitting;
  };

  for (let i = 0; i < remainingPieces.length; ) {
    const piece = remainingPieces[i];
    let piecePlaced = false;

    // Try both rotations for rectangles and semicircles (bounding box can be rotated)
    const rotations: Array<0 | 90> =
      (piece.shape === ShapeType.RECTANGLE || piece.shape === ShapeType.SEMICIRCLE) ? [0, 90] : [0];

    for (const rotation of rotations) {
      const { width: currentPieceWidth, height: currentPieceHeight } =
        rotatePieceBoundingBox(piece, rotation);

      // Find a space to fit the piece
      let bestSpaceIndex = -1;
      let bestX = -1;
      let bestY = -1;
      let minWasteArea = Infinity;

      for (let j = 0; j < availableSpace.length; j++) {
        const space = availableSpace[j];
        if (space.width >= currentPieceWidth && space.height >= currentPieceHeight) {
          // Calculate potential waste if placed here (greedy, simple)
          const wasteWidth = space.width - currentPieceWidth;
          const wasteHeight = space.height - currentPieceHeight;
          const wasteArea = (wasteWidth * space.height) + (wasteHeight * currentPieceWidth); // Simplified heuristic

          if (wasteArea < minWasteArea) {
            minWasteArea = wasteArea;
            bestSpaceIndex = j;
            bestX = space.x;
            bestY = space.y;
          }
        }
      }

      if (bestSpaceIndex !== -1) {
        const space = availableSpace[bestSpaceIndex];

        // Place the piece
        placedPieces.push({
          ...piece,
          x: bestX,
          y: bestY,
          rotation: rotation,
          boundingBox: { // Store the actual bounding box used for placement
            width: currentPieceWidth,
            height: currentPieceHeight,
          },
          usedInSheetId: sheet.id,
        });
        remainingPieces.splice(i, 1); // Remove the piece from the "to place" list
        piecePlaced = true;

        // Update available space: split the current space into up to two new smaller rectangular spaces
        // The original space is replaced by new remnants
        const newSpaces: Rectangle[] = [];

        // Space to the right of the placed piece
        if (space.width > currentPieceWidth) {
          newSpaces.push({
            x: bestX + currentPieceWidth,
            y: bestY,
            width: space.width - currentPieceWidth,
            height: currentPieceHeight,
          });
        }
        // Space above the placed piece (or below if we're thinking bottom-left)
        if (space.height > currentPieceHeight) {
          newSpaces.push({
            x: bestX,
            y: bestY + currentPieceHeight, // This places the remnant above the piece
            width: currentPieceWidth,
            height: space.height - currentPieceHeight,
          });
        }

        // Add remaining portion of the original space (if any)
        if (space.width > currentPieceWidth && space.height > currentPieceHeight) {
          // Additional remnant for the corner
          newSpaces.push({
            x: bestX + currentPieceWidth,
            y: bestY + currentPieceHeight,
            width: space.width - currentPieceWidth,
            height: space.height - currentPieceHeight,
          });
        }

        // Replace the consumed space with new spaces
        availableSpace.splice(bestSpaceIndex, 1, ...newSpaces);
        availableSpace = availableSpace.filter(s => s.width > 0 && s.height > 0);
        break; // Piece placed, move to next piece
      }
    }
    if (!piecePlaced) {
      i++; // Move to the next piece if current one couldn't be placed
    }
  }

  // After placing all possible pieces, the remaining 'availableSpace' rectangles are potential new remnants.
  const newRemnants: Sheet[] = availableSpace
    .filter(
      (rect) => rect.width >= MIN_REMNANT_WIDTH && rect.height >= MIN_REMNANT_HEIGHT,
    )
    .map((rect) => ({
      id: generateId(),
      materialId: sheet.materialId,
      type: sheet.type,
      length: rect.height, // Note: Sheet length/width vs Rect width/height might need consistent mapping
      width: rect.width,
      thickness: sheet.thickness,
      price: 0, // Remnants have no direct price, as they are "waste" being repurposed
      isRemnant: true,
      parentId: sheet.id,
      originArea: rect,
    }));

  return { placedPieces, newRemnants, remainingPieces };
}

/**
 * Calculates bounding box for a given piece based on its shape and dimensions.
 * This is a simplification; for true nesting, more complex geometry libraries would be used.
 */
export function calculatePieceBoundingBox(piece: Piece): { width: number; height: number } {
  const { shape, dimensions } = piece;
  switch (shape) {
    case ShapeType.RECTANGLE:
      return { width: dimensions.width || 0, height: dimensions.length || 0 };
    case ShapeType.CIRCLE:
      return { width: (dimensions.radius || 0) * 2, height: (dimensions.radius || 0) * 2 };
    case ShapeType.SEMICIRCLE:
      // Original index.html uses L (straight side) and R (radius).
      // Bounding box for semicircle is typically L x R for top/bottom curve.
      // So, width is L (dimensions.length) and height is R (dimensions.radius).
      return { width: dimensions.length || 0, height: dimensions.radius || 0 };
    case ShapeType.TRIANGLE:
      // Assuming right-angle or equilateral for simplicity, worst-case bounding box
      return { width: dimensions.width || 0, height: dimensions.height || 0 };
    case ShapeType.POLYGON:
      // This is highly simplified. A real polygon bounding box needs vertex analysis.
      // For basic purposes, assume a square bounding box based on side length if only one is given,
      // or derive from max side length for n-gon.
      const maxSide = Math.max(...(dimensions.sideLengths || [dimensions.sideLength || 0]));
      // A very rough approximation for a bounding box of a general polygon
      return { width: maxSide * 2, height: maxSide * 2 }; // Extremely loose
    default:
      return { width: 0, height: 0 };
  }
}

/**
 * Main function to create a cutting plan using available stock.
 * Iterates through remnants first, then new sheets.
 */
export function createCuttingPlan(
  initialPieces: Piece[],
  availableRemnants: Sheet[],
  availableSheets: Sheet[],
): {
  cutPlan: { placedPieces: PlacedPiece[]; newRemnants: Sheet[]; sheetsUsed: Sheet[] };
  unplacedPieces: Piece[];
  updatedRemnantStock: Sheet[];
  updatedSheetStock: Sheet[];
} {
  let piecesToPlace = [...initialPieces];
  let allPlacedPieces: PlacedPiece[] = [];
  let allNewRemnants: Sheet[] = [];
  let allSheetsUsed: Sheet[] = [];

  // Create mutable copies of stock to track usage
  let currentRemnants = [...availableRemnants];
  let currentSheets = [...availableSheets];

  // Combine and sort all available stock for optimal use: remnants first, then new sheets.
  // Prioritize larger sheets/remnants (by area)
  const allStock = [
    ...currentRemnants.map(s => ({ ...s, isRemnant: true })),
    ...currentSheets.map(s => ({ ...s, isRemnant: false }))
  ].sort((a, b) => (b.width * b.length) - (a.width * a.length));


  for (let i = 0; i < allStock.length && piecesToPlace.length > 0; i++) {
    const currentStockItem = allStock[i];
    const {
      placedPieces: currentPlaced,
      newRemnants: currentRemnantsGenerated,
      remainingPieces: currentRemaining,
    } = performNesting(currentStockItem, piecesToPlace);

    if (currentPlaced.length > 0) {
      allPlacedPieces = allPlacedPieces.concat(currentPlaced);
      allNewRemnants = allNewRemnants.concat(currentRemnantsGenerated);
      allSheetsUsed.push(currentStockItem); // Mark this stock item as used

      // Filter out the pieces that were successfully placed
      piecesToPlace = currentRemaining;

      // Update the original stock arrays based on usage (for return values)
      if (currentStockItem.isRemnant) {
        currentRemnants = currentRemnants.filter(r => r.id !== currentStockItem.id);
      } else {
        currentSheets = currentSheets.filter(s => s.id !== currentStockItem.id);
      }
    }
  }

  // Combine remaining original remnants with newly generated remnants
  const finalRemnantStock = currentRemnants.concat(allNewRemnants);

  return {
    cutPlan: { placedPieces: allPlacedPieces, newRemnants: allNewRemnants, sheetsUsed: allSheetsUsed },
    unplacedPieces: piecesToPlace,
    updatedRemnantStock: finalRemnantStock,
    updatedSheetStock: currentSheets, // Sheets that were not used
  };
}