import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Harvest, HarvestInput } from '../models/harvest.model';
import { InventoryItem, InventoryItemInput } from '../models/inventory-item.model';

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly harvestsSubject = new BehaviorSubject<Harvest[]>(this.createInitialHarvests());
  private readonly inventorySubject = new BehaviorSubject<InventoryItem[]>(this.createInitialInventory());

  readonly harvests$ = this.harvestsSubject.asObservable();
  readonly inventory$ = this.inventorySubject.asObservable();

  get harvestsSnapshot(): Harvest[] {
    return this.harvestsSubject.value;
  }

  get inventorySnapshot(): InventoryItem[] {
    return this.inventorySubject.value;
  }

  addHarvest(input: HarvestInput): void {
    const harvest: Harvest = {
      id: this.generateId(),
      ...input
    };

    this.harvestsSubject.next([harvest, ...this.harvestsSubject.value]);
  }

  addInventoryItem(input: InventoryItemInput): void {
    const item: InventoryItem = {
      id: this.generateId(),
      ...input
    };

    this.inventorySubject.next([item, ...this.inventorySubject.value]);
  }

  updateInventoryQuantity(id: string, quantity: number): void {
    const updated = this.inventorySubject.value.map((item: InventoryItem) =>
      item.id === id ? { ...item, quantity } : item
    );
    this.inventorySubject.next(updated);
  }

  private createInitialHarvests(): Harvest[] {
    const now = Date.now();
    return [
      {
        id: this.generateId(),
        crop: 'Café Arábica',
        category: 'primera',
        quantity: 12.5,
        date: new Date(now - ((24 + 3) * 60 * 60 * 1000)),
        partner: 'Coop Andina'
      },
      {
        id: this.generateId(),
        crop: 'Cacao Premium',
        category: 'segunda',
        quantity: 8.2,
        date: new Date(now - ((4 * 24 + 6) * 60 * 60 * 1000)),
        partner: 'Finca Aurora'
      }
    ];
  }

  private createInitialInventory(): InventoryItem[] {
    return [
      { id: this.generateId(), name: 'Fertilizante orgánico A', quantity: 18, unit: 'kg', category: 'fertilizante' },
      { id: this.generateId(), name: 'Pesticida biológico X', quantity: 9, unit: 'lt', category: 'pesticida' },
      { id: this.generateId(), name: 'Semillas de quinoa', quantity: 25, unit: 'kg', category: 'planta' },
      { id: this.generateId(), name: 'Guantes de nitrilo', quantity: 6, unit: 'paquetes', category: 'herramienta' },
      { id: this.generateId(), name: 'Mangueras de riego', quantity: 14, unit: 'unidades', category: 'herramienta' },
      { id: this.generateId(), name: 'Trampas para insectos', quantity: 4, unit: 'kits', category: 'pesticida' }
    ];
  }

  private generateId(): string {
    const globalCrypto = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>)['crypto'] as Crypto | undefined : undefined;
    if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
      return globalCrypto.randomUUID();
    }
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
