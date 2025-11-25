import { UserRole } from './user-role.model';

export interface Loss {
  readonly id: string;
  readonly productName: string;
  readonly quantity: number;
  readonly reason: string;
  readonly date: Date;
  readonly recordedBy: UserRole;
  readonly recordedByPartnerName?: string;
}

export interface LossInput {
  readonly productName: string;
  readonly quantity: number;
  readonly reason: string;
  readonly date: Date;
  readonly recordedBy: UserRole;
  readonly recordedByPartnerName?: string;
}
