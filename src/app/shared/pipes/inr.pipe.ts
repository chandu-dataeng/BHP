import { Pipe, PipeTransform } from '@angular/core';

const fmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** 58000 → "₹58,000" */
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(v: number | null | undefined): string {
    return v == null ? '' : `₹${fmt.format(v)}`;
  }
}

/** 4400000 → "₹44 L",  12500000 → "₹1.25 Cr",  58000 → "₹58K" */
export function inrShort(v: number): string {
  if (v >= 1e7) return `₹${+(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${+(v / 1e5).toFixed(1)} L`;
  if (v >= 1e3) return `₹${+(v / 1e3).toFixed(1)}K`;
  return `₹${v}`;
}

@Pipe({ name: 'inrShort' })
export class InrShortPipe implements PipeTransform {
  transform(v: number | null | undefined): string { return v == null ? '' : inrShort(v); }
}
