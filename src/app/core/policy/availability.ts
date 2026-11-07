/**
 * Availability freshness rules — ONE place, deterministic, shared by the public site and BHP admin.
 *
 * "Available yesterday" is not "available today": a listing is shown as confirmed only while its last
 * verification is inside the freshness window. After that it is shown as uncertain until re-checked.
 */
import { AvailabilityState } from '../models/rent.models';

export const AVAILABILITY_POLICY = {
  /** A confirmation older than this stops being shown as "confirmed". */
  freshDays: 7,
  /** Re-confirm before dispatching a site visit if the last check is older than this. */
  recheckBeforeVisitDays: 2,
};

export type Freshness = 'confirmed' | 'stale' | 'unverified' | 'on_hold' | 'rented';

const DAY = 86_400_000;

export function daysSince(iso: string | null | undefined, now = Date.now()): number {
  return iso ? Math.floor((now - new Date(iso).getTime()) / DAY) : Infinity;
}

export function freshness(f: { availability: AvailabilityState; lastVerifiedAt: string | null }, now = Date.now()): Freshness {
  if (f.availability === 'rented') return 'rented';
  if (f.availability === 'on_hold') return 'on_hold';
  if (f.availability !== 'available' || !f.lastVerifiedAt) return 'unverified';
  return daysSince(f.lastVerifiedAt, now) <= AVAILABILITY_POLICY.freshDays ? 'confirmed' : 'stale';
}

export function agoText(iso: string | null | undefined, now = Date.now()): string {
  const d = daysSince(iso, now);
  if (d === Infinity) return 'never';
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}

export interface FreshnessLabel { text: string; short: string; tone: 'green' | 'amber' | 'gray'; icon: string; }

export function freshnessLabel(f: { availability: AvailabilityState; lastVerifiedAt: string | null }, now = Date.now()): FreshnessLabel {
  switch (freshness(f, now)) {
    case 'confirmed': return { text: `Availability confirmed ${agoText(f.lastVerifiedAt, now)}`, short: `Confirmed ${agoText(f.lastVerifiedAt, now)}`, tone: 'green', icon: 'event_available' };
    case 'stale': return { text: `Last confirmed ${agoText(f.lastVerifiedAt, now)} — we'll reconfirm before your visit`, short: 'Reconfirming', tone: 'amber', icon: 'schedule' };
    case 'on_hold': return { text: 'On hold — another tenant is finalising', short: 'On hold', tone: 'amber', icon: 'pause_circle' };
    case 'rented': return { text: 'This flat has been rented out', short: 'Rented', tone: 'gray', icon: 'block' };
    default: return { text: 'Availability not yet confirmed', short: 'Unconfirmed', tone: 'amber', icon: 'help' };
  }
}

/** Rent + maintenance — the number tenants actually budget with. */
export function totalMonthly(f: { rent: number; maintenance: number }) { return f.rent + f.maintenance; }

/** Date helpers for mock data (keeps demo freshness meaningful whenever the app is opened). */
export function daysAgo(n: number, hour = 11): string {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(hour, 0, 0, 0); return d.toISOString();
}
export function daysFromNow(n: number, hour = 11): string { return daysAgo(-n, hour); }
