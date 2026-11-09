import { RentalFlat } from '../models/rent.models';
import { directImageUrl } from './drive';
import { SOCIETIES } from './rent.data';

/**
 * Feed rows are typed in by people through a form — anything a tenant can't rely on is dropped here
 * (unknown society, missing / silly rent or size), and Drive photo links are turned into images.
 */
export function cleanFeedFlat(f: Partial<RentalFlat>): RentalFlat | null {
  const society = SOCIETIES.find(s => s.id === f.societyId);
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v));
  const rent = n(f.rent), area = n(f.areaSqft), bhk = n(f.bhk);
  if (!f.id || !society || !(rent >= 1000) || !(area >= 200) || !(bhk >= 1 && bhk <= 5)) return null;
  const maintenance = n(f.maintenance) >= 0 ? n(f.maintenance) : 0;
  const depositMonths = n(f.depositMonths) > 0 ? n(f.depositMonths) : 2;
  return {
    id: String(f.id), code: f.code ?? String(f.id).toUpperCase(), societyId: society.id, bhk, title: f.title || `${bhk} BHK Apartment`,
    rent, maintenance, depositMonths, deposit: n(f.deposit) > 0 ? n(f.deposit) : rent * depositMonths, areaSqft: area,
    bathrooms: n(f.bathrooms) || bhk, balconies: n(f.balconies) >= 0 ? n(f.balconies) : 1,
    furnishing: f.furnishing ?? 'Semi Furnished', facing: f.facing ?? 'East',
    floor: n(f.floor) >= 0 ? n(f.floor) : 1, totalFloors: n(f.totalFloors) || Math.max(1, n(f.floor) || 1),
    availableFrom: f.availableFrom ?? new Date().toISOString().slice(0, 10), tenantType: f.tenantType ?? 'Both Allowed',
    propertyAge: f.propertyAge ?? '', parking: f.parking ?? '', petsAllowed: !!f.petsAllowed,
    verified: !!f.verified, availability: f.availability ?? 'unknown', lastVerifiedAt: f.lastVerifiedAt ?? null,
    postedOn: f.postedOn ?? new Date().toISOString().slice(0, 10),
    description: f.description || `${bhk} BHK in ${society.name}, ${society.locality}.`,
    images: (f.images ?? []).map(directImageUrl),
    ...(f.floorPlan ? { floorPlan: directImageUrl(f.floorPlan) } : {}),
    ...(f.videoUrl ? { videoUrl: f.videoUrl } : {}),
  };
}
