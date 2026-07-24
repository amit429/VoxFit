import type { GoalType } from '@/app/models/goal-type.model';
import type { SportType } from '@/app/models/sport-type.model';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  sport_type: SportType | null;
  goal: GoalType | null;
  target_protein_g: number;
  target_calories: number;
  /** Daily carb target (grams); defaults from DB migration when unset in UI. */
  target_carbs_g: number;
  /** Daily fat target (grams); defaults from DB migration when unset in UI. */
  target_fat_g: number;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}
