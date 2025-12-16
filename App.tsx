import React, { useState, useEffect, useRef } from 'react';
import { fetchMondayOrders } from './services/mondayService';
import { initializeChat, sendMessageToGemini } from './services/geminiService';
import { getTrackingUrl, getCarrierConfig } from './services/carrierService';
import { ChatMessage, ShippingCarrier, OrderData, ShipmentStatus } from './types';
import { 
  MagnifyingGlassIcon, 
  TruckIcon, 
  SparklesIcon,
  PaperAirplaneIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface TrackingInfo {
  trackingNumber: string;
  carrier: ShippingCarrier;
  status: ShipmentStatus;
}

const App: React.FC = () => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Iniciando...');
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [ordersData, setOrdersData] = useState<OrderData[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Defer connection to next tick so UI renders first
    const timer = setTimeout(() => {
      handleConnection();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleConnection = async () => {
    const startTime = performance.now();
    setStatusMessage('Conectando a Monday...');
    
    try {
      const orders = await fetchMondayOrders();
      const fetchTime = Math.round(performance.now() - startTime);
      console.log(`Fetched ${orders.length} orders from Monday in ${fetchTime}ms`);
      
      setStatusMessage('Iniciando asistente IA...');
      setOrdersData(orders);
      initializeChat(orders);
      
      const totalTime = Math.round(performance.now() - startTime);
      console.log(`Total initialization: ${totalTime}ms`);
      
      setIsConfigured(true);
      setStatusMessage('Sistema en línea');
    } catch (error) {
      console.error(error);
      setIsConfigured(false);
      const errorMessage = error instanceof Error ? error.message : 'Error de conexión';
      setStatusMessage(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  };

  /**
   * Detects tracking number, carrier and status from AI response text
   * Uses the orders data to match and find the correct information
   */
  const detectTrackingInfo = (text: string) => {
    // First, try to detect the status from the response text
    let status: ShipmentStatus = 'PENDING';
    
    const statusPatterns: { pattern: RegExp; status: ShipmentStatus }[] = [
      { pattern: /entregado|delivered|✅/i, status: 'DELIVERED' },
      { pattern: /en camino|en tránsito|en transito|shipped|🚚.*estado/i, status: 'IN_TRANSIT' },
      { pattern: /sin información|no tenemos información|sin datos|⚠️/i, status: 'NO_DATA' },
      { pattern: /preparando|procesando|pendiente|⏳/i, status: 'PENDING' }
    ];
    
    for (const { pattern, status: detectedStatus } of statusPatterns) {
      if (pattern.test(text)) {
        status = detectedStatus;
        break;
      }
    }
    
    // Extract tracking number (10-22 digits)
    const trackingMatch = text.match(/\b\d{10,22}\b/);
    
    // If no tracking number found
    if (!trackingMatch) {
      // Check if we should show a "no data" or "pending" card
      if (status === 'NO_DATA' || status === 'PENDING') {
        setTrackingInfo({ trackingNumber: '', carrier: 'UNKNOWN', status });
      }
      return;
    }
    
    const trackingNumber = trackingMatch[0];
    
    // Try to find the order in our data to get the exact carrier and status
    const matchingOrder = ordersData.find(order => order.trackingNumber === trackingNumber);
    
    let carrier: ShippingCarrier = 'UNKNOWN';
    
    if (matchingOrder) {
      carrier = matchingOrder.shippingCarrier;
      status = matchingOrder.shipmentStatus;
    } else {
      // Fallback: try to detect carrier from the response text
      const carrierPatterns = [
        { pattern: /estafeta/i, carrier: 'ESTAFETA' as ShippingCarrier },
        { pattern: /fedex|fed\s*ex/i, carrier: 'FEDEX' as ShippingCarrier },
        { pattern: /dhl/i, carrier: 'DHL' as ShippingCarrier },
        { pattern: /ups/i, carrier: 'UPS' as ShippingCarrier },
        { pattern: /redpack/i, carrier: 'REDPACK' as ShippingCarrier },
        { pattern: /paquetexpress|paquete\s*express/i, carrier: 'PAQUETEXPRESS' as ShippingCarrier }
      ];
      
      for (const { pattern, carrier: detectedCarrier } of carrierPatterns) {
        if (pattern.test(text)) {
          carrier = detectedCarrier;
          break;
        }
      }
    }
    
    setTrackingInfo({ trackingNumber, carrier, status });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !isConfigured) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: searchQuery,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setSearchQuery('');
    setIsLoading(true);
    setHasSearched(true);
    setTrackingInfo(null); // Reset tracking info for new search

    try {
      const responseText = await sendMessageToGemini(userMsg.text);
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMsg]);
      detectTrackingInfo(responseText);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: 'Lo siento, ocurrió un error. Por favor intenta de nuevo.',
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      
      {/* Header */}
      <header className="relative z-10 bg-gradient-to-r from-mystic-800 to-mystic-900">
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* Logo placeholder - replace with actual logo */}
           
            <div>
             <img src="https://app.numerologia-cotidiana.com/wp-content/uploads/2022/05/Logo.png" alt="Numerología Cotidiana" className="w-full h-12" />
              <p className="text-xs text-gold-400 tracking-widest uppercase">
                Rastreo de Envío
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isConfigured ? 'bg-emerald-400' : isInitializing ? 'bg-amber-400' : 'bg-red-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConfigured ? 'bg-emerald-500' : isInitializing ? 'bg-amber-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-xs text-white/80">{statusMessage}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-mystic-900 mb-4">
            Rastrea tu <span className="text-mystic-800">pedido</span>
          </h2>
          <p className="text-mystic-700 max-w-xl mx-auto leading-relaxed">
            Ingresa tu nombre, correo electrónico o número de teléfono con el cual se realizó la compra para consultar el estado de tu envío.
          </p>
        </div>

        {/* Search Box */}
        <div className="bg-gradient-to-br from-mystic-800 to-mystic-900 rounded-2xl p-8 mb-8 shadow-xl">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isInitializing ? "Cargando sistema..." : "Nombre, correo o teléfono..."}
                disabled={!isConfigured || isLoading}
                className="w-full bg-white/10 border border-white/20 rounded-xl py-4 pl-12 pr-4 text-white placeholder-white/50 focus:outline-none focus:border-gold-400/50 focus:ring-2 focus:ring-gold-400/20 transition-all disabled:opacity-50"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!isConfigured || isLoading || !searchQuery.trim()}
              className="gradient-gold hover:opacity-90 text-mystic-900 font-semibold px-8 py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-mystic-900 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-mystic-900 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-mystic-900 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              ) : (
                <>
                  <span>Buscar</span>
                  <PaperAirplaneIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            <span className="text-xs text-white/60">Ejemplos:</span>
            <button 
              onClick={() => setSearchQuery('María García')}
              className="text-xs text-gold-400 hover:text-gold-300 transition-colors"
            >
              "María García"
            </button>
            <span className="text-white/30">•</span>
            <button 
              onClick={() => setSearchQuery('ejemplo@correo.com')}
              className="text-xs text-gold-400 hover:text-gold-300 transition-colors"
            >
              "ejemplo@correo.com"
            </button>
            <span className="text-white/30">•</span>
            <button 
              onClick={() => setSearchQuery('55 1234 5678')}
              className="text-xs text-gold-400 hover:text-gold-300 transition-colors"
            >
              "55 1234 5678"
            </button>
          </div>
        </div>

        {/* Tracking Result Card */}
        {trackingInfo && (
          <TrackingCard trackingInfo={trackingInfo} />
        )}

        {/* Chat/Results Area */}
        {hasSearched && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-mystic-800 to-mystic-900">
              <h3 className="font-display text-lg text-gold-400">Resultados de búsqueda</h3>
            </div>
            
            <div className="p-6 max-h-96 overflow-y-auto space-y-4">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-4 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'gradient-gold text-mystic-900 rounded-br-sm' 
                      : 'bg-gray-100 border border-gray-200 text-mystic-900 rounded-bl-sm'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    <span className={`text-[10px] mt-2 block ${
                      msg.role === 'user' ? 'text-mystic-700' : 'text-gray-500'
                    }`}>
                      {msg.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 border border-gray-200 p-4 rounded-2xl rounded-bl-sm">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-mystic-800 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-mystic-800 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-mystic-800 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Follow-up input */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="¿Tienes alguna otra pregunta?"
                  disabled={!isConfigured || isLoading}
                  className="flex-1 bg-white border border-gray-300 rounded-xl py-3 px-4 text-mystic-900 text-sm placeholder-gray-400 focus:outline-none focus:border-mystic-800 focus:ring-2 focus:ring-mystic-800/20 transition-all disabled:opacity-50"
                />
                <button
                  onClick={handleSearch}
                  disabled={!isConfigured || isLoading || !searchQuery.trim()}
                  className="gradient-gold hover:opacity-90 text-mystic-900 p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info Cards - shown when no search yet */}
        {!hasSearched && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <InfoCard 
              icon={<MagnifyingGlassIcon className="w-6 h-6" />}
              title="Búsqueda Inteligente"
              desc="Encuentra tu pedido con nombre, email o teléfono"
            />
            <InfoCard 
              icon={<TruckIcon className="w-6 h-6" />}
              title="Multi-Paquetería"
              desc="Rastreo en Estafeta, FedEx, DHL, UPS y más"
            />
            <InfoCard 
              icon={<SparklesIcon className="w-6 h-6" />}
              title="Asistente IA"
              desc="Respuestas precisas impulsadas por inteligencia artificial"
            />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-mystic-800 to-mystic-900 py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-white/70 text-sm">
            © {new Date().getFullYear()} Numerología Cotidiana. Powered by Google Gemini
          </p>
          <a 
            href="https://tienda.numerologia-cotidiana.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gold-400 hover:text-gold-300 text-xs mt-2 inline-block transition-colors"
          >
            tienda.numerologia-cotidiana.com
          </a>
        </div>
      </footer>

    </div>
  );
};

const InfoCard: React.FC<{icon: React.ReactNode, title: string, desc: string}> = ({ icon, title, desc }) => (
  <div className="bg-gradient-to-br from-mystic-800 to-mystic-900 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 group">
    <div className="bg-white/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-gold-400 group-hover:bg-gold-400/20 transition-colors">
      {icon}
    </div>
    <h3 className="font-display text-lg font-semibold text-white mb-2">{title}</h3>
    <p className="text-sm text-white/80">{desc}</p>
  </div>
);

const TrackingCard: React.FC<{trackingInfo: TrackingInfo}> = ({ trackingInfo }) => {
  const carrierConfig = getCarrierConfig(trackingInfo.carrier);
  const trackingUrl = getTrackingUrl(trackingInfo.carrier, trackingInfo.trackingNumber);
  const { status, trackingNumber, carrier } = trackingInfo;
  
  // Determine card style based on status
  const getStatusConfig = () => {
    switch (status) {
      case 'DELIVERED':
        return {
          icon: <CheckCircleIcon className="w-6 h-6 text-emerald-400" />,
          iconBg: 'bg-emerald-400/20',
          title: '¡Pedido Entregado!',
          statusBadge: { text: 'ENTREGADO', color: 'bg-emerald-500' }
        };
      case 'IN_TRANSIT':
        return {
          icon: <TruckIcon className="w-6 h-6 text-gold-400" />,
          iconBg: 'bg-gold-400/20',
          title: 'Guía Detectada',
          statusBadge: { text: 'EN CAMINO', color: 'bg-blue-500' }
        };
      case 'PENDING':
        return {
          icon: <ClockIcon className="w-6 h-6 text-amber-400" />,
          iconBg: 'bg-amber-400/20',
          title: 'Pedido en Preparación',
          statusBadge: { text: 'PREPARANDO', color: 'bg-amber-500' }
        };
      case 'NO_DATA':
      default:
        return {
          icon: <ExclamationTriangleIcon className="w-6 h-6 text-orange-400" />,
          iconBg: 'bg-orange-400/20',
          title: 'Sin Información de Envío',
          statusBadge: { text: 'SIN DATOS', color: 'bg-orange-500' }
        };
    }
  };
  
  const statusConfig = getStatusConfig();
  
  return (
    <div className="bg-gradient-to-r from-mystic-800 to-mystic-900 rounded-2xl p-6 mb-8 shadow-lg">
      <div className="flex items-start gap-4">
        <div className={`${statusConfig.iconBg} p-3 rounded-xl`}>
          {statusConfig.icon}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h3 className="font-display text-xl font-semibold text-white">
              {statusConfig.title}
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${statusConfig.statusBadge.color}`}>
              {statusConfig.statusBadge.text}
            </span>
            {carrier !== 'UNKNOWN' && trackingNumber && (
              <span 
                className="px-3 py-1 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: carrierConfig.color }}
              >
                {carrierConfig.displayName}
              </span>
            )}
          </div>
          
          {/* Show tracking number if available */}
          {trackingNumber && (
            <p className="text-gold-400 font-mono text-lg mb-4">{trackingNumber}</p>
          )}
          
          {/* Different content based on status */}
          {status === 'DELIVERED' && (
            <p className="text-white/80 text-sm">
              Tu pedido ha sido entregado exitosamente. Si tienes algún problema con tu entrega, por favor contáctanos.
            </p>
          )}
          
          {status === 'IN_TRANSIT' && trackingUrl && (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 gradient-gold text-mystic-900 font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-all"
            >
              <span>Rastrear en {carrierConfig.displayName}</span>
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
          )}
          
          {status === 'IN_TRANSIT' && !trackingUrl && carrier === 'UNKNOWN' && (
            <p className="text-white/60 text-sm">
              Paquetería no identificada. Por favor verifica el número de guía directamente con tu proveedor.
            </p>
          )}
          
          {status === 'PENDING' && (
            <p className="text-white/80 text-sm">
              Tu pedido está siendo preparado. Te notificaremos por correo cuando sea enviado y tengas tu número de guía.
            </p>
          )}
          
          {status === 'NO_DATA' && (
            <p className="text-white/80 text-sm">
              Aún no tenemos información de envío para tu pedido. Esto puede significar que tu pedido está siendo procesado. 
              Por favor, espera 24-48 horas o contáctanos si necesitas más información.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
