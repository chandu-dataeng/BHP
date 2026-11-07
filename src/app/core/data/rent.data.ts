/**
 * DUMMY RENT DATA — 8 gated communities and 20 flats around Hyderabad.
 * Replace with API data later (see PropertyService). Field names match the
 * models so the .NET DTOs can mirror them 1:1.
 */
import { RentalFlat, Society } from '../models/rent.models';
import { IMG, pick } from './images';
import { daysAgo } from '../policy/availability';

export const SOCIETIES: Society[] = [
  {
    id: 'soc-lakeview', name: 'Lakeview Heights', builder: 'Sunstone Developers',
    locality: 'Gachibowli', city: 'Hyderabad', pincode: '500032', lat: 17.4401, lng: 78.3489,
    rating: 4.5, reviewsCount: 320, totalAcres: 12, towers: 8, totalUnits: 1150, completedYear: 2022,
    bhkTypes: [2, 3, 4],
    highlights: ['gatedCommunity', 'clubhouse', 'pool', 'security'],
    amenities: ['clubhouse', 'pool', 'gym', 'kidsPlay', 'garden', 'security', 'powerBackup', 'indoorGames', 'lift', 'parking'],
    about: 'Lakeview Heights is a premium gated community spread across 12 acres with modern amenities, open spaces and excellent connectivity to the Financial District and Hitech City.',
    coverImage: IMG.towers[0], images: [IMG.towers[0], IMG.amenity[0], IMG.towers[1]],
    nearby: [
      { category: 'Schools', name: 'Oakridge International School', distanceKm: 1.2, minutes: 4 },
      { category: 'Schools', name: 'Delhi Public School, Nanakramguda', distanceKm: 2.6, minutes: 8 },
      { category: 'Colleges', name: 'University of Hyderabad', distanceKm: 3.4, minutes: 10 },
      { category: 'Hospitals', name: 'Continental Hospitals', distanceKm: 3.2, minutes: 10 },
      { category: 'Malls', name: 'Sarath City Capital Mall', distanceKm: 4.8, minutes: 15 },
      { category: 'IT Parks', name: 'Financial District', distanceKm: 2.5, minutes: 8 },
      { category: 'Metro', name: 'Raidurg Metro Station', distanceKm: 4.9, minutes: 14 },
    ],
    reviews: [
      { id: 'r1', author: 'Rahul S.', rating: 5, comment: 'Great society with good security and amenities. Very close to Financial District and schools.', date: '2026-09-02' },
      { id: 'r2', author: 'Priya M.', rating: 4, comment: 'Spacious flats and well maintained amenities. Good for families.', date: '2026-07-10' },
    ],
    brochureUrl: '#',
  },
  {
    id: 'soc-skyline', name: 'Skyline Residency', builder: 'Bluebay Constructions',
    locality: 'Kondapur', city: 'Hyderabad', pincode: '500084', lat: 17.4635, lng: 78.3635,
    rating: 4.3, reviewsCount: 210, totalAcres: 7.5, towers: 5, totalUnits: 640, completedYear: 2020,
    bhkTypes: [2, 3],
    highlights: ['gatedCommunity', 'gym', 'pool', 'security'],
    amenities: ['clubhouse', 'pool', 'gym', 'kidsPlay', 'security', 'powerBackup', 'lift', 'parking', 'joggingTrack'],
    about: 'Skyline Residency offers well-planned 2 & 3 BHK homes in the heart of Kondapur, minutes from Hitech City, Botanical Garden and top restaurants.',
    coverImage: IMG.towers[1], images: [IMG.towers[1], IMG.amenity[1], IMG.towers[2]],
    nearby: [
      { category: 'Schools', name: 'Meridian School, Kondapur', distanceKm: 1.0, minutes: 4 },
      { category: 'Hospitals', name: 'KIMS Hospitals, Kondapur', distanceKm: 1.5, minutes: 6 },
      { category: 'Malls', name: 'Sarath City Capital Mall', distanceKm: 2.2, minutes: 8 },
      { category: 'IT Parks', name: 'Hitech City', distanceKm: 3.0, minutes: 10 },
      { category: 'Metro', name: 'Hitech City Metro Station', distanceKm: 3.4, minutes: 11 },
      { category: 'Colleges', name: 'IIIT Hyderabad', distanceKm: 3.8, minutes: 12 },
    ],
    reviews: [
      { id: 'r1', author: 'Kiran R.', rating: 4, comment: 'Prime location, walking distance to cafes. Weekend traffic can be heavy.', date: '2026-08-18' },
      { id: 'r2', author: 'Sneha P.', rating: 5, comment: 'Maintenance team is very responsive. Pool and gym are kept clean.', date: '2026-06-01' },
    ],
  },
  {
    id: 'soc-greenmeadows', name: 'Green Meadows', builder: 'Greenline Infra',
    locality: 'Kokapet', city: 'Hyderabad', pincode: '500075', lat: 17.3960, lng: 78.3300,
    rating: 4.6, reviewsCount: 185, totalAcres: 18, towers: 10, totalUnits: 1600, completedYear: 2024,
    bhkTypes: [3, 4],
    highlights: ['gatedCommunity', 'clubhouse', 'pool', 'security'],
    amenities: ['clubhouse', 'pool', 'gym', 'kidsPlay', 'garden', 'security', 'powerBackup', 'indoorGames', 'tennis', 'joggingTrack', 'lift', 'parking'],
    about: 'Green Meadows is a luxury high-rise community in Kokapet with 70% open space, a 60,000 sq.ft clubhouse and quick access to the Outer Ring Road.',
    coverImage: IMG.towers[2], images: [IMG.towers[2], IMG.amenity[0], IMG.towers[4]],
    nearby: [
      { category: 'Schools', name: 'Chirec International School', distanceKm: 2.0, minutes: 6 },
      { category: 'Hospitals', name: 'Apollo Clinic, Kokapet', distanceKm: 1.6, minutes: 5 },
      { category: 'IT Parks', name: 'Financial District', distanceKm: 3.5, minutes: 9 },
      { category: 'Highways', name: 'ORR Exit 1 (Kokapet)', distanceKm: 1.1, minutes: 3 },
      { category: 'Malls', name: 'Inorbit Mall', distanceKm: 9.5, minutes: 24 },
      { category: 'Airport', name: 'RGI Airport', distanceKm: 29, minutes: 32 },
    ],
    reviews: [
      { id: 'r1', author: 'Arjun V.', rating: 5, comment: 'Brand new towers, stunning views of the city. Great clubhouse.', date: '2026-10-05' },
    ],
    brochureUrl: '#',
  },
  {
    id: 'soc-palmgrove', name: 'Palm Grove Enclave', builder: 'Palmera Homes',
    locality: 'Narsingi', city: 'Hyderabad', pincode: '500089', lat: 17.3855, lng: 78.3600,
    rating: 4.2, reviewsCount: 140, totalAcres: 9, towers: 6, totalUnits: 820, completedYear: 2021,
    bhkTypes: [2, 3],
    highlights: ['gatedCommunity', 'garden', 'kidsPlay', 'security'],
    amenities: ['clubhouse', 'gym', 'kidsPlay', 'garden', 'security', 'powerBackup', 'lift', 'parking', 'temple'],
    about: 'Palm Grove Enclave is a family-friendly community near Narsingi with landscaped gardens, a temple and easy access to Gachibowli and the ORR.',
    coverImage: IMG.towers[3], images: [IMG.towers[3], IMG.amenity[2], IMG.towers[0]],
    nearby: [
      { category: 'Schools', name: 'Gaudium School', distanceKm: 3.1, minutes: 9 },
      { category: 'Hospitals', name: 'Care Hospitals, Gachibowli', distanceKm: 5.0, minutes: 14 },
      { category: 'IT Parks', name: 'Financial District', distanceKm: 4.2, minutes: 12 },
      { category: 'Highways', name: 'ORR Narsingi Junction', distanceKm: 1.4, minutes: 4 },
      { category: 'Malls', name: 'Sarath City Capital Mall', distanceKm: 8.0, minutes: 22 },
    ],
    reviews: [
      { id: 'r1', author: 'Lakshmi N.', rating: 4, comment: 'Peaceful and green. Good for elders and kids.', date: '2026-05-21' },
    ],
  },
  {
    id: 'soc-orchid', name: 'Orchid County', builder: 'Orchid Realty',
    locality: 'Miyapur', city: 'Hyderabad', pincode: '500049', lat: 17.4960, lng: 78.3570,
    rating: 4.1, reviewsCount: 260, totalAcres: 10, towers: 7, totalUnits: 980, completedYear: 2019,
    bhkTypes: [2, 3],
    highlights: ['gatedCommunity', 'clubhouse', 'gym', 'security'],
    amenities: ['clubhouse', 'gym', 'kidsPlay', 'security', 'powerBackup', 'indoorGames', 'lift', 'parking'],
    about: 'Orchid County sits close to Miyapur Metro, making it ideal for commuters. Affordable rents with full gated-community amenities.',
    coverImage: IMG.towers[4], images: [IMG.towers[4], IMG.amenity[1], IMG.towers[5]],
    nearby: [
      { category: 'Metro', name: 'Miyapur Metro Station', distanceKm: 1.1, minutes: 4 },
      { category: 'Schools', name: 'Sri Chaitanya School', distanceKm: 0.8, minutes: 3 },
      { category: 'Hospitals', name: 'Archana Hospital', distanceKm: 1.9, minutes: 6 },
      { category: 'Malls', name: 'GSM Mall, Miyapur', distanceKm: 1.5, minutes: 5 },
      { category: 'IT Parks', name: 'Hitech City', distanceKm: 9.5, minutes: 25 },
    ],
    reviews: [
      { id: 'r1', author: 'Mahesh K.', rating: 4, comment: 'Metro is very close, great value for money.', date: '2026-08-30' },
      { id: 'r2', author: 'Divya T.', rating: 4, comment: 'Good security and water supply. Gym could be bigger.', date: '2026-04-14' },
    ],
  },
  {
    id: 'soc-royalcrest', name: 'Royal Crest', builder: 'Crestline Estates',
    locality: 'Kompally', city: 'Hyderabad', pincode: '500014', lat: 17.5440, lng: 78.4880,
    rating: 4.0, reviewsCount: 96, totalAcres: 6, towers: 4, totalUnits: 480, completedYear: 2023,
    bhkTypes: [2, 3],
    highlights: ['gatedCommunity', 'pool', 'kidsPlay', 'security'],
    amenities: ['clubhouse', 'pool', 'gym', 'kidsPlay', 'garden', 'security', 'powerBackup', 'lift', 'parking'],
    about: 'Royal Crest offers new 2 & 3 BHK homes in fast-growing Kompally with wide roads, good schools and easy access to NH-44.',
    coverImage: IMG.towers[5], images: [IMG.towers[5], IMG.amenity[0], IMG.towers[3]],
    nearby: [
      { category: 'Schools', name: 'Johnson Grammar School', distanceKm: 2.3, minutes: 7 },
      { category: 'Hospitals', name: 'Rainbow Children\'s Hospital', distanceKm: 3.5, minutes: 10 },
      { category: 'Malls', name: 'Cinepolis, Kompally', distanceKm: 1.8, minutes: 6 },
      { category: 'Highways', name: 'NH-44', distanceKm: 0.9, minutes: 3 },
    ],
    reviews: [
      { id: 'r1', author: 'Sandeep G.', rating: 4, comment: 'Calm neighbourhood, new construction quality is good.', date: '2026-09-25' },
    ],
  },
  {
    id: 'soc-sunrise', name: 'Sunrise Towers', builder: 'Dawnview Builders',
    locality: 'Uppal', city: 'Hyderabad', pincode: '500039', lat: 17.4010, lng: 78.5600,
    rating: 3.9, reviewsCount: 118, totalAcres: 5, towers: 4, totalUnits: 420, completedYear: 2018,
    bhkTypes: [1, 2, 3],
    highlights: ['gatedCommunity', 'gym', 'powerBackup', 'security'],
    amenities: ['gym', 'kidsPlay', 'security', 'powerBackup', 'lift', 'parking', 'cctv'],
    about: 'Sunrise Towers is an affordable gated community close to Uppal Metro and the Uppal stadium, with quick access to Habsiguda and Tarnaka.',
    coverImage: IMG.towers[1], images: [IMG.towers[1], IMG.towers[4]],
    nearby: [
      { category: 'Metro', name: 'Uppal Metro Station', distanceKm: 0.7, minutes: 3 },
      { category: 'IT Parks', name: 'Genpact / Raheja IT Park, Uppal', distanceKm: 1.5, minutes: 5 },
      { category: 'Hospitals', name: 'Aware Gleneagles Hospital', distanceKm: 3.6, minutes: 11 },
      { category: 'Schools', name: 'Delhi Public School, Uppal', distanceKm: 2.2, minutes: 7 },
    ],
    reviews: [
      { id: 'r1', author: 'Naveen B.', rating: 4, comment: 'Metro at walking distance. Ideal for working professionals.', date: '2026-03-12' },
    ],
  },
  {
    id: 'soc-banyan', name: 'Banyan Woods', builder: 'Rootwood Developers',
    locality: 'Tellapur', city: 'Hyderabad', pincode: '502032', lat: 17.4630, lng: 78.2850,
    rating: 4.4, reviewsCount: 152, totalAcres: 14, towers: 9, totalUnits: 1240, completedYear: 2023,
    bhkTypes: [2, 3, 4],
    highlights: ['gatedCommunity', 'clubhouse', 'pool', 'security'],
    amenities: ['clubhouse', 'pool', 'gym', 'kidsPlay', 'garden', 'security', 'powerBackup', 'indoorGames', 'tennis', 'joggingTrack', 'lift', 'parking'],
    about: 'Banyan Woods is a lush, low-density community in Tellapur surrounded by greenery, with large homes and resort-style amenities.',
    coverImage: IMG.towers[0], images: [IMG.towers[0], IMG.amenity[0], IMG.towers[2]],
    nearby: [
      { category: 'Schools', name: 'Global Edge School', distanceKm: 2.4, minutes: 7 },
      { category: 'Hospitals', name: 'Citizens Specialty Hospital', distanceKm: 4.5, minutes: 12 },
      { category: 'IT Parks', name: 'Gachibowli IT Corridor', distanceKm: 8.0, minutes: 20 },
      { category: 'Highways', name: 'ORR Exit 2 (Patancheru)', distanceKm: 3.0, minutes: 8 },
    ],
    reviews: [
      { id: 'r1', author: 'Harsha D.', rating: 5, comment: 'Feels like living in a resort. Very green and quiet.', date: '2026-10-10' },
    ],
    brochureUrl: '#',
  },
];

/* ---------- Flats ---------- */
export type FlatSeed = Partial<RentalFlat> & Pick<RentalFlat, 'id' | 'societyId' | 'bhk' | 'rent' | 'areaSqft'>;

let imgOffset = 0;
/** Builds a complete public listing from a few fields (also used by the admin seed / add-property wizard). */
export function makeFlat(s: FlatSeed): RentalFlat { return flat(s); }
function flat(s: FlatSeed): RentalFlat {
  const soc = SOCIETIES.find(x => x.id === s.societyId)!;
  const o = imgOffset++;
  const code = `FF-${String(1200 + o).padStart(6, '0')}`;   // BHP Property ID
  return {
    code,
    title: `${s.bhk} BHK Apartment`,
    maintenance: Math.round(s.areaSqft * 3 / 100) * 100,
    deposit: s.rent * 3,
    depositMonths: 3,
    bathrooms: Math.max(1, s.bhk === 1 ? 1 : s.bhk),
    balconies: s.bhk >= 3 ? 2 : 1,
    furnishing: 'Semi Furnished',
    facing: 'East',
    floor: 5,
    totalFloors: 14,
    availableFrom: '2026-11-15',
    tenantType: 'Both Allowed',
    propertyAge: 'New (1-3 years)',
    parking: s.bhk >= 3 ? '2 Covered' : '1 Covered',
    petsAllowed: false,
    verified: true,
    availability: 'available',
    lastVerifiedAt: daysAgo(o % 5),
    postedOn: '2026-10-20',
    description: `Spacious ${s.bhk} BHK in ${soc.name}, ${soc.locality}. Well-ventilated, vastu-compliant layout with modular kitchen, wardrobes in all bedrooms and a balcony with an open view. 24x7 security, power backup and covered parking.`,
    images: [
      ...pick(IMG.living, o, 2), ...pick(IMG.kitchen, o, 1), ...pick(IMG.bedroom, o, 2),
      ...pick(IMG.bathroom, o, 1), soc.coverImage, ...pick(IMG.amenity, o, 1),
    ],
    ...s,
  } as RentalFlat;
}

export const FLATS: RentalFlat[] = [
  // Lakeview Heights — 2BHK (0) | 3BHK (2) | 4BHK (1)  — matches the reference screen
  flat({ id: 'flt-101', societyId: 'soc-lakeview', bhk: 3, rent: 58000, areaSqft: 1650, floor: 8, facing: 'East', availableFrom: '2026-11-15' }),
  flat({ id: 'flt-102', societyId: 'soc-lakeview', bhk: 3, rent: 62000, areaSqft: 1700, floor: 12, facing: 'North-East', furnishing: 'Furnished', tenantType: 'Family Only' }),
  flat({ id: 'flt-103', societyId: 'soc-lakeview', bhk: 4, rent: 85000, areaSqft: 2450, floor: 11, facing: 'North', furnishing: 'Furnished', tenantType: 'Family Only', petsAllowed: true }),

  flat({ id: 'flt-201', societyId: 'soc-skyline', bhk: 2, rent: 34000, areaSqft: 1180, floor: 4, facing: 'West', furnishing: 'Semi Furnished', tenantType: 'Bachelors Only' }),
  flat({ id: 'flt-202', societyId: 'soc-skyline', bhk: 2, rent: 36500, areaSqft: 1225, floor: 9, facing: 'East', furnishing: 'Furnished' }),
  flat({ id: 'flt-203', societyId: 'soc-skyline', bhk: 3, rent: 48000, areaSqft: 1560, floor: 6, facing: 'North-East', availableFrom: '2026-12-01' }),

  flat({ id: 'flt-301', societyId: 'soc-greenmeadows', bhk: 3, rent: 72000, areaSqft: 2100, floor: 22, totalFloors: 40, facing: 'East', furnishing: 'Semi Furnished', propertyAge: 'Brand New (< 1 year)' }),
  flat({ id: 'flt-302', societyId: 'soc-greenmeadows', bhk: 4, rent: 115000, areaSqft: 3200, floor: 31, totalFloors: 40, facing: 'North-East', furnishing: 'Furnished', tenantType: 'Family Only', propertyAge: 'Brand New (< 1 year)' }),

  flat({ id: 'flt-401', societyId: 'soc-palmgrove', bhk: 2, rent: 30000, areaSqft: 1150, floor: 3, facing: 'North', furnishing: 'Unfurnished' }),
  flat({ id: 'flt-402', societyId: 'soc-palmgrove', bhk: 3, rent: 42000, areaSqft: 1520, floor: 7, facing: 'East', petsAllowed: true }),

  flat({ id: 'flt-501', societyId: 'soc-orchid', bhk: 2, rent: 24000, areaSqft: 1100, floor: 2, facing: 'East', furnishing: 'Semi Furnished', propertyAge: '5-10 years' }),
  flat({ id: 'flt-502', societyId: 'soc-orchid', bhk: 3, rent: 32000, areaSqft: 1480, floor: 10, facing: 'West', furnishing: 'Unfurnished', tenantType: 'Family Only', propertyAge: '5-10 years' }),

  flat({ id: 'flt-601', societyId: 'soc-royalcrest', bhk: 2, rent: 22000, areaSqft: 1150, floor: 5, totalFloors: 12, facing: 'North-East', propertyAge: 'New (1-3 years)' }),
  flat({ id: 'flt-602', societyId: 'soc-royalcrest', bhk: 3, rent: 29000, areaSqft: 1450, floor: 8, totalFloors: 12, facing: 'East', furnishing: 'Furnished' }),

  flat({ id: 'flt-701', societyId: 'soc-sunrise', bhk: 1, rent: 14000, areaSqft: 650, floor: 3, totalFloors: 10, facing: 'South', furnishing: 'Furnished', tenantType: 'Bachelors Only', propertyAge: '5-10 years', parking: '1 Open' }),
  flat({ id: 'flt-702', societyId: 'soc-sunrise', bhk: 2, rent: 19000, areaSqft: 1050, floor: 6, totalFloors: 10, facing: 'East', propertyAge: '5-10 years' }),
  flat({ id: 'flt-703', societyId: 'soc-sunrise', bhk: 3, rent: 25000, areaSqft: 1380, floor: 9, totalFloors: 10, facing: 'North', furnishing: 'Unfurnished', propertyAge: '5-10 years', verified: false }),

  flat({ id: 'flt-801', societyId: 'soc-banyan', bhk: 2, rent: 28000, areaSqft: 1250, floor: 4, facing: 'East' }),
  flat({ id: 'flt-802', societyId: 'soc-banyan', bhk: 3, rent: 40000, areaSqft: 1780, floor: 9, facing: 'North-East', furnishing: 'Semi Furnished' }),
  flat({ id: 'flt-803', societyId: 'soc-banyan', bhk: 4, rent: 62000, areaSqft: 2650, floor: 13, facing: 'East', furnishing: 'Furnished', tenantType: 'Family Only', petsAllowed: true }),
];
