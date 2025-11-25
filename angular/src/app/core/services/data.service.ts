import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Harvest, HarvestInput } from '../models/harvest.model';
import { InventoryItem, InventoryItemInput } from '../models/inventory-item.model';
import { Reminder, ReminderInput } from '../models/reminder.model';
import { Loss, LossInput } from '../models/loss.model';

type PersistedHarvest = Omit<Harvest, 'date'> & { date: string };
type PersistedInventoryItem = InventoryItem;
type PersistedLoss = Omit<Loss, 'date'> & { date: string };
type PersistedReminder = Omit<Reminder, 'scheduledAt'> & { scheduledAt: string };

@Injectable({ providedIn: 'root' })
export class DataService {
  private static readonly HARVESTS_STORAGE_KEY = 'floricoop.harvests';
  private static readonly INVENTORY_STORAGE_KEY = 'floricoop.inventory';
  private static readonly LOSSES_STORAGE_KEY = 'floricoop.losses';
  private static readonly REMINDERS_STORAGE_KEY = 'floricoop.reminders';

  private readonly harvestsSubject = new BehaviorSubject<Harvest[]>(this.loadInitialHarvests());
  private readonly inventorySubject = new BehaviorSubject<InventoryItem[]>(this.loadInitialInventory());
  private readonly remindersSubject = new BehaviorSubject<Reminder[]>(this.loadInitialReminders());
  private readonly lossesSubject = new BehaviorSubject<Loss[]>(this.loadInitialLosses());

  readonly harvests$ = this.harvestsSubject.asObservable();
  readonly inventory$ = this.inventorySubject.asObservable();
  readonly reminders$ = this.remindersSubject.asObservable();
  readonly losses$ = this.lossesSubject.asObservable();

  get harvestsSnapshot(): Harvest[] {
    return this.harvestsSubject.value;
  }

  get inventorySnapshot(): InventoryItem[] {
    return this.inventorySubject.value;
  }

  get remindersSnapshot(): Reminder[] {
    return this.remindersSubject.value;
  }

  get lossesSnapshot(): Loss[] {
    return this.lossesSubject.value;
  }

  addHarvest(input: HarvestInput): void {
    const purchasePriceClp = this.normalizePrice(input.purchasePriceClp);
    const salePriceClp = this.normalizePrice(input.salePriceClp);

    const harvest: Harvest = {
      id: this.generateId(),
      crop: input.crop,
      category: input.category,
      quantity: input.quantity,
      date: input.date,
      recordedBy: input.recordedBy,
      recordedByPartnerName: input.recordedBy === 'socio'
        ? input.recordedByPartnerName?.trim() || undefined
        : undefined,
      purchasePriceClp,
      salePriceClp
    };

    const nextValue = [harvest, ...this.harvestsSubject.value];
    this.harvestsSubject.next(nextValue);
    this.persistHarvests(nextValue);
  }

  addInventoryItem(input: InventoryItemInput): void {
    const item: InventoryItem = {
      id: this.generateId(),
      ...input,
      recordedByPartnerName: input.recordedBy === 'socio'
        ? input.recordedByPartnerName?.trim() || undefined
        : undefined
    };

    const nextValue = [item, ...this.inventorySubject.value];
    this.inventorySubject.next(nextValue);
    this.persistInventory(nextValue);
  }

  addReminder(input: ReminderInput): void {
    const reminder: Reminder = {
      id: this.generateId(),
      title: input.title,
      note: input.note?.trim() ? input.note.trim() : undefined,
      scheduledAt: this.normalizeReminderDate(input.scheduledAt)
    };

    const next = [...this.remindersSubject.value, reminder].sort(
      (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()
    );

    this.remindersSubject.next(next);
    this.persistReminders(next);
  }

  updateReminder(id: string, input: ReminderInput): void {
    let changed = false;
    const normalizedDate = this.normalizeReminderDate(input.scheduledAt);
    const trimmedNote = input.note?.trim() ? input.note.trim() : undefined;

    const updated = this.remindersSubject.value.map(reminder => {
      if (reminder.id !== id) {
        return reminder;
      }
      changed = true;
      return {
        ...reminder,
        title: input.title,
        scheduledAt: normalizedDate,
        note: trimmedNote
      } satisfies Reminder;
    });

    if (!changed) {
      return;
    }

    const sorted = updated.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    this.remindersSubject.next(sorted);
    this.persistReminders(sorted);
  }

  removeReminder(id: string): void {
    const next = this.remindersSubject.value.filter(reminder => reminder.id !== id);
    if (next.length === this.remindersSubject.value.length) {
      return;
    }
    this.remindersSubject.next(next);
    this.persistReminders(next);
  }

  addLoss(input: LossInput): void {
    const loss: Loss = {
      id: this.generateId(),
      productName: input.productName,
      quantity: input.quantity,
      reason: input.reason,
      date: this.normalizeLossDate(input.date),
      recordedBy: input.recordedBy,
      recordedByPartnerName: input.recordedBy === 'socio'
        ? input.recordedByPartnerName?.trim() || undefined
        : undefined
    };

    const next = [...this.lossesSubject.value, loss].sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );

    this.lossesSubject.next(next);
    this.persistLosses(next);
  }

  removeLoss(id: string): void {
    const next = this.lossesSubject.value.filter(loss => loss.id !== id);
    this.lossesSubject.next(next);
    this.persistLosses(next);
  }

  updateInventoryQuantity(
    id: string,
    quantity: number,
    recordedBy: InventoryItem['recordedBy'],
    recordedByPartnerName?: string
  ): void {
    const updated = this.inventorySubject.value.map((item: InventoryItem) =>
      item.id === id
        ? {
            ...item,
            quantity,
            recordedBy,
            recordedByPartnerName: recordedBy === 'socio'
              ? recordedByPartnerName?.trim() || undefined
              : undefined
          }
        : item
    );
    this.inventorySubject.next(updated);
    this.persistInventory(updated);
  }

  private createInitialHarvests(): Harvest[] {
    return [];
  }

  private loadInitialHarvests(): Harvest[] {
    return this.readHarvestsFromStorage() ?? this.createInitialHarvests();
  }

  private createInitialInventory(): InventoryItem[] {
    return [
      { id: this.generateId(), name: 'Fertilizante orgánico A', quantity: 18, unit: 'kg', category: 'fertilizante', recordedBy: 'secretaria' as const },
      { id: this.generateId(), name: 'Pesticida X', quantity: 9, unit: 'lt', category: 'pesticida', recordedBy: 'administrador' as const },
      { id: this.generateId(), name: 'Guantes de nitrilo', quantity: 6, unit: 'paquetes', category: 'herramienta', recordedBy: 'tesorero' as const },
      { id: this.generateId(), name: 'Mangueras de riego', quantity: 14, unit: 'unidades', category: 'herramienta', recordedBy: 'administrador' as const },
      {
        id: this.generateId(),
        name: 'Maceteros',
        quantity: 25,
        unit: 'unidades',
        category: 'planta',
        recordedBy: 'socio' as const,
        recordedByPartnerName: 'Coop Andina'
      }
    ];
  }

  private loadInitialInventory(): InventoryItem[] {
    return this.readInventoryFromStorage() ?? this.createInitialInventory();
  }

  private createInitialLosses(): Loss[] {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 6);

    return [
      {
        id: this.generateId(),
        productName: 'Semillas de quinoa',
        quantity: 3,
        reason: 'Humedad durante el almacenamiento',
        date: this.normalizeLossDate(yesterday),
        recordedBy: 'secretaria' as const
      },
      {
        id: this.generateId(),
        productName: 'Café Arábica',
        quantity: 2,
        reason: 'Daño por transporte',
        date: this.normalizeLossDate(lastWeek),
        recordedBy: 'socio' as const,
        recordedByPartnerName: 'Socio Norte'
      }
    ].sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private loadInitialLosses(): Loss[] {
    return this.readLossesFromStorage() ?? this.createInitialLosses();
  }

  private createInitialReminders(): Reminder[] {
    const now = new Date();
    const upcomingFieldVisit = new Date(now);
    upcomingFieldVisit.setDate(upcomingFieldVisit.getDate() + 2);
    upcomingFieldVisit.setHours(9, 0, 0, 0);

    const upcomingInventoryAudit = new Date(now);
    upcomingInventoryAudit.setDate(upcomingInventoryAudit.getDate() + 5);
    upcomingInventoryAudit.setHours(16, 0, 0, 0);

    return [
      {
        id: this.generateId(),
        title: 'Visita de campo con productores',
        scheduledAt: this.normalizeReminderDate(upcomingFieldVisit),
        note: 'Revisar estado de cosechas y necesidades de insumos'
      },
      {
        id: this.generateId(),
        title: 'Auditoría rápida de inventario',
        scheduledAt: this.normalizeReminderDate(upcomingInventoryAudit),
        note: 'Confirmar existencias críticas antes de la reunión semanal'
      }
    ].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }

  private loadInitialReminders(): Reminder[] {
    return this.readRemindersFromStorage() ?? this.createInitialReminders();
  }

  private normalizeReminderDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setSeconds(0, 0);
    return normalized;
  }

  private normalizeLossDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private readHarvestsFromStorage(): Harvest[] | null {
    const storage = this.getBrowserStorage();
    if (!storage) {
      return null;
    }

    const raw = storage.getItem(DataService.HARVESTS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as PersistedHarvest[];
      if (!Array.isArray(parsed)) {
        return null;
      }

      const normalized = parsed
        .map((record): Harvest | null => {
          const date = new Date(record.date);
          if (Number.isNaN(date.getTime())) {
            return null;
          }
          const { date: _ignored, ...rest } = record;
          return { ...rest, date } as Harvest;
        })
        .filter((record): record is Harvest => record !== null);

      return normalized;
    } catch {
      return null;
    }
  }

  private persistHarvests(harvests: Harvest[]): void {
    const storage = this.getBrowserStorage();
    if (!storage) {
      return;
    }

    try {
      const serialized: PersistedHarvest[] = harvests.map((harvest) => ({
        ...harvest,
        date: harvest.date.toISOString()
      }));
      storage.setItem(DataService.HARVESTS_STORAGE_KEY, JSON.stringify(serialized));
    } catch {
      // Ignored: persistence is best-effort only
    }
  }

  private normalizePrice(value?: number | null): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (Number.isNaN(value) || value <= 0) {
      return undefined;
    }
    return Math.round(value);
  }

  private readInventoryFromStorage(): InventoryItem[] | null {
    const storage = this.getBrowserStorage();
    if (!storage) {
      return null;
    }

    const raw = storage.getItem(DataService.INVENTORY_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as PersistedInventoryItem[];
      if (!Array.isArray(parsed)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private persistInventory(items: InventoryItem[]): void {
    const storage = this.getBrowserStorage();
    if (!storage) {
      return;
    }

    try {
      storage.setItem(DataService.INVENTORY_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // best-effort
    }
  }

  private readLossesFromStorage(): Loss[] | null {
    const storage = this.getBrowserStorage();
    if (!storage) {
      return null;
    }

    const raw = storage.getItem(DataService.LOSSES_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as PersistedLoss[];
      if (!Array.isArray(parsed)) {
        return null;
      }

      const normalized = parsed
        .map((record): Loss | null => {
          const date = new Date(record.date);
          if (Number.isNaN(date.getTime())) {
            return null;
          }
          const { date: _ignored, ...rest } = record;
          return { ...rest, date } as Loss;
        })
        .filter((record): record is Loss => record !== null);

      return normalized.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch {
      return null;
    }
  }

  private persistLosses(losses: Loss[]): void {
    const storage = this.getBrowserStorage();
    if (!storage) {
      return;
    }

    try {
      const serialized: PersistedLoss[] = losses.map(loss => ({
        ...loss,
        date: loss.date.toISOString()
      }));
      storage.setItem(DataService.LOSSES_STORAGE_KEY, JSON.stringify(serialized));
    } catch {
      // best-effort
    }
  }

  private readRemindersFromStorage(): Reminder[] | null {
    const storage = this.getBrowserStorage();
    if (!storage) {
      return null;
    }

    const raw = storage.getItem(DataService.REMINDERS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as PersistedReminder[];
      if (!Array.isArray(parsed)) {
        return null;
      }

      const normalized = parsed
        .map((record): Reminder | null => {
          const scheduledAt = new Date(record.scheduledAt);
          if (Number.isNaN(scheduledAt.getTime())) {
            return null;
          }
          const { scheduledAt: _ignored, ...rest } = record;
          return { ...rest, scheduledAt: this.normalizeReminderDate(scheduledAt) } as Reminder;
        })
        .filter((record): record is Reminder => record !== null)
        .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

      return normalized;
    } catch {
      return null;
    }
  }

  private persistReminders(reminders: Reminder[]): void {
    const storage = this.getBrowserStorage();
    if (!storage) {
      return;
    }

    try {
      const serialized: PersistedReminder[] = reminders.map(reminder => ({
        ...reminder,
        scheduledAt: reminder.scheduledAt.toISOString()
      }));
      storage.setItem(DataService.REMINDERS_STORAGE_KEY, JSON.stringify(serialized));
    } catch {
      // best-effort
    }
  }

  private getBrowserStorage(): Storage | null {
    try {
      if (typeof globalThis === 'undefined') {
        return null;
      }
      const storage = (globalThis as Record<string, unknown>)['localStorage'] as Storage | undefined;
      return storage ?? null;
    } catch {
      return null;
    }
  }

  private generateId(): string {
    const globalCrypto = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>)['crypto'] as Crypto | undefined : undefined;
    if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
      return globalCrypto.randomUUID();
    }
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
