export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isError?: boolean;
}

export interface OrderData {
  id: string;
  name: string; // Usually Order ID or Client Name
  values: Record<string, string>; // Simplified key-value pairs of columns
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
