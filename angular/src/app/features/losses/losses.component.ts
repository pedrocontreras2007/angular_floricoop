import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, map, startWith } from 'rxjs';
import { DataService } from '../../core/services/data.service';
import { Loss, LossSource } from '../../core/models/loss.model';
import { QuantityFormatPipe } from '../../shared/pipes/quantity-format.pipe';
import { UserRole, USER_ROLE_LABELS, USER_ROLE_OPTIONS } from '../../core/models/user-role.model';
import { Harvest } from '../../core/models/harvest.model';
import { InventoryItem } from '../../core/models/inventory-item.model';
import { AuthService } from '../../core/services/auth.service';

interface LossesViewModel {
  readonly losses: Loss[];
  readonly lossRows: LossRowView[];
  readonly totalQuantity: number;
  readonly distribution: LossDistributionSlice[];
  readonly selectedFilter: 'todos' | UserRole;
  readonly availableProducts: LossProductOption[];
}

interface LossDistributionSlice {
  readonly label: string;
  readonly total: number;
  readonly percentage: number;
  readonly color: string;
  readonly dashArray: string;
  readonly dashOffset: number;
}

interface LossProductOption {
  readonly ref: string;
  readonly name: string;
  readonly stock: number;
  readonly source: LossSource;
  readonly description: string;
}

interface LossRowView {
  readonly loss: Loss;
  readonly remainingStock: number | null;
  readonly sourceLabel: string;
}

interface LossProductSelection {
  readonly source: LossSource;
  readonly id: string;
  readonly name: string;
  readonly stock: number;
}

@Component({
  selector: 'app-losses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, QuantityFormatPipe],
  templateUrl: './losses.component.html',
  styleUrls: ['./losses.component.css']
})
export class LossesComponent {
  private static readonly CHART_PALETTE = ['#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#66bb6a', '#81c784', '#a5d6a7'];
  readonly chartRadius = 64;
  readonly chartCircumference = 2 * Math.PI * this.chartRadius;
  readonly chartSize = this.chartRadius * 2 + 24;
  readonly chartCenter = this.chartSize / 2;
  readonly chartViewBox = `0 0 ${this.chartSize} ${this.chartSize}`;

  private readonly defaultRole = USER_ROLE_OPTIONS[0]?.value ?? 'presidente';

  readonly filterControl = this.fb.nonNullable.control<'todos' | UserRole>('todos');

  readonly vm$ = combineLatest([
    this.data.losses$,
    this.data.inventory$,
    this.data.harvests$,
    this.filterControl.valueChanges.pipe(startWith(this.filterControl.value))
  ]).pipe(
    map(([losses, inventory, harvests, filter]): LossesViewModel => {
      const availableProducts = this.buildAvailableProducts(harvests, inventory);
      const filtered = filter === 'todos' ? losses : losses.filter(loss => loss.recordedBy === filter);
      const ordered = [...filtered].sort((a, b) => b.date.getTime() - a.date.getTime());
      const totalQuantity = ordered.reduce((sum, loss) => sum + loss.quantity, 0);
      const distribution = this.buildDistribution(ordered, totalQuantity);
      const inventoryMap = new Map(inventory.map(item => [item.id, item]));
      const harvestMap = new Map(harvests.map(entry => [entry.id, entry]));
      const lossRows = this.buildLossRows(ordered, inventoryMap, harvestMap);
      return { losses: ordered, lossRows, totalQuantity, distribution, selectedFilter: filter, availableProducts };
    })
  );

  showForm = false;

  readonly form = this.fb.group({
    productRef: this.fb.nonNullable.control('', [Validators.required]),
    quantity: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^[0-9]*$/)]),
    reason: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(160)]),
    date: this.fb.nonNullable.control(this.toISODate(new Date()), [Validators.required]),
    recordedBy: this.fb.nonNullable.control<UserRole>(this.defaultRole),
    recordedByPartnerName: this.fb.control('')
  });

  readonly userRoleOptions = USER_ROLE_OPTIONS;
  readonly userRoleLabels = USER_ROLE_LABELS;

  constructor(
    private readonly fb: FormBuilder,
    private readonly data: DataService,
    private readonly auth: AuthService
  ) {}

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (this.showForm) {
      this.form.reset({
        productRef: '',
        quantity: '',
        reason: '',
        date: this.toISODate(new Date()),
        recordedBy: this.defaultRole,
        recordedByPartnerName: ''
      });
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const reason = raw.reason.trim();
    const productRef = raw.productRef;

    if (!productRef) {
      this.form.controls.productRef.setErrors({ required: true });
      this.form.controls.productRef.markAsTouched();
      return;
    }

    const quantityValue = Number(raw.quantity);

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      this.form.controls.quantity.setErrors({ invalid: true });
      return;
    }

    const date = new Date(raw.date);
    if (Number.isNaN(date.getTime())) {
      this.form.controls.date.setErrors({ invalid: true });
      return;
    }

    const quantity = Math.round(quantityValue);

    const selection = this.resolveProductSelection(productRef);
    if (!selection) {
      this.form.controls.productRef.setErrors({ invalid: true });
      return;
    }

    if (quantity > selection.stock) {
      this.form.controls.quantity.setErrors({ exceedStock: true });
      return;
    }

    if (!reason) {
      this.form.controls.reason.setErrors({ required: true });
      this.form.controls.reason.markAsTouched();
      return;
    }

    if (reason !== raw.reason) {
      this.form.controls.reason.setValue(reason, { emitEvent: false });
    }

    const recordedByPartnerName = raw.recordedBy === 'socio'
      ? raw.recordedByPartnerName?.trim() || undefined
      : undefined;

    this.data.addLoss({
      productName: selection.name,
      quantity,
      reason,
      date,
      recordedBy: raw.recordedBy,
      recordedByPartnerName,
      sourceType: selection.source,
      sourceId: selection.id
    })
      .subscribe({
        next: () => {
          const remainingStock = Math.max(selection.stock - quantity, 0);
          if (selection.source === 'inventory') {
            this.data.updateInventoryQuantity(
              selection.id,
              remainingStock,
              raw.recordedBy,
              recordedByPartnerName,
              this.auth.email ?? undefined
            );
          } else {
            this.data.updateHarvestQuantity(selection.id, remainingStock);
          }
          this.showForm = false;
          this.form.reset({
            productRef: '',
            quantity: '',
            reason: '',
            date: this.toISODate(new Date()),
            recordedBy: this.defaultRole,
            recordedByPartnerName: ''
          });
        },
        error: () => {
          this.form.setErrors({ submitFailed: true });
        }
      });
  }

  cancel(): void {
    this.showForm = false;
    this.form.reset({
      productRef: '',
      quantity: '',
      reason: '',
      date: this.toISODate(new Date()),
      recordedBy: this.defaultRole,
      recordedByPartnerName: ''
    });
  }

  remove(loss: Loss): void {
    const confirmed = window.confirm(`¿Eliminar la merma registrada de ${loss.productName}?`);
    if (!confirmed) {
      return;
    }
    this.data.removeLoss(loss.id);
  }

  trackLoss(_: number, row: LossRowView): string {
    return row.loss.id;
  }

  private buildDistribution(losses: Loss[], totalQuantity: number): LossDistributionSlice[] {
    if (!totalQuantity) {
      return [];
    }

    const totalsByProduct = losses.reduce<Map<string, number>>((acc, loss) => {
      const key = loss.productName;
      acc.set(key, (acc.get(key) ?? 0) + loss.quantity);
      return acc;
    }, new Map<string, number>());

    const entries = Array.from(totalsByProduct.entries())
      .filter(([, total]) => total > 0)
      .sort((a, b) => b[1] - a[1]);

    if (!entries.length) {
      return [];
    }

    let offset = 0;
    return entries.map(([label, total], index) => {
      const ratio = total / totalQuantity;
      const length = ratio * this.chartCircumference;
      const percentage = Math.round(ratio * 1000) / 10;
      const color = LossesComponent.CHART_PALETTE[index % LossesComponent.CHART_PALETTE.length];
      const slice: LossDistributionSlice = {
        label,
        total,
        percentage,
        color,
        dashArray: `${Math.max(length, 0)} ${this.chartCircumference}`,
        dashOffset: -offset
      };
      offset += length;
      return slice;
    });
  }

  private buildLossRows(
    losses: Loss[],
    inventoryMap: Map<string, InventoryItem>,
    harvestMap: Map<string, Harvest>
  ): LossRowView[] {
    return losses.map(loss => {
      let remainingStock: number | null = null;
      let sourceLabel = 'Origen no disponible';

      if (loss.sourceType === 'inventory' && loss.sourceId) {
        const item = inventoryMap.get(loss.sourceId);
        sourceLabel = item ? `Inventario · ${item.category}` : 'Inventario';
        remainingStock = item?.quantity ?? null;
      } else if (loss.sourceType === 'harvest' && loss.sourceId) {
        const harvest = harvestMap.get(loss.sourceId);
        sourceLabel = harvest ? `Cosecha · ${harvest.category}` : 'Cosecha';
        remainingStock = harvest?.quantity ?? null;
      }

      return { loss, remainingStock, sourceLabel };
    });
  }

  private buildAvailableProducts(harvests: Harvest[], inventory: InventoryItem[]): LossProductOption[] {
    const inventoryOptions: LossProductOption[] = inventory
      .filter(item => item.quantity > 0)
      .map(item => ({
        ref: `inventory:${item.id}`,
        name: item.name,
        stock: item.quantity,
        source: 'inventory',
        description: `Inventario · ${item.category}`
      }));

    const harvestOptions: LossProductOption[] = harvests
      .filter(harvest => harvest.quantity > 0)
      .map(harvest => ({
        ref: `harvest:${harvest.id}`,
        name: harvest.crop,
        stock: harvest.quantity,
        source: 'harvest',
        description: `Cosecha · ${harvest.category}`
      }));

    return [...inventoryOptions, ...harvestOptions]
      .sort((a, b) => a.name.localeCompare(b.name, 'es-CL', { sensitivity: 'base' }));
  }

  getProductOption(products: LossProductOption[], ref: string | null): LossProductOption | undefined {
    if (!ref) {
      return undefined;
    }
    return products.find(product => product.ref === ref);
  }

  private resolveProductSelection(ref: string): LossProductSelection | null {
    if (!ref) {
      return null;
    }

    const [source, id] = ref.split(':');
    if (!source || !id) {
      return null;
    }

    if (source === 'inventory') {
      const item = this.data.inventorySnapshot.find(entry => entry.id === id);
      if (!item) {
        return null;
      }
      return { source: 'inventory', id, name: item.name, stock: item.quantity };
    }

    if (source === 'harvest') {
      const harvest = this.data.harvestsSnapshot.find(entry => entry.id === id);
      if (!harvest) {
        return null;
      }
      return { source: 'harvest', id, name: harvest.crop, stock: harvest.quantity };
    }

    return null;
  }

  private toISODate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
