import React, { useState, useMemo } from 'react';
import { Sheet, MaterialType } from '../types';
import Button from './Button';
import Table from './Table';
import Modal from './Modal';
import MaterialSelector from './MaterialSelector';
import { STANDARD_MATERIALS } from '../constants';
import { v4 as uuidv4 } from 'uuid';

interface SheetStockProps {
  sheets: Sheet[];
  onUpdateSheets: (sheets: Sheet[]) => void;
}

const SheetStock: React.FC<SheetStockProps> = ({ sheets, onUpdateSheets }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSheet, setEditingSheet] = useState<Sheet | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | undefined>(undefined);
  const [selectedThickness, setSelectedThickness] = useState<number | undefined>(undefined);
  const [length, setLength] = useState<number | ''>('');
  const [width, setWidth] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');

  const openAddModal = () => {
    setEditingSheet(null);
    setSelectedMaterialId(undefined);
    setSelectedThickness(undefined);
    setLength('');
    setWidth('');
    setPrice('');
    setIsModalOpen(true);
  };

  const openEditModal = (sheet: Sheet) => {
    setEditingSheet(sheet);
    setSelectedMaterialId(sheet.materialId);
    setSelectedThickness(sheet.thickness);
    setLength(sheet.length);
    setWidth(sheet.width);
    setPrice(sheet.price);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSheet(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMaterialId && selectedThickness && length && width && price) {
      const material = STANDARD_MATERIALS.find(m => m.id === selectedMaterialId);
      if (!material) {
        alert('Material selecionado inválido.');
        return;
      }

      const newOrUpdatedSheet: Sheet = {
        id: editingSheet?.id || uuidv4(),
        materialId: selectedMaterialId,
        type: material.type,
        length: length,
        width: width,
        thickness: selectedThickness,
        price: price,
        isRemnant: false,
      };

      if (editingSheet) {
        onUpdateSheets(sheets.map((s) => (s.id === newOrUpdatedSheet.id ? newOrUpdatedSheet : s)));
      } else {
        onUpdateSheets([...sheets, newOrUpdatedSheet]);
      }
      closeModal();
    } else {
      alert('Por favor, preencha todos os campos.');
    }
  };

  const deleteSheet = (id: string) => {
    if (window.confirm('Tem certeza de que deseja excluir esta chapa?')) {
      onUpdateSheets(sheets.filter((s) => s.id !== id));
    }
  };

  const sheetColumns = useMemo(() => [
    // FIX: Updated accessor to be a function for type compatibility with React.ReactNode
    { header: 'Material', accessor: (row: Sheet) => row.type },
    { header: 'Descrição', accessor: (row: Sheet) => STANDARD_MATERIALS.find(m => m.id === row.materialId)?.description || '' },
    // FIX: Updated accessor to be a function for type compatibility with React.ReactNode
    { header: 'Comprimento (mm)', accessor: (row: Sheet) => row.length },
    // FIX: Updated accessor to be a function for type compatibility with React.ReactNode
    { header: 'Largura (mm)', accessor: (row: Sheet) => row.width },
    // FIX: Updated accessor to be a function for type compatibility with React.ReactNode
    { header: 'Espessura (mm)', accessor: (row: Sheet) => row.thickness },
    { header: 'Preço (R$)', accessor: (row: Sheet) => row.price.toFixed(2) },
    {
      header: 'Ações',
      accessor: (row: Sheet) => (
        <div className="flex space-x-2">
          <Button onClick={(e) => { e.stopPropagation(); openEditModal(row); }} variant="secondary" size="sm">
            Editar
          </Button>
          <Button onClick={(e) => { e.stopPropagation(); deleteSheet(row.id); }} variant="danger" size="sm">
            Excluir
          </Button>
        </div>
      ),
      className: 'w-fit',
    },
  ], [sheets]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h2 className="text-2xl font-bold text-[var(--title-color)] mb-6">Estoque de Chapas</h2>
      <div className="mb-4">
        <Button onClick={openAddModal} variant="primary">
          Adicionar Chapa
        </Button>
      </div>

      <Table<Sheet>
        data={sheets}
        columns={sheetColumns}
        keyExtractor={(sheet) => sheet.id}
        emptyMessage="Nenhuma chapa inteira no estoque."
        className="neumorphic-card"
      />

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingSheet ? 'Editar Chapa' : 'Adicionar Nova Chapa'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <MaterialSelector
            selectedMaterialId={selectedMaterialId}
            onSelectMaterial={setSelectedMaterialId}
            selectedThickness={selectedThickness}
            onSelectThickness={setSelectedThickness}
          />
          <div>
            <label htmlFor="sheet-length" className="block text-sm font-medium text-gray-700">
              Comprimento (mm)
            </label>
            <input
              type="number"
              id="sheet-length"
              className="neumorphic-input"
              value={length}
              onChange={(e) => setLength(parseFloat(e.target.value) || '')}
              min="1"
              required
            />
          </div>
          <div>
            <label htmlFor="sheet-width" className="block text-sm font-medium text-gray-700">
              Largura (mm)
            </label>
            <input
              type="number"
              id="sheet-width"
              className="neumorphic-input"
              value={width}
              onChange={(e) => setWidth(parseFloat(e.target.value) || '')}
              min="1"
              required
            />
          </div>
          <div>
            <label htmlFor="sheet-price" className="block text-sm font-medium text-gray-700">
              Preço por Chapa (R$)
            </label>
            <input
              type="number"
              id="sheet-price"
              className="neumorphic-input"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || '')}
              min="0"
              step="0.01"
              required
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" variant="primary">
              {editingSheet ? 'Salvar Alterações' : 'Adicionar Chapa'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SheetStock;