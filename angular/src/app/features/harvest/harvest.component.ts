import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, map, startWith } from 'rxjs';
import { DataService } from '../../core/services/data.service';
import { Harvest, HarvestCategory } from '../../core/models/harvest.model';
import { QuantityFormatPipe } from '../../shared/pipes/quantity-format.pipe';
import { UserRole, USER_ROLE_LABELS, USER_ROLE_OPTIONS } from '../../core/models/user-role.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-harvest',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, QuantityFormatPipe],
  templateUrl: './harvest.component.html',
  styleUrls: ['./harvest.component.css']
})
export class HarvestComponent {
  private readonly defaultRole = USER_ROLE_OPTIONS[0]?.value ?? 'presidente';

  readonly filterControl = this.fb.nonNullable.control<'todos' | UserRole>('todos');
  readonly vm$ = combineLatest([
    this.data.harvests$,
    this.filterControl.valueChanges.pipe(startWith(this.filterControl.value))
  ]).pipe(
    map(([harvests, filter]) => {
      const filtered = filter === 'todos' ? harvests : harvests.filter(harvest => harvest.recordedBy === filter);
      const fifoQueue = [...filtered].sort((a, b) => a.date.getTime() - b.date.getTime());
      return { harvests: filtered, total: filtered.length, selectedFilter: filter, fifoQueue };
    })
  );

  readonly form = this.fb.group({
    crop: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(80)]),
    quantity: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^[0-9]*[.,]?[0-9]{0,2}$/)]),
    category: this.fb.nonNullable.control<HarvestCategory>('primera'),
    recordedBy: this.fb.nonNullable.control<UserRole>(this.defaultRole),
    recordedByPartnerName: this.fb.control(''),
    purchasePriceClp: this.fb.control('', [Validators.pattern(/^[0-9]*[.,]?[0-9]{0,2}$/)]),
    salePriceClp: this.fb.control('', [Validators.pattern(/^[0-9]*[.,]?[0-9]{0,2}$/)])
  });

  submitting = false;

  readonly categories: { value: HarvestCategory; label: string }[] = [
    { value: 'primera', label: 'Categoría primera' },
    { value: 'segunda', label: 'Categoría segunda' },
    { value: 'tercera', label: 'Categoría tercera' }
  ];

  readonly userRoleOptions = USER_ROLE_OPTIONS;
  readonly userRoleLabels = USER_ROLE_LABELS;

  constructor(
    private readonly fb: FormBuilder,
    private readonly data: DataService,
    private readonly auth: AuthService
  ) {}

  submit(): void {
    if (this.form.invalid || this.submitting) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const parsed = parseFloat(raw.quantity.replace(',', '.'));

    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.form.controls.quantity.setErrors({ invalid: true });
      return;
    }

    const quantity = Math.round(parsed);

    this.submitting = true;

    const recordedByPartnerName = raw.recordedBy === 'socio'
      ? raw.recordedByPartnerName?.trim() || undefined
      : undefined;

    const purchasePriceClp = this.parseCurrency(raw.purchasePriceClp);
    const salePriceClp = this.parseCurrency(raw.salePriceClp);

    const recordedByUser = this.auth.email ?? undefined;

    this.data.addHarvest({
      crop: raw.crop.trim(),
      category: raw.category,
      quantity,
      date: new Date(),
      recordedBy: raw.recordedBy,
      recordedByPartnerName,
      recordedByUser,
      purchasePriceClp,
      salePriceClp
    });

    this.form.reset({
      crop: '',
      quantity: '',
      category: 'primera',
      recordedBy: this.defaultRole,
      recordedByPartnerName: '',
      purchasePriceClp: '',
      salePriceClp: ''
    });
    this.submitting = false;
  }

  trackHarvest(_: number, harvest: Harvest): string {
    return harvest.id;
  }

  private parseCurrency(rawValue?: string | null): number | undefined {
    if (!rawValue) {
      return undefined;
    }
    const parsed = parseFloat(rawValue.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }
    return Math.round(parsed);
  }
}
