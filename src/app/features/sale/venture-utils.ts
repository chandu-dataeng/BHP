import { Venture } from '../../core/models/sale.models';

/** Helpers shared by the Sale screens. */
export const availablePlots = (v: Venture) => v.plots.filter(p => p.status === 'Available');
export const plotSizes = (v: Venture) => [...new Set(v.plots.map(p => p.sizeSqYd))].sort((a, b) => a - b);
export const plotPrice = (v: Venture, sizeSqYd: number) => v.pricePerSqYd * sizeSqYd;
export const minTicket = (v: Venture) => {
  const av = availablePlots(v);
  const sizes = (av.length ? av : v.plots).map(p => p.sizeSqYd);
  return v.pricePerSqYd * Math.min(...sizes);
};
export const approvalTone = (a: string) => a === 'RERA' ? 'badge-blue' : a === 'HMDA' ? 'badge-green' : 'badge-amber';
export const statusTone = (s: string) => s === 'Ready to Register' ? 'badge-green' : s === 'New Launch' ? 'badge-blue' : 'badge-amber';

/** Standard EMI formula. */
export function emi(principal: number, annualRatePct: number, years: number) {
  const r = annualRatePct / 12 / 100, n = years * 12;
  if (!principal || !n) return 0;
  return r === 0 ? principal / n : principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}
