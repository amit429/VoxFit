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
  /** Sessions per week the user is aiming for. 1–14, enforced by a DB check. */
  weekly_session_target: number;
  height_cm: number | null;
  weight_kg: number | null;
  /** weight_kg / (height_cm/100)^2, rounded to 1dp. DB-generated column — never sent in a write patch. */
  bmi: number | null;
  onboarding_completed: boolean;
  tour_orientation_seen: boolean;
  tour_workout_seen: boolean;
  tour_meal_seen: boolean;
  created_at: string;
  updated_at: string;
}
