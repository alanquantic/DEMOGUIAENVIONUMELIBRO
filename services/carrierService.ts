import { ShippingCarrier, CarrierConfig } from '../types';

// Carrier configuration with tracking URLs
export const CARRIER_CONFIGS: Record<ShippingCarrier, CarrierConfig> = {
  ESTAFETA: {
    name: 'ESTAFETA',
    displayName: 'Estafeta',
    trackingUrl: 'https://www.estafeta.com/Herramientas/Rastreo?guia=',
    color: '#E31837'
  },
  FEDEX: {
    name: 'FEDEX',
    displayName: 'FedEx',
    trackingUrl: 'https://www.fedex.com/fedextrack/?trknbr=',
    color: '#4D148C'
  },
  DHL: {
    name: 'DHL',
    displayName: 'DHL',
    trackingUrl: 'https://www.dhl.com/mx-es/home/rastreo.html?tracking-id=',
    color: '#FFCC00'
  },
  UPS: {
    name: 'UPS',
    displayName: 'UPS',
    trackingUrl: 'https://www.ups.com/track?tracknum=',
    color: '#351C15'
  },
  REDPACK: {
    name: 'REDPACK',
    displayName: 'Redpack',
    trackingUrl: 'https://www.redpack.com.mx/es/rastreo/?guias=',
    color: '#E30613'
  },
  PAQUETEXPRESS: {
    name: 'PAQUETEXPRESS',
    displayName: 'Paquetexpress',
    trackingUrl: 'https://www.paquetexpress.com.mx/rastreo/',
    color: '#003087'
  },
  UNKNOWN: {
    name: 'UNKNOWN',
    displayName: 'Paquetería',
    trackingUrl: '',
    color: '#6B7280'
  }
};

/**
 * Normalizes carrier name from Monday.com column to ShippingCarrier type
 */
export const detectCarrier = (carrierText: string): ShippingCarrier => {
  if (!carrierText) return 'UNKNOWN';
  
  const normalized = carrierText.toUpperCase().trim();
  
  if (normalized.includes('ESTAFETA')) return 'ESTAFETA';
  if (normalized.includes('FEDEX') || normalized.includes('FED EX')) return 'FEDEX';
  if (normalized.includes('DHL')) return 'DHL';
  if (normalized.includes('UPS')) return 'UPS';
  if (normalized.includes('REDPACK')) return 'REDPACK';
  if (normalized.includes('PAQUETEXPRESS') || normalized.includes('PAQUETE EXPRESS')) return 'PAQUETEXPRESS';
  
  return 'UNKNOWN';
};

/**
 * Gets the full tracking URL for a carrier and tracking number
 */
export const getTrackingUrl = (carrier: ShippingCarrier, trackingNumber: string): string => {
  const config = CARRIER_CONFIGS[carrier];
  if (!config.trackingUrl || carrier === 'UNKNOWN') {
    return '';
  }
  return `${config.trackingUrl}${trackingNumber}`;
};

/**
 * Gets carrier display configuration
 */
export const getCarrierConfig = (carrier: ShippingCarrier): CarrierConfig => {
  return CARRIER_CONFIGS[carrier];
};

// API Information for each carrier (for future integration)
export const CARRIER_API_INFO = {
  ESTAFETA: {
    hasApi: true,
    apiType: 'SOAP',
    documentation: 'https://www.estafeta.com/herramientas/webservices',
    notes: 'Requires business contract. Uses SOAP API with authentication. Contact Estafeta for API credentials.',
    requiresContract: true
  },
  FEDEX: {
    hasApi: true,
    apiType: 'REST',
    documentation: 'https://developer.fedex.com/',
    notes: 'Free developer account available. OAuth 2.0 authentication. Track API included in free tier.',
    requiresContract: false
  },
  DHL: {
    hasApi: true,
    apiType: 'REST',
    documentation: 'https://developer.dhl.com/',
    notes: 'Free developer portal. Unified Tracking API available. Requires MyDHL account.',
    requiresContract: false
  },
  UPS: {
    hasApi: true,
    apiType: 'REST',
    documentation: 'https://developer.ups.com/',
    notes: 'Free developer access. Tracking API requires OAuth. Rate limits apply.',
    requiresContract: false
  },
  REDPACK: {
    hasApi: true,
    apiType: 'REST/SOAP',
    documentation: 'Contact Redpack directly',
    notes: 'API access requires business relationship with Redpack.',
    requiresContract: true
  },
  PAQUETEXPRESS: {
    hasApi: true,
    apiType: 'REST',
    documentation: 'Contact Paquetexpress directly',
    notes: 'API requires commercial account. Contact for integration.',
    requiresContract: true
  }
};
