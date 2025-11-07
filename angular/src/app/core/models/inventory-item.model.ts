export type InventoryCategory = 'planta' | 'fertilizante' | 'pesticida' | 'herramienta';

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: InventoryCategory;
}

export type InventoryItemInput = Omit<InventoryItem, 'id'>;
