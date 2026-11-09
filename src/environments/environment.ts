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
  /**
   * Live listings: the Google Sheet's Apps Script web app (approved rows only). When set, the public site shows these
   * flats and sends enquiries to WhatsApp. Empty = use the demo data above.
   */
  listingsFeedUrl: 'https://script.google.com/macros/s/AKfycbwTNkvRfv-dNnFyvqv255v_4r4GOKzbWzbRAPpyvawKqyZL3poieHfCL946sIG9-0OAJA/exec',
  /** The demo BHP Admin has no real login — keep it out of the public site until the .NET API exists. */
  adminEnabled: false,
};
