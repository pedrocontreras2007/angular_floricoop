import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Harvest, HarvestInput } from '../models/harvest.model';
import { InventoryItem, InventoryItemInput } from '../models/inventory-item.model';
import { Reminder, ReminderInput } from '../models/reminder.model';
import { Loss, LossInput } from '../models/loss.model';
import { AuthService } from './auth.service';

interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class DataService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private readonly API_URL = 'http://innovacode.cloud-app.cl/api';
  private static readonly REMINDERS_STORAGE_KEY = 'floricoop.reminders';

  private readonly harvestsSubject = new BehaviorSubject<Harvest[]>([]);
  private readonly inventorySubject = new BehaviorSubject<InventoryItem[]>([]);
  private readonly lossesSubject = new BehaviorSubject<Loss[]>([]);
  private readonly remindersSubject = new BehaviorSubject<Reminder[]>(this.loadInitialReminders());

  readonly harvests$ = this.harvestsSubject.asObservable();
  readonly inventory$ = this.inventorySubject.asObservable();
  readonly reminders$ = this.remindersSubject.asObservable();
  readonly losses$ = this.lossesSubject.asObservable();

  constructor() {
    this.refreshAllData();
  }

  get harvestsSnapshot(): Harvest[] { return this.harvestsSubject.value; }
  get inventorySnapshot(): InventoryItem[] { return this.inventorySubject.value; }
  get remindersSnapshot(): Reminder[] { return this.remindersSubject.value; }
  get lossesSnapshot(): Loss[] { return this.lossesSubject.value; }

  private refreshAllData() {
    this.fetchHarvests();
    this.fetchInventory();
    this.fetchLosses();
  }

  // --- Funciones de carga (Privadas) ---

  private fetchHarvests() {
    this.http.get<ApiResponse<Harvest[]>>(`${this.API_URL}/harvests`)
      .subscribe({
        next: (res) => {
          const data = res.data.map(item => ({
            ...item,
            date: new Date(item.date),
            recordedByUser: item.recordedByUser ?? null
          }));
          this.harvestsSubject.next(data);
        },
        error: (err) => console.error('Error cargando cosechas:', err)
      });
  }

  private fetchInventory() {
    this.http.get<ApiResponse<InventoryItem[]>>(`${this.API_URL}/inventory`)
      .subscribe({
        next: (res) => this.inventorySubject.next(
          res.data.map(item => ({
            ...item,
            unit: 'unidades',
            recordedByUser: item.recordedByUser ?? null
          }))
        ),
        error: (err) => console.error('Error cargando inventario:', err)
      });
  }

  private fetchLosses() {
    this.http.get<ApiResponse<Loss[]>>(`${this.API_URL}/losses`)
      .subscribe({
        next: (res) => {
          const data = res.data.map(item => ({
            ...item,
            date: new Date(item.date),
            quantity: Number(item.quantity) || 0
          } as Loss));
          this.lossesSubject.next(data);
        },
        error: (err) => console.error('Error cargando pérdidas:', err)
      });
  }

  // --- Métodos Públicos con Refresco Automático ---

  addHarvest(input: HarvestInput): void {
    const recordedByUser = input.recordedByUser ?? this.auth.email ?? 'sistema@floricoop.cl';
    const payload: HarvestInput = { ...input, recordedByUser };
    
    this.http.post(`${this.API_URL}/harvests`, payload).subscribe({
      next: () => {
        // Al agregar cosecha, refrescamos historial E inventario (pues el backend ahora suma el stock)
        this.fetchHarvests();
        this.fetchInventory(); 
      },
      error: (e) => console.error('Error guardando cosecha', e)
    });
  }

  deleteHarvest(id: string): void {
    this.http.delete(`${this.API_URL}/harvests/${id}`).subscribe({
      next: () => {
        this.fetchHarvests();
        this.fetchInventory(); // Refrescar inventario por si se descontó al borrar
      },
      error: (e) => console.error('Error eliminando cosecha', e)
    });
  }

  addInventoryItem(input: InventoryItemInput): void {
    const recordedByUser = input.recordedByUser ?? this.auth.email ?? 'sistema@floricoop.cl';
    const payload: InventoryItemInput = { ...input, unit: 'unidades', recordedByUser };
    this.http.post(`${this.API_URL}/inventory`, payload).subscribe({
      next: () => this.fetchInventory(),
      error: (e) => console.error('Error guardando item', e)
    });
  }

  // NOTA: Esta función updateInventoryQuantity se mantiene para ediciones manuales,
  // pero ya no la usaremos para restar mermas automáticamente desde el frontend.
  updateInventoryQuantity(id: string, quantity: number, recordedBy: string, recordedByPartnerName?: string, recordedByUser?: string | null): void {
    const currentItem = this.inventorySubject.value.find(i => i.id === id);
    if (!currentItem) return;

    const recordedByUserValue = recordedByUser ?? this.auth.email ?? currentItem.recordedByUser ?? null;
    const updateData = {
      ...currentItem,
      quantity,
      recordedBy,
      recordedByPartnerName: recordedByPartnerName || '',
      recordedByUser: recordedByUserValue
    };

    this.http.put(`${this.API_URL}/inventory/${id}`, updateData).subscribe({
      next: () => this.fetchInventory(),
      error: (e) => console.error('Error actualizando stock manual', e)
    });
  }

  // Método para agregar Mermas
  addLoss(input: LossInput): Observable<unknown> {
    return this.http.post(`${this.API_URL}/losses`, input).pipe(
      tap({
        next: () => {
          // Al crear merma, el backend resta el stock.
          // Aquí recargamos Mermas e Inventario para ver el cambio reflejado.
          this.fetchLosses();
          this.fetchInventory();
        }
      })
    );
  }

  removeLoss(id: string): void {
    this.http.delete(`${this.API_URL}/losses/${id}`).subscribe({
      next: () => {
        this.fetchLosses();
        this.fetchInventory(); // Refrescar por si el backend devuelve el stock
      },
      error: (e) => console.error('Error eliminando pérdida', e)
    });
  }

  // --- Recordatorios (LocalStorage) ---
  addReminder(input: ReminderInput): void {
    const reminder: Reminder = {
      id: `local-${Date.now()}`,
      title: input.title,
      note: input.note?.trim() || undefined,
      scheduledAt: new Date(input.scheduledAt)
    };
    const next = [...this.remindersSubject.value, reminder].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    this.remindersSubject.next(next);
    this.persistReminders(next);
  }

  updateReminder(id: string, changes: ReminderInput): void {
    const next = this.remindersSubject.value
      .map(reminder => reminder.id === id
        ? {
            ...reminder,
            title: changes.title,
            scheduledAt: new Date(changes.scheduledAt),
            note: changes.note?.trim() || undefined
          }
        : reminder)
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    this.remindersSubject.next(next);
    this.persistReminders(next);
  }

  removeReminder(id: string): void {
    const next = this.remindersSubject.value.filter(r => r.id !== id);
    this.remindersSubject.next(next);
    this.persistReminders(next);
  }

  updateHarvestQuantity(id: string, quantity: number): void {
    const harvest = this.harvestsSubject.value.find(entry => entry.id === id);
    if (!harvest) {
      return;
    }

    const recordedByUser = this.auth.email ?? harvest.recordedByUser ?? null;
    const payload = {
      ...harvest,
      quantity,
      recordedByUser,
      date: harvest.date.toISOString()
    };

    this.http.put(`${this.API_URL}/harvests/${id}`, payload).subscribe({
      next: () => this.fetchHarvests(),
      error: (e) => console.error('Error actualizando cosecha', e)
    });
  }

  private loadInitialReminders(): Reminder[] {
    const raw = localStorage.getItem(DataService.REMINDERS_STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw).map((r: any) => ({...r, scheduledAt: new Date(r.scheduledAt)}));
    } catch { return []; }
  }

  private persistReminders(data: Reminder[]) {
    localStorage.setItem(DataService.REMINDERS_STORAGE_KEY, JSON.stringify(data));
  }
}