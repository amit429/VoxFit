import type { MealSectionVm } from '@/app/models/meal-section-vm.model';

export interface DayGroupVm {
  readonly dateKey: string;
  readonly dateHeading: string;
  readonly sections: readonly MealSectionVm[];
}
