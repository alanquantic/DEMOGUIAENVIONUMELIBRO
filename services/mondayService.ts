import { MondayRawItem, OrderData, ShippingCarrier, ShipmentStatus } from '../types';
import { detectCarrier } from './carrierService';

const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN || '';
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID || '';

// Column ID patterns to detect tracking and carrier columns
const TRACKING_COLUMN_PATTERNS = ['guia', 'tracking', 'rastreo', 'numero_guia', 'guía'];
const CARRIER_COLUMN_PATTERNS = ['compania', 'compañia', 'carrier', 'paqueteria', 'paquetería', 'empresa_envio'];
const STATUS_COLUMN_PATTERNS = ['estado', 'status', 'estatus', 'situacion', 'situación'];

// Keywords for detecting shipment status
const DELIVERED_KEYWORDS = ['entregado', 'delivered', 'completado', 'completed', 'finalizado', 'recibido'];
const IN_TRANSIT_KEYWORDS = ['en camino', 'en transito', 'en tránsito', 'enviado', 'shipped', 'transit', 'en ruta'];

interface MondayColumnValue {
  id: string;
  text: string;
  value: string;
  column: {
    title: string;
  };
}

interface MondayItemWithTitles {
  id: string;
  name: string;
  column_values: MondayColumnValue[];
}

/**
 * Checks if a column title matches tracking number patterns
 */
const isTrackingColumn = (title: string): boolean => {
  const normalized = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return TRACKING_COLUMN_PATTERNS.some(pattern => normalized.includes(pattern));
};

/**
 * Checks if a column title matches carrier/company patterns
 */
const isCarrierColumn = (title: string): boolean => {
  const normalized = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return CARRIER_COLUMN_PATTERNS.some(pattern => normalized.includes(pattern));
};

/**
 * Checks if a column title matches status patterns
 */
const isStatusColumn = (title: string): boolean => {
  const normalized = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return STATUS_COLUMN_PATTERNS.some(pattern => normalized.includes(pattern));
};

/**
 * Extracts tracking number from text (10-22 digits)
 */
const extractTrackingNumber = (text: string): string => {
  if (!text) return '';
  const match = text.match(/\b\d{10,22}\b/);
  return match ? match[0] : text.trim();
};

/**
 * Detects shipment status from status text
 */
const detectShipmentStatus = (statusText: string, hasTrackingNumber: boolean): ShipmentStatus => {
  if (!statusText && !hasTrackingNumber) return 'NO_DATA';
  
  const normalized = statusText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Check for delivered status
  if (DELIVERED_KEYWORDS.some(keyword => normalized.includes(keyword))) {
    return 'DELIVERED';
  }
  
  // Check for in transit status
  if (IN_TRANSIT_KEYWORDS.some(keyword => normalized.includes(keyword))) {
    return 'IN_TRANSIT';
  }
  
  // If has tracking number but no clear status, assume in transit
  if (hasTrackingNumber) {
    return 'IN_TRANSIT';
  }
  
  return 'PENDING';
};

/**
 * Fetches items from a specific Monday.com board.
 * Credentials are loaded from environment variables.
 */
export const fetchMondayOrders = async (): Promise<OrderData[]> => {
  if (!MONDAY_API_TOKEN || !MONDAY_BOARD_ID) {
    throw new Error('Missing Monday.com credentials. Set MONDAY_API_TOKEN and MONDAY_BOARD_ID in .env.local');
  }

  // Updated query to include column titles
  const query = `
    query {
      boards (ids: [${MONDAY_BOARD_ID}]) {
        items_page (limit: 50) {
          items {
            id
            name
            column_values {
              id
              text
              value
              column {
                title
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch("https://api.monday.com/v2", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MONDAY_API_TOKEN,
        'API-Version': '2023-10'
      },
      body: JSON.stringify({ query })
    });

    const result = await response.json();

    if (result.errors) {
      throw new Error(result.errors[0]?.message || "Error fetching data from Monday");
    }

    const items: MondayItemWithTitles[] = result.data?.boards?.[0]?.items_page?.items || [];

    // Transform complex Monday structure into a clean JSON for the AI
    return items.map(item => {
      const simplifiedValues: Record<string, string> = {};
      let trackingNumber = '';
      let shippingCarrier: ShippingCarrier = 'UNKNOWN';
      let statusText = '';
      
      item.column_values.forEach(col => {
        const columnTitle = col.column?.title || col.id;
        
        // We use the text representation of the column
        if (col.text) {
          simplifiedValues[columnTitle] = col.text;
          
          // Detect tracking number column
          if (isTrackingColumn(columnTitle) && !trackingNumber) {
            trackingNumber = extractTrackingNumber(col.text);
          }
          
          // Detect carrier column
          if (isCarrierColumn(columnTitle) && shippingCarrier === 'UNKNOWN') {
            shippingCarrier = detectCarrier(col.text);
          }
          
          // Detect status column
          if (isStatusColumn(columnTitle) && !statusText) {
            statusText = col.text;
          }
        }
      });

      const hasTracking = trackingNumber.length > 0;
      const shipmentStatus = detectShipmentStatus(statusText, hasTracking);

      return {
        id: item.id,
        name: item.name,
        values: simplifiedValues,
        trackingNumber,
        shippingCarrier,
        shipmentStatus
      };
    });

  } catch (error) {
    console.error("Monday API Error:", error);
    throw error;
  }
};
