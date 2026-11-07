/** Shared types used by both Rent and Sale modules. */

export type AmenityKey =
  | 'clubhouse' | 'pool' | 'gym' | 'kidsPlay' | 'garden' | 'security' | 'powerBackup'
  | 'indoorGames' | 'gatedCommunity' | 'cctv' | 'lift' | 'parking' | 'joggingTrack'
  | 'tennis' | 'temple' | 'waterSupply' | 'blackTopRoads' | 'streetLights'
  | 'drainage' | 'avenuePlantation' | 'compoundWall' | 'electricity' | 'park';

export type NearbyCategory = 'Schools' | 'Colleges' | 'Hospitals' | 'Malls' | 'IT Parks' | 'Metro' | 'Highways' | 'Airport';

export interface NearbyPlace {
  category: NearbyCategory;
  name: string;
  distanceKm: number;
  minutes: number;
}

export interface Review {
  id: string;
  author: string;
  rating: number;      // 1-5
  comment: string;
  date: string;        // ISO date
}

export interface GeoPoint { lat: number; lng: number; }

/** Enquiry posted from any contact form — will map to a .NET endpoint later. */
export interface Enquiry {
  type: 'message' | 'site-visit' | 'callback';
  listingType: 'rent' | 'sale';
  listingId: string;
  listingTitle: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  preferredDate?: string;
  preferredSlot?: string;
}

/** "Report a problem with this listing" from the public site → lands in the BHP verification queue. */
export type ReportReason = 'already-rented' | 'wrong-price' | 'wrong-photos' | 'wrong-details' | 'other';
export interface ListingReport {
  flatId: string;
  propertyCode: string;
  reason: ReportReason;
  details?: string;
  phone?: string;
}

/** "Notify me when a matching flat opens up". */
export interface AvailabilityAlert {
  name: string;
  phone: string;
  societyId?: string;
  locality?: string;
  bhk?: number;
  maxBudget?: number;
}

export interface EnquiryResult { ok: boolean; duplicate: boolean; reference: string; }
