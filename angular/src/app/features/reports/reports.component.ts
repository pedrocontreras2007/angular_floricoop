import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';
import { DataService } from '../../core/services/data.service';
import { InventoryItem } from '../../core/models/inventory-item.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css']
})
export class ReportsComponent {
  readonly vm$ = this.data.inventory$.pipe(
    map((items: InventoryItem[]) => {
      const totalStock = items.reduce((sum, item) => sum + item.quantity, 0);
      const healthyCount = items.filter(item => item.quantity > 10).length;
      const criticalItems = items.filter(item => item.quantity <= 10).sort((a, b) => a.quantity - b.quantity);
      const categoryTotals = items.reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] ?? 0) + item.quantity;
        return acc;
      }, {});
      const highestStock = items.length ? items.reduce((a, b) => (a.quantity >= b.quantity ? a : b)) : null;
      const lowestStock = items.length ? items.reduce((a, b) => (a.quantity <= b.quantity ? a : b)) : null;
      const averageStock = items.length ? totalStock / items.length : 0;

      return {
        items,
        totalStock,
        healthyCount,
        criticalItems,
        categoryTotals,
        highestStock,
        lowestStock,
        averageStock
      };
    })
  );

  constructor(private readonly data: DataService) {}
}
