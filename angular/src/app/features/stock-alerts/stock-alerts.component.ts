import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest, map } from 'rxjs';
import { DataService } from '../../core/services/data.service';
import { InventoryItem } from '../../core/models/inventory-item.model';
import { Harvest } from '../../core/models/harvest.model';
import { QuantityFormatPipe } from '../../shared/pipes/quantity-format.pipe';

interface StockAlertItem {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly category: string;
  readonly source: 'inventario' | 'cosecha';
  readonly date?: Date;
  readonly critical: boolean;
  readonly icon: string;
}

interface StockAlertsViewModel {
  readonly ordered: StockAlertItem[];
  readonly criticalCount: number;
}

@Component({
  selector: 'app-stock-alerts',
  standalone: true,
  imports: [CommonModule, QuantityFormatPipe],
  templateUrl: './stock-alerts.component.html',
  styleUrls: ['./stock-alerts.component.css']
})
export class StockAlertsComponent {
  private static readonly CRITICAL_THRESHOLD = 10;

  readonly alerts$ = combineLatest([this.data.inventory$, this.data.harvests$]).pipe(
    map(([inventory, harvests]): StockAlertsViewModel => {
      const inventoryAlerts = inventory.map((item: InventoryItem): StockAlertItem => ({
        id: `inventory-${item.id}`,
        name: item.name,
        quantity: item.quantity,
        category: `Inventario · ${item.category}`,
        source: 'inventario',
        critical: item.quantity <= StockAlertsComponent.CRITICAL_THRESHOLD,
        icon: item.quantity <= StockAlertsComponent.CRITICAL_THRESHOLD ? 'warning' : 'check_circle'
      }));

      const harvestAlerts = harvests.map((harvest: Harvest): StockAlertItem => ({
        id: `harvest-${harvest.id}`,
        name: harvest.crop,
        quantity: harvest.quantity,
        category: `Cosecha · ${harvest.category}`,
        source: 'cosecha',
        date: harvest.date,
        critical: harvest.quantity <= StockAlertsComponent.CRITICAL_THRESHOLD,
        icon: harvest.quantity <= StockAlertsComponent.CRITICAL_THRESHOLD ? 'warning' : 'spa'
      }));

      const ordered = [...inventoryAlerts, ...harvestAlerts]
        .sort((a, b) => a.quantity - b.quantity);
      const criticalCount = ordered.filter(item => item.critical).length;
      return { ordered, criticalCount };
    })
  );

  constructor(private readonly data: DataService) {}

  trackById(_: number, item: StockAlertItem): string {
    return item.id;
  }
}
