import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { DataService } from '../../core/services/data.service';
import { Harvest } from '../../core/models/harvest.model';
import { InventoryItem } from '../../core/models/inventory-item.model';

interface DashboardSummary {
  readonly totalHarvests: number;
  readonly totalHarvestQuantity: number;
  readonly inventoryCount: number;
  readonly healthyInventory: number;
  readonly criticalItems: InventoryItem[];
  readonly recentHarvests: { crop: string; date: Date; quantity: number; category: string; partner: string }[];
}

interface DashboardAction {
  readonly icon: string;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly accent: 'primary' | 'secondary' | 'warning' | 'info';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
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
          partner: harvest.partner
        }));

      return {
        totalHarvests: harvests.length,
        totalHarvestQuantity: harvests.reduce((sum: number, harvest: Harvest) => sum + harvest.quantity, 0),
        inventoryCount: inventory.length,
        healthyInventory: inventory.filter((item: InventoryItem) => item.quantity > 10).length,
        criticalItems,
        recentHarvests
      } satisfies DashboardSummary;
    })
  );

  constructor(private readonly data: DataService) {}

  trackInventory(_: number, item: InventoryItem): string {
    return item.id;
  }
}
