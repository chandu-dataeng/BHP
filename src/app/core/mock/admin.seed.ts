/**
 * DUMMY BHP OPERATING DATA — staff, sources, owners, property records, verifications, leads, deals.
 * Dates are relative to "now" so availability freshness and overdue follow-ups look realistic whenever
 * the demo is opened. All names and phone numbers are made up.
 */
import { FLATS, makeFlat } from '../data/rent.data';
import { daysAgo, daysFromNow } from '../policy/availability';
import {
  AuditEntry, Deal, Lead, LeadStatus, Owner, PropertyRecord, Source, StaffUser, Verification,
} from '../admin/admin.models';

export const SEED_USERS: StaffUser[] = [
  { id: 'USR-001', name: 'Ravi Teja',     role: 'super_admin',    phone: '9800000001', email: 'ravi@bhp.example',    active: true },
  { id: 'USR-002', name: 'Shiva',         role: 'business_owner', phone: '9800000002', email: 'shiva@bhp.example',   active: true },
  { id: 'USR-003', name: 'Anil Kumar',    role: 'ops_manager',    phone: '9800000003', email: 'anil@bhp.example',    active: true },
  { id: 'USR-004', name: 'Meena Rao',     role: 'dept_manager',   phone: '9800000004', email: 'meena@bhp.example',   active: true },
  { id: 'USR-005', name: 'Kiran Reddy',   role: 'sourcer',        phone: '9800000005', email: 'kiran@bhp.example',   active: true },
  { id: 'USR-006', name: 'Pooja Sharma',  role: 'sourcer',        phone: '9800000006', email: 'pooja@bhp.example',   active: true },
  { id: 'USR-007', name: 'Suresh Babu',   role: 'verifier',       phone: '9800000007', email: 'suresh@bhp.example',  active: true },
  { id: 'USR-008', name: 'Lavanya N.',    role: 'verifier',       phone: '9800000008', email: 'lavanya@bhp.example', active: true },
  { id: 'USR-009', name: 'Deepa Iyer',    role: 'telecaller',     phone: '9800000009', email: 'deepa@bhp.example',   active: true },
  { id: 'USR-010', name: 'Rahul Varma',   role: 'telecaller',     phone: '9800000010', email: 'rahul@bhp.example',   active: true },
  { id: 'USR-011', name: 'Vikram Singh',  role: 'visit_exec',     phone: '9800000011', email: 'vikram@bhp.example',  active: true },
  { id: 'USR-012', name: 'Ramesh (Ramesh Realty)', role: 'agent', phone: '9811100087', email: 'ramesh@realty.example', active: true, sourceId: 'AGT-000087' },
  { id: 'USR-013', name: 'Audit Partner', role: 'auditor',        phone: '9800000013', email: 'audit@bhp.example',   active: true },
  { id: 'USR-014', name: 'Former Telecaller', role: 'telecaller', phone: '9800000014', email: 'former@bhp.example',  active: false },
];

export const SEED_SOURCES: Source[] = [
  { id: 'AGT-000087', name: 'Ramesh Realty',       type: 'agent', phone: '9811100087', company: 'Ramesh Realty', defaultSharePct: 30, joinedAt: daysAgo(400) },
  { id: 'AGT-000112', name: 'Sai Homes',           type: 'agent', phone: '9811100112', company: 'Sai Homes & Rentals', defaultSharePct: 25, joinedAt: daysAgo(220) },
  { id: 'AGT-000140', name: 'Hitech Rentals',      type: 'agent', phone: '9811100140', defaultSharePct: 30, joinedAt: daysAgo(90), notes: 'New partner — verify every listing.' },
  { id: 'SRC-DIRECT', name: 'Direct owner',        type: 'owner-direct', phone: '-', defaultSharePct: 0, joinedAt: daysAgo(700) },
  { id: 'SRC-SOCREF', name: 'Lakeview Society Office', type: 'society-referral', phone: '9811100500', defaultSharePct: 10, joinedAt: daysAgo(300) },
  { id: 'SRC-EMP',    name: 'Employee network',    type: 'employee-network', phone: '-', defaultSharePct: 0, joinedAt: daysAgo(700) },
  { id: 'SRC-WEB',    name: 'FindFlat website',    type: 'website', phone: '-', defaultSharePct: 0, joinedAt: daysAgo(700) },
];

const OWNER_NAMES = ['Venkat Rao', 'Sunita Reddy', 'Prakash Jain', 'Farah Khan', 'Gopal Krishna', 'Anitha Menon', 'Rajesh Gupta',
  'Swathi Patel', 'Mohan Das', 'Kavya Nair', 'Imran Ali', 'Bhavana S.', 'Ashok Varma', 'Neha Kapoor', 'Srinivas M.',
  'Lalitha Devi', 'Arvind Joshi', 'Hema Latha', 'Naresh Goud', 'Padma Priya', 'Karthik R.', 'Uma Shankar', 'Zoya Hussain', 'Ganesh P.'];

export const SEED_OWNERS: Owner[] = OWNER_NAMES.map((name, i) => ({
  id: `OWN-${String(i + 1).padStart(4, '0')}`, name, phone: `98490${String(10000 + i * 137).slice(0, 5)}`,
  email: i % 3 === 0 ? `${name.split(' ')[0].toLowerCase()}@mail.example` : undefined, createdAt: daysAgo(30 + i * 9),
}));

/* ---------------- Property records ---------------- */

const TOWERS = ['A', 'B', 'C', 'D'];
const SOURCE_ROTATION = ['AGT-000087', 'AGT-000112', 'SRC-DIRECT', 'AGT-000140', 'SRC-SOCREF', 'SRC-EMP'];
const SOURCERS = ['USR-005', 'USR-006'];
const VERIFIERS = ['USR-007', 'USR-008'];

const terms = (rent: number, share: number) => ({
  tenantBrokerage: '15 days rent', ownerBrokerage: 'None', sourceSharePct: share, minAcceptableRent: Math.round(rent * 0.95 / 500) * 500,
});

function published(i: number): PropertyRecord {
  const flat = FLATS[i];
  const sourceId = SOURCE_ROTATION[i % SOURCE_ROTATION.length];
  const share = sourceId.startsWith('AGT') ? 30 : sourceId === 'SRC-SOCREF' ? 10 : 0;
  return {
    id: flat.code, flat, tower: TOWERS[i % 4], flatNo: `${flat.floor}0${(i % 4) + 1}`,
    ownerId: SEED_OWNERS[i].id, sourceId, sourcedBy: SOURCERS[i % 2], sourcedAt: daysAgo(20 + i),
    status: 'published', availability: 'available',
    lastVerifiedAt: flat.lastVerifiedAt, lastVerifiedBy: VERIFIERS[i % 2],
    nextCheckDue: flat.lastVerifiedAt ? addDays(flat.lastVerifiedAt, 7) : null,
    assignedVerifier: VERIFIERS[i % 2],
    authorization: { status: 'received', method: i % 3 === 0 ? 'written' : 'whatsapp', receivedAt: daysAgo(19 + i), validTill: daysFromNow(60 - i) },
    commercial: terms(flat.rent, share), updatedAt: flat.lastVerifiedAt ?? daysAgo(5),
  };
}

function addDays(iso: string, n: number) { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString(); }

function buildProperties(): PropertyRecord[] {
  const list = FLATS.map((_, i) => published(i));
  const byFlat = (id: string) => list.find(r => r.flat.id === id)!;

  // Rented out through BHP last week — kept for history, off the public map.
  Object.assign(byFlat('flt-202'), { status: 'rented', availability: 'rented', lastVerifiedAt: daysAgo(6), nextCheckDue: null });
  // On hold: another tenant finalising.
  Object.assign(byFlat('flt-402'), { availability: 'on_hold' });
  // Stale verifications (owner not responding).
  Object.assign(byFlat('flt-703'), { lastVerifiedAt: daysAgo(12), nextCheckDue: daysAgo(5) });
  Object.assign(byFlat('flt-502'), { lastVerifiedAt: daysAgo(9), nextCheckDue: daysAgo(2) });
  // Agent says available, owner says in talks with someone else → conflict blocks confirmation.
  Object.assign(byFlat('flt-302'), {
    availability: 'unknown', nextCheckDue: daysAgo(0),
    conflict: 'Agent AGT-000112 says available; owner said on call they are "in talks" with another tenant.',
  });
  // Owner asked to reduce rent — awaiting manager approval before the public listing changes.
  byFlat('flt-102').pendingRentChange = { oldRent: 62000, newRent: 60000, requestedBy: 'USR-007', requestedAt: daysAgo(1), evidence: 'Owner WhatsApp, 10:42 AM' };
  // Authorization about to expire.
  byFlat('flt-801').authorization = { status: 'received', method: 'whatsapp', receivedAt: daysAgo(85), validTill: daysFromNow(3) };
  for (const id of ['flt-101', 'flt-102', 'flt-103']) byFlat(id).tower = 'B';
  byFlat('flt-102').flatNo = '1203';

  // ---- work in progress (never visible publicly) ----
  const wip = (id: string, seed: Parameters<typeof makeFlat>[0], rec: Partial<PropertyRecord>): PropertyRecord => {
    const flat = { ...makeFlat(seed), code: id, availability: 'unknown' as const, lastVerifiedAt: null };
    return {
      id, flat, tower: 'A', flatNo: '101', ownerId: null, sourceId: 'SRC-DIRECT', sourcedBy: 'USR-005', sourcedAt: daysAgo(1),
      status: 'draft', availability: 'unknown', lastVerifiedAt: null, lastVerifiedBy: null, nextCheckDue: null, assignedVerifier: null,
      authorization: { status: 'pending' }, commercial: terms(seed.rent, 0), updatedAt: daysAgo(1), ...rec,
    };
  };

  list.push(
    wip('FF-001300', { id: 'flt-n300', societyId: 'soc-skyline', bhk: 3, rent: 47000, areaSqft: 1540, floor: 3 },
      { tower: 'C', flatNo: '304', ownerId: SEED_OWNERS[20].id, sourcedBy: 'USR-005', sourcedAt: daysAgo(0) }),
    // Same flat as FF-001201 (Lakeview, Tower B, 1203) submitted by another agent through another employee.
    wip('FF-001301', { id: 'flt-n301', societyId: 'soc-lakeview', bhk: 3, rent: 61000, areaSqft: 1700, floor: 12, facing: 'North-East', furnishing: 'Furnished' },
      { status: 'pending_verification', tower: 'B', flatNo: '1203', ownerId: SEED_OWNERS[1].id, sourceId: 'AGT-000140', sourcedBy: 'USR-006',
        sourcedAt: daysAgo(1), assignedVerifier: 'USR-007', nextCheckDue: daysAgo(0), authorization: { status: 'pending' }, commercial: terms(61000, 30) }),
    wip('FF-001302', { id: 'flt-n302', societyId: 'soc-banyan', bhk: 2, rent: 27500, areaSqft: 1240, floor: 6 },
      { status: 'pending_approval', tower: 'D', flatNo: '602', ownerId: SEED_OWNERS[21].id, sourceId: 'AGT-000087', sourcedBy: 'USR-006',
        sourcedAt: daysAgo(3), availability: 'available', lastVerifiedAt: daysAgo(1), lastVerifiedBy: 'USR-008', nextCheckDue: daysFromNow(6),
        assignedVerifier: 'USR-008', authorization: { status: 'received', method: 'written', receivedAt: daysAgo(2), validTill: daysFromNow(88) },
        commercial: terms(27500, 30) }),
    wip('FF-001303', { id: 'flt-n303', societyId: 'soc-greenmeadows', bhk: 3, rent: 70000, areaSqft: 2050, floor: 18, totalFloors: 40 },
      { status: 'pending_approval', tower: 'A', flatNo: '1802', ownerId: SEED_OWNERS[22].id, sourceId: 'SRC-EMP', sourcedBy: 'USR-003',
        sourcedAt: daysAgo(2), availability: 'available', lastVerifiedAt: daysAgo(0), lastVerifiedBy: 'USR-007', nextCheckDue: daysFromNow(7),
        assignedVerifier: 'USR-007', authorization: { status: 'received', method: 'whatsapp', receivedAt: daysAgo(2), validTill: daysFromNow(60) } }),
    wip('FF-001304', { id: 'flt-n304', societyId: 'soc-greenmeadows', bhk: 4, rent: 110000, areaSqft: 3100, floor: 27, totalFloors: 40, furnishing: 'Furnished' },
      { status: 'pending_verification', tower: 'C', flatNo: '2701', ownerId: SEED_OWNERS[23].id, sourceId: 'AGT-000087', sourcedBy: 'USR-012',
        sourcedAt: daysAgo(2), assignedVerifier: 'USR-008', nextCheckDue: daysAgo(1), commercial: terms(110000, 30),
        intakeMessage: '4 BHK Green Meadows tower C 27th floor, 3100 sft, fully furnished, rent 1.1 lakh, maintenance 9500 per month, 3 months deposit, available immediately' }),
    wip('FF-001305', { id: 'flt-n305', societyId: 'soc-orchid', bhk: 2, rent: 26000, areaSqft: 1090, floor: 4 },
      { status: 'rejected', sourceId: 'AGT-000140', sourcedBy: 'USR-005', sourcedAt: daysAgo(10),
        rejectionReason: 'Owner denied authorizing Hitech Rentals; flat not available.' }),
  );
  return list;
}

export const SEED_PROPERTIES: PropertyRecord[] = buildProperties();

export const SEED_VERIFICATIONS: Verification[] = SEED_PROPERTIES
  .filter(p => p.lastVerifiedAt)
  .flatMap((p, i) => {
    const latest: Verification = {
      id: `VER-${String(i * 2 + 1).padStart(5, '0')}`, propertyId: p.id, at: p.lastVerifiedAt!, by: p.lastVerifiedBy ?? 'USR-007',
      confirmedBy: p.sourceId.startsWith('AGT') ? 'Owner (via call)' : 'Owner', method: i % 2 ? 'whatsapp' : 'call',
      result: p.availability === 'rented' ? 'rented' : 'available', nextCheckDue: p.nextCheckDue,
    };
    const older: Verification = { ...latest, id: `VER-${String(i * 2 + 2).padStart(5, '0')}`, at: addDays(p.lastVerifiedAt!, -8), result: 'available',
      confirmedBy: 'Owner', method: 'call', nextCheckDue: p.lastVerifiedAt };
    return [latest, older];
  });

/* ---------------- Leads & deals ---------------- */

const LEAD_NAMES = ['Aditya', 'Bhargavi', 'Chaitanya', 'Divya', 'Eshwar', 'Fathima', 'Ganesh', 'Harika', 'Ishaan', 'Jyothi',
  'Kalyan', 'Lakshmi', 'Manoj', 'Nikhil', 'Oviya', 'Pranav', 'Rekha', 'Sameer', 'Tanvi', 'Uday', 'Varun', 'Yamini',
  'Zubair', 'Akhil', 'Bindu', 'Charan', 'Dinesh', 'Esha', 'Gautham', 'Hari'];
const STATUSES: LeadStatus[] = ['new', 'new', 'contacted', 'contacted', 'qualified', 'qualified', 'visit_scheduled', 'visited', 'negotiation', 'won', 'lost', 'lost'];
const CHANNELS: Lead['channel'][] = ['website', 'whatsapp', 'call', 'website', 'referral'];

export const SEED_LEADS: Lead[] = LEAD_NAMES.map((n, i) => {
  const status = STATUSES[i % STATUSES.length];
  const open = status !== 'won' && status !== 'lost';
  const prop = SEED_PROPERTIES[i % 20];
  return {
    id: `LD-${String(500 + i).padStart(6, '0')}`, name: n, phone: `97000${String(10000 + i * 211).slice(0, 5)}`,
    channel: CHANNELS[i % CHANNELS.length], type: i % 3 === 0 ? 'site-visit' : 'message',
    propertyId: prop.id, societyId: prop.flat.societyId, status,
    assignedTo: status === 'new' && i % 4 === 0 ? null : (i % 2 ? 'USR-009' : 'USR-010'),
    createdAt: daysAgo(i % 14, 9 + (i % 8)),
    nextFollowUpAt: open ? (i % 3 === 0 ? daysAgo(1 + (i % 3)) : daysFromNow(1 + (i % 4))) : null,
  };
});

export const SEED_DEALS: Deal[] = [
  { id: 'DL-0001', propertyId: 'FF-001204', agreedRent: 36000, brokerageEarned: 18000, brokerageCollected: 18000, sourcePayoutDue: 4500, sourcePayoutPaid: 0, closedAt: daysAgo(6), closedBy: 'USR-003' },
  { id: 'DL-0002', propertyId: 'FF-OLD-0981', agreedRent: 44000, brokerageEarned: 22000, brokerageCollected: 22000, sourcePayoutDue: 6600, sourcePayoutPaid: 6600, closedAt: daysAgo(12), closedBy: 'USR-003' },
  { id: 'DL-0003', propertyId: 'FF-OLD-0975', agreedRent: 58000, brokerageEarned: 29000, brokerageCollected: 15000, sourcePayoutDue: 8700, sourcePayoutPaid: 0, closedAt: daysAgo(17), closedBy: 'USR-002' },
  { id: 'DL-0004', propertyId: 'FF-OLD-0962', agreedRent: 27000, brokerageEarned: 13500, brokerageCollected: 13500, sourcePayoutDue: 0, sourcePayoutPaid: 0, closedAt: daysAgo(21), closedBy: 'USR-003' },
  { id: 'DL-0005', propertyId: 'FF-OLD-0950', agreedRent: 72000, brokerageEarned: 36000, brokerageCollected: 0, sourcePayoutDue: 10800, sourcePayoutPaid: 0, closedAt: daysAgo(26), closedBy: 'USR-003' },
];

export const SEED_AUDIT: AuditEntry[] = [
  ...SEED_PROPERTIES.slice(0, 26).map((p, i): AuditEntry => ({
    id: `AUD-${String(i + 1).padStart(6, '0')}`, at: p.sourcedAt, actor: p.sourcedBy, entity: 'property', entityId: p.id,
    action: 'property.created', detail: `${p.flat.bhk} BHK, rent ₹${p.flat.rent.toLocaleString('en-IN')}`,
  })),
  { id: 'AUD-000900', at: daysAgo(6), actor: 'USR-003', entity: 'property', entityId: 'FF-001204', action: 'listing.rented', detail: 'Closed via deal DL-0001' },
  { id: 'AUD-000901', at: daysAgo(1), actor: 'USR-007', entity: 'property', entityId: 'FF-001201', action: 'rent.change_requested', detail: '₹62,000 → ₹60,000 (awaiting approval)' },
  { id: 'AUD-000902', at: daysAgo(10), actor: 'USR-003', entity: 'property', entityId: 'FF-001305', action: 'listing.rejected', detail: 'Owner denied authorizing the agent' },
  { id: 'AUD-000903', at: daysAgo(30), actor: 'USR-001', entity: 'user', entityId: 'USR-014', action: 'user.deactivated', detail: 'Left BHP — tasks reassigned to USR-009' },
];
