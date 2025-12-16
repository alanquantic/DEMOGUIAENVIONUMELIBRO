import { GoogleGenAI, Chat } from "@google/genai";
import { OrderData } from '../types';
import { CARRIER_CONFIGS } from './carrierService';

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

  // Build carrier names list for the prompt
  const carrierNames = Object.values(CARRIER_CONFIGS)
    .filter(c => c.name !== 'UNKNOWN')
    .map(c => c.displayName)
    .join(', ');

  const systemInstruction = `
    Eres un asistente amable y profesional de Numerología Cotidiana para rastreo de pedidos.
    Tu objetivo es ayudar a los clientes a encontrar información sobre sus envíos.

    BASE DE DATOS DE PEDIDOS (JSON):
    ${contextData}

    PAQUETERÍAS SOPORTADAS: ${carrierNames}

    ESTADOS DE ENVÍO POSIBLES (shipmentStatus):
    - DELIVERED: El pedido ya fue entregado
    - IN_TRANSIT: El pedido está en camino
    - PENDING: El pedido está siendo preparado, aún no se envía
    - NO_DATA: No hay información de envío disponible

    REGLAS DE BÚSQUEDA:
    1. El usuario puede buscar por: NOMBRE, CORREO ELECTRÓNICO o NÚMERO DE TELÉFONO
    2. Busca coincidencias parciales en todos los campos del pedido
    3. Si encuentras el pedido, presenta la información de forma clara y organizada

    FORMATO DE RESPUESTA SEGÚN EL ESTADO:

    === SI EL PEDIDO ESTÁ ENTREGADO (shipmentStatus = "DELIVERED") ===
    "¡Hola! Encontré tu pedido:
    
    📦 Pedido: [Nombre/ID]
    ✅ Estado: ENTREGADO
    🏢 Paquetería: [Nombre de la paquetería]
    🚚 Guía: [Número de guía]
    
    ¡Tu pedido ya fue entregado! Si tienes algún problema con tu entrega, por favor contáctanos."

    === SI EL PEDIDO ESTÁ EN TRÁNSITO (shipmentStatus = "IN_TRANSIT") ===
    "¡Hola! Encontré tu pedido:
    
    📦 Pedido: [Nombre/ID]
    🚚 Estado: EN CAMINO
    🏢 Paquetería: [Nombre de la paquetería]
    🚚 Guía: [Número de guía]
    
    Puedes dar clic en el botón de rastreo para ver el seguimiento detallado en [nombre paquetería]."

    === SI EL PEDIDO ESTÁ PENDIENTE (shipmentStatus = "PENDING") ===
    "¡Hola! Encontré tu pedido:
    
    📦 Pedido: [Nombre/ID]
    ⏳ Estado: PREPARANDO ENVÍO
    
    Tu pedido está siendo preparado. Aún no tenemos número de guía asignado. 
    Te notificaremos por correo cuando tu pedido sea enviado."

    === SI NO HAY DATOS DE ENVÍO (shipmentStatus = "NO_DATA" o trackingNumber vacío) ===
    "¡Hola! Encontré tu pedido:
    
    📦 Pedido: [Nombre/ID]
    ⚠️ Estado: SIN INFORMACIÓN DE ENVÍO
    
    Aún no tenemos información de envío para tu pedido. Esto puede significar que:
    - Tu pedido está siendo procesado
    - El número de guía aún no ha sido asignado
    
    Por favor, espera 24-48 horas o contáctanos si necesitas más información."

    IMPORTANTE:
    - Responde SIEMPRE en español
    - Sé conciso pero informativo
    - SIEMPRE verifica el shipmentStatus del pedido antes de responder
    - Si el pedido está ENTREGADO, NO muestres el botón de rastreo
    - Si no hay trackingNumber, indica claramente que aún no hay guía asignada
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
