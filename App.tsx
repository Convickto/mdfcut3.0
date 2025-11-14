import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sheet, Piece, CurrentPlanState, CutPlan } from './types';
import PlanningAndCutting from './components/PlanningAndCutting';
import SheetStock from './components/SheetStock';
import RemnantStock from './components/RemnantStock';
import ReportAndBudget from './components/ReportAndBudget';
import { storageService } from './services/storageService';
import { STANDARD_MATERIALS, DEFAULT_CUT_PLAN_NAME } from './constants';
import { v4 as uuidv4 } from 'uuid';

enum Tab {
  PLANNING_CUTTING = 'PLANNING_CUTTING',
  SHEET_STOCK = 'SHEET_STOCK',
  REMNANT_STOCK = 'REMNANT_STOCK',
  REPORT_BUDGET = 'REPORT_BUDGET',
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.PLANNING_CUTTING);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [remnants, setRemnants] = useState<Sheet[]>([]);
  const [cutPlans, setCutPlans] = useState<CutPlan[]>([] );
  const [currentPlan, setCurrentPlan] = useState<CurrentPlanState>(() => {
    // Initialize current plan from storage or default
    const storedPlan = storageService.getCurrentPlanState();
    if (storedPlan) {
      // Ensure all necessary properties exist, add defaults if missing
      return {
        ...storedPlan,
        pieces: storedPlan.pieces || [],
        simulatedPlacedPieces: storedPlan.simulatedPlacedPieces || [],
        simulatedRemnants: storedPlan.simulatedRemnants || [],
        simulatedSheetsUsed: storedPlan.simulatedSheetsUsed || [],
        simulatedCost: storedPlan.simulatedCost || 0,
        loading: false,
        progress: 'Pronto para simular.',
        // FIX: Remove sheetBeingViewedId as per types.ts - it's handled internally by PlanningAndCutting's state
      };
    }
    return {
      pieces: [],
      simulatedPlacedPieces: [],
      simulatedRemnants: [],
      simulatedSheetsUsed: [],
      simulatedCost: 0,
      loading: false,
      progress: 'Pronto para simular.',
    };
  });

  // Load initial data from local storage
  useEffect(() => {
    storageService.saveMaterials(STANDARD_MATERIALS); // Ensure standard materials are always present
    setSheets(storageService.getSheets());
    setRemnants(storageService.getRemnants());
    setCutPlans(storageService.getCutPlans());
  }, []);

  // Persist current plan state to local storage whenever it changes
  useEffect(() => {
    storageService.saveCurrentPlanState(currentPlan);
  }, [currentPlan]);

  // Update sheets and remnants in storage
  const handleUpdateSheets = useCallback((updatedSheets: Sheet[]) => {
    setSheets(updatedSheets);
    storageService.saveSheets(updatedSheets);
  }, []);

  const handleUpdateRemnants = useCallback((updatedRemnants: Sheet[]) => {
    setRemnants(updatedRemnants);
    storageService.saveRemnants(updatedRemnants);
  }, []);

  const handlePlanUpdate = useCallback((updatedPlan: CurrentPlanState) => {
    setCurrentPlan(updatedPlan);
  }, []);

  const handleConfirmPlan = useCallback(() => {
    if (currentPlan.simulatedSheetsUsed.length === 0 || currentPlan.simulatedPlacedPieces.length === 0) {
      alert('Não há plano de corte válido para confirmar. Por favor, simule o corte primeiro.');
      return;
    }

    const confirmed: boolean = window.confirm('Ao confirmar, o estoque será atualizado e o plano de corte será salvo. Deseja continuar?');
    if (!confirmed) {
      return;
    }

    const planId = uuidv4();
    const newCutPlan: CutPlan = {
      id: planId,
      name: DEFAULT_CUT_PLAN_NAME + ` (${new Date().toLocaleDateString()})`,
      date: new Date().toISOString(),
      piecesToCut: currentPlan.pieces,
      sheetsUsed: currentPlan.simulatedSheetsUsed,
      newRemnantsGenerated: currentPlan.simulatedRemnants,
      cost: currentPlan.simulatedCost,
      visualizationData: currentPlan.simulatedPlacedPieces,
      sheetBeingViewedId: currentPlan.simulatedSheetsUsed[0]?.id, // Default to viewing the first sheet of the confirmed plan
    };

    // 1. Update Sheet Stock
    let updatedSheetsInStock = [...sheets];
    let updatedRemnantsInStock = [...remnants];

    currentPlan.simulatedSheetsUsed.forEach(usedSheet => {
      if (usedSheet.isRemnant) {
        // Remove used remnant from stock
        updatedRemnantsInStock = updatedRemnantsInStock.filter(r => r.id !== usedSheet.id);
      } else {
        // Remove used full sheet from stock
        updatedSheetsInStock = updatedSheetsInStock.filter(s => s.id !== usedSheet.id);
      }
    });

    // 2. Add new remnants to Remnant Stock
    updatedRemnantsInStock = [...updatedRemnantsInStock, ...currentPlan.simulatedRemnants];

    setSheets(updatedSheetsInStock);
    setRemnants(updatedRemnantsInStock);
    setCutPlans(prev => [...prev, newCutPlan]);

    storageService.saveSheets(updatedSheetsInStock);
    storageService.saveRemnants(updatedRemnantsInStock);
    storageService.saveCutPlans([...cutPlans, newCutPlan]); // Ensure cutPlans is up-to-date in useCallback dependencies

    // Clear current plan for a new one
    setCurrentPlan({
      pieces: [],
      simulatedPlacedPieces: [],
      simulatedRemnants: [],
      simulatedSheetsUsed: [],
      simulatedCost: 0,
      loading: false,
      progress: 'Pronto para simular.',
    });
    storageService.clearCurrentPlanState(); // Clear from local storage too

    alert('Plano de corte confirmado e estoque atualizado!');
    setActiveTab(Tab.REPORT_BUDGET); // Switch to report to view confirmed plan
  }, [currentPlan, sheets, remnants, cutPlans]); // Added cutPlans to dependencies

  // Tab navigation items
  const tabs = useMemo(() => [
    { id: Tab.PLANNING_CUTTING, label: 'Planejamento e Corte' },
    { id: Tab.SHEET_STOCK, label: 'Estoque de Chapas' },
    { id: Tab.REMNANT_STOCK, label: 'Estoque de Retalhos' },
    { id: Tab.REPORT_BUDGET, label: 'Relatório e Orçamento' },
  ], []);

  return (
    <div className="min-h-screen bg-[var(--background-color)] flex flex-col">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-30 bg-white shadow-md p-4 neumorphic-card rounded-b-none mb-4">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
          <h1 className="text-xl md:text-2xl font-bold text-[var(--title-color)] mb-2 md:mb-0 w-full text-center">
            Nesting Planner
          </h1>
          <div className="flex flex-wrap justify-center md:justify-end gap-2 md:gap-4 mt-2 md:mt-0 w-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  neumorphic-button py-2 px-3 sm:px-4 rounded-md text-sm font-medium transition-colors duration-200
                  ${activeTab === tab.id
                    ? 'button-primary shadow-lg'
                    : 'text-gray-700 hover:bg-gray-200'}
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow container mx-auto p-0 pb-16 md:pb-0"> {/* Added pb-16 for sticky button spacing */}
        {activeTab === Tab.PLANNING_CUTTING && (
          <PlanningAndCutting
            onPlanUpdate={handlePlanUpdate}
            currentPlan={currentPlan}
            onConfirmPlan={handleConfirmPlan}
            sheets={sheets}
            remnants={remnants}
            loadingCutPlan={currentPlan.loading}
            cutPlanProgress={currentPlan.progress}
          />
        )}
        {activeTab === Tab.SHEET_STOCK && (
          <SheetStock sheets={sheets} onUpdateSheets={handleUpdateSheets} />
        )}
        {activeTab === Tab.REMNANT_STOCK && (
          <RemnantStock remnants={remnants} onUpdateRemnants={handleUpdateRemnants} />
        )}
        {activeTab === Tab.REPORT_BUDGET && (
          <ReportAndBudget
            currentPlan={currentPlan}
            onConfirmPlan={handleConfirmPlan}
            sheetsInStock={sheets}
            remnantsInStock={remnants}
          />
        )}
      </main>
    </div>
  );
};

export default App;