/** Local development — .NET Core API usually runs on https://localhost:7001 */
export const environment = {
  production: false,
  useMockData: true,
  apiBaseUrl: 'https://localhost:7001/api',
  /** Paste your Google Maps JavaScript API key here (allow http://localhost:4200/* in key restrictions). */
  googleMapsApiKey: '',
  googleMapId: 'DEMO_MAP_ID',
  /**
   * OAuth client ID for Google Sheets bulk import (Google Cloud Console → enable "Google Sheets API" →
   * Credentials → OAuth client ID → Web application → add http://localhost:4200 under "Authorized JavaScript origins").
   */
  googleOAuthClientId: '283237744071-4ki7ntupj1e8kii5mm0r291mmlqa01c6.apps.googleusercontent.com',
};
