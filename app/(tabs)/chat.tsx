// ...existing code...
import { Mensaje } from "@/src/domain/models/Mensaje";
import { useAuth } from "@/src/presentation/hooks/useAuth";
import { useChat } from "@/src/presentation/hooks/useChat";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function ChatScreen() {
  const {
    mensajes,
    cargando,
    enviando,
    enviarMensaje,
    typingUsers,
    notificarEscribiendo,
  } = useChat();
  const { usuario } = useAuth();
  const [textoMensaje, setTextoMensaje] = useState("");
  const flatListRef = useRef<FlatList>(null);

  // Debounce typing notifications
  const typingTimeoutRef = useRef<number | null>(null);

  // Auto-scroll al final cuando llegan nuevos mensajes
  useEffect(() => {
    if (mensajes.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [mensajes]);

  const handleEnviar = async () => {
    if (!textoMensaje.trim() || enviando) return;

    // Notify stopped typing immediately
    if (usuario) {
      notificarEscribiendo(usuario.id, usuario.email, false);
    }

    const mensaje = textoMensaje;
    setTextoMensaje(""); // Limpiar input inmediatamente

    const resultado = await enviarMensaje(mensaje);

    if (!resultado.success) {
      alert("Error: " + resultado.error);
      setTextoMensaje(mensaje); // Restaurar mensaje si falló
    }
  };

  const handleChangeText = (text: string) => {
    setTextoMensaje(text);

    if (!usuario) return;

    // Notify typing started
    notificarEscribiendo(usuario.id, usuario.email, true);

    // Reset debounce
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    // @ts-ignore - setTimeout returns number in React Native runtime
    typingTimeoutRef.current = setTimeout(() => {
      notificarEscribiendo(usuario.id, usuario.email, false);
      typingTimeoutRef.current = null;
    }, 1500);
  };

  const renderMensaje = ({ item }: { item: Mensaje }) => {
    const esMio = item.usuario_id === usuario?.id;
    const emailUsuario = item.usuario?.email || "diego.mullo@epn.edu.ec";

    return (
      <View
        style={[
          styles.mensajeContainer,
          esMio ? styles.mensajeMio : styles.mensajeOtro,
        ]}
      >
        {/* Always show a small label with the author (use "Tú" when it's the current user) */}
        <Text style={styles.nombreUsuario}>
          {esMio ? emailUsuario : "diego.mullo@epn.edu.ec"}
        </Text>

        <Text
          style={[
            styles.contenidoMensaje,
            esMio && styles.contenidoMensajeMio,
          ]}
        >
          {item.contenido}
        </Text>
        <Text style={[styles.horaMensaje, esMio && styles.horaMensajeMio]}>
          {new Date(item.created_at).toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.textoCargando}>Cargando mensajes...</Text>
      </View>
    );
  }

  // Compose typing indicator text excluding current user
  const otrosEscribiendo = typingUsers
    .filter((t) => t.userId !== usuario?.id)
    .map((t) => t.email);

  const typingText =
    otrosEscribiendo.length === 1
      ? `${otrosEscribiendo[0]} está escribiendo...`
      : otrosEscribiendo.length > 1
      ? `${otrosEscribiendo.join(", ")} están escribiendo...`
      : "";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <FlatList
        ref={flatListRef}
        data={mensajes}
        renderItem={renderMensaje}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {/* Typing indicator (shown above the input) */}
      {typingText ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
          <Text style={{ color: "#666", fontSize: 13 }}>{typingText}</Text>
        </View>
      ) : null}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={textoMensaje}
          onChangeText={handleChangeText}
          placeholder="Escribe un mensaje..."
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.botonEnviar,
            (!textoMensaje.trim() || enviando) && styles.botonDeshabilitado,
          ]}
          onPress={handleEnviar}
          disabled={!textoMensaje.trim() || enviando}
        >
          <Text style={styles.textoBotonEnviar}>
            {enviando ? "..." : "Enviar"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  centrado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  textoCargando: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  listContainer: {
    padding: 16,
  },
  mensajeContainer: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  mensajeMio: {
    alignSelf: "flex-end",
    backgroundColor: "#007AFF",
  },
  mensajeOtro: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  nombreUsuario: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
  },
  contenidoMensaje: {
    fontSize: 16,
    color: "#000",
  },
  contenidoMensajeMio: {
    color: "#FFF",
  },
  horaMensaje: {
    fontSize: 10,
    color: "#999",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  horaMensajeMio: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    fontSize: 16,
  },
  botonEnviar: {
    marginLeft: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#007AFF",
    borderRadius: 20,
    justifyContent: "center",
  },
  botonDeshabilitado: {
    backgroundColor: "#CCC",
  },
  textoBotonEnviar: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
  },
});