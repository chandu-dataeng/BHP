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
};
