import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { DataService } from '../../core/services/data.service';
import { Harvest } from '../../core/models/harvest.model';
import { InventoryItem } from '../../core/models/inventory-item.model';
import { Reminder } from '../../core/models/reminder.model';
import { QuantityFormatPipe } from '../../shared/pipes/quantity-format.pipe';

interface DashboardSummary {
  readonly totalHarvests: number;
  readonly totalHarvestQuantity: number;
  readonly inventoryCount: number;
  readonly healthyInventory: number;
  readonly criticalItems: InventoryItem[];
  readonly recentHarvests: { crop: string; date: Date; quantity: number; category: string; purchasePriceClp?: number; salePriceClp?: number }[];
  readonly stockByCategory: { category: string; total: number }[];
  readonly maxCategoryTotal: number;
  readonly topInventoryItems: InventoryItem[];
  readonly economicStats: {
    averageMargin: number;
    entries: { id: string; crop: string; margin: number; salePriceClp: number; purchasePriceClp: number }[];
  };
}

interface DashboardAction {
  readonly icon: string;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly accent: 'primary' | 'secondary' | 'warning' | 'info';
}

interface CalendarDay {
  readonly date: Date;
  readonly isoDate: string;
  readonly label: number;
  readonly inCurrentMonth: boolean;
  readonly isToday: boolean;
  readonly reminders: Reminder[];
}

interface CalendarViewModel {
  readonly monthLabel: string;
  readonly todayLabel: string;
  readonly weeks: CalendarDay[][];
  readonly upcomingReminders: Reminder[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, QuantityFormatPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  private static readonly ACTIONS: DashboardAction[] = [
    {
      icon: 'compost',
      title: 'Cosechas',
      subtitle: 'Registra entradas y clasificaciones',
      path: '/cosechas',
      accent: 'primary'
    },
    {
      icon: 'inventory_2',
      title: 'Inventario',
      subtitle: 'Gestiona insumos y existencias',
      path: '/inventario',
      accent: 'secondary'
    },
    {
      icon: 'warning',
      title: 'Alertas',
      subtitle: 'Identifica productos críticos',
      path: '/alertas',
      accent: 'warning'
    },
    {
      icon: 'insights',
      title: 'Reportes',
      subtitle: 'Analiza la salud del inventario',
      path: '/reportes',
      accent: 'info'
    }
  ];

  readonly actions = DashboardComponent.ACTIONS;
  readonly weekDayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  readonly Math = Math;
  editingReminderId: string | null = null;

  private readonly currentMonthSubject = new BehaviorSubject<Date>(this.startOfMonth(new Date()));
  private readonly currentMonth$ = this.currentMonthSubject.asObservable();

  readonly reminderForm = this.fb.group({
    title: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(100)]),
    date: this.fb.nonNullable.control(this.toISODate(new Date()), [Validators.required]),
    time: this.fb.control('', [Validators.pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)]),
    note: this.fb.control('', [Validators.maxLength(250)])
  });

  readonly calendarVm$ = combineLatest([this.currentMonth$, this.data.reminders$]).pipe(
    map(([month, reminders]) => this.buildCalendar(month, reminders))
  );

  readonly summary$ = combineLatest([this.data.harvests$, this.data.inventory$]).pipe(
    map(([harvests, inventory]: [Harvest[], InventoryItem[]]) => {
      const criticalItems = inventory
        .filter((item: InventoryItem) => item.quantity <= 10)
        .sort((a: InventoryItem, b: InventoryItem) => a.quantity - b.quantity);

      const recentHarvests = harvests
        .slice(0, 3)
        .map((harvest: Harvest) => ({
          crop: harvest.crop,
          date: harvest.date,
          quantity: harvest.quantity,
          category: harvest.category,
          purchasePriceClp: harvest.purchasePriceClp,
          salePriceClp: harvest.salePriceClp
        }));

      const stockByCategoryMap = inventory.reduce((acc, item: InventoryItem) => {
        const current = acc.get(item.category) ?? 0;
        acc.set(item.category, current + item.quantity);
        return acc;
      }, new Map<string, number>());

      const stockByCategory = Array.from(stockByCategoryMap.entries())
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);

      const maxCategoryTotal = stockByCategory.reduce((max, stat) => Math.max(max, stat.total), 0);

      const topInventoryItems = [...inventory]
        .sort((a: InventoryItem, b: InventoryItem) => b.quantity - a.quantity)
        .slice(0, 5);

      const profitEntries = harvests
        .map((harvest): { id: string; crop: string; margin: number; purchasePriceClp: number; salePriceClp: number } | null => {
          if (!harvest.purchasePriceClp || !harvest.salePriceClp || harvest.purchasePriceClp <= 0) {
            return null;
          }
          const gain = harvest.salePriceClp - harvest.purchasePriceClp;
          const margin = (gain / harvest.purchasePriceClp) * 100;
          return {
            id: harvest.id,
            crop: harvest.crop,
            margin,
            purchasePriceClp: harvest.purchasePriceClp,
            salePriceClp: harvest.salePriceClp
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((a, b) => b.margin - a.margin);

      const averageMargin = profitEntries.length
        ? profitEntries.reduce((sum, entry) => sum + entry.margin, 0) / profitEntries.length
        : 0;

      const economicStats = {
        averageMargin,
        entries: profitEntries.slice(0, 5)
      };

      return {
        totalHarvests: harvests.length,
        totalHarvestQuantity: harvests.reduce((sum: number, harvest: Harvest) => sum + harvest.quantity, 0),
        inventoryCount: inventory.length,
        healthyInventory: inventory.filter((item: InventoryItem) => item.quantity > 10).length,
        criticalItems,
        recentHarvests,
        stockByCategory,
        maxCategoryTotal,
        topInventoryItems,
        economicStats
      } satisfies DashboardSummary;
    })
  );

  constructor(private readonly data: DataService, private readonly fb: FormBuilder) {}

  trackInventory(_: number, item: InventoryItem): string {
    return item.id;
  }

  trackCategory(_: number, category: { category: string; total: number }): string {
    return category.category;
  }

  goToPreviousMonth(): void {
    this.shiftMonth(-1);
  }

  goToNextMonth(): void {
    this.shiftMonth(1);
  }

  selectDate(day: CalendarDay): void {
    const iso = day.isoDate;
    if (!day.inCurrentMonth) {
      this.currentMonthSubject.next(this.startOfMonth(day.date));
    }
    this.reminderForm.controls.date.setValue(iso);
  }

  submitReminder(): void {
    if (this.reminderForm.invalid) {
      this.reminderForm.markAllAsTouched();
      return;
    }

    const raw = this.reminderForm.getRawValue();
    const title = raw.title.trim();

    if (!title) {
      this.reminderForm.controls.title.setErrors({ required: true });
      this.reminderForm.controls.title.markAsTouched();
      return;
    }

    const scheduledAt = this.parseReminderDate(raw.date, raw.time);

    if (!scheduledAt) {
      this.reminderForm.controls.date.setErrors({ invalid: true });
      this.reminderForm.controls.date.markAsTouched();
      return;
    }

    this.reminderForm.controls.title.setValue(title, { emitEvent: false });

    const note = raw.note?.trim() || undefined;

    if (this.editingReminderId) {
      this.data.updateReminder(this.editingReminderId, {
        title,
        scheduledAt,
        note
      });
    } else {
      this.data.addReminder({
        title,
        scheduledAt,
        note
      });
    }

    const isoDate = this.toISODate(scheduledAt);
    this.reminderForm.reset({
      title: '',
      date: isoDate,
      time: raw.time || '',
      note: ''
    });
    this.editingReminderId = null;
  }

  startReminderEdit(reminder: Reminder): void {
    this.editingReminderId = reminder.id;
    this.reminderForm.setValue({
      title: reminder.title,
      date: this.toISODate(reminder.scheduledAt),
      time: this.formatTime(reminder.scheduledAt),
      note: reminder.note ?? ''
    });
  }

  cancelReminderEdit(): void {
    this.editingReminderId = null;
    const currentDate = this.reminderForm.controls.date.value || this.toISODate(new Date());
    this.reminderForm.reset({
      title: '',
      date: currentDate,
      time: '',
      note: ''
    });
  }

  deleteReminder(reminder: Reminder): void {
    this.data.removeReminder(reminder.id);
    if (this.editingReminderId === reminder.id) {
      this.cancelReminderEdit();
    }
  }

  trackCalendarDay(_: number, day: CalendarDay): string {
    return day.isoDate;
  }

  trackReminder(_: number, reminder: Reminder): string {
    return reminder.id;
  }

  private shiftMonth(step: number): void {
    const current = this.currentMonthSubject.value;
    const next = new Date(current);
    next.setMonth(next.getMonth() + step);
    this.currentMonthSubject.next(this.startOfMonth(next));
  }

  private buildCalendar(month: Date, reminders: Reminder[]): CalendarViewModel {
    const today = this.startOfDay(new Date());
    const monthStart = this.startOfMonth(month);
  const firstVisibleDay = this.startOfWeek(monthStart);
    const remindersByDay = this.groupRemindersByDay(reminders);

    const weeks: CalendarDay[][] = [];
  let cursor = new Date(firstVisibleDay);

    for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
      const week: CalendarDay[] = [];

      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const dayDate = new Date(cursor);
        const isoDate = this.toISODate(dayDate);
        week.push({
          date: dayDate,
          isoDate,
          label: dayDate.getDate(),
          inCurrentMonth: dayDate.getMonth() === monthStart.getMonth(),
          isToday: this.isSameDate(dayDate, today),
          reminders: remindersByDay.get(isoDate) ?? []
        });
        cursor = this.addDays(cursor, 1);
      }

      weeks.push(week);
    }

    const monthLabel = this.capitalize(
      new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(monthStart)
    );
    const todayLabel = this.capitalize(
      new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(today)
    );

    const upcomingReminders = reminders
      .filter(reminder => this.startOfDay(reminder.scheduledAt).getTime() >= today.getTime())
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
      .slice(0, 8);

    return {
      monthLabel,
      todayLabel,
      weeks,
      upcomingReminders
    };
  }

  private groupRemindersByDay(reminders: Reminder[]): Map<string, Reminder[]> {
    const map = new Map<string, Reminder[]>();

    reminders.forEach(reminder => {
      const key = this.toISODate(reminder.scheduledAt);
      const collection = map.get(key) ?? [];
      collection.push(reminder);
      collection.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
      map.set(key, collection);
    });

    return map;
  }

  private toISODate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private startOfMonth(date: Date): Date {
    const clone = new Date(date);
    clone.setDate(1);
    clone.setHours(0, 0, 0, 0);
    return clone;
  }

  private startOfDay(date: Date): Date {
    const clone = new Date(date);
    clone.setHours(0, 0, 0, 0);
    return clone;
  }

  private startOfWeek(date: Date): Date {
    const clone = this.startOfDay(date);
    const day = clone.getDay();
    const offset = (day + 6) % 7;
    clone.setDate(clone.getDate() - offset);
    return clone;
  }

  private addDays(date: Date, amount: number): Date {
    const clone = new Date(date);
    clone.setDate(clone.getDate() + amount);
    return clone;
  }

  private isSameDate(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  private capitalize(value: string): string {
    if (!value) {
      return value;
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private parseReminderDate(date: string, time?: string | null): Date | null {
    if (!date) {
      return null;
    }

    const [yearStr, monthStr, dayStr] = date.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    if ([year, month, day].some(value => Number.isNaN(value))) {
      return null;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    let hour = 9;
    let minute = 0;

    if (time && time.includes(':')) {
      const [hourStr, minuteStr] = time.split(':');
      hour = Number(hourStr);
      minute = Number(minuteStr);

      if ([hour, minute].some(value => Number.isNaN(value))) {
        return null;
      }
    }

    const scheduled = new Date(year, month - 1, day, hour, minute, 0, 0);

    if (
      scheduled.getFullYear() !== year ||
      scheduled.getMonth() !== month - 1 ||
      scheduled.getDate() !== day
    ) {
      return null;
    }

    return scheduled;
  }
}
