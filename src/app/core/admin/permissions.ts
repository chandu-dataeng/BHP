/**
 * Role-based access for BHP Admin.
 *
 * IMPORTANT: the frontend uses these to shape navigation and screens, but it is NOT the security boundary.
 * The .NET API must enforce the same permissions (and row-level scoping, e.g. agents see only their own
 * submissions) on every request. MockDbService/AdminService already mimic that by redacting records
 * server-side-style before they reach a component, so screens are written against redacted data.
 */

export type Role =
  | 'super_admin'       // L0 technical system
  | 'business_owner'    // L1
  | 'ops_manager'       // L2
  | 'dept_manager'      // L3
  | 'sourcer'           // L4 executives…
  | 'verifier'
  | 'telecaller'
  | 'visit_exec'
  | 'agent'             // L5 external
  | 'auditor';          // L6 read-only

export type Permission =
  | 'dashboard.business'        // owner KPIs incl. revenue
  | 'property.view'
  | 'property.create'
  | 'property.edit'
  | 'property.viewOwner'        // owner name & phone
  | 'property.viewCommercial'   // brokerage, source share, negotiation floor
  | 'property.approve'          // publish / reject / approve rent changes
  | 'property.suspend'
  | 'verification.record'
  | 'verification.assign'
  | 'duplicates.resolve'
  | 'lead.viewAll'
  | 'source.view'
  | 'source.manage'
  | 'owner.view'
  | 'society.view'
  | 'team.manage'
  | 'audit.view'
  | 'finance.view'
  | 'system.configure';

export interface RoleMeta { label: string; level: string; description: string; }

export const ROLE_META: Record<Role, RoleMeta> = {
  super_admin:    { label: 'Super Admin',         level: 'L0', description: 'User accounts, roles, integrations, system settings' },
  business_owner: { label: 'Business Owner',      level: 'L1', description: 'All operations, financials, performance and approvals' },
  ops_manager:    { label: 'Operations Manager',  level: 'L2', description: 'Inventory, assignments, verification, quality control' },
  dept_manager:   { label: 'Department Manager',  level: 'L3', description: 'Their department and its team' },
  sourcer:        { label: 'Property Sourcer',    level: 'L4', description: 'Adds properties, owners, sources and photos' },
  verifier:       { label: 'Verification Exec.',  level: 'L4', description: 'Confirms availability, rent and authorization' },
  telecaller:     { label: 'Telecaller',          level: 'L4', description: 'Assigned enquiries, follow-ups, visit booking' },
  visit_exec:     { label: 'Site Visit Exec.',    level: 'L4', description: 'Assigned visits and outcomes' },
  agent:          { label: 'External Agent',      level: 'L5', description: 'Own submissions only' },
  auditor:        { label: 'Auditor (read-only)', level: 'L6', description: 'Authorized records and reports, no edits' },
};

const ALL: Permission[] = [
  'dashboard.business', 'property.view', 'property.create', 'property.edit', 'property.viewOwner', 'property.viewCommercial',
  'property.approve', 'property.suspend', 'verification.record', 'verification.assign', 'duplicates.resolve', 'lead.viewAll',
  'source.view', 'source.manage', 'owner.view', 'society.view', 'team.manage', 'audit.view', 'finance.view', 'system.configure',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: ['team.manage', 'system.configure', 'audit.view', 'property.view', 'society.view', 'source.view'],
  business_owner: ALL.filter(p => p !== 'system.configure' && p !== 'team.manage'),
  ops_manager: [
    'property.view', 'property.create', 'property.edit', 'property.viewOwner', 'property.approve', 'property.suspend',
    'verification.record', 'verification.assign', 'duplicates.resolve', 'lead.viewAll', 'source.view', 'source.manage',
    'owner.view', 'society.view', 'audit.view',
  ],
  dept_manager: ['property.view', 'property.edit', 'property.viewOwner', 'verification.record', 'verification.assign', 'lead.viewAll', 'source.view', 'owner.view', 'society.view'],
  sourcer: ['property.view', 'property.create', 'property.edit', 'property.viewOwner', 'source.view', 'source.manage', 'owner.view', 'society.view'],
  verifier: ['property.view', 'property.viewOwner', 'verification.record', 'society.view'],
  telecaller: ['property.view', 'society.view'],
  visit_exec: ['property.view', 'society.view'],
  agent: ['property.view', 'property.create'],
  auditor: ['property.view', 'property.viewOwner', 'property.viewCommercial', 'owner.view', 'source.view', 'society.view', 'audit.view', 'finance.view', 'dashboard.business'],
};

export function roleCan(role: Role, p: Permission) { return ROLE_PERMISSIONS[role].includes(p); }
