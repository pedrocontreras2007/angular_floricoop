import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, map, startWith } from 'rxjs';
import { DataService } from '../../core/services/data.service';
import { Loss } from '../../core/models/loss.model';
import { QuantityFormatPipe } from '../../shared/pipes/quantity-format.pipe';
import { UserRole, USER_ROLE_LABELS, USER_ROLE_OPTIONS } from '../../core/models/user-role.model';

interface LossesViewModel {
  readonly losses: Loss[];
  readonly totalQuantity: number;
  readonly distribution: LossDistributionSlice[];
  readonly selectedFilter: 'todos' | UserRole;
}

interface LossDistributionSlice {
  readonly label: string;
  readonly total: number;
  readonly percentage: number;
  readonly color: string;
  readonly dashArray: string;
  readonly dashOffset: number;
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
    this.filterControl.valueChanges.pipe(startWith(this.filterControl.value))
  ]).pipe(
    map(([losses, filter]): LossesViewModel => {
      const filtered = filter === 'todos' ? losses : losses.filter(loss => loss.recordedBy === filter);
      const ordered = [...filtered].sort((a, b) => b.date.getTime() - a.date.getTime());
      const totalQuantity = ordered.reduce((sum, loss) => sum + loss.quantity, 0);
      const distribution = this.buildDistribution(ordered, totalQuantity);
      return { losses: ordered, totalQuantity, distribution, selectedFilter: filter };
    })
  );

  showForm = false;

  readonly form = this.fb.group({
    productName: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(80)]),
    quantity: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^[0-9]*[.,]?[0-9]{0,2}$/)]),
    reason: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(160)]),
    date: this.fb.nonNullable.control(this.toISODate(new Date()), [Validators.required]),
    recordedBy: this.fb.nonNullable.control<UserRole>(this.defaultRole),
    recordedByPartnerName: this.fb.control('')
  });

  readonly userRoleOptions = USER_ROLE_OPTIONS;
  readonly userRoleLabels = USER_ROLE_LABELS;

  constructor(private readonly fb: FormBuilder, private readonly data: DataService) {}

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (this.showForm) {
      this.form.reset({
        productName: '',
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
    const productName = raw.productName.trim();
    const reason = raw.reason.trim();

    if (!productName) {
      this.form.controls.productName.setErrors({ required: true });
      this.form.controls.productName.markAsTouched();
      return;
    }

    const quantityValue = parseFloat(raw.quantity.replace(',', '.'));

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      this.form.controls.quantity.setErrors({ invalid: true });
      return;
    }

    const date = new Date(raw.date);
    if (Number.isNaN(date.getTime())) {
      this.form.controls.date.setErrors({ invalid: true });
      return;
    }

    const quantity = Math.round(quantityValue * 100) / 100;

    if (!reason) {
      this.form.controls.reason.setErrors({ required: true });
      this.form.controls.reason.markAsTouched();
      return;
    }

    if (productName !== raw.productName) {
      this.form.controls.productName.setValue(productName, { emitEvent: false });
    }

    if (reason !== raw.reason) {
      this.form.controls.reason.setValue(reason, { emitEvent: false });
    }

    const recordedByPartnerName = raw.recordedBy === 'socio'
      ? raw.recordedByPartnerName?.trim() || undefined
      : undefined;

    this.data.addLoss({ productName, quantity, reason, date, recordedBy: raw.recordedBy, recordedByPartnerName });

    this.showForm = false;
    this.form.reset({
      productName: '',
      quantity: '',
      reason: '',
      date: this.toISODate(new Date()),
      recordedBy: this.defaultRole,
      recordedByPartnerName: ''
    });
  }

  cancel(): void {
    this.showForm = false;
    this.form.reset({
      productName: '',
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

  trackLoss(_: number, loss: Loss): string {
    return loss.id;
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

  private toISODate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
