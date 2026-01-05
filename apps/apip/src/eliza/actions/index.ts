/**
 * Actions Index
 * Export all custom actions for the multi-agent system
 */

import { collectInfoAction } from './collect-info.action';
import { classifyUrgenceAction } from './classify-urgence.action';
import { guidanceRCPAction, guidanceHeimlichAction, guidanceHemostaseAction } from './guidance-protocols.action';

// Export all actions
export const actions = [
  collectInfoAction,
  classifyUrgenceAction,
  guidanceRCPAction,
  guidanceHeimlichAction,
  guidanceHemostaseAction,
  // escaladeMedecinAction     // À implémenter Phase 3
];

// Export individual actions
export {
  collectInfoAction,
  classifyUrgenceAction,
  guidanceRCPAction,
  guidanceHeimlichAction,
  guidanceHemostaseAction
};

// Export action types
export type { ActionResult, CollectInfoAction } from './collect-info.action';
export type { ClassificationResult } from './classify-urgence.action';
export type { GuidanceState } from './guidance-protocols.action';
