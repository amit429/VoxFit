import type { MacroRowMock } from '@/app/models/macro-row-mock.model';

export interface HomeMacrosMock {
  readonly rows: readonly MacroRowMock[];
  readonly hint?: string;
}
