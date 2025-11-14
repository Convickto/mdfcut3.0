import { Sheet, Piece, CutPlan, Material, CurrentPlanState } from '../types';
import { STANDARD_MATERIALS } from '../constants';

const LS_PREFIX = 'nesting_planner_';

export const storageService = {
  // Materials
  getMaterials(): Material[] {
    const stored = localStorage.getItem(`${LS_PREFIX}materials`);
    return stored ? JSON.parse(stored) : STANDARD_MATERIALS;
  },
  saveMaterials(materials: Material[]): void {
    localStorage.setItem(`${LS_PREFIX}materials`, JSON.stringify(materials));
  },

  // Sheets (Stock)
  getSheets(): Sheet[] {
    const stored = localStorage.getItem(`${LS_PREFIX}sheets`);
    return stored ? JSON.parse(stored) : [];
  },
  saveSheets(sheets: Sheet[]): void {
    localStorage.setItem(`${LS_PREFIX}sheets`, JSON.stringify(sheets));
  },

  // Remnants (Stock)
  getRemnants(): Sheet[] {
    const stored = localStorage.getItem(`${LS_PREFIX}remnants`);
    return stored ? JSON.parse(stored) : [];
  },
  saveRemnants(remnants: Sheet[]): void {
    localStorage.setItem(`${LS_PREFIX}remnants`, JSON.stringify(remnants));
  },

  // Cut Plans
  getCutPlans(): CutPlan[] {
    const stored = localStorage.getItem(`${LS_PREFIX}cutPlans`);
    return stored ? JSON.parse(stored) : [];
  },
  saveCutPlans(cutPlans: CutPlan[]): void {
    localStorage.setItem(`${LS_PREFIX}cutPlans`, JSON.stringify(cutPlans));
  },

  // Onboarding state
  getOnboardingCompleted(): boolean {
    return localStorage.getItem(`${LS_PREFIX}onboardingCompleted`) === 'true';
  },
  setOnboardingCompleted(completed: boolean): void {
    localStorage.setItem(`${LS_PREFIX}onboardingCompleted`, String(completed));
  },

  // Current plan state (for persisting between tab navigations)
  getCurrentPlanState(): CurrentPlanState | null {
    const stored = localStorage.getItem(`${LS_PREFIX}currentPlanState`);
    return stored ? JSON.parse(stored) : null;
  },
  saveCurrentPlanState(state: CurrentPlanState): void {
    localStorage.setItem(`${LS_PREFIX}currentPlanState`, JSON.stringify(state));
  },
  clearCurrentPlanState(): void {
    localStorage.removeItem(`${LS_PREFIX}currentPlanState`);
  },
};
