/** Production settings — switch useMockData to false once the .NET API is live. */
export const environment = {
  production: true,
  useMockData: true,
  apiBaseUrl: 'https://api.your-domain.com/api',
  /**
   * Google Maps JavaScript API key (Google Cloud Console → APIs & Services → Credentials).
   * Restrict it to your website domain. Leave empty to use the free satellite preview map.
   */
  googleMapsApiKey: '',
  /** Map ID from Google Cloud Console → Map Management (needed for custom pins). */
  googleMapId: 'DEMO_MAP_ID',
  /**
   * OAuth client ID for Google Sheets bulk import (Google Cloud Console → enable "Google Sheets API" →
   * Credentials → OAuth client ID → Web application → add this site's origin under "Authorized JavaScript origins").
   */
  googleOAuthClientId: '283237744071-4ki7ntupj1e8kii5mm0r291mmlqa01c6.apps.googleusercontent.com',
};
