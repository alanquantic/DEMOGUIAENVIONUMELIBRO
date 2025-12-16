export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isError?: boolean;
}

// Supported shipping carriers
export type ShippingCarrier = 'ESTAFETA' | 'FEDEX' | 'DHL' | 'UPS' | 'REDPACK' | 'PAQUETEXPRESS' | 'UNKNOWN';

// Shipment status types
export type ShipmentStatus = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'NO_DATA';

export interface OrderData {
  id: string;
  name: string; // Usually Order ID or Client Name
  values: Record<string, string>; // Simplified key-value pairs of columns
  trackingNumber: string; // Extracted tracking/guide number
  shippingCarrier: ShippingCarrier; // Detected shipping company
  shipmentStatus: ShipmentStatus; // Current shipment status
}

export interface MondayRawItem {
  id: string;
  name: string;
  column_values: {
    id: string;
    text: string;
    title: string;
    value: string;
  }[];
}

export interface CarrierConfig {
  name: string;
  displayName: string;
  trackingUrl: string;
  logo?: string;
  color: string;
}
