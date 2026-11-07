import { AmenityKey, NearbyPlace, Review } from './common.models';

export type Furnishing = 'Furnished' | 'Semi Furnished' | 'Unfurnished';
export type TenantType = 'Family Only' | 'Bachelors Only' | 'Both Allowed';
/**
 * Public availability state of a listing. Internal workflow states (draft, pending approval…)
 * never reach the public site — see core/admin/admin.models.ts.
 */
export type AvailabilityState = 'available' | 'on_hold' | 'rented' | 'unknown';

export type Facing = 'East' | 'West' | 'North' | 'South' | 'North-East' | 'North-West' | 'South-East' | 'South-West';

/** A gated community / apartment society shown as a pin on the Rent map. */
export interface Society {
  id: string;
  name: string;
  builder: string;
  locality: string;          // e.g. Gachibowli
  city: string;
  pincode: string;
  lat: number;
  lng: number;
  rating: number;
  reviewsCount: number;
  totalAcres: number;
  towers: number;
  totalUnits: number;
  completedYear: number;
  bhkTypes: number[];        // BHK types that exist in this society, e.g. [2,3,4]
  highlights: AmenityKey[];  // 4 shown in the popup
  amenities: AmenityKey[];
  about: string;
  coverImage: string;
  images: string[];
  nearby: NearbyPlace[];
  reviews: Review[];
  brochureUrl?: string;
}

/** A single flat available for rent inside a society. */
export interface RentalFlat {
  id: string;
  code: string;              // BHP Property ID, e.g. FF-001245 — quote it when contacting us
  societyId: string;
  bhk: number;
  title: string;
  rent: number;              // per month
  maintenance: number;       // per month
  deposit: number;
  depositMonths: number;
  areaSqft: number;
  bathrooms: number;
  balconies: number;
  furnishing: Furnishing;
  facing: Facing;
  floor: number;
  totalFloors: number;
  availableFrom: string;     // ISO date
  tenantType: TenantType;
  propertyAge: string;       // e.g. "New (1-3 years)"
  parking: string;           // e.g. "1 Covered"
  petsAllowed: boolean;
  verified: boolean;         // physically inspected by the BHP team
  availability: AvailabilityState;
  lastVerifiedAt: string | null;  // ISO datetime of the last availability confirmation
  postedOn: string;          // ISO date
  description: string;
  images: string[];
  floorPlan?: string;
  videoUrl?: string;
}

export interface RentFilters {
  search: string;
  bhk: number[];
  minRent: number | null;
  maxRent: number | null;
  furnishing: Furnishing[];
  tenantType: TenantType | null;
  verifiedOnly: boolean;
}

/** How a tenant's budget should be read — "under ₹70K" can mean rent only, or rent + maintenance. */
export type BudgetType = 'rent' | 'total';
