import { UserRole } from './user-role.model';

export type InventoryCategory = 'planta' | 'fertilizante' | 'pesticida' | 'herramienta';
export type InventoryUnit = 'unidades';

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: InventoryUnit;
  category: InventoryCategory;
  recordedBy: UserRole;
  recordedByPartnerName?: string;
  recordedByUser?: string | null;
}

export type InventoryItemInput = Omit<InventoryItem, 'id'>;
