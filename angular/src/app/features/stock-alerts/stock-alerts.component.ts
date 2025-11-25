import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';
import { DataService } from '../../core/services/data.service';
import { InventoryItem } from '../../core/models/inventory-item.model';
import { QuantityFormatPipe } from '../../shared/pipes/quantity-format.pipe';

@Component({
  selector: 'app-stock-alerts',
  standalone: true,
  imports: [CommonModule, QuantityFormatPipe],
  templateUrl: './stock-alerts.component.html',
  styleUrls: ['./stock-alerts.component.css']
})
export class StockAlertsComponent {
  readonly alerts$ = this.data.inventory$.pipe(
    map((items: InventoryItem[]) => {
      const ordered = [...items].sort((a, b) => a.quantity - b.quantity);
      const criticalCount = ordered.filter(item => item.quantity <= 10).length;
      return { ordered, criticalCount };
    })
  );

  constructor(private readonly data: DataService) {}

  trackById(_: number, item: InventoryItem): string {
    return item.id;
  }
}
