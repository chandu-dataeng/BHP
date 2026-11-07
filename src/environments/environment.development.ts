/** Local development — .NET Core API usually runs on https://localhost:7001 */
export const environment = {
  production: false,
  useMockData: true,
  apiBaseUrl: 'https://localhost:7001/api',
  /** Paste your Google Maps JavaScript API key here (allow http://localhost:4200/* in key restrictions). */
  googleMapsApiKey: '',
  googleMapId: 'DEMO_MAP_ID',
};
