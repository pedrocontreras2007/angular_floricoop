import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest, map } from 'rxjs';
import { DataService } from '../../core/services/data.service';
import { InventoryItem } from '../../core/models/inventory-item.model';
import { QuantityFormatPipe } from '../../shared/pipes/quantity-format.pipe';
import { Harvest } from '../../core/models/harvest.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, QuantityFormatPipe],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css']
})
export class ReportsComponent {
  readonly Math = Math;
  readonly vm$ = combineLatest([this.data.inventory$, this.data.harvests$]).pipe(
    map(([items, harvests]: [InventoryItem[], Harvest[]]) => {
      const inventoryStock = items.reduce((sum, item) => sum + item.quantity, 0);
      const harvestStock = harvests.reduce((sum, harvest) => sum + harvest.quantity, 0);
      const totalStock = inventoryStock + harvestStock;
      const healthyCount = items.filter(item => item.quantity > 10).length;
      const criticalItems = items.filter(item => item.quantity <= 10).sort((a, b) => a.quantity - b.quantity);
      const categoryTotals = items.reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] ?? 0) + item.quantity;
        return acc;
      }, {});
      const highestStock = items.length ? items.reduce((a, b) => (a.quantity >= b.quantity ? a : b)) : null;
      const lowestStock = items.length ? items.reduce((a, b) => (a.quantity <= b.quantity ? a : b)) : null;
      const averageStock = items.length ? totalStock / items.length : 0;

      const harvestByCategory = harvests.reduce<Record<string, number>>((acc, harvest) => {
        acc[harvest.category] = (acc[harvest.category] ?? 0) + harvest.quantity;
        return acc;
      }, {});

      const recentHarvests = [...harvests]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 5);

      const harvestSummary = {
        totalHarvests: harvests.length,
        totalQuantity: harvestStock,
        averageQuantity: harvests.length ? harvestStock / harvests.length : 0,
        byCategory: harvestByCategory,
        recentHarvests
      };

      const profitEntries = harvests
        .map((harvest): { crop: string; margin: number; purchasePriceClp: number; salePriceClp: number } | null => {
          if (!harvest.purchasePriceClp || !harvest.salePriceClp || harvest.purchasePriceClp <= 0) {
            return null;
          }
          const gain = harvest.salePriceClp - harvest.purchasePriceClp;
          const margin = (gain / harvest.purchasePriceClp) * 100;
          return {
            crop: harvest.crop,
            margin,
            purchasePriceClp: harvest.purchasePriceClp,
            salePriceClp: harvest.salePriceClp
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((a, b) => b.margin - a.margin);

      const harvestProfit = {
        averageMargin: profitEntries.length
          ? profitEntries.reduce((sum, entry) => sum + entry.margin, 0) / profitEntries.length
          : 0,
        entries: profitEntries.slice(0, 6)
      };

      return {
        items,
        totalStock,
        inventoryStock,
        harvestStock,
        healthyCount,
        criticalItems,
        categoryTotals,
        highestStock,
        lowestStock,
        averageStock,
        harvestSummary,
        harvestProfit
      };
    })
  );

  constructor(private readonly data: DataService) {}
}
