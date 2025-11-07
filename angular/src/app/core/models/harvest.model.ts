export type HarvestCategory = 'primera' | 'segunda' | 'tercera';

export interface Harvest {
  id: string;
  crop: string;
  category: HarvestCategory;
  quantity: number;
  date: Date;
  partner: string;
}

export type HarvestInput = Omit<Harvest, 'id'>;
