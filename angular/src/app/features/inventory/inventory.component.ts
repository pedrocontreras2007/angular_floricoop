import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, map, startWith } from 'rxjs';
import { DataService } from '../../core/services/data.service';
import { InventoryCategory, InventoryItem } from '../../core/models/inventory-item.model';
import { QuantityFormatPipe } from '../../shared/pipes/quantity-format.pipe';
import { UserRole, USER_ROLE_LABELS, USER_ROLE_OPTIONS } from '../../core/models/user-role.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, QuantityFormatPipe],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css']
})
export class InventoryComponent {
  private readonly defaultRole = USER_ROLE_OPTIONS[0]?.value ?? 'presidente';

  readonly filterControl = this.fb.nonNullable.control<'todos' | UserRole>('todos');

  readonly vm$ = combineLatest([
    this.data.inventory$,
    this.filterControl.valueChanges.pipe(startWith(this.filterControl.value))
  ]).pipe(
    map(([items, filter]) => {
      const filtered = filter === 'todos' ? items : items.filter(item => item.recordedBy === filter);
      return { items: filtered, selectedFilter: filter };
    })
  );

  readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(80)]),
    quantity: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^[0-9]*$/)]),
    category: this.fb.nonNullable.control<InventoryCategory>('planta'),
    recordedBy: this.fb.nonNullable.control<UserRole>(this.defaultRole),
    recordedByPartnerName: this.fb.control('')
  });

  readonly categories: { value: InventoryCategory; label: string }[] = [
    { value: 'planta', label: 'Planta' },
    { value: 'fertilizante', label: 'Fertilizante' },
    { value: 'pesticida', label: 'Pesticida' },
    { value: 'herramienta', label: 'Herramienta' }
  ];

  readonly userRoleOptions = USER_ROLE_OPTIONS;
  readonly userRoleLabels = USER_ROLE_LABELS;

  constructor(
    private readonly fb: FormBuilder,
    private readonly data: DataService,
    private readonly auth: AuthService
  ) {}

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const parsed = Number(raw.quantity);

    if (!Number.isFinite(parsed) || parsed < 0) {
      this.form.controls.quantity.setErrors({ invalid: true });
      return;
    }

    const quantity = Math.round(parsed);
    const recordedByPartnerName = raw.recordedBy === 'socio'
      ? raw.recordedByPartnerName?.trim() || undefined
      : undefined;

    const recordedByUser = this.auth.email ?? undefined;

    this.data.addInventoryItem({
      name: raw.name.trim(),
      quantity,
      unit: 'unidades',
      category: raw.category,
      recordedBy: raw.recordedBy,
      recordedByPartnerName,
      recordedByUser
    });

    this.form.reset({
      name: '',
      quantity: '',
      category: 'planta',
      recordedBy: this.defaultRole,
      recordedByPartnerName: ''
    });
  }

  adjustQuantity(item: InventoryItem): void {
    const initialValue = Math.round(item.quantity).toString();
    const input = window.prompt(`Nueva cantidad (unidades) para ${item.name}`, initialValue);
    if (input === null) {
      return;
    }

    const normalized = input.trim();
    const value = Number(normalized);
    if (!Number.isFinite(value) || value < 0) {
      window.alert('Ingresa un número válido.');
      return;
    }

    const sanitized = Math.round(value);

    const rolePrompt = `¿Quién registra el ajuste?
Opciones: ${USER_ROLE_OPTIONS.map(option => option.value).join(', ')}`;
    const roleInput = window.prompt(rolePrompt, item.recordedBy ?? this.defaultRole);
    if (roleInput === null) {
      return;
    }

    const normalizedRole = roleInput.trim().toLowerCase() as UserRole | 'todos';
    const selectedRole = USER_ROLE_OPTIONS.find(option => option.value === normalizedRole)?.value;

    if (!selectedRole) {
      window.alert('Rol no válido. Ajuste cancelado.');
      return;
    }

    let partnerName: string | undefined;
    if (selectedRole === 'socio') {
      const partnerInput = window.prompt('Nombre del socio (opcional)', item.recordedByPartnerName ?? '');
      partnerName = partnerInput?.trim() || undefined;
    }

    const recordedByUser = this.auth.email ?? undefined;
    this.data.updateInventoryQuantity(item.id, sanitized, selectedRole, partnerName, recordedByUser);
  }

  trackById(_: number, item: InventoryItem): string {
    return item.id;
  }
}
