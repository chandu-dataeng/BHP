/**
 * Map overlays for Hyderabad.
 * Ring roads are APPROXIMATE paths (good enough for orientation). Replace with the
 * official KML/GeoJSON coordinates later if you need exact alignment.
 */
export type LatLng = [number, number];

/** Outer Ring Road (≈158 km), drawn in green. */
export const ORR_PATH: LatLng[] = [
  [17.389, 78.352], [17.418, 78.342], [17.462, 78.318], [17.500, 78.286], [17.528, 78.272],
  [17.556, 78.322], [17.581, 78.390], [17.596, 78.440], [17.598, 78.488], [17.590, 78.540],
  [17.567, 78.590], [17.530, 78.632], [17.480, 78.664], [17.436, 78.678], [17.390, 78.668],
  [17.338, 78.650], [17.296, 78.628], [17.255, 78.596], [17.222, 78.552], [17.212, 78.505],
  [17.222, 78.460], [17.240, 78.420], [17.272, 78.388], [17.310, 78.368], [17.352, 78.358],
  [17.389, 78.352],
];

/** Proposed Regional Ring Road (≈340 km), drawn in yellow. */
export const RRR_PATH: LatLng[] = [
  [17.620, 78.080], [17.700, 78.180], [17.740, 78.290], [17.800, 78.390], [17.840, 78.480],
  [17.855, 78.600], [17.840, 78.700], [17.780, 78.800], [17.680, 78.900], [17.580, 78.950],
  [17.470, 78.960], [17.360, 78.940], [17.255, 78.900], [17.150, 78.820], [17.060, 78.720],
  [17.010, 78.600], [16.995, 78.480], [17.020, 78.360], [17.060, 78.250], [17.110, 78.160],
  [17.200, 78.110], [17.320, 78.090], [17.450, 78.070], [17.540, 78.060], [17.620, 78.080],
];

/** Pin colour by price per sq.yd — same green → red heat scale as the reference map. */
export const PRICE_BANDS = [
  { key: 'b1', max: 12000, color: '#16d43a', label: 'Under ₹12K' },
  { key: 'b2', max: 20000, color: '#a3f803', label: '₹12K – 20K' },
  { key: 'b3', max: 25000, color: '#f3e903', label: '₹20K – 25K' },
  { key: 'b4', max: 30000, color: '#f7a302', label: '₹25K – 30K' },
  { key: 'b5', max: Infinity, color: '#e8141a', label: '₹30K +' },
] as const;

export type PriceBandKey = (typeof PRICE_BANDS)[number]['key'];

export function bandFor(pricePerSqYd: number) {
  return PRICE_BANDS.find(b => pricePerSqYd <= b.max)!;
}
