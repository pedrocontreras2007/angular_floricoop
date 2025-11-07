import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DataService } from '../../core/services/data.service';
import { Harvest, HarvestCategory } from '../../core/models/harvest.model';

@Component({
  selector: 'app-harvest',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './harvest.component.html',
  styleUrls: ['./harvest.component.css']
})
export class HarvestComponent {
  readonly harvests$ = this.data.harvests$;

  readonly form = this.fb.group({
    crop: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(80)]),
    quantity: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^[0-9]*[.,]?[0-9]{0,2}$/)]),
    partner: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(80)]),
    category: this.fb.nonNullable.control<HarvestCategory>('primera')
  });

  submitting = false;

  readonly categories: { value: HarvestCategory; label: string }[] = [
    { value: 'primera', label: 'Categoría primera' },
    { value: 'segunda', label: 'Categoría segunda' },
    { value: 'tercera', label: 'Categoría tercera' }
  ];

  constructor(private readonly fb: FormBuilder, private readonly data: DataService) {}

  submit(): void {
    if (this.form.invalid || this.submitting) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const quantity = parseFloat(raw.quantity.replace(',', '.'));

    if (!Number.isFinite(quantity) || quantity <= 0) {
      this.form.controls.quantity.setErrors({ invalid: true });
      return;
    }

    this.submitting = true;

    this.data.addHarvest({
      crop: raw.crop.trim(),
      category: raw.category,
      quantity,
      date: new Date(),
      partner: raw.partner.trim()
    });

    this.form.reset({ crop: '', quantity: '', partner: '', category: 'primera' });
    this.submitting = false;
  }

  trackHarvest(_: number, harvest: Harvest): string {
    return harvest.id;
  }
}
