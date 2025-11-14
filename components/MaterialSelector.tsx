import React from 'react';
import { Material, MaterialType } from '../types';
import { STANDARD_MATERIALS } from '../constants';

interface MaterialSelectorProps {
  selectedMaterialId: string | undefined;
  onSelectMaterial: (materialId: string) => void;
  selectedThickness: number | undefined;
  onSelectThickness: (thickness: number) => void;
  label?: string;
  thicknessLabel?: string;
  className?: string;
  disabled?: boolean; // New prop for disabling the selectors
}

const MaterialSelector: React.FC<MaterialSelectorProps> = ({
  selectedMaterialId,
  onSelectMaterial,
  selectedThickness,
  onSelectThickness,
  label = 'Tipo de Material',
  thicknessLabel = 'Espessura (mm)',
  className = '',
  disabled = false, // Default to false
}) => {
  const selectedMaterial = STANDARD_MATERIALS.find(
    (m) => m.id === selectedMaterialId,
  );

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      <div>
        <label htmlFor="material-type" className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <select
          id="material-type"
          className="neumorphic-select" // Apply neumorphic style
          value={selectedMaterialId || ''}
          onChange={(e) => onSelectMaterial(e.target.value)}
          required
          disabled={disabled}
          aria-disabled={disabled}
        >
          <option value="" disabled>
            Selecione o Material
          </option>
          {STANDARD_MATERIALS.map((material) => (
            <option key={material.id} value={material.id}>
              {material.type} - {material.description}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="material-thickness" className="block text-sm font-medium text-gray-700 mb-1">
          {thicknessLabel}
        </label>
        <select
          id="material-thickness"
          className="neumorphic-select" // Apply neumorphic style
          value={selectedThickness || ''}
          onChange={(e) => onSelectThickness(parseFloat(e.target.value))}
          disabled={!selectedMaterialId || disabled}
          aria-disabled={!selectedMaterialId || disabled}
          required
        >
          <option value="" disabled>
            Selecione a Espessura
          </option>
          {selectedMaterial?.standardThicknesses.map((thickness) => (
            <option key={thickness} value={thickness}>
              {thickness}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default MaterialSelector;