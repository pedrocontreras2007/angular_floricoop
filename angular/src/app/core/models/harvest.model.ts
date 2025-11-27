import { UserRole } from './user-role.model';

export type HarvestCategory = 'primera' | 'segunda' | 'tercera';

export interface Harvest {
  id: string;
  crop: string;
  category: HarvestCategory;
  quantity: number;
  date: Date;
  recordedBy: UserRole;
  recordedByPartnerName?: string;
  recordedByUser?: string | null;
  purchasePriceClp?: number;
  salePriceClp?: number;
}

export type HarvestInput = Omit<Harvest, 'id'>;
