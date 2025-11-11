import { supabase } from "@/src/data/services/supabaseClient";
import { Mensaje } from "../../models/Mensaje";
import { RealtimeChannel } from "@supabase/supabase-js";

export class ChatUseCase {
  private channel: RealtimeChannel | null = null;
  private typingChannel: RealtimeChannel | null = null;

  // Obtener mensajes históricos
  async obtenerMensajes(limite: number = 50): Promise<Mensaje[]> {
    try {
      const { data, error } = await supabase
        .from("mensajes")
        .select(`
          *,
          usuarios!fk_usuario(email, rol)
        `)
        .order("created_at", { ascending: false })
        .limit(limite);

      if (error) {
        console.error("Error al obtener mensajes:", error);
        throw error;
      }

      const mensajesFormateados = (data || []).map((msg: any) => ({
        ...msg,
        usuario: msg.usuarios
      }));

      return mensajesFormateados.reverse() as Mensaje[];
    } catch (error) {
      console.error("Error al obtener mensajes:", error);
      return [];
    }
  }

  // Obtener email del usuario actual
  async obtenerEmailUsuario(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("usuarios")
        .select("email")
        .eq("id", user.id)
        .single();

      if (error || !data) {
        return user.email || null;
      }

      return data.email;
    } catch (error) {
      console.error("Error al obtener email:", error);
      return null;
    }
  }

  // Enviar un nuevo mensaje
  async enviarMensaje(contenido: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "Usuario no autenticado" };
      }

      const { error } = await supabase
        .from("mensajes")
        .insert({
          contenido,
          usuario_id: user.id,
        });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error("Error al enviar mensaje:", error);
      return { success: false, error: error.message };
    }
  }

  // Notificar escribiendo (broadcast ligero)
  async notificarEscribiendo(userId: string, email: string, isTyping: boolean) {
    try {
      if (!this.typingChannel) {
        this.typingChannel = supabase.channel('typing-channel');
        await this.typingChannel.subscribe();
      }

      await this.typingChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId,
          email,
          isTyping,
          timestamp: new Date().toISOString(),
        },
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error al notificar escribiendo:", error);
      return { success: false, error: error.message };
    }
  }

  // Suscribirse a nuevos mensajes en tiempo real
  suscribirseAMensajes(callback: (mensaje: Mensaje) => void) {
    this.channel = supabase.channel('mensajes-channel');

    this.channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes'
        },
        async (payload) => {
          console.log('📨 Nuevo mensaje recibido!', payload.new);

          try {
            const { data, error } = await supabase
              .from("mensajes")
              .select(`
                *,
                usuarios!fk_usuario(email, rol)
              `)
              .eq('id', payload.new.id)
              .single();

            if (error) {
              console.error('⚠️ Error al obtener mensaje completo:', error);
              const mensajeFallback: Mensaje = {
                id: payload.new.id,
                contenido: payload.new.contenido,
                usuario_id: payload.new.usuario_id,
                created_at: payload.new.created_at,
                usuario: {
                  email: 'Desconocido',
                  rol: 'usuario'
                }
              };
              callback(mensajeFallback);
              return;
            }

            if (data) {
              const mensajeFormateado: Mensaje = {
                id: data.id,
                contenido: data.contenido,
                usuario_id: data.usuario_id,
                created_at: data.created_at,
                usuario: data.usuarios || { email: 'Desconocido', rol: 'usuario' }
              };

              callback(mensajeFormateado);
            }
          } catch (err) {
            console.error('❌ Error inesperado:', err);
            const mensajeFallback: Mensaje = {
              id: payload.new.id,
              contenido: payload.new.contenido,
              usuario_id: payload.new.usuario_id,
              created_at: payload.new.created_at,
              usuario: {
                email: 'Desconocido',
                rol: 'usuario'
              }
            };
            callback(mensajeFallback);
          }
        }
      )
      .subscribe((status) => {
        console.log('Estado de suscripción:', status);
      });

    return () => {
      if (this.channel) {
        supabase.removeChannel(this.channel);
        this.channel = null;
      }
    };
  }

  // Suscribirse a eventos de "typing" (broadcasts)
  suscribirseAEscritura(callback: (payload: any) => void) {
    this.typingChannel = supabase.channel('typing-channel');

    this.typingChannel
      .on(
        'broadcast',
        { event: 'typing' },
        (broadcastPayload) => {
          // ⚠️ IMPORTANTE: El payload real está en broadcastPayload.payload
          console.log('📝 Evento typing recibido:', broadcastPayload);
          
          if (broadcastPayload && broadcastPayload.payload) {
            callback(broadcastPayload.payload);
          }
        }
      )
      .subscribe((status) => {
        console.log('Estado suscripción typing:', status);
      });

    return () => {
      if (this.typingChannel) {
        supabase.removeChannel(this.typingChannel);
        this.typingChannel = null;
      }
    };
  }

  // Eliminar un mensaje
  async eliminarMensaje(mensajeId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from("mensajes")
        .delete()
        .eq('id', mensajeId);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error("Error al eliminar mensaje:", error);
      return { success: false, error: error.message };
    }
  }
}