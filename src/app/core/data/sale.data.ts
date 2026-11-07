/**
 * DUMMY SALE DATA — 8 plotted ventures in and around Hyderabad.
 * Every venture gets a generated plot layout (plot no, size, facing, status).
 */
import { Facing } from '../models/rent.models';
import { Plot, PlotStatus, Venture } from '../models/sale.models';
import { IMG, pick } from './images';

/** Deterministic pseudo-random generator so dummy data never changes between reloads. */
function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function makePlots(prefix: string, count: number, sizes: number[], seed: number, soldRatio = 0.35): Plot[] {
  const r = rng(seed);
  const facings: Facing[] = ['East', 'West', 'North', 'South', 'North-East'];
  return Array.from({ length: count }, (_, i) => {
    const x = r();
    const status: PlotStatus = x < soldRatio ? 'Sold' : x < soldRatio + 0.12 ? 'Booked' : 'Available';
    return {
      id: `${prefix}-p${i + 1}`,
      plotNo: String(i + 1),
      sizeSqYd: sizes[Math.floor(r() * sizes.length)],
      facing: facings[Math.floor(r() * facings.length)],
      roadWidthFt: r() > 0.7 ? 40 : 33,
      corner: i % 8 === 0 || i % 8 === 7,
      status,
    };
  });
}

const landImgs = (o: number) => [...pick(IMG.land, o, 3), ...pick(IMG.villa, o, 2)];

export const VENTURES: Venture[] = [
  {
    id: 'ven-lotus', name: 'Lotus Meadows', developer: 'Sunstone Developers',
    locality: 'Shankarpally', city: 'Hyderabad', pincode: '501203', lat: 17.4560, lng: 78.1300,
    pricePerSqYd: 22000, totalAcres: 32, approvals: ['HMDA', 'RERA'],
    reraNo: 'P02400004321', hmdaLpNo: '000123/LO/Plg/HMDA/2025',
    status: 'Ready to Register', launchYear: 2025, verified: true, rating: 4.6, reviewsCount: 88,
    roadWidths: '40 ft & 33 ft BT roads', orrDistanceKm: 9,
    highlights: ['gatedCommunity', 'blackTopRoads', 'park', 'security'],
    amenities: ['gatedCommunity', 'compoundWall', 'blackTopRoads', 'streetLights', 'drainage', 'waterSupply', 'electricity', 'avenuePlantation', 'park', 'kidsPlay', 'security', 'clubhouse'],
    bankLoans: ['SBI', 'HDFC', 'ICICI', 'LIC HFL'],
    about: 'Lotus Meadows is an HMDA & RERA approved gated plotted community on the Shankarpally–Mokila road with 40 ft black-top roads, underground drainage and a landscaped central park. Just 9 km from ORR Exit 3.',
    coverImage: IMG.land[0], images: landImgs(0),
    nearby: [
      { category: 'Highways', name: 'ORR Exit 3 (Kollur)', distanceKm: 9, minutes: 14 },
      { category: 'IT Parks', name: 'Financial District', distanceKm: 22, minutes: 35 },
      { category: 'Schools', name: 'ICFAI Business School', distanceKm: 6, minutes: 10 },
      { category: 'Hospitals', name: 'Area Hospital, Shankarpally', distanceKm: 3, minutes: 6 },
    ],
    reviews: [
      { id: 'r1', author: 'Venkat R.', rating: 5, comment: 'Clear titles and HMDA approval made the decision easy. Roads are already laid.', date: '2026-08-12' },
      { id: 'r2', author: 'Anusha K.', rating: 4, comment: 'Good layout, site visit team was helpful.', date: '2026-06-20' },
    ],
    plots: makePlots('lotus', 48, [150, 167, 200, 240, 267], 11),
    brochureUrl: '#',
  },
  {
    id: 'ven-golden', name: 'Golden Acres', developer: 'Greenline Infra',
    locality: 'Maheshwaram', city: 'Hyderabad', pincode: '501359', lat: 17.1330, lng: 78.4400,
    pricePerSqYd: 28000, totalAcres: 45, approvals: ['HMDA', 'RERA'],
    reraNo: 'P02400005678', hmdaLpNo: '000456/LO/Plg/HMDA/2024',
    status: 'Ready to Register', launchYear: 2024, verified: true, rating: 4.5, reviewsCount: 132,
    roadWidths: '60 ft main road, 40 ft internal', orrDistanceKm: 6,
    highlights: ['gatedCommunity', 'clubhouse', 'blackTopRoads', 'security'],
    amenities: ['gatedCommunity', 'compoundWall', 'blackTopRoads', 'streetLights', 'drainage', 'waterSupply', 'electricity', 'avenuePlantation', 'park', 'clubhouse', 'pool', 'security'],
    bankLoans: ['SBI', 'HDFC', 'Axis Bank'],
    about: 'Golden Acres is a 45-acre premium plotted venture near the Maheshwaram pharma & electronics hub with a clubhouse, swimming pool and 60 ft main road. Close to Srisailam Highway and RGI Airport.',
    coverImage: IMG.land[1], images: landImgs(1),
    nearby: [
      { category: 'Airport', name: 'RGI Airport', distanceKm: 18, minutes: 25 },
      { category: 'Highways', name: 'ORR Exit 14 (Tukkuguda)', distanceKm: 6, minutes: 9 },
      { category: 'IT Parks', name: 'Hardware Park / E-City', distanceKm: 4, minutes: 7 },
      { category: 'Schools', name: 'Delhi Public School, Mahendra Hills', distanceKm: 12, minutes: 20 },
    ],
    reviews: [
      { id: 'r1', author: 'Suresh P.', rating: 5, comment: 'Excellent appreciation in 2 years. Clubhouse is under construction as promised.', date: '2026-09-01' },
    ],
    plots: makePlots('golden', 56, [167, 200, 250, 300], 23, 0.45),
    brochureUrl: '#',
  },
  {
    id: 'ven-pearl', name: 'Pearl Valley', developer: 'Bluebay Constructions',
    locality: 'Ghatkesar', city: 'Hyderabad', pincode: '501301', lat: 17.4500, lng: 78.6830,
    pricePerSqYd: 26000, totalAcres: 20, approvals: ['HMDA', 'RERA'],
    reraNo: 'P02200009012',
    status: 'Under Development', launchYear: 2026, verified: true, rating: 4.3, reviewsCount: 54,
    roadWidths: '40 ft & 30 ft', orrDistanceKm: 2,
    highlights: ['gatedCommunity', 'blackTopRoads', 'streetLights', 'security'],
    amenities: ['gatedCommunity', 'compoundWall', 'blackTopRoads', 'streetLights', 'drainage', 'waterSupply', 'electricity', 'park', 'security'],
    bankLoans: ['SBI', 'ICICI'],
    about: 'Pearl Valley is just 2 km from the Ghatkesar ORR exit, with quick access to Uppal, Pocharam IT SEZ and Warangal Highway. Ideal for both investment and building your dream home.',
    coverImage: IMG.land[2], images: landImgs(2),
    nearby: [
      { category: 'Highways', name: 'ORR Exit 9 (Ghatkesar)', distanceKm: 2, minutes: 4 },
      { category: 'IT Parks', name: 'Infosys Pocharam SEZ', distanceKm: 6, minutes: 10 },
      { category: 'Metro', name: 'Uppal Metro Station', distanceKm: 14, minutes: 25 },
      { category: 'Colleges', name: 'CVR / Anurag Engineering Colleges', distanceKm: 4, minutes: 8 },
    ],
    reviews: [
      { id: 'r1', author: 'Ravi T.', rating: 4, comment: 'Very close to ORR, prices are reasonable compared to the west side.', date: '2026-10-02' },
    ],
    plots: makePlots('pearl', 40, [150, 180, 200, 267], 37, 0.2),
  },
  {
    id: 'ven-royalorchid', name: 'Royal Orchid Enclave', developer: 'Crestline Estates',
    locality: 'Tukkuguda', city: 'Hyderabad', pincode: '501359', lat: 17.2040, lng: 78.4800,
    pricePerSqYd: 32000, totalAcres: 28, approvals: ['HMDA', 'RERA'],
    reraNo: 'P02400007788', hmdaLpNo: '000789/LO/Plg/HMDA/2025',
    status: 'Ready to Register', launchYear: 2025, verified: true, rating: 4.7, reviewsCount: 76,
    roadWidths: '40 ft BT roads', orrDistanceKm: 1,
    highlights: ['gatedCommunity', 'clubhouse', 'park', 'security'],
    amenities: ['gatedCommunity', 'compoundWall', 'blackTopRoads', 'streetLights', 'drainage', 'waterSupply', 'electricity', 'avenuePlantation', 'park', 'kidsPlay', 'clubhouse', 'joggingTrack', 'security'],
    bankLoans: ['SBI', 'HDFC', 'ICICI', 'Bank of Baroda'],
    about: 'Royal Orchid Enclave sits right next to ORR Exit 14 (Tukkuguda), 15 minutes from the airport. A premium villa-plot community with a clubhouse, jogging track and 24x7 security.',
    coverImage: IMG.villa[0], images: [IMG.villa[0], ...pick(IMG.land, 3, 3), IMG.villa[4]],
    nearby: [
      { category: 'Highways', name: 'ORR Exit 14 (Tukkuguda)', distanceKm: 1, minutes: 2 },
      { category: 'Airport', name: 'RGI Airport', distanceKm: 12, minutes: 15 },
      { category: 'IT Parks', name: 'Fab City', distanceKm: 5, minutes: 8 },
      { category: 'Malls', name: 'GMR Arena / Airport Plaza', distanceKm: 13, minutes: 18 },
    ],
    reviews: [
      { id: 'r1', author: 'Pavan M.', rating: 5, comment: 'Location next to ORR is unbeatable. Premium development.', date: '2026-07-28' },
      { id: 'r2', author: 'Keerthi S.', rating: 5, comment: 'Smooth registration process, all documents were ready.', date: '2026-05-11' },
    ],
    plots: makePlots('royal', 36, [200, 240, 300, 400], 41, 0.5),
    brochureUrl: '#',
  },
  {
    id: 'ven-vihaan', name: 'Vihaan Gardens', developer: 'Palmera Homes',
    locality: 'Medchal', city: 'Hyderabad', pincode: '501401', lat: 17.6290, lng: 78.4810,
    pricePerSqYd: 24000, totalAcres: 25, approvals: ['HMDA', 'RERA'],
    reraNo: 'P02200003456',
    status: 'New Launch', launchYear: 2026, verified: true, rating: 4.2, reviewsCount: 31,
    roadWidths: '40 ft & 33 ft', orrDistanceKm: 4,
    highlights: ['gatedCommunity', 'park', 'blackTopRoads', 'security'],
    amenities: ['gatedCommunity', 'compoundWall', 'blackTopRoads', 'streetLights', 'drainage', 'waterSupply', 'electricity', 'park', 'kidsPlay', 'temple', 'security'],
    bankLoans: ['SBI', 'HDFC'],
    about: 'Vihaan Gardens is a newly launched HMDA venture on NH-44 near Medchal, offering pre-launch prices with excellent connectivity to Kompally and the upcoming Regional Ring Road.',
    coverImage: IMG.land[3], images: landImgs(3),
    nearby: [
      { category: 'Highways', name: 'NH-44', distanceKm: 1.5, minutes: 3 },
      { category: 'Highways', name: 'ORR Exit 6 (Medchal)', distanceKm: 4, minutes: 7 },
      { category: 'Colleges', name: 'CMR Group of Institutions', distanceKm: 3, minutes: 6 },
      { category: 'Hospitals', name: 'Medchal Area Hospital', distanceKm: 2.5, minutes: 5 },
    ],
    reviews: [
      { id: 'r1', author: 'Srinivas Y.', rating: 4, comment: 'Good pre-launch price, development has started.', date: '2026-10-18' },
    ],
    plots: makePlots('vihaan', 44, [150, 167, 200, 250], 53, 0.12),
  },
  {
    id: 'ven-emerald', name: 'Emerald Springs', developer: 'Orchid Realty',
    locality: 'Adibatla', city: 'Hyderabad', pincode: '501510', lat: 17.2310, lng: 78.5650,
    pricePerSqYd: 30000, totalAcres: 22, approvals: ['HMDA', 'RERA'],
    reraNo: 'P02400006655', hmdaLpNo: '000222/LO/Plg/HMDA/2024',
    status: 'Ready to Register', launchYear: 2024, verified: true, rating: 4.4, reviewsCount: 64,
    roadWidths: '40 ft BT roads', orrDistanceKm: 3,
    highlights: ['gatedCommunity', 'blackTopRoads', 'park', 'security'],
    amenities: ['gatedCommunity', 'compoundWall', 'blackTopRoads', 'streetLights', 'drainage', 'waterSupply', 'electricity', 'avenuePlantation', 'park', 'security'],
    bankLoans: ['SBI', 'ICICI', 'Axis Bank'],
    about: 'Emerald Springs is in the Adibatla aerospace & IT corridor (TCS, Tata Advanced Systems) — one of the fastest appreciating zones in South-East Hyderabad.',
    coverImage: IMG.land[4], images: landImgs(4),
    nearby: [
      { category: 'IT Parks', name: 'TCS Adibatla Campus', distanceKm: 3, minutes: 6 },
      { category: 'Highways', name: 'ORR Exit 13 (Bongloor)', distanceKm: 3, minutes: 5 },
      { category: 'Airport', name: 'RGI Airport', distanceKm: 24, minutes: 28 },
      { category: 'Hospitals', name: 'Ibrahimpatnam Area Hospital', distanceKm: 9, minutes: 15 },
    ],
    reviews: [
      { id: 'r1', author: 'Ramesh G.', rating: 4, comment: 'Near TCS campus, good rental demand once you build.', date: '2026-04-09' },
    ],
    plots: makePlots('emerald', 40, [167, 200, 267], 67, 0.4),
  },
  {
    id: 'ven-saigreen', name: 'Sri Sai Green City', developer: 'Dawnview Builders',
    locality: 'Shadnagar', city: 'Hyderabad', pincode: '509216', lat: 17.0700, lng: 78.2050,
    pricePerSqYd: 14500, totalAcres: 60, approvals: ['DTCP', 'RERA'],
    reraNo: 'P01100008899',
    status: 'Ready to Register', launchYear: 2023, verified: true, rating: 4.1, reviewsCount: 145,
    roadWidths: '40 ft & 30 ft', orrDistanceKm: 28,
    highlights: ['gatedCommunity', 'blackTopRoads', 'park', 'waterSupply'],
    amenities: ['gatedCommunity', 'compoundWall', 'blackTopRoads', 'streetLights', 'drainage', 'waterSupply', 'electricity', 'avenuePlantation', 'park', 'temple'],
    bankLoans: ['SBI', 'LIC HFL'],
    about: 'Sri Sai Green City is a budget-friendly DTCP approved venture on the Bengaluru Highway (NH-44) at Shadnagar, an emerging industrial town with steady appreciation.',
    coverImage: IMG.land[5], images: landImgs(5),
    nearby: [
      { category: 'Highways', name: 'NH-44 (Bengaluru Highway)', distanceKm: 2, minutes: 4 },
      { category: 'Airport', name: 'RGI Airport', distanceKm: 32, minutes: 35 },
      { category: 'Schools', name: 'Shadnagar Public School', distanceKm: 3, minutes: 6 },
    ],
    reviews: [
      { id: 'r1', author: 'Mallesh B.', rating: 4, comment: 'Affordable plots for investment, good roads.', date: '2026-02-17' },
    ],
    plots: makePlots('saigreen', 52, [150, 167, 200], 79, 0.3),
  },
  {
    id: 'ven-aranya', name: 'Aranya County', developer: 'Rootwood Developers',
    locality: 'Yadadri (Bhongir)', city: 'Hyderabad', pincode: '508116', lat: 17.5130, lng: 78.8880,
    pricePerSqYd: 9500, totalAcres: 40, approvals: ['DTCP'],
    status: 'Under Development', launchYear: 2026, verified: false, rating: 3.9, reviewsCount: 22,
    roadWidths: '33 ft', orrDistanceKm: 22,
    highlights: ['gatedCommunity', 'avenuePlantation', 'blackTopRoads', 'temple'],
    amenities: ['gatedCommunity', 'compoundWall', 'blackTopRoads', 'streetLights', 'electricity', 'avenuePlantation', 'temple'],
    bankLoans: ['SBI'],
    about: 'Aranya County is a low-budget DTCP layout near the Yadadri temple town on the Warangal Highway — great for long-term investment with plots starting under ₹15 lakh.',
    coverImage: IMG.land[1], images: [...pick(IMG.land, 1, 4)],
    nearby: [
      { category: 'Highways', name: 'Warangal Highway (NH-163)', distanceKm: 1.5, minutes: 3 },
      { category: 'Highways', name: 'Regional Ring Road (proposed)', distanceKm: 5, minutes: 8 },
      { category: 'Schools', name: 'Bhongir Govt. Schools', distanceKm: 4, minutes: 8 },
    ],
    reviews: [
      { id: 'r1', author: 'Yadagiri P.', rating: 4, comment: 'Low price, good for future RRR growth.', date: '2026-09-29' },
    ],
    plots: makePlots('aranya', 40, [150, 167, 200, 267], 97, 0.15),
  },
];
