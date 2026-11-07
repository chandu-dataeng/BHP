/**
 * BHP operating-backend models (internal). None of these types are sent to the public FindFlat site —
 * the public site only ever receives the `RentalFlat` projection built in MockDbService.toPublicFlat().
 * Field names are the suggested contract for the .NET API / C# DTOs.
 */
import { AvailabilityState, RentalFlat } from '../models/rent.models';
import { Role } from './permissions';

/* ---------------- People ---------------- */

export interface StaffUser {
  id: string;            // USR-001
  name: string;
  role: Role;
  phone: string;
  email: string;
  active: boolean;
  /** For agents (L5): the source record they log in as. */
  sourceId?: string;
}

export interface Owner {
  id: string;            // OWN-0001
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

export type SourceType = 'agent' | 'owner-direct' | 'society-referral' | 'tenant-referral' | 'builder' | 'employee-network' | 'website' | 'walk-in';

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  'agent': 'External agent', 'owner-direct': 'Direct owner', 'society-referral': 'Society referral',
  'tenant-referral': 'Tenant referral', 'builder': 'Builder / PM', 'employee-network': 'Employee network',
  'website': 'Website', 'walk-in': 'Walk-in / call',
};

/** Where a property came from — an agent, a referral, the owner directly… */
export interface Source {
  id: string;            // AGT-000087
  name: string;
  type: SourceType;
  phone: string;
  company?: string;
  /** Default commercial arrangement with this source (restricted). */
  defaultSharePct: number;
  joinedAt: string;
  notes?: string;
}

/* ---------------- Property & listing ---------------- */

/** Listing lifecycle. Each transition is a controlled action, never a free dropdown. */
export type ListingStatus =
  | 'draft'                 // being entered by sourcer / agent
  | 'pending_verification'  // submitted, awaiting availability + authorization check
  | 'pending_approval'      // verified, awaiting a manager's publish approval
  | 'published'             // live on FindFlat
  | 'suspended'             // temporarily hidden (conflict, report under review, owner paused)
  | 'rented'                // closed — rented out (record kept for history)
  | 'rejected';

export const STATUS_LABEL: Record<ListingStatus, string> = {
  draft: 'Draft', pending_verification: 'Pending verification', pending_approval: 'Pending approval',
  published: 'Published', suspended: 'Suspended', rented: 'Rented', rejected: 'Rejected',
};

export type AuthorizationStatus = 'pending' | 'received' | 'expired';

export interface OwnerAuthorization {
  status: AuthorizationStatus;
  method?: 'written' | 'whatsapp' | 'call-recorded' | 'agreement';
  receivedAt?: string;
  validTill?: string;
}

/** Restricted: brokerage & source terms. Only roles with `property.viewCommercial` receive this. */
export interface CommercialTerms {
  tenantBrokerage: string;        // e.g. "15 days rent"
  ownerBrokerage: string;         // e.g. "None" / "15 days rent"
  sourceSharePct: number;         // share of BHP brokerage payable to the source
  /** Lowest rent the owner has authorised BHP to accept. */
  minAcceptableRent: number;
}

export interface PendingRentChange {
  oldRent: number;
  newRent: number;
  requestedBy: string;
  requestedAt: string;
  evidence: string;
}

export interface PropertyRecord {
  /** BHP Property ID — also the public "Property Code" (FF-001245). */
  id: string;
  /** Public listing content (id = route id on the public site). */
  flat: RentalFlat;
  tower: string;
  flatNo: string;
  ownerId: string | null;          // null → redacted for this viewer, or not yet captured
  sourceId: string;
  sourcedBy: string;               // staff user id who recorded it
  sourcedAt: string;
  status: ListingStatus;
  availability: AvailabilityState;
  lastVerifiedAt: string | null;
  lastVerifiedBy: string | null;
  nextCheckDue: string | null;
  assignedVerifier: string | null;
  authorization: OwnerAuthorization;
  commercial: CommercialTerms | null;  // null → redacted
  pendingRentChange?: PendingRentChange;
  conflict?: string;                    // unresolved conflicting information blocks confirmation
  intakeMessage?: string;               // original message kept for AI-extracted drafts
  rejectionReason?: string;
  updatedAt: string;
}

/* ---------------- Verification ---------------- */

export type VerificationResult = 'available' | 'rent_changed' | 'on_hold' | 'rented' | 'no_response' | 'conflict';

export const VERIFICATION_RESULT_LABEL: Record<VerificationResult, string> = {
  available: 'Available — confirmed', rent_changed: 'Available — rent changed', on_hold: 'On hold',
  rented: 'Rented out', no_response: 'No response', conflict: 'Conflicting information',
};

export interface Verification {
  id: string;
  propertyId: string;
  at: string;
  by: string;                    // staff user id
  confirmedBy: string;           // who gave the information: "Owner", "Agent AGT-…", "Society office"
  method: 'call' | 'whatsapp' | 'site-visit' | 'society-office';
  result: VerificationResult;
  newRent?: number;
  notes?: string;
  evidence?: string;             // file name / message reference
  nextCheckDue: string | null;
}

/* ---------------- CRM (minimal, drives dashboard — full CRM is the next slice) ---------------- */

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'visit_scheduled' | 'visited' | 'negotiation' | 'won' | 'lost';

export interface Lead {
  id: string;             // LD-000123
  name: string;
  phone: string;
  channel: 'website' | 'whatsapp' | 'call' | 'walk-in' | 'referral';
  type: 'message' | 'site-visit' | 'callback' | 'requirement';
  propertyId?: string;    // FF-… if enquiry was for a specific property
  societyId?: string;
  message?: string;
  status: LeadStatus;
  assignedTo: string | null;
  createdAt: string;
  nextFollowUpAt: string | null;
  duplicateOf?: string;
}

export interface Deal {
  id: string;             // DL-0001
  propertyId: string;
  leadId?: string;
  agreedRent: number;
  brokerageEarned: number;
  brokerageCollected: number;
  sourcePayoutDue: number;
  sourcePayoutPaid: number;
  closedAt: string;
  closedBy: string;
}

/* ---------------- Public-site signals ---------------- */

export interface ReportRecord {
  id: string;
  propertyId: string;
  reason: string;
  details?: string;
  phone?: string;
  at: string;
  status: 'open' | 'resolved';
}

export interface AlertRecord {
  id: string;
  name: string;
  phone: string;
  criteria: string;
  at: string;
}

/* ---------------- Duplicates & audit ---------------- */

export interface DuplicateDecision {
  a: string;              // property ids (sorted)
  b: string;
  decision: 'not_duplicate' | 'linked' | 'merged';
  by: string;
  at: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;          // staff user id or 'public'
  entity: 'property' | 'verification' | 'lead' | 'user' | 'source' | 'owner' | 'system';
  entityId: string;
  action: string;         // e.g. "rent.changed"
  detail: string;
}
