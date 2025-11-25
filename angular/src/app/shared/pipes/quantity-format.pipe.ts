import { formatNumber } from '@angular/common';
import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'quantityFormat',
  standalone: true
})
export class QuantityFormatPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(value: number | null | undefined): string {
    if (value == null) {
      return '';
    }

    return formatNumber(value, this.locale, '1.0-0');
  }
}
