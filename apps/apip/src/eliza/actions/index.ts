/**
 * Actions Index
 * Export all custom actions for the multi-agent system
 */

import { collectInfoAction } from './collect-info.action';

// Export all actions
export const actions = [
  collectInfoAction,
];

// Export individual actions
export {
  collectInfoAction,
};

// Export action types
export type { ActionResult, CollectInfoAction } from './collect-info.action';
