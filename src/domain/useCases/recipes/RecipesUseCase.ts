import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../../data/services/supabaseClient";
import { Receta } from "../../models/Receta";

export class RecipesUseCase {
  // Obtener todas las recetas
  async obtenerRecetas(): Promise<Receta[]> {
    try {
      const { data, error } = await supabase
        .from("recetas")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.log("Error al obtener recetas:", error);
      return [];
    }
  }

  // Buscar recetas por ingrediente
  async buscarPorIngrediente(ingrediente: string): Promise<Receta[]> {
    try {
      const { data, error } = await supabase
        .from("recetas")
        .select("*")
        .contains("ingredientes", [ingrediente])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.log("Error en búsqueda:", error);
      return [];
    }
  }

  // Crear nueva receta
  async crearReceta(
    titulo: string,
    descripcion: string,
    ingredientes: string[],
    chefId: string,
    imagenUri?: string
  ) {
    try {
      let imagenUrl = null;

      // Si hay imagen, la subimos primero
      if (imagenUri) {
        imagenUrl = await this.subirImagen(imagenUri);
      }

      const { data, error } = await supabase
        .from("recetas")
        .insert({
          titulo,
          descripcion,
          ingredientes,
          chef_id: chefId,
          imagen_url: imagenUrl,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, receta: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Actualizar receta existente - ✅ Ahora permite cambiar la imagen
  async actualizarReceta(
    id: string,
    titulo: string,
    descripcion: string,
    ingredientes: string[],
    imagenUri?: string, // ✅ Nuevo parámetro opcional
    imagenActual?: string // ✅ Para eliminar la imagen anterior si existe
  ) {
    try {
      let imagenUrl = imagenActual; // Mantener la imagen actual por defecto

      // Si hay una nueva imagen, la subimos
      if (imagenUri) {
        // Eliminar la imagen anterior del storage si existe
        if (imagenActual) {
          await this.eliminarImagen(imagenActual);
        }
        
        // Subir la nueva imagen
        imagenUrl = await this.subirImagen(imagenUri);
      }

      const { data, error } = await supabase
        .from("recetas")
        .update({
          titulo,
          descripcion,
          ingredientes,
          imagen_url: imagenUrl, // ✅ Actualizar la URL de la imagen
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, receta: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Eliminar receta
  async eliminarReceta(id: string) {
    try {
      // Primero obtenemos la receta para eliminar su imagen
      const { data: receta } = await supabase
        .from("recetas")
        .select("imagen_url")
        .eq("id", id)
        .single();

      // Eliminar la imagen del storage si existe
      if (receta?.imagen_url) {
        await this.eliminarImagen(receta.imagen_url);
      }

      // Eliminar la receta de la base de datos
      const { error } = await supabase.from("recetas").delete().eq("id", id);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Subir imagen a Supabase Storage
  private async subirImagen(uri: string): Promise<string | null> {
    try {
      // Obtener la extensión del archivo
      const extension = uri.split(".").pop();
      const nombreArchivo = `${Date.now()}.${extension}`;

      // Convertir la imagen a blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Subir a Supabase Storage
      const { data, error } = await supabase.storage
        .from("recetas-fotos")
        .upload(nombreArchivo, blob, {
          contentType: `image/${extension}`,
        });

      if (error) throw error;

      // Obtener la URL pública
      const { data: urlData } = supabase.storage
        .from("recetas-fotos")
        .getPublicUrl(nombreArchivo);

      return urlData.publicUrl;
    } catch (error) {
      console.log("Error al subir imagen:", error);
      return null;
    }
  }

  // ✅ Nuevo método para eliminar imagen del storage
  private async eliminarImagen(imagenUrl: string): Promise<void> {
    try {
      // Extraer el nombre del archivo de la URL
      const nombreArchivo = imagenUrl.split("/").pop();
      if (!nombreArchivo) return;

      const { error } = await supabase.storage
        .from("recetas-fotos")
        .remove([nombreArchivo]);

      if (error) {
        console.log("Error al eliminar imagen:", error);
      }
    } catch (error) {
      console.log("Error al eliminar imagen:", error);
    }
  }

  // Seleccionar imagen de la galería
  async seleccionarImagen(): Promise<string | null> {
    try {
      // Pedir permisos
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        alert("Necesitamos permisos para acceder a tus fotos");
        return null;
      }

      // Abrir selector de imágenes
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!resultado.canceled) {
        return resultado.assets[0].uri;
      }

      return null;
    } catch (error) {
      console.log("Error al seleccionar imagen:", error);
      return null;
    }
  }

  // ✅ Nuevo método para tomar foto con la cámara
  async tomarFoto(): Promise<string | null> {
    try {
      // Pedir permisos de cámara
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== "granted") {
        alert("Necesitamos permisos para acceder a tu cámara");
        return null;
      }

      // Abrir cámara
      const resultado = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!resultado.canceled) {
        return resultado.assets[0].uri;
      }

      return null;
    } catch (error) {
      console.log("Error al tomar foto:", error);
      return null;
    }
  }
}