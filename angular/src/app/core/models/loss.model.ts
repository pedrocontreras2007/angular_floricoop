import { UserRole } from './user-role.model';

export type LossSource = 'inventory' | 'harvest';

export interface Loss {
  readonly id: string;
  readonly productName: string;
  readonly quantity: number;
  readonly reason: string;
  readonly date: Date;
  readonly recordedBy: UserRole;
  readonly recordedByPartnerName?: string;
  readonly sourceType?: LossSource;
  readonly sourceId?: string;
}

export interface LossInput {
  readonly productName: string;
  readonly quantity: number;
  readonly reason: string;
  readonly date: Date;
  readonly recordedBy: UserRole;
  readonly recordedByPartnerName?: string;
  readonly sourceType?: LossSource;
  readonly sourceId?: string;
}
