import type { CoachingContext } from './context';
import { evaluateRules, type Insight } from './rules';

/**
 * Coaching provider interface. The app ships with the local rule-based provider only.
 * A future optional AI provider can implement this interface (e.g. sending an anonymised
 * summary — never raw health records without explicit consent) and be selected in Settings.
 */
export interface CoachingProvider {
  id: string;
  /** True when the provider runs entirely on-device. */
  local: boolean;
  generate(ctx: CoachingContext): Promise<Insight[]>;
}

export const ruleBasedProvider: CoachingProvider = {
  id: 'rules',
  local: true,
  generate: async (ctx) => evaluateRules(ctx)
};
