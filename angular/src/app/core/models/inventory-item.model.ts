import { UserRole } from './user-role.model';

export type InventoryCategory = 'planta' | 'fertilizante' | 'pesticida' | 'herramienta';

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: InventoryCategory;
  recordedBy: UserRole;
  recordedByPartnerName?: string;
}

export type InventoryItemInput = Omit<InventoryItem, 'id'>;
