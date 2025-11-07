import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DataService } from '../../core/services/data.service';
import { InventoryCategory, InventoryItem } from '../../core/models/inventory-item.model';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css']
})
export class InventoryComponent {
  readonly inventory$ = this.data.inventory$;

  readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(80)]),
    quantity: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^[0-9]*[.,]?[0-9]{0,2}$/)]),
    unit: this.fb.nonNullable.control('kg', [Validators.required, Validators.maxLength(12)]),
    category: this.fb.nonNullable.control<InventoryCategory>('planta')
  });

  readonly categories: { value: InventoryCategory; label: string }[] = [
    { value: 'planta', label: 'Planta' },
    { value: 'fertilizante', label: 'Fertilizante' },
    { value: 'pesticida', label: 'Pesticida' },
    { value: 'herramienta', label: 'Herramienta' }
  ];

  constructor(private readonly fb: FormBuilder, private readonly data: DataService) {}

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const quantity = parseFloat(raw.quantity.replace(',', '.'));

    if (!Number.isFinite(quantity) || quantity < 0) {
      this.form.controls.quantity.setErrors({ invalid: true });
      return;
    }

    this.data.addInventoryItem({
      name: raw.name.trim(),
      quantity,
      unit: raw.unit.trim(),
      category: raw.category
    });

    this.form.reset({ name: '', quantity: '', unit: 'kg', category: 'planta' });
  }

  adjustQuantity(item: InventoryItem): void {
    const input = window.prompt(`Nueva cantidad para ${item.name}`, item.quantity.toFixed(2));
    if (input === null) {
      return;
    }

    const normalized = input.trim().replace(',', '.');
    const value = parseFloat(normalized);

    if (!Number.isFinite(value) || value < 0) {
      window.alert('Ingresa un número válido.');
      return;
    }

    this.data.updateInventoryQuantity(item.id, value);
  }

  trackById(_: number, item: InventoryItem): string {
    return item.id;
  }
}
