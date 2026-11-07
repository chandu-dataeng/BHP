import { AmenityKey, NearbyPlace, Review } from './common.models';
import { Facing } from './rent.models';

export type Approval = 'HMDA' | 'DTCP' | 'RERA' | 'GP';
export type VentureStatus = 'Ready to Register' | 'Under Development' | 'New Launch';
export type PlotStatus = 'Available' | 'Booked' | 'Sold';

/** A plotted layout / venture shown as a pin on the Sale map. */
export interface Venture {
  id: string;
  name: string;
  developer: string;
  locality: string;
  city: string;
  pincode: string;
  lat: number;
  lng: number;
  pricePerSqYd: number;
  totalAcres: number;
  approvals: Approval[];
  reraNo?: string;
  hmdaLpNo?: string;
  status: VentureStatus;
  launchYear: number;
  verified: boolean;
  rating: number;
  reviewsCount: number;
  roadWidths: string;        // e.g. "40 ft & 33 ft"
  orrDistanceKm: number;     // distance from Outer Ring Road
  highlights: AmenityKey[];
  amenities: AmenityKey[];
  bankLoans: string[];
  about: string;
  coverImage: string;
  images: string[];
  layoutImage?: string;
  nearby: NearbyPlace[];
  reviews: Review[];
  plots: Plot[];
  brochureUrl?: string;
}

/** An individual plot inside a venture layout. */
export interface Plot {
  id: string;
  plotNo: string;
  sizeSqYd: number;
  facing: Facing;
  roadWidthFt: number;
  corner: boolean;
  status: PlotStatus;
}

export interface SaleFilters {
  search: string;
  maxBudget: number | null;       // total plot budget in ₹
  sizeRange: [number, number] | null;
  approvals: Approval[];
  status: VentureStatus[];
  verifiedOnly: boolean;
  sort: 'relevance' | 'priceAsc' | 'priceDesc' | 'availability';
}
