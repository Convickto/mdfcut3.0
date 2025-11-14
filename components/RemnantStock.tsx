import React, { useMemo } from 'react';
import { Sheet } from '../types';
import Button from './Button';
import Table from './Table';
import { STANDARD_MATERIALS } from '../constants';

interface RemnantStockProps {
  remnants: Sheet[];
  onUpdateRemnants: (remnants: Sheet[]) => void;
}

const RemnantStock: React.FC<RemnantStockProps> = ({ remnants, onUpdateRemnants }) => {
  const deleteRemnant = (id: string) => {
    if (window.confirm('Tem certeza de que deseja excluir permanentemente este retalho?')) {
      onUpdateRemnants(remnants.filter((r) => r.id !== id));
    }
  };

  const remnantColumns = useMemo(() => [
    // FIX: Updated accessor to be a function for type compatibility with React.ReactNode
    { header: 'Material', accessor: (row: Sheet) => row.type },
    { header: 'Descrição', accessor: (row: Sheet) => STANDARD_MATERIALS.find(m => m.id === row.materialId)?.description || '' },
    { header: 'Dimensões (mm)', accessor: (row: Sheet) => `${row.width}x${row.length}` },
    // FIX: Updated accessor to be a function for type compatibility with React.ReactNode
    { header: 'Espessura (mm)', accessor: (row: Sheet) => row.thickness },
    { header: 'Origem', accessor: (row: Sheet) => row.parentId ? `Chapa ${row.parentId.substring(0, 8)}` : 'Desconhecida' },
    {
      header: 'Ações',
      accessor: (row: Sheet) => (
        <Button onClick={(e) => { e.stopPropagation(); deleteRemnant(row.id); }} variant="danger" size="sm">
          Excluir
        </Button>
      ),
      className: 'w-fit',
    },
  ], [remnants]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h2 className="text-2xl font-bold text-[var(--title-color)] mb-6">Estoque de Retalhos (Offcuts)</h2>

      <Table<Sheet>
        data={remnants}
        columns={remnantColumns}
        keyExtractor={(remnant) => remnant.id}
        emptyMessage="Nenhum retalho elegível no estoque. Retalhos menores que A4 não são salvos."
        className="neumorphic-card"
      />
    </div>
  );
};

export default RemnantStock;