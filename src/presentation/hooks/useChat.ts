import { useState, useEffect, useCallback, useRef } from "react";
import { ChatUseCase } from "@/src/domain/useCases/chat/ChatUseCase";
import { Mensaje } from "@/src/domain/models/Mensaje";
import { supabase } from "@/src/data/services/supabaseClient";

const chatUseCase = new ChatUseCase();

export const useChat = () => {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ userId: string; email: string; isTyping?: boolean }[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  
  // Timer para limpiar usuarios que dejaron de escribir
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Obtener usuario actual
  useEffect(() => {
    const obtenerUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const email = await chatUseCase.obtenerEmailUsuario();
        setCurrentUser({ id: user.id, email: email || user.email || 'Anónimo' });
      }
    };
    obtenerUsuario();
  }, []);

  // Cargar mensajes históricos
  const cargarMensajes = useCallback(async () => {
    setCargando(true);
    const mensajesObtenidos = await chatUseCase.obtenerMensajes();
    setMensajes(mensajesObtenidos);
    setCargando(false);
  }, []);

  // Enviar mensaje
  const enviarMensaje = useCallback(async (contenido: string) => {
    if (!contenido.trim()) return { success: false, error: "El mensaje está vacío" };

    setEnviando(true);
    const resultado = await chatUseCase.enviarMensaje(contenido);
    setEnviando(false);

    // Cuando envías un mensaje, dejas de escribir automáticamente
    if (resultado.success && currentUser) {
      await notificarEscribiendo(false);
    }

    return resultado;
  }, [currentUser]);

  // Notificar escribiendo (simplificado)
  const notificarEscribiendo = useCallback(async (isTyping: boolean) => {
    if (!currentUser) return;
    
    await chatUseCase.notificarEscribiendo(
      currentUser.id,
      currentUser.email,
      isTyping
    );
  }, [currentUser]);

  // Eliminar mensaje
  const eliminarMensaje = useCallback(async (mensajeId: string) => {
    const resultado = await chatUseCase.eliminarMensaje(mensajeId);
    if (resultado.success) {
      setMensajes(prev => prev.filter(m => m.id !== mensajeId));
    }
    return resultado;
  }, []);

  // Suscribirse a mensajes y typing
  useEffect(() => {
    cargarMensajes();

    // Suscribirse a nuevos mensajes
    const desuscribir = chatUseCase.suscribirseAMensajes((nuevoMensaje) => {
      setMensajes(prev => {
        if (prev.some(m => m.id === nuevoMensaje.id)) {
          return prev;
        }
        return [...prev, nuevoMensaje];
      });
    });

    // Suscribirse a typing events
    const desuscribirTyping = chatUseCase.suscribirseAEscritura((payload: any) => {
      console.log('🎯 Payload typing recibido:', payload);
      
      const { userId, email, isTyping } = payload;

      // Ignorar nuestros propios eventos de typing
      if (currentUser && userId === currentUser.id) {
        return;
      }

      setTypingUsers(prev => {
        if (!userId) return prev;

        // Limpiar timeout anterior si existe
        const existingTimeout = typingTimeouts.current.get(userId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        // Filtrar entrada existente
        const filtered = prev.filter(p => p.userId !== userId);

        if (isTyping) {
          // Auto-limpiar después de 3 segundos si no recibimos más eventos
          const timeout = setTimeout(() => {
            setTypingUsers(current => current.filter(p => p.userId !== userId));
            typingTimeouts.current.delete(userId);
          }, 3000);

          typingTimeouts.current.set(userId, timeout);

          return [...filtered, { userId, email, isTyping }];
        } else {
          typingTimeouts.current.delete(userId);
          return filtered;
        }
      });
    });

    return () => {
      desuscribir();
      desuscribirTyping();
      
      // Limpiar todos los timeouts
      typingTimeouts.current.forEach(timeout => clearTimeout(timeout));
      typingTimeouts.current.clear();
    };
  }, [cargarMensajes, currentUser]);

  return {
    mensajes,
    cargando,
    enviando,
    enviarMensaje,
    eliminarMensaje,
    recargarMensajes: cargarMensajes,
    typingUsers,
    notificarEscribiendo,
    currentUser,
  };
};