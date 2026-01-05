/**
 * Characters Index
 * Export all character definitions for the multi-agent system
 */

import { triageCharacter } from './triage.character';
import { classificationCharacter } from './classification.character';
import { guidanceCharacter } from './guidance.character';

// Export all characters
export const characters = [
  triageCharacter,
  classificationCharacter,
  guidanceCharacter,
  // coordinationCharacter,   // À implémenter Phase 3
  // memoryCharacter          // À implémenter Phase 3
];

// Export individual characters
export { triageCharacter, classificationCharacter, guidanceCharacter };

// Export character type
export type { Character } from './triage.character';
