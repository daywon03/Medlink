/**
 * Characters Index
 * Export all character definitions for the multi-agent system
 */

import { triageCharacter } from './triage.character';

// Export all characters
export const characters = [
  triageCharacter,
];

// Export individual characters
export { triageCharacter };

// Export character type
export type { Character } from './triage.character';
