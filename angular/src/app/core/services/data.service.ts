import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Harvest, HarvestInput } from '../models/harvest.model';
import { InventoryItem, InventoryItemInput } from '../models/inventory-item.model';
import { Reminder, ReminderInput } from '../models/reminder.model';
import { Loss, LossInput } from '../models/loss.model';
import { AuthService } from './auth.service';

// Interfaz para manejar la respuesta de tu API (que devuelve { data: [], ... })
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class DataService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  // URL de tu backend (asegúrate que coincida con el puerto de tu index.js)
  private readonly API_URL = 'http://localhost:3000/api';

  // Mantenemos la lógica de Recordatorios en LocalStorage ya que no creamos API para ellos aún
  private static readonly REMINDERS_STORAGE_KEY = 'floricoop.reminders';

  // Inicializamos con arrays vacíos mientras carga la API
  private readonly harvestsSubject = new BehaviorSubject<Harvest[]>([]);
  private readonly inventorySubject = new BehaviorSubject<InventoryItem[]>([]);
  private readonly lossesSubject = new BehaviorSubject<Loss[]>([]);
  
  // Los recordatorios sí inician con datos locales
  private readonly remindersSubject = new BehaviorSubject<Reminder[]>(this.loadInitialReminders());

  readonly harvests$ = this.harvestsSubject.asObservable();
  readonly inventory$ = this.inventorySubject.asObservable();
  readonly reminders$ = this.remindersSubject.asObservable();
  readonly losses$ = this.lossesSubject.asObservable();

  constructor() {
    // Cargar datos reales al iniciar el servicio
    this.refreshAllData();
  }

  // --- Getters para Snapshots (útiles para valores actuales síncronos) ---
  get harvestsSnapshot(): Harvest[] { return this.harvestsSubject.value; }
  get inventorySnapshot(): InventoryItem[] { return this.inventorySubject.value; }
  get remindersSnapshot(): Reminder[] { return this.remindersSubject.value; }
  get lossesSnapshot(): Loss[] { return this.lossesSubject.value; }

  // --- Lógica de Carga de Datos (GET) ---
  
  private refreshAllData() {
    this.fetchHarvests();
    this.fetchInventory();
    this.fetchLosses();
  }

  private fetchHarvests() {
    this.http.get<ApiResponse<Harvest[]>>(`${this.API_URL}/harvests`)
      .subscribe({
        next: (res) => {
          // Convertimos los strings de fecha de la BD a objetos Date de JS
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
          const data = res.data.map(item => {
            const normalizedQuantity = Number(item.quantity) || 0;
            const sourceType = item.sourceType === 'inventory' || item.sourceType === 'harvest'
              ? item.sourceType
              : undefined;
            return {
              ...item,
              date: new Date(item.date),
              quantity: normalizedQuantity,
              sourceType,
              sourceId: sourceType ? item.sourceId : undefined
            } as Loss;
          });
          this.lossesSubject.next(data);
        },
        error: (err) => console.error('Error cargando pérdidas:', err)
      });
  }

  // --- Métodos Públicos (POST/PUT/DELETE) ---

  addHarvest(input: HarvestInput): void {
    const recordedByUser = input.recordedByUser ?? this.auth.email ?? 'sistema@floricoop.cl';
    const payload: HarvestInput = { ...input, recordedByUser };
    this.http.post(`${this.API_URL}/harvests`, payload).subscribe({
      next: () => this.fetchHarvests(), // Recargamos la lista tras guardar
      error: (e) => console.error('Error guardando cosecha', e)
    });
  }

  deleteHarvest(id: string): void {
    this.http.delete(`${this.API_URL}/harvests/${id}`).subscribe({
      next: () => this.fetchHarvests(),
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

  updateInventoryQuantity(
    id: string,
    quantity: number,
    recordedBy: string,
    recordedByPartnerName?: string,
    recordedByUser?: string | null
  ): void {
    // Buscamos el item actual para no perder otros datos (nombre, categoría, etc)
    const currentItem = this.inventorySubject.value.find(i => i.id === id);
    if (!currentItem) return;

    const recordedByUserValue = recordedByUser ?? this.auth.email ?? currentItem.recordedByUser ?? null;

    const updateData = {
      ...currentItem,
      quantity,
      recordedBy,
      recordedByPartnerName: recordedByPartnerName || '',
      unit: 'unidades',
      recordedByUser: recordedByUserValue
    };

    this.http.put(`${this.API_URL}/inventory/${id}`, updateData).subscribe({
      next: () => this.fetchInventory(),
      error: (e) => console.error('Error actualizando stock', e)
    });
  }

  updateHarvestQuantity(id: string, quantity: number): void {
    const currentHarvest = this.harvestsSubject.value.find(h => h.id === id);
    if (!currentHarvest) {
      return;
    }

    const recordedByUserValue = currentHarvest.recordedByUser ?? this.auth.email ?? null;

    const updateData = {
      ...currentHarvest,
      quantity: Math.max(quantity, 0),
      recordedByUser: recordedByUserValue
    };

    this.http.put(`${this.API_URL}/harvests/${id}`, updateData).subscribe({
      next: () => this.fetchHarvests(),
      error: (e) => console.error('Error actualizando cosecha', e)
    });
  }

  addLoss(input: LossInput): Observable<unknown> {
    return this.http.post(`${this.API_URL}/losses`, input).pipe(
      tap({
        next: () => this.fetchLosses()
      })
    );
  }

  removeLoss(id: string): void {
    this.http.delete(`${this.API_URL}/losses/${id}`).subscribe({
      next: () => this.fetchLosses(),
      error: (e) => console.error('Error eliminando pérdida', e)
    });
  }

  // --- Lógica de Recordatorios (Mantenida Localmente) ---
  // Como no creamos endpoints para recordatorios, mantenemos tu código original de localStorage aquí
  
  addReminder(input: ReminderInput): void {
    const reminder: Reminder = {
      id: this.generateLocalId(),
      title: input.title,
      note: input.note?.trim() || undefined,
      scheduledAt: new Date(input.scheduledAt)
    };
    const next = [...this.remindersSubject.value, reminder].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    this.remindersSubject.next(next);
    this.persistReminders(next);
  }

  removeReminder(id: string): void {
    const next = this.remindersSubject.value.filter(r => r.id !== id);
    this.remindersSubject.next(next);
    this.persistReminders(next);
  }

  updateReminder(id: string, input: ReminderInput): void {
    const current = this.remindersSubject.value;
    const index = current.findIndex(reminder => reminder.id === id);
    if (index === -1) {
      return;
    }

    const updatedReminder: Reminder = {
      ...current[index],
      title: input.title,
      note: input.note?.trim() || undefined,
      scheduledAt: new Date(input.scheduledAt)
    };

    const next = [...current];
    next[index] = updatedReminder;
    next.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    this.remindersSubject.next(next);
    this.persistReminders(next);
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

  private generateLocalId(): string {
    return `local-${Date.now()}`;
  }
}