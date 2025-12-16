import { MondayRawItem, OrderData } from '../types';

const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN || '';
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID || '';

/**
 * Fetches items from a specific Monday.com board.
 * Credentials are loaded from environment variables.
 */
export const fetchMondayOrders = async (): Promise<OrderData[]> => {
  if (!MONDAY_API_TOKEN || !MONDAY_BOARD_ID) {
    throw new Error('Missing Monday.com credentials. Set MONDAY_API_TOKEN and MONDAY_BOARD_ID in .env.local');
  }

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

    const items: MondayRawItem[] = result.data?.boards?.[0]?.items_page?.items || [];

    // Transform complex Monday structure into a clean JSON for the AI
    return items.map(item => {
      const simplifiedValues: Record<string, string> = {};
      
      item.column_values.forEach(col => {
        // We use the text representation of the column
        if (col.text) {
          simplifiedValues[col.id] = col.text;
        }
      });

      return {
        id: item.id,
        name: item.name,
        values: simplifiedValues
      };
    });

  } catch (error) {
    console.error("Monday API Error:", error);
    throw error;
  }
};
