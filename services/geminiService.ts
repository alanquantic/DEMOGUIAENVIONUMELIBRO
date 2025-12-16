import { GoogleGenAI, Chat } from "@google/genai";
import { OrderData } from '../types';

// Initialize Gemini with the API Key from environment variables
// Note: In a real production app, ensure this key is not exposed if possible, 
// though client-side apps often require a proxy or constrained keys.
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

let chatSession: Chat | null = null;

/**
 * Initializes the chat session with the order context.
 * We feed the simplified Monday.com data into the system instruction
 * so the model can act as a knowledgeable agent.
 */
export const initializeChat = (orders: OrderData[]) => {
  if (!apiKey) {
    console.error("Gemini API Key is missing.");
    return;
  }

  // Convert orders to a string representation for the context
  const contextData = JSON.stringify(orders, null, 2);

  const systemInstruction = `
    Eres un asistente amable y profesional de Numerología Cotidiana para rastreo de pedidos.
    Tu objetivo es ayudar a los clientes a encontrar información sobre sus envíos.

    BASE DE DATOS DE PEDIDOS (JSON):
    ${contextData}

    REGLAS DE BÚSQUEDA:
    1. El usuario puede buscar por: NOMBRE, CORREO ELECTRÓNICO o NÚMERO DE TELÉFONO
    2. Busca coincidencias parciales en todos los campos del pedido
    3. Si encuentras el pedido, presenta la información de forma clara y organizada

    FORMATO DE RESPUESTA:
    - Saluda brevemente y confirma qué pedido encontraste
    - Muestra el ESTADO del pedido de forma destacada
    - Si hay número de GUÍA/TRACKING (10-22 dígitos), SIEMPRE menciónalo claramente
    - Indica que pueden rastrear en Estafeta usando el botón que aparecerá

    EJEMPLO DE RESPUESTA:
    "¡Hola! Encontré tu pedido:
    
    📦 Pedido: [Nombre/ID]
    📍 Estado: [Estado actual]
    🚚 Guía Estafeta: [Número de guía]
    
    Puedes dar clic en el botón 'Rastrear en Estafeta' para ver el seguimiento detallado."

    IMPORTANTE:
    - Responde SIEMPRE en español
    - Sé conciso pero informativo
    - Si no encuentras el pedido, pide amablemente que verifiquen los datos
    - Mantén un tono cálido y profesional acorde a la marca Numerología Cotidiana
  `;

  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.7,
    },
  });
};

export const sendMessageToGemini = async (message: string): Promise<string> => {
  if (!chatSession) {
    return "Error: La conexión con el asistente no está configurada. Por favor verifica los datos de Monday.";
  }

  try {
    const result = await chatSession.sendMessage({
      message: message
    });
    return result.text || "Lo siento, no pude procesar esa respuesta.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Hubo un error al conectar con la inteligencia artificial. Por favor intenta más tarde.";
  }
};
