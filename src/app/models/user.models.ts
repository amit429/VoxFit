export type SportType = 'gym' | 'runner' | 'cyclist' | 'sport';
export type GoalType = 'bulk' | 'cut' | 'maintain';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  sport_type: SportType | null;
  goal: GoalType | null;
  target_protein_g: number;
  target_calories: number;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}
