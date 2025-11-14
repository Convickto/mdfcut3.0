import React, { useCallback, useMemo } from 'react';
import { CurrentPlanState, Sheet, PlacedPiece, ShapeType } from '../types';
import Button from './Button';
import Table from './Table';
import { STANDARD_MATERIALS } from '../constants';
import { v4 as uuidv4 } from 'uuid';

interface ReportAndBudgetProps {
  currentPlan: CurrentPlanState;
  onConfirmPlan: () => void;
  sheetsInStock: Sheet[];
  remnantsInStock: Sheet[];
}

// =========================================
// == FUNÇÕES AUXILIARES DE EXPORTAÇÃO ====
// =========================================
// FIX: Removed `toDegrees`, `generateDxfString`, `desenharChapaParaExportacao` as they are now in PlanningAndCutting.tsx


const ReportAndBudget: React.FC<ReportAndBudgetProps> = ({
  currentPlan,
  onConfirmPlan,
  sheetsInStock,
  remnantsInStock,
}) => {
  const { simulatedPlacedPieces, simulatedRemnants, simulatedSheetsUsed, simulatedCost, pieces } = currentPlan;

  const totalPiecesToCut = useMemo(() => {
    return pieces.reduce((total, piece) => total + piece.quantity, 0);
  }, [pieces]);

  const totalPlacedPieces = useMemo(() => {
    return simulatedPlacedPieces.length; // Count individual placed instances, not sum of quantities from original pieces
  }, [simulatedPlacedPieces]);

  const newSheetsRequired = useMemo(() => {
    return simulatedSheetsUsed.filter(s => !s.isRemnant).length;
  }, [simulatedSheetsUsed]);

  const remnantsUsed = useMemo(() => {
    return simulatedSheetsUsed.filter(s => s.isRemnant).length;
  }, [simulatedSheetsUsed]);

  const piecesToCutColumns = useMemo(() => [
    // FIX: Updated accessor to be a function for type compatibility with React.ReactNode
    { header: 'Nome da Peça', accessor: (row: PlacedPiece) => row.name },
    // FIX: Updated accessor to be a function for type compatibility with React.ReactNode
    { header: 'Forma', accessor: (row: PlacedPiece) => row.shape },
    { header: 'Dimensões (mm)', accessor: (row: PlacedPiece) => `${row.boundingBox.width}x${row.boundingBox.height}` },
    { header: 'Chapa de Origem', accessor: (row: PlacedPiece) => {
      const sheet = simulatedSheetsUsed.find(s => s.id === row.usedInSheetId);
      if (sheet) {
        return sheet.isRemnant ? `Retalho (${sheet.type} ${sheet.thickness}mm)` : `Chapa Nova (${sheet.type} ${sheet.thickness}mm)`;
      }
      return 'N/A';
    }},
    { header: 'Coordenadas (X,Y)', accessor: (row: PlacedPiece) => `(${row.x},${row.y})` },
    { header: 'Rotação', accessor: (row: PlacedPiece) => `${row.rotation}°` },
  ], [simulatedSheetsUsed]);

  const sheetsUsedColumns = useMemo(() => [
    { header: 'Tipo', accessor: (row: Sheet) => row.isRemnant ? 'Retalho' : 'Nova Chapa' },
    { header: 'Material', accessor: (row: Sheet) => STANDARD_MATERIALS.find(m => m.id === row.materialId)?.description || '' },
    // FIX: Updated accessor to be a function for type compatibility with React.ReactNode
    { header: 'Espessura (mm)', accessor: (row: Sheet) => row.thickness },
    { header: 'Dimensões (mm)', accessor: (row: Sheet) => `${row.width}x${row.length}` },
    { header: 'Preço (R$)', accessor: (row: Sheet) => row.isRemnant ? '0.00' : row.price.toFixed(2) },
  ], []);

  const generatedRemnantsColumns = useMemo(() => [
    { header: 'Material', accessor: (row: Sheet) => STANDARD_MATERIALS.find(m => m.id === row.materialId)?.description || '' },
    // FIX: Updated accessor to be a function for type compatibility with React.ReactNode
    { header: 'Espessura (mm)', accessor: (row: Sheet) => row.thickness },
    { header: 'Dimensões (mm)', accessor: (row: Sheet) => `${row.width}x${row.length}` },
    { header: 'Origem', accessor: (row: Sheet) => {
      const parentSheet = simulatedSheetsUsed.find(s => s.id === row.parentId);
      if (parentSheet) {
        return parentSheet.isRemnant ? `Retalho Original (${parentSheet.type})` : `Chapa Nova (${parentSheet.type})`;
      }
      return 'Desconhecida';
    }},
  ], [simulatedSheetsUsed]);


  // FIX: Removed generatePng as it is now in PlanningAndCutting.tsx
  // FIX: Removed generateDxf as it is now in PlanningAndCutting.tsx


  const isConfirmDisabled = currentPlan.simulatedSheetsUsed.length === 0 || currentPlan.simulatedPlacedPieces.length === 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h2 className="text-2xl font-bold text-[var(--title-color)] mb-6">Relatório e Orçamento</h2>

      {currentPlan.simulatedSheetsUsed.length === 0 && currentPlan.pieces.length === 0 ? (
        <p className="text-gray-600 text-center py-8 neumorphic-card">
          Defina uma chapa e adicione peças na aba "Planejamento e Corte" para gerar um relatório.
        </p>
      ) : (
        <div className="space-y-8">
          <section className="neumorphic-card p-6">
            <h3 className="text-xl font-semibold text-[var(--title-color)] mb-4">Resumo do Plano</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-gray-700">
              <p><strong>Total de Peças Solicitadas:</strong> {totalPiecesToCut}</p>
              <p><strong>Total de Peças Encaixadas:</strong> {totalPlacedPieces}</p>
              <p><strong>Total de Chapas Utilizadas:</strong> {simulatedSheetsUsed.length}</p>
              <p><strong>Novas Chapas Necessárias:</strong> {newSheetsRequired}</p>
              <p><strong>Retalhos Utilizados:</strong> {remnantsUsed}</p>
              <p><strong>Custo Total (Estimado):</strong> R$ {simulatedCost.toFixed(2)}</p>
            </div>
          </section>

          <section className="neumorphic-card p-6">
            <h3 className="text-xl font-semibold text-[var(--title-color)] mb-4">Peças a Serem Cortadas</h3>
            <Table<PlacedPiece>
              data={simulatedPlacedPieces}
              columns={piecesToCutColumns}
              keyExtractor={(piece) => piece.id}
              emptyMessage="Nenhuma peça foi encaixada neste plano."
            />
          </section>

          <section className="neumorphic-card p-6">
            <h3 className="text-xl font-semibold text-[var(--title-color)] mb-4">Chapas/Retalhos Utilizados</h3>
            <Table<Sheet>
              data={simulatedSheetsUsed}
              columns={sheetsUsedColumns}
              keyExtractor={(sheet) => sheet.id}
              emptyMessage="Nenhuma chapa ou retalho foi utilizado."
            />
          </section>

          <section className="neumorphic-card p-6">
            <h3 className="text-xl font-semibold text-[var(--title-color)] mb-4">Novos Retalhos Gerados (Elegíveis)</h3>
            <Table<Sheet>
              data={simulatedRemnants}
              columns={generatedRemnantsColumns}
              keyExtractor={(remnant) => remnant.id}
              emptyMessage="Nenhum novo retalho elegível gerado."
            />
          </section>

          <section className="neumorphic-card p-6">
            <h3 className="text-xl font-semibold text-[var(--title-color)] mb-4">Estoque Após Confirmação (Estimativa)</h3>
            <p className="text-gray-700 mb-2">
              Note: Esta é uma estimativa do estoque após a confirmação *deste* plano de corte.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
              <p><strong>Chapas Novas em Estoque:</strong> {sheetsInStock.length - newSheetsRequired}</p>
              <p><strong>Retalhos em Estoque:</strong> {remnantsInStock.length - remnantsUsed + simulatedRemnants.length}</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default ReportAndBudget;