import { AmenityKey, NearbyCategory } from '../models/common.models';

/** Display label + Material Symbols icon for every amenity key. */
export const AMENITY_META: Record<AmenityKey, { label: string; icon: string }> = {
  clubhouse: { label: 'Clubhouse', icon: 'holiday_village' },
  pool: { label: 'Swimming Pool', icon: 'pool' },
  gym: { label: 'Gym', icon: 'fitness_center' },
  kidsPlay: { label: 'Kids Play Area', icon: 'toys' },
  garden: { label: 'Landscaped Garden', icon: 'local_florist' },
  security: { label: '24x7 Security', icon: 'verified_user' },
  powerBackup: { label: 'Power Backup', icon: 'battery_charging_full' },
  indoorGames: { label: 'Indoor Games', icon: 'sports_esports' },
  gatedCommunity: { label: 'Gated Community', icon: 'gate' },
  cctv: { label: 'CCTV', icon: 'videocam' },
  lift: { label: 'Lift', icon: 'elevator' },
  parking: { label: 'Covered Parking', icon: 'local_parking' },
  joggingTrack: { label: 'Jogging Track', icon: 'directions_run' },
  tennis: { label: 'Tennis Court', icon: 'sports_tennis' },
  temple: { label: 'Temple', icon: 'temple_hindu' },
  waterSupply: { label: 'Water Supply', icon: 'water_drop' },
  blackTopRoads: { label: 'BT Roads', icon: 'add_road' },
  streetLights: { label: 'Street Lights', icon: 'light' },
  drainage: { label: 'UG Drainage', icon: 'plumbing' },
  avenuePlantation: { label: 'Avenue Plantation', icon: 'park' },
  compoundWall: { label: 'Compound Wall', icon: 'fence' },
  electricity: { label: 'Electricity', icon: 'bolt' },
  park: { label: 'Parks & Open Space', icon: 'nature_people' },
};

export const NEARBY_ICON: Record<NearbyCategory, string> = {
  Schools: 'school',
  Colleges: 'account_balance',
  Hospitals: 'local_hospital',
  Malls: 'local_mall',
  'IT Parks': 'apartment',
  Metro: 'subway',
  Highways: 'add_road',
  Airport: 'flight',
};

export const NEARBY_COLOR: Record<NearbyCategory, string> = {
  Schools: '#0a6dff',
  Colleges: '#6d4aff',
  Hospitals: '#e2305c',
  Malls: '#0a6dff',
  'IT Parks': '#f5a524',
  Metro: '#3b4bd8',
  Highways: '#0c2a4c',
  Airport: '#11a54f',
};
