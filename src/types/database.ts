export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      almacen_materiales: {
        Row: {
          created_at: string | null
          id: string
          nombre: string
          stock_fisico: number | null
          stock_minimo: number | null
          tipo_material: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nombre: string
          stock_fisico?: number | null
          stock_minimo?: number | null
          tipo_material?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nombre?: string
          stock_fisico?: number | null
          stock_minimo?: number | null
          tipo_material?: string | null
        }
        Relationships: []
      }
      almacen_pedidos_transito: {
        Row: {
          cantidad_pedida: number
          estado: string | null
          fecha_llegada: string | null
          id: string
          material_id: string | null
          num_pedido: string | null
        }
        Insert: {
          cantidad_pedida: number
          estado?: string | null
          fecha_llegada?: string | null
          id?: string
          material_id?: string | null
          num_pedido?: string | null
        }
        Update: {
          cantidad_pedida?: number
          estado?: string | null
          fecha_llegada?: string | null
          id?: string
          material_id?: string | null
          num_pedido?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "almacen_pedidos_transito_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "almacen_control_inteligente"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "almacen_pedidos_transito_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "almacen_materiales"
            referencedColumns: ["id"]
          },
        ]
      }
      almacen_reservas: {
        Row: {
          cantidad_bruta: number
          estado: string | null
          fecha_prevista: string | null
          id: string
          material_id: string | null
          ot_num: string
        }
        Insert: {
          cantidad_bruta: number
          estado?: string | null
          fecha_prevista?: string | null
          id?: string
          material_id?: string | null
          ot_num: string
        }
        Update: {
          cantidad_bruta?: number
          estado?: string | null
          fecha_prevista?: string | null
          id?: string
          material_id?: string | null
          ot_num?: string
        }
        Relationships: [
          {
            foreignKeyName: "almacen_reservas_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "almacen_control_inteligente"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "almacen_reservas_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "almacen_materiales"
            referencedColumns: ["id"]
          },
        ]
      }
      minerva_documents: {
        Row: {
          content: string
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      prod_albaran_prov_material: {
        Row: {
          articulo_referencia: string | null
          cantidad_recibida: number | null
          created_at: string
          fecha_albaran: string | null
          formato_ancho: number | null
          formato_largo: number | null
          gramaje: number | null
          id: string
          img_url: string | null
          material_tipo: string | null
          numero_albaran: string | null
          ots: string[] | null
          precio_unitario: number | null
          proveedor: string
          raw_ai_analysis: Json | null
          telegram_user: string | null
          total_hojas: number | null
          total_palets: number | null
          unidad_medida: string | null
        }
        Insert: {
          articulo_referencia?: string | null
          cantidad_recibida?: number | null
          created_at?: string
          fecha_albaran?: string | null
          formato_ancho?: number | null
          formato_largo?: number | null
          gramaje?: number | null
          id?: string
          img_url?: string | null
          material_tipo?: string | null
          numero_albaran?: string | null
          ots?: string[] | null
          precio_unitario?: number | null
          proveedor: string
          raw_ai_analysis?: Json | null
          telegram_user?: string | null
          total_hojas?: number | null
          total_palets?: number | null
          unidad_medida?: string | null
        }
        Update: {
          articulo_referencia?: string | null
          cantidad_recibida?: number | null
          created_at?: string
          fecha_albaran?: string | null
          formato_ancho?: number | null
          formato_largo?: number | null
          gramaje?: number | null
          id?: string
          img_url?: string | null
          material_tipo?: string | null
          numero_albaran?: string | null
          ots?: string[] | null
          precio_unitario?: number | null
          proveedor?: string
          raw_ai_analysis?: Json | null
          telegram_user?: string | null
          total_hojas?: number | null
          total_palets?: number | null
          unidad_medida?: string | null
        }
        Relationships: []
      }
      prod_cajas_embalaje: {
        Row: {
          activo: boolean
          bultos_por_palet_default: number | null
          codigo: string
          con_logo: boolean | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          descripcion: string | null
          id: string
          notas: string | null
          orden: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          bultos_por_palet_default?: number | null
          codigo: string
          con_logo?: boolean | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          descripcion?: string | null
          id?: string
          notas?: string | null
          orden?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          bultos_por_palet_default?: number | null
          codigo?: string
          con_logo?: boolean | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          descripcion?: string | null
          id?: string
          notas?: string | null
          orden?: number
          updated_at?: string
        }
        Relationships: []
      }
      prod_calendario_festivo: {
        Row: {
          activo: boolean
          ambito: string
          codigo_ambito: string | null
          created_at: string
          fecha: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          ambito?: string
          codigo_ambito?: string | null
          created_at?: string
          fecha: string
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          ambito?: string
          codigo_ambito?: string | null
          created_at?: string
          fecha?: string
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      prod_calendario_produccion_nota: {
        Row: {
          created_at: string
          created_by: string | null
          fecha: string
          id: string
          orden: number
          texto: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fecha: string
          id?: string
          orden?: number
          texto: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          orden?: number
          texto?: string
          updated_at?: string
        }
        Relationships: []
      }
      prod_calendario_produccion_ot: {
        Row: {
          ambito: string
          created_at: string
          created_by: string | null
          fecha: string
          id: string
          marcado_hecho: boolean
          marcado_hecho_at: string | null
          marcado_hecho_por: string | null
          notas: string | null
          orden: number
          ot_numero: string
          updated_at: string
        }
        Insert: {
          ambito?: string
          created_at?: string
          created_by?: string | null
          fecha: string
          id?: string
          marcado_hecho?: boolean
          marcado_hecho_at?: string | null
          marcado_hecho_por?: string | null
          notas?: string | null
          orden?: number
          ot_numero: string
          updated_at?: string
        }
        Update: {
          ambito?: string
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          marcado_hecho?: boolean
          marcado_hecho_at?: string | null
          marcado_hecho_por?: string | null
          notas?: string | null
          orden?: number
          ot_numero?: string
          updated_at?: string
        }
        Relationships: []
      }
      prod_cat_acabados: {
        Row: {
          created_at: string | null
          id: string
          nombre: string
          tipo_proveedor_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nombre: string
          tipo_proveedor_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nombre?: string
          tipo_proveedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prod_cat_acabados_tipo_proveedor_id_fkey"
            columns: ["tipo_proveedor_id"]
            isOneToOne: false
            referencedRelation: "prod_cat_tipos_proveedor"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_cat_tipos_proveedor: {
        Row: {
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      prod_compra_material: {
        Row: {
          albaran_proveedor: string | null
          cliente_nombre: string | null
          created_at: string | null
          estado: string | null
          fecha_prevista_recepcion: string | null
          fecha_recepcion: string | null
          fecha_solicitud: string | null
          gramaje: number | null
          id: string
          material: string | null
          notas: string | null
          num_compra: string | null
          num_hojas_brutas: number | null
          num_hojas_netas: number | null
          ot_numero: string | null
          posicion: number | null
          proveedor_id: string | null
          tamano_hoja: string | null
          trabajo_titulo: string | null
        }
        Insert: {
          albaran_proveedor?: string | null
          cliente_nombre?: string | null
          created_at?: string | null
          estado?: string | null
          fecha_prevista_recepcion?: string | null
          fecha_recepcion?: string | null
          fecha_solicitud?: string | null
          gramaje?: number | null
          id?: string
          material?: string | null
          notas?: string | null
          num_compra?: string | null
          num_hojas_brutas?: number | null
          num_hojas_netas?: number | null
          ot_numero?: string | null
          posicion?: number | null
          proveedor_id?: string | null
          tamano_hoja?: string | null
          trabajo_titulo?: string | null
        }
        Update: {
          albaran_proveedor?: string | null
          cliente_nombre?: string | null
          created_at?: string | null
          estado?: string | null
          fecha_prevista_recepcion?: string | null
          fecha_recepcion?: string | null
          fecha_solicitud?: string | null
          gramaje?: number | null
          id?: string
          material?: string | null
          notas?: string | null
          num_compra?: string | null
          num_hojas_brutas?: number | null
          num_hojas_netas?: number | null
          ot_numero?: string | null
          posicion?: number | null
          proveedor_id?: string | null
          tamano_hoja?: string | null
          trabajo_titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prod_compra_material_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "prod_proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_compras_material_comunicacion: {
        Row: {
          asunto: string | null
          compra_ids: string[]
          created_at: string | null
          cuerpo: string | null
          enviado_por: string | null
          id: string
          proveedor_id: string | null
        }
        Insert: {
          asunto?: string | null
          compra_ids: string[]
          created_at?: string | null
          cuerpo?: string | null
          enviado_por?: string | null
          id?: string
          proveedor_id?: string | null
        }
        Update: {
          asunto?: string | null
          compra_ids?: string[]
          created_at?: string | null
          cuerpo?: string | null
          enviado_por?: string | null
          id?: string
          proveedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prod_compras_material_comunicacion_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "prod_proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_comunicacion_logs: {
        Row: {
          created_at: string
          cuerpo: string
          enviado_por: string | null
          id: string
          id_pedidos: number[] | null
          proveedor_id: string | null
        }
        Insert: {
          created_at?: string
          cuerpo: string
          enviado_por?: string | null
          id?: string
          id_pedidos?: number[] | null
          proveedor_id?: string | null
        }
        Update: {
          created_at?: string
          cuerpo?: string
          enviado_por?: string | null
          id?: string
          id_pedidos?: number[] | null
          proveedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prod_comunicacion_logs_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "prod_proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_configuracion: {
        Row: {
          clave: string
          id: string
          updated_at: string
          valor: string
        }
        Insert: {
          clave: string
          id?: string
          updated_at?: string
          valor?: string
        }
        Update: {
          clave?: string
          id?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      prod_despacho_catalogo: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          created_by_email: string | null
          id: string
          label: string
          orden: number
          tipo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          label: string
          orden?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          label?: string
          orden?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      prod_despacho_materiales_lineas: {
        Row: {
          cantidad: number | null
          created_at: string | null
          descripcion: string | null
          id: string
          notas: string | null
          orden: number | null
          ot_numero: string
          soporte_impresion: boolean
          tipo: string | null
          unidad: string | null
          updated_at: string | null
        }
        Insert: {
          cantidad?: number | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          notas?: string | null
          orden?: number | null
          ot_numero: string
          soporte_impresion?: boolean
          tipo?: string | null
          unidad?: string | null
          updated_at?: string | null
        }
        Update: {
          cantidad?: number | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          notas?: string | null
          orden?: number | null
          ot_numero?: string
          soporte_impresion?: boolean
          tipo?: string | null
          unidad?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      prod_etiquetas_calendario_apunte: {
        Row: {
          created_at: string
          fecha: string
          id: string
          orden: number
          texto: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fecha: string
          id?: string
          orden?: number
          texto: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fecha?: string
          id?: string
          orden?: number
          texto?: string
          updated_at?: string
        }
        Relationships: []
      }
      prod_etiquetas_catalogo: {
        Row: {
          activo: boolean
          categoria: string
          created_at: string
          grupo: string | null
          id: string
          label: string
          orden: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria: string
          created_at?: string
          grupo?: string | null
          id?: string
          label: string
          orden?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria?: string
          created_at?: string
          grupo?: string | null
          id?: string
          label?: string
          orden?: number
          updated_at?: string
        }
        Relationships: []
      }
      prod_etiquetas_compras: {
        Row: {
          created_at: string
          enviado: boolean
          enviado_at: string | null
          equipo: string
          fecha_llegada: string | null
          fecha_pedido: string
          id: string
          marca: string
          prioridad: string
          producto: string
          propietario: string
          recibido: boolean
          tipo_linea: string
          unidad: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enviado?: boolean
          enviado_at?: string | null
          equipo?: string
          fecha_llegada?: string | null
          fecha_pedido?: string
          id?: string
          marca: string
          prioridad?: string
          producto: string
          propietario: string
          recibido?: boolean
          tipo_linea: string
          unidad?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enviado?: boolean
          enviado_at?: string | null
          equipo?: string
          fecha_llegada?: string | null
          fecha_pedido?: string
          id?: string
          marca?: string
          prioridad?: string
          producto?: string
          propietario?: string
          recibido?: boolean
          tipo_linea?: string
          unidad?: number
          updated_at?: string
        }
        Relationships: []
      }
      prod_etiquetas_compras_comunicacion: {
        Row: {
          asunto: string
          compra_ids: string[]
          created_at: string
          cuerpo: string
          enviado_por: string | null
          id: string
        }
        Insert: {
          asunto?: string
          compra_ids: string[]
          created_at?: string
          cuerpo?: string
          enviado_por?: string | null
          id?: string
        }
        Update: {
          asunto?: string
          compra_ids?: string[]
          created_at?: string
          cuerpo?: string
          enviado_por?: string | null
          id?: string
        }
        Relationships: []
      }
      prod_etiquetas_hoja_ruta: {
        Row: {
          bobinas: number | null
          cajas: number | null
          cajas_restantes: string | null
          cantidad: number | null
          cliente: string | null
          created_at: string
          etiquetas: number | null
          fecha_entrada_depto: string | null
          fecha_entrega_ot: string | null
          fecha_fin_konica: string | null
          fecha_fin_numeradora: string | null
          fecha_fin_produccion: string | null
          fecha_fin_troqueladora: string | null
          fecha_inicio_produccion: string | null
          fecha_pdf_ok: string | null
          finalizado: boolean
          id: string
          konica: boolean
          metros_impresion: number | null
          numeradora: boolean
          observacion: string | null
          ot_general_id: string | null
          ot_numero: string
          papel: string | null
          pdf_ok: boolean
          trabajo: string | null
          troquel_id: number | null
          troquel_utillaje: string | null
          troqueladora: boolean
          updated_at: string
          urgencia: string
        }
        Insert: {
          bobinas?: number | null
          cajas?: number | null
          cajas_restantes?: string | null
          cantidad?: number | null
          cliente?: string | null
          created_at?: string
          etiquetas?: number | null
          fecha_entrada_depto?: string | null
          fecha_entrega_ot?: string | null
          fecha_fin_konica?: string | null
          fecha_fin_numeradora?: string | null
          fecha_fin_produccion?: string | null
          fecha_fin_troqueladora?: string | null
          fecha_inicio_produccion?: string | null
          fecha_pdf_ok?: string | null
          finalizado?: boolean
          id?: string
          konica?: boolean
          metros_impresion?: number | null
          numeradora?: boolean
          observacion?: string | null
          ot_general_id?: string | null
          ot_numero: string
          papel?: string | null
          pdf_ok?: boolean
          trabajo?: string | null
          troquel_id?: number | null
          troquel_utillaje?: string | null
          troqueladora?: boolean
          updated_at?: string
          urgencia?: string
        }
        Update: {
          bobinas?: number | null
          cajas?: number | null
          cajas_restantes?: string | null
          cantidad?: number | null
          cliente?: string | null
          created_at?: string
          etiquetas?: number | null
          fecha_entrada_depto?: string | null
          fecha_entrega_ot?: string | null
          fecha_fin_konica?: string | null
          fecha_fin_numeradora?: string | null
          fecha_fin_produccion?: string | null
          fecha_fin_troqueladora?: string | null
          fecha_inicio_produccion?: string | null
          fecha_pdf_ok?: string | null
          finalizado?: boolean
          id?: string
          konica?: boolean
          metros_impresion?: number | null
          numeradora?: boolean
          observacion?: string | null
          ot_general_id?: string | null
          ot_numero?: string
          papel?: string | null
          pdf_ok?: boolean
          trabajo?: string | null
          troquel_id?: number | null
          troquel_utillaje?: string | null
          troqueladora?: boolean
          updated_at?: string
          urgencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "prod_etiquetas_hoja_ruta_ot_general_id_fkey"
            columns: ["ot_general_id"]
            isOneToOne: false
            referencedRelation: "prod_ots_general"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_etiquetas_hoja_ruta_troquel_id_fkey"
            columns: ["troquel_id"]
            isOneToOne: false
            referencedRelation: "prod_etiquetas_troqueles"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_etiquetas_hoja_ruta_backup_20260520: {
        Row: {
          bobinas: number | null
          cajas: number | null
          cajas_restantes: string | null
          cantidad: number | null
          cliente: string | null
          created_at: string | null
          etiquetas: number | null
          fecha_entrada_depto: string | null
          fecha_entrega_ot: string | null
          fecha_fin_konica: string | null
          fecha_fin_numeradora: string | null
          fecha_fin_produccion: string | null
          fecha_fin_troqueladora: string | null
          fecha_inicio_produccion: string | null
          finalizado: boolean | null
          id: string | null
          konica: boolean | null
          numeradora: boolean | null
          observacion: string | null
          ot_general_id: string | null
          ot_numero: string | null
          papel: string | null
          trabajo: string | null
          troquel_utillaje: string | null
          troqueladora: boolean | null
          updated_at: string | null
          urgencia: string | null
        }
        Insert: {
          bobinas?: number | null
          cajas?: number | null
          cajas_restantes?: string | null
          cantidad?: number | null
          cliente?: string | null
          created_at?: string | null
          etiquetas?: number | null
          fecha_entrada_depto?: string | null
          fecha_entrega_ot?: string | null
          fecha_fin_konica?: string | null
          fecha_fin_numeradora?: string | null
          fecha_fin_produccion?: string | null
          fecha_fin_troqueladora?: string | null
          fecha_inicio_produccion?: string | null
          finalizado?: boolean | null
          id?: string | null
          konica?: boolean | null
          numeradora?: boolean | null
          observacion?: string | null
          ot_general_id?: string | null
          ot_numero?: string | null
          papel?: string | null
          trabajo?: string | null
          troquel_utillaje?: string | null
          troqueladora?: boolean | null
          updated_at?: string | null
          urgencia?: string | null
        }
        Update: {
          bobinas?: number | null
          cajas?: number | null
          cajas_restantes?: string | null
          cantidad?: number | null
          cliente?: string | null
          created_at?: string | null
          etiquetas?: number | null
          fecha_entrada_depto?: string | null
          fecha_entrega_ot?: string | null
          fecha_fin_konica?: string | null
          fecha_fin_numeradora?: string | null
          fecha_fin_produccion?: string | null
          fecha_fin_troqueladora?: string | null
          fecha_inicio_produccion?: string | null
          finalizado?: boolean | null
          id?: string | null
          konica?: boolean | null
          numeradora?: boolean | null
          observacion?: string | null
          ot_general_id?: string | null
          ot_numero?: string | null
          papel?: string | null
          trabajo?: string | null
          troquel_utillaje?: string | null
          troqueladora?: boolean | null
          updated_at?: string | null
          urgencia?: string | null
        }
        Relationships: []
      }
      prod_etiquetas_hoja_ruta_bkp_20260521_1505_pre_saneo_it: {
        Row: {
          bobinas: number | null
          cajas: number | null
          cajas_restantes: string | null
          cantidad: number | null
          cliente: string | null
          created_at: string | null
          etiquetas: number | null
          fecha_entrada_depto: string | null
          fecha_entrega_ot: string | null
          fecha_fin_konica: string | null
          fecha_fin_numeradora: string | null
          fecha_fin_produccion: string | null
          fecha_fin_troqueladora: string | null
          fecha_inicio_produccion: string | null
          finalizado: boolean | null
          id: string | null
          konica: boolean | null
          numeradora: boolean | null
          observacion: string | null
          ot_general_id: string | null
          ot_numero: string | null
          papel: string | null
          trabajo: string | null
          troquel_utillaje: string | null
          troqueladora: boolean | null
          updated_at: string | null
          urgencia: string | null
        }
        Insert: {
          bobinas?: number | null
          cajas?: number | null
          cajas_restantes?: string | null
          cantidad?: number | null
          cliente?: string | null
          created_at?: string | null
          etiquetas?: number | null
          fecha_entrada_depto?: string | null
          fecha_entrega_ot?: string | null
          fecha_fin_konica?: string | null
          fecha_fin_numeradora?: string | null
          fecha_fin_produccion?: string | null
          fecha_fin_troqueladora?: string | null
          fecha_inicio_produccion?: string | null
          finalizado?: boolean | null
          id?: string | null
          konica?: boolean | null
          numeradora?: boolean | null
          observacion?: string | null
          ot_general_id?: string | null
          ot_numero?: string | null
          papel?: string | null
          trabajo?: string | null
          troquel_utillaje?: string | null
          troqueladora?: boolean | null
          updated_at?: string | null
          urgencia?: string | null
        }
        Update: {
          bobinas?: number | null
          cajas?: number | null
          cajas_restantes?: string | null
          cantidad?: number | null
          cliente?: string | null
          created_at?: string | null
          etiquetas?: number | null
          fecha_entrada_depto?: string | null
          fecha_entrega_ot?: string | null
          fecha_fin_konica?: string | null
          fecha_fin_numeradora?: string | null
          fecha_fin_produccion?: string | null
          fecha_fin_troqueladora?: string | null
          fecha_inicio_produccion?: string | null
          finalizado?: boolean | null
          id?: string | null
          konica?: boolean | null
          numeradora?: boolean | null
          observacion?: string | null
          ot_general_id?: string | null
          ot_numero?: string | null
          papel?: string | null
          trabajo?: string | null
          troquel_utillaje?: string | null
          troqueladora?: boolean | null
          updated_at?: string | null
          urgencia?: string | null
        }
        Relationships: []
      }
      prod_etiquetas_hoja_ruta_bkp_20260521_1536_pre_saneo_n: {
        Row: {
          bobinas: number | null
          cajas: number | null
          cajas_restantes: string | null
          cantidad: number | null
          cliente: string | null
          created_at: string | null
          etiquetas: number | null
          fecha_entrada_depto: string | null
          fecha_entrega_ot: string | null
          fecha_fin_konica: string | null
          fecha_fin_numeradora: string | null
          fecha_fin_produccion: string | null
          fecha_fin_troqueladora: string | null
          fecha_inicio_produccion: string | null
          finalizado: boolean | null
          id: string | null
          konica: boolean | null
          numeradora: boolean | null
          observacion: string | null
          ot_general_id: string | null
          ot_numero: string | null
          papel: string | null
          trabajo: string | null
          troquel_utillaje: string | null
          troqueladora: boolean | null
          updated_at: string | null
          urgencia: string | null
        }
        Insert: {
          bobinas?: number | null
          cajas?: number | null
          cajas_restantes?: string | null
          cantidad?: number | null
          cliente?: string | null
          created_at?: string | null
          etiquetas?: number | null
          fecha_entrada_depto?: string | null
          fecha_entrega_ot?: string | null
          fecha_fin_konica?: string | null
          fecha_fin_numeradora?: string | null
          fecha_fin_produccion?: string | null
          fecha_fin_troqueladora?: string | null
          fecha_inicio_produccion?: string | null
          finalizado?: boolean | null
          id?: string | null
          konica?: boolean | null
          numeradora?: boolean | null
          observacion?: string | null
          ot_general_id?: string | null
          ot_numero?: string | null
          papel?: string | null
          trabajo?: string | null
          troquel_utillaje?: string | null
          troqueladora?: boolean | null
          updated_at?: string | null
          urgencia?: string | null
        }
        Update: {
          bobinas?: number | null
          cajas?: number | null
          cajas_restantes?: string | null
          cantidad?: number | null
          cliente?: string | null
          created_at?: string | null
          etiquetas?: number | null
          fecha_entrada_depto?: string | null
          fecha_entrega_ot?: string | null
          fecha_fin_konica?: string | null
          fecha_fin_numeradora?: string | null
          fecha_fin_produccion?: string | null
          fecha_fin_troqueladora?: string | null
          fecha_inicio_produccion?: string | null
          finalizado?: boolean | null
          id?: string | null
          konica?: boolean | null
          numeradora?: boolean | null
          observacion?: string | null
          ot_general_id?: string | null
          ot_numero?: string | null
          papel?: string | null
          trabajo?: string | null
          troquel_utillaje?: string | null
          troqueladora?: boolean | null
          updated_at?: string | null
          urgencia?: string | null
        }
        Relationships: []
      }
      prod_etiquetas_material_catalogo: {
        Row: {
          activo: boolean
          adhesive: string | null
          backing: string | null
          categoria: string | null
          created_at: string
          ean_code: string | null
          face_name: string | null
          id: string
          item_number: string
          marca: string
          notes: string | null
          price_m2: number | null
          stock_dimensions: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          adhesive?: string | null
          backing?: string | null
          categoria?: string | null
          created_at?: string
          ean_code?: string | null
          face_name?: string | null
          id?: string
          item_number: string
          marca: string
          notes?: string | null
          price_m2?: number | null
          stock_dimensions?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          adhesive?: string | null
          backing?: string | null
          categoria?: string | null
          created_at?: string
          ean_code?: string | null
          face_name?: string | null
          id?: string
          item_number?: string
          marca?: string
          notes?: string | null
          price_m2?: number | null
          stock_dimensions?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prod_etiquetas_stock_bobinas: {
        Row: {
          activo: boolean
          ancho_mm: number | null
          codigo: string
          created_at: string
          fabricante: string
          fecha_pedido: string | null
          fecha_recepcion: string | null
          id: string
          notas: string | null
          papel: string
          ubicacion: string | null
          unidades_stock: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          ancho_mm?: number | null
          codigo?: string
          created_at?: string
          fabricante?: string
          fecha_pedido?: string | null
          fecha_recepcion?: string | null
          id?: string
          notas?: string | null
          papel: string
          ubicacion?: string | null
          unidades_stock?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          ancho_mm?: number | null
          codigo?: string
          created_at?: string
          fabricante?: string
          fecha_pedido?: string | null
          fecha_recepcion?: string | null
          id?: string
          notas?: string | null
          papel?: string
          ubicacion?: string | null
          unidades_stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      prod_etiquetas_troqueles: {
        Row: {
          alto_mm: number | null
          ancho_mm: number | null
          carpeta_original: string | null
          carpeta_path: string | null
          codigo: string
          con_hendido: boolean | null
          created_at: string | null
          diametro_mm: number | null
          dimensiones_texto: string | null
          documentos: Json | null
          especial: boolean | null
          estado: string | null
          fecha_ult_reparacion: string | null
          forma: string | null
          id: number
          multiple: boolean | null
          necesita_revision: boolean | null
          notas: string | null
          updated_at: string | null
        }
        Insert: {
          alto_mm?: number | null
          ancho_mm?: number | null
          carpeta_original?: string | null
          carpeta_path?: string | null
          codigo: string
          con_hendido?: boolean | null
          created_at?: string | null
          diametro_mm?: number | null
          dimensiones_texto?: string | null
          documentos?: Json | null
          especial?: boolean | null
          estado?: string | null
          fecha_ult_reparacion?: string | null
          forma?: string | null
          id?: number
          multiple?: boolean | null
          necesita_revision?: boolean | null
          notas?: string | null
          updated_at?: string | null
        }
        Update: {
          alto_mm?: number | null
          ancho_mm?: number | null
          carpeta_original?: string | null
          carpeta_path?: string | null
          codigo?: string
          con_hendido?: boolean | null
          created_at?: string | null
          diametro_mm?: number | null
          dimensiones_texto?: string | null
          documentos?: Json | null
          especial?: boolean | null
          estado?: string | null
          fecha_ult_reparacion?: string | null
          forma?: string | null
          id?: number
          multiple?: boolean | null
          necesita_revision?: boolean | null
          notas?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      prod_fichas_tecnicas: {
        Row: {
          acabado: string | null
          cliente: string | null
          created_at: string | null
          densidad_1: number | null
          densidad_2: number | null
          densidad_3: number | null
          densidad_4: number | null
          densidad_5: number | null
          densidad_6: number | null
          densidad_7: number | null
          densidad_8: number | null
          fecha: string | null
          formato: string | null
          gramaje: string | null
          id: string
          maquinista: string | null
          notas: string | null
          num_tintas: number | null
          ot: number
          pasadas: number | null
          proveedor_papel: string | null
          ruta_backup: string | null
          tipo_impresion: string | null
          tipo_material: string | null
          tipo_trabajo: string | null
          trabajo: string | null
          updated_at: string | null
        }
        Insert: {
          acabado?: string | null
          cliente?: string | null
          created_at?: string | null
          densidad_1?: number | null
          densidad_2?: number | null
          densidad_3?: number | null
          densidad_4?: number | null
          densidad_5?: number | null
          densidad_6?: number | null
          densidad_7?: number | null
          densidad_8?: number | null
          fecha?: string | null
          formato?: string | null
          gramaje?: string | null
          id?: string
          maquinista?: string | null
          notas?: string | null
          num_tintas?: number | null
          ot: number
          pasadas?: number | null
          proveedor_papel?: string | null
          ruta_backup?: string | null
          tipo_impresion?: string | null
          tipo_material?: string | null
          tipo_trabajo?: string | null
          trabajo?: string | null
          updated_at?: string | null
        }
        Update: {
          acabado?: string | null
          cliente?: string | null
          created_at?: string | null
          densidad_1?: number | null
          densidad_2?: number | null
          densidad_3?: number | null
          densidad_4?: number | null
          densidad_5?: number | null
          densidad_6?: number | null
          densidad_7?: number | null
          densidad_8?: number | null
          fecha?: string | null
          formato?: string | null
          gramaje?: string | null
          id?: string
          maquinista?: string | null
          notas?: string | null
          num_tintas?: number | null
          ot?: number
          pasadas?: number | null
          proveedor_papel?: string | null
          ruta_backup?: string | null
          tipo_impresion?: string | null
          tipo_material?: string | null
          tipo_trabajo?: string | null
          trabajo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      prod_logs_auditoria: {
        Row: {
          accion: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          detalle: string | null
          id: string
          registro_id: string | null
          tabla_afectada: string
        }
        Insert: {
          accion: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detalle?: string | null
          id?: string
          registro_id?: string | null
          tabla_afectada: string
        }
        Update: {
          accion?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detalle?: string | null
          id?: string
          registro_id?: string | null
          tabla_afectada?: string
        }
        Relationships: []
      }
      prod_maquinas: {
        Row: {
          activa: boolean
          capacidad_horas_default_manana: number
          capacidad_horas_default_tarde: number
          codigo: string
          created_at: string
          created_by: string | null
          created_by_email: string | null
          id: string
          nombre: string
          notas: string | null
          orden_visual: number
          tipo_maquina: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          capacidad_horas_default_manana?: number
          capacidad_horas_default_tarde?: number
          codigo: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          nombre: string
          notas?: string | null
          orden_visual?: number
          tipo_maquina: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          capacidad_horas_default_manana?: number
          capacidad_horas_default_tarde?: number
          codigo?: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          orden_visual?: number
          tipo_maquina?: string
          updated_at?: string
        }
        Relationships: []
      }
      prod_mesa_capacidad_turnos: {
        Row: {
          capacidad_horas: number
          created_at: string
          created_by: string | null
          created_by_email: string | null
          fecha: string
          id: string
          maquina_id: string | null
          motivo_ajuste: string | null
          turno: string
          updated_at: string
        }
        Insert: {
          capacidad_horas?: number
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          fecha: string
          id?: string
          maquina_id?: string | null
          motivo_ajuste?: string | null
          turno: string
          updated_at?: string
        }
        Update: {
          capacidad_horas?: number
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          fecha?: string
          id?: string
          maquina_id?: string | null
          motivo_ajuste?: string | null
          turno?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prod_mesa_capacidad_turnos_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "prod_maquinas"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_mesa_ejecuciones: {
        Row: {
          accion_correctiva: string | null
          cantidad_unidades: number | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          densidades_json: Json | null
          estado_ejecucion: string
          fecha_planificada: string | null
          fin_real_at: string | null
          ha_estado_pausada: boolean
          horas_planificadas_snapshot: number | null
          horas_reales: number | null
          horas_reales_engomado: number | null
          horas_reales_entrada: number | null
          horas_reales_tiraje: number | null
          horas_reales_troquelado: number | null
          id: string
          incidencia: string | null
          inicio_real_at: string | null
          liberada_at: string | null
          maquina_id: string
          maquinista: string | null
          mesa_trabajo_id: string | null
          minutos_pausada_acum: number
          num_hojas_producidas: number | null
          num_pausas: number
          observaciones: string | null
          ot_numero: string
          ot_paso_id: string | null
          slot_orden: number | null
          turno: string | null
          updated_at: string
          updated_by: string | null
          updated_by_email: string | null
        }
        Insert: {
          accion_correctiva?: string | null
          cantidad_unidades?: number | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          densidades_json?: Json | null
          estado_ejecucion?: string
          fecha_planificada?: string | null
          fin_real_at?: string | null
          ha_estado_pausada?: boolean
          horas_planificadas_snapshot?: number | null
          horas_reales?: number | null
          horas_reales_engomado?: number | null
          horas_reales_entrada?: number | null
          horas_reales_tiraje?: number | null
          horas_reales_troquelado?: number | null
          id?: string
          incidencia?: string | null
          inicio_real_at?: string | null
          liberada_at?: string | null
          maquina_id: string
          maquinista?: string | null
          mesa_trabajo_id?: string | null
          minutos_pausada_acum?: number
          num_hojas_producidas?: number | null
          num_pausas?: number
          observaciones?: string | null
          ot_numero: string
          ot_paso_id?: string | null
          slot_orden?: number | null
          turno?: string | null
          updated_at?: string
          updated_by?: string | null
          updated_by_email?: string | null
        }
        Update: {
          accion_correctiva?: string | null
          cantidad_unidades?: number | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          densidades_json?: Json | null
          estado_ejecucion?: string
          fecha_planificada?: string | null
          fin_real_at?: string | null
          ha_estado_pausada?: boolean
          horas_planificadas_snapshot?: number | null
          horas_reales?: number | null
          horas_reales_engomado?: number | null
          horas_reales_entrada?: number | null
          horas_reales_tiraje?: number | null
          horas_reales_troquelado?: number | null
          id?: string
          incidencia?: string | null
          inicio_real_at?: string | null
          liberada_at?: string | null
          maquina_id?: string
          maquinista?: string | null
          mesa_trabajo_id?: string | null
          minutos_pausada_acum?: number
          num_hojas_producidas?: number | null
          num_pausas?: number
          observaciones?: string | null
          ot_numero?: string
          ot_paso_id?: string | null
          slot_orden?: number | null
          turno?: string | null
          updated_at?: string
          updated_by?: string | null
          updated_by_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prod_mesa_ejecuciones_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "prod_maquinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_mesa_ejecuciones_mesa_trabajo_id_fkey"
            columns: ["mesa_trabajo_id"]
            isOneToOne: false
            referencedRelation: "prod_mesa_planificacion_trabajos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_mesa_ejecuciones_ot_paso_id_fkey"
            columns: ["ot_paso_id"]
            isOneToOne: false
            referencedRelation: "prod_ot_pasos"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_mesa_ejecuciones_pausas: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          ejecucion_id: string
          id: string
          minutos_pausa: number | null
          motivo: string | null
          motivo_id: string
          observaciones_pausa: string | null
          paused_at: string
          resumed_at: string | null
          updated_at: string
          updated_by: string | null
          updated_by_email: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          ejecucion_id: string
          id?: string
          minutos_pausa?: number | null
          motivo?: string | null
          motivo_id: string
          observaciones_pausa?: string | null
          paused_at: string
          resumed_at?: string | null
          updated_at?: string
          updated_by?: string | null
          updated_by_email?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          ejecucion_id?: string
          id?: string
          minutos_pausa?: number | null
          motivo?: string | null
          motivo_id?: string
          observaciones_pausa?: string | null
          paused_at?: string
          resumed_at?: string | null
          updated_at?: string
          updated_by?: string | null
          updated_by_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prod_mesa_ejecuciones_pausas_ejecucion_id_fkey"
            columns: ["ejecucion_id"]
            isOneToOne: false
            referencedRelation: "prod_mesa_ejecuciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_mesa_ejecuciones_pausas_motivo_id_fkey"
            columns: ["motivo_id"]
            isOneToOne: false
            referencedRelation: "sys_motivos_pausa"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_mesa_planificacion_trabajos: {
        Row: {
          acabado_pral_snapshot: string | null
          barniz_snapshot: string | null
          cliente_snapshot: string | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          estado_mesa: string
          fecha_entrega_snapshot: string | null
          fecha_planificada: string
          horas_planificadas_snapshot: number | null
          id: string
          maquina: string | null
          maquina_id: string | null
          material_status: string | null
          notas: string | null
          num_hojas_brutas_snapshot: number | null
          origen_pool_id: string | null
          ot_numero: string
          papel_snapshot: string | null
          prioridad_snapshot: string | null
          slot_orden: number
          tintas_snapshot: string | null
          troquel_status: string | null
          turno: string | null
          updated_at: string
        }
        Insert: {
          acabado_pral_snapshot?: string | null
          barniz_snapshot?: string | null
          cliente_snapshot?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          estado_mesa?: string
          fecha_entrega_snapshot?: string | null
          fecha_planificada: string
          horas_planificadas_snapshot?: number | null
          id?: string
          maquina?: string | null
          maquina_id?: string | null
          material_status?: string | null
          notas?: string | null
          num_hojas_brutas_snapshot?: number | null
          origen_pool_id?: string | null
          ot_numero: string
          papel_snapshot?: string | null
          prioridad_snapshot?: string | null
          slot_orden: number
          tintas_snapshot?: string | null
          troquel_status?: string | null
          turno?: string | null
          updated_at?: string
        }
        Update: {
          acabado_pral_snapshot?: string | null
          barniz_snapshot?: string | null
          cliente_snapshot?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          estado_mesa?: string
          fecha_entrega_snapshot?: string | null
          fecha_planificada?: string
          horas_planificadas_snapshot?: number | null
          id?: string
          maquina?: string | null
          maquina_id?: string | null
          material_status?: string | null
          notas?: string | null
          num_hojas_brutas_snapshot?: number | null
          origen_pool_id?: string | null
          ot_numero?: string
          papel_snapshot?: string | null
          prioridad_snapshot?: string | null
          slot_orden?: number
          tintas_snapshot?: string | null
          troquel_status?: string | null
          turno?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prod_mesa_planificacion_trabajos_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "prod_maquinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_mesa_planificacion_trabajos_origen_pool_id_fkey"
            columns: ["origen_pool_id"]
            isOneToOne: false
            referencedRelation: "prod_planificacion_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_ot_hija_componentes: {
        Row: {
          cantidad_objetivo: number | null
          created_at: string
          id: string
          orden: number
          ot_hija_numero: string
          poses_en_forma: number
          referencia_codigo: string
          referencia_descripcion: string | null
        }
        Insert: {
          cantidad_objetivo?: number | null
          created_at?: string
          id?: string
          orden?: number
          ot_hija_numero: string
          poses_en_forma: number
          referencia_codigo: string
          referencia_descripcion?: string | null
        }
        Update: {
          cantidad_objetivo?: number | null
          created_at?: string
          id?: string
          orden?: number
          ot_hija_numero?: string
          poses_en_forma?: number
          referencia_codigo?: string
          referencia_descripcion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prod_ot_hija_componentes_ot_hija_fk"
            columns: ["ot_hija_numero"]
            isOneToOne: false
            referencedRelation: "prod_ots_general"
            referencedColumns: ["num_pedido"]
          },
        ]
      }
      prod_ot_pasos: {
        Row: {
          datos_proceso: Json | null
          estado: Database["public"]["Enums"]["paso_estado"] | null
          fecha_disponible: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          maquina_id: string | null
          notas_instrucciones: string | null
          orden: number
          ot_id: string
          proceso_id: number | null
          proveedor_nombre: string | null
        }
        Insert: {
          datos_proceso?: Json | null
          estado?: Database["public"]["Enums"]["paso_estado"] | null
          fecha_disponible?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          maquina_id?: string | null
          notas_instrucciones?: string | null
          orden: number
          ot_id: string
          proceso_id?: number | null
          proveedor_nombre?: string | null
        }
        Update: {
          datos_proceso?: Json | null
          estado?: Database["public"]["Enums"]["paso_estado"] | null
          fecha_disponible?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          maquina_id?: string | null
          notas_instrucciones?: string | null
          orden?: number
          ot_id?: string
          proceso_id?: number | null
          proveedor_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prod_ot_pasos_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "prod_maquinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_ot_pasos_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "prod_procesos_cat"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_ot_producidas: {
        Row: {
          acabado_pral: string | null
          cantidad_pedida: number | null
          cantidad_producida: number | null
          cerrada_at: string
          cerrada_por: string | null
          cliente: string | null
          codigo_caja_embalaje: string | null
          created_at: string
          estuches_por_bulto: number | null
          excluido_de_promedios: boolean
          fecha_cierre: string | null
          fecha_fin_real: string | null
          fecha_inicio_real: string | null
          formato: string | null
          fsc: boolean | null
          gramaje: number | null
          horas_ctp_reales: number | null
          horas_desbroce_reales: number | null
          horas_guillotina_reales: number | null
          horas_prep_engomado_reales: number | null
          horas_prep_impresion_reales: number | null
          horas_prep_troquelado_reales: number | null
          horas_tiraje_engomado_reales: number | null
          horas_tiraje_impresion_reales: number | null
          horas_tiraje_troquelado_reales: number | null
          horas_total_reales: number | null
          id: string
          material: string | null
          merma_total: number | null
          motivo_exclusion: string | null
          observaciones_revision: string | null
          ot_id: string | null
          ot_numero: string
          poses: number | null
          reabierta_at: string | null
          reabierta_desde_id: string | null
          reabierta_por: string | null
          referencia_cliente: string | null
          referencia_id: string | null
          referencia_minerva: string | null
          snapshot: Json
          snapshot_version: number
          tintas: string | null
          tipo_engomado: string | null
          trabajo: string | null
          troquel: string | null
          version: number
        }
        Insert: {
          acabado_pral?: string | null
          cantidad_pedida?: number | null
          cantidad_producida?: number | null
          cerrada_at?: string
          cerrada_por?: string | null
          cliente?: string | null
          codigo_caja_embalaje?: string | null
          created_at?: string
          estuches_por_bulto?: number | null
          excluido_de_promedios?: boolean
          fecha_cierre?: string | null
          fecha_fin_real?: string | null
          fecha_inicio_real?: string | null
          formato?: string | null
          fsc?: boolean | null
          gramaje?: number | null
          horas_ctp_reales?: number | null
          horas_desbroce_reales?: number | null
          horas_guillotina_reales?: number | null
          horas_prep_engomado_reales?: number | null
          horas_prep_impresion_reales?: number | null
          horas_prep_troquelado_reales?: number | null
          horas_tiraje_engomado_reales?: number | null
          horas_tiraje_impresion_reales?: number | null
          horas_tiraje_troquelado_reales?: number | null
          horas_total_reales?: number | null
          id?: string
          material?: string | null
          merma_total?: number | null
          motivo_exclusion?: string | null
          observaciones_revision?: string | null
          ot_id?: string | null
          ot_numero: string
          poses?: number | null
          reabierta_at?: string | null
          reabierta_desde_id?: string | null
          reabierta_por?: string | null
          referencia_cliente?: string | null
          referencia_id?: string | null
          referencia_minerva?: string | null
          snapshot: Json
          snapshot_version?: number
          tintas?: string | null
          tipo_engomado?: string | null
          trabajo?: string | null
          troquel?: string | null
          version?: number
        }
        Update: {
          acabado_pral?: string | null
          cantidad_pedida?: number | null
          cantidad_producida?: number | null
          cerrada_at?: string
          cerrada_por?: string | null
          cliente?: string | null
          codigo_caja_embalaje?: string | null
          created_at?: string
          estuches_por_bulto?: number | null
          excluido_de_promedios?: boolean
          fecha_cierre?: string | null
          fecha_fin_real?: string | null
          fecha_inicio_real?: string | null
          formato?: string | null
          fsc?: boolean | null
          gramaje?: number | null
          horas_ctp_reales?: number | null
          horas_desbroce_reales?: number | null
          horas_guillotina_reales?: number | null
          horas_prep_engomado_reales?: number | null
          horas_prep_impresion_reales?: number | null
          horas_prep_troquelado_reales?: number | null
          horas_tiraje_engomado_reales?: number | null
          horas_tiraje_impresion_reales?: number | null
          horas_tiraje_troquelado_reales?: number | null
          horas_total_reales?: number | null
          id?: string
          material?: string | null
          merma_total?: number | null
          motivo_exclusion?: string | null
          observaciones_revision?: string | null
          ot_id?: string | null
          ot_numero?: string
          poses?: number | null
          reabierta_at?: string | null
          reabierta_desde_id?: string | null
          reabierta_por?: string | null
          referencia_cliente?: string | null
          referencia_id?: string | null
          referencia_minerva?: string | null
          snapshot?: Json
          snapshot_version?: number
          tintas?: string | null
          tipo_engomado?: string | null
          trabajo?: string | null
          troquel?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "prod_ot_producidas_ot_id_fkey"
            columns: ["ot_id"]
            isOneToOne: false
            referencedRelation: "prod_ots_general"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_ot_producidas_reabierta_desde_id_fkey"
            columns: ["reabierta_desde_id"]
            isOneToOne: false
            referencedRelation: "prod_ot_producidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_ot_producidas_referencia_id_fkey"
            columns: ["referencia_id"]
            isOneToOne: false
            referencedRelation: "prod_referencias"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_ots_general: {
        Row: {
          cantidad: number | null
          cliente: string | null
          created_at: string | null
          despachado: boolean | null
          estado_cod: number | null
          estado_desc: string | null
          familia: string | null
          fecha_apertura: string | null
          fecha_entrega: string | null
          forma_descripcion: string | null
          fsc: string | null
          id: string
          muestra_ok: string | null
          num_pedido: string
          originador: string | null
          ot_padre_numero: string | null
          ot_tipo: string
          pdf_ok: string | null
          pedido_cliente: string | null
          prioridad: number | null
          prueba_color: string | null
          tipo_hija: string | null
          tipo_pedido: string | null
          titulo: string | null
          ultima_transaccion: string | null
          updated_at: string | null
          valor_potencial: number | null
          vendedor: string | null
        }
        Insert: {
          cantidad?: number | null
          cliente?: string | null
          created_at?: string | null
          despachado?: boolean | null
          estado_cod?: number | null
          estado_desc?: string | null
          familia?: string | null
          fecha_apertura?: string | null
          fecha_entrega?: string | null
          forma_descripcion?: string | null
          fsc?: string | null
          id?: string
          muestra_ok?: string | null
          num_pedido: string
          originador?: string | null
          ot_padre_numero?: string | null
          ot_tipo?: string
          pdf_ok?: string | null
          pedido_cliente?: string | null
          prioridad?: number | null
          prueba_color?: string | null
          tipo_hija?: string | null
          tipo_pedido?: string | null
          titulo?: string | null
          ultima_transaccion?: string | null
          updated_at?: string | null
          valor_potencial?: number | null
          vendedor?: string | null
        }
        Update: {
          cantidad?: number | null
          cliente?: string | null
          created_at?: string | null
          despachado?: boolean | null
          estado_cod?: number | null
          estado_desc?: string | null
          familia?: string | null
          fecha_apertura?: string | null
          fecha_entrega?: string | null
          forma_descripcion?: string | null
          fsc?: string | null
          id?: string
          muestra_ok?: string | null
          num_pedido?: string
          originador?: string | null
          ot_padre_numero?: string | null
          ot_tipo?: string
          pdf_ok?: string | null
          pedido_cliente?: string | null
          prioridad?: number | null
          prueba_color?: string | null
          tipo_hija?: string | null
          tipo_pedido?: string | null
          titulo?: string | null
          ultima_transaccion?: string | null
          updated_at?: string | null
          valor_potencial?: number | null
          vendedor?: string | null
        }
        Relationships: []
      }
      prod_planificacion_pool: {
        Row: {
          acabado_pral_snapshot: string | null
          closed_at: string | null
          closed_by: string | null
          closed_by_email: string | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          estado_pool: string
          fecha_entrega_snapshot: string | null
          id: string
          material_status: string | null
          notas: string | null
          ot_numero: string
          prioridad_snapshot: string | null
          requiere_troquel: boolean
          troquel_status: string | null
          updated_at: string
        }
        Insert: {
          acabado_pral_snapshot?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closed_by_email?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          estado_pool?: string
          fecha_entrega_snapshot?: string | null
          id?: string
          material_status?: string | null
          notas?: string | null
          ot_numero: string
          prioridad_snapshot?: string | null
          requiere_troquel?: boolean
          troquel_status?: string | null
          updated_at?: string
        }
        Update: {
          acabado_pral_snapshot?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closed_by_email?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          estado_pool?: string
          fecha_entrega_snapshot?: string | null
          id?: string
          material_status?: string | null
          notas?: string | null
          ot_numero?: string
          prioridad_snapshot?: string | null
          requiere_troquel?: boolean
          troquel_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prod_procesos_cat: {
        Row: {
          activo: boolean | null
          es_externo: boolean | null
          id: number
          nombre: string
          orden_sugerido: number | null
          seccion_slug: string
          tipo_planificacion: string | null
        }
        Insert: {
          activo?: boolean | null
          es_externo?: boolean | null
          id?: number
          nombre: string
          orden_sugerido?: number | null
          seccion_slug: string
          tipo_planificacion?: string | null
        }
        Update: {
          activo?: boolean | null
          es_externo?: boolean | null
          id?: number
          nombre?: string
          orden_sugerido?: number | null
          seccion_slug?: string
          tipo_planificacion?: string | null
        }
        Relationships: []
      }
      prod_proveedores: {
        Row: {
          created_at: string | null
          direccion: string | null
          email: string | null
          id: string
          nombre: string
          notas: string | null
          telefono: string | null
          telf_movil: string | null
          tipo_proveedor_id: string | null
        }
        Insert: {
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          nombre: string
          notas?: string | null
          telefono?: string | null
          telf_movil?: string | null
          tipo_proveedor_id?: string | null
        }
        Update: {
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          telefono?: string | null
          telf_movil?: string | null
          tipo_proveedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prod_proveedores_tipo_proveedor_id_fkey"
            columns: ["tipo_proveedor_id"]
            isOneToOne: false
            referencedRelation: "prod_cat_tipos_proveedor"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_recepciones_fotos: {
        Row: {
          created_at: string | null
          foto_url: string
          id: string
          recepcion_id: string
        }
        Insert: {
          created_at?: string | null
          foto_url: string
          id?: string
          recepcion_id: string
        }
        Update: {
          created_at?: string | null
          foto_url?: string
          id?: string
          recepcion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prod_recepciones_fotos_recepcion_id_fkey"
            columns: ["recepcion_id"]
            isOneToOne: false
            referencedRelation: "prod_recepciones_material"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_recepciones_material: {
        Row: {
          albaran_proveedor: string
          cantidad_peso: number | null
          cantidad_peso_unidad: string | null
          compra_id: string | null
          created_at: string | null
          estado_recepcion: string
          fecha_recepcion: string
          formato: string | null
          gramaje: number | null
          hojas_recibidas: number
          id: string
          material_nombre: string | null
          notas: string | null
          palets_recibidos: number | null
          proveedor_id: string | null
          recepcionado_por: string | null
          recepcionado_por_email: string | null
          recepcionado_por_nombre: string | null
          tipo_recepcion: string
        }
        Insert: {
          albaran_proveedor: string
          cantidad_peso?: number | null
          cantidad_peso_unidad?: string | null
          compra_id?: string | null
          created_at?: string | null
          estado_recepcion: string
          fecha_recepcion?: string
          formato?: string | null
          gramaje?: number | null
          hojas_recibidas: number
          id?: string
          material_nombre?: string | null
          notas?: string | null
          palets_recibidos?: number | null
          proveedor_id?: string | null
          recepcionado_por?: string | null
          recepcionado_por_email?: string | null
          recepcionado_por_nombre?: string | null
          tipo_recepcion?: string
        }
        Update: {
          albaran_proveedor?: string
          cantidad_peso?: number | null
          cantidad_peso_unidad?: string | null
          compra_id?: string | null
          created_at?: string | null
          estado_recepcion?: string
          fecha_recepcion?: string
          formato?: string | null
          gramaje?: number | null
          hojas_recibidas?: number
          id?: string
          material_nombre?: string | null
          notas?: string | null
          palets_recibidos?: number | null
          proveedor_id?: string | null
          recepcionado_por?: string | null
          recepcionado_por_email?: string | null
          recepcionado_por_nombre?: string | null
          tipo_recepcion?: string
        }
        Relationships: [
          {
            foreignKeyName: "prod_recepciones_material_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "prod_compra_material"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_recepciones_material_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "prod_proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_referencias: {
        Row: {
          acabado_habitual: string | null
          acabado_oficial: string | null
          acabado_promedio: string | null
          activo: boolean
          caja_embalaje_habitual: string | null
          caja_embalaje_oficial: string | null
          caja_embalaje_promedio: string | null
          cliente: string | null
          codigo: string
          created_at: string | null
          defaults_proceso: Json | null
          descripcion: string | null
          formato_ancho_mm: number | null
          formato_fondo_mm: number | null
          formato_largo_mm: number | null
          fsc: boolean
          fsc_fecha_validacion: string | null
          gramaje_habitual: number | null
          gramaje_muestra_n: number | null
          gramaje_oficial: number | null
          gramaje_promedio: number | null
          horas_desbroce_muestra_n: number | null
          horas_desbroce_oficial: number | null
          horas_desbroce_promedio: number | null
          horas_guillotina_muestra_n: number | null
          horas_guillotina_oficial: number | null
          horas_guillotina_promedio: number | null
          horas_millar_engomado_muestra_n: number | null
          horas_millar_engomado_oficial: number | null
          horas_millar_engomado_promedio: number | null
          horas_millar_impresion_muestra_n: number | null
          horas_millar_impresion_oficial: number | null
          horas_millar_impresion_promedio: number | null
          horas_millar_troquelado_muestra_n: number | null
          horas_millar_troquelado_oficial: number | null
          horas_millar_troquelado_promedio: number | null
          horas_prep_engomado_muestra_n: number | null
          horas_prep_engomado_oficial: number | null
          horas_prep_engomado_promedio: number | null
          horas_prep_impresion_muestra_n: number | null
          horas_prep_impresion_oficial: number | null
          horas_prep_impresion_promedio: number | null
          horas_prep_troquelado_muestra_n: number | null
          horas_prep_troquelado_oficial: number | null
          horas_prep_troquelado_promedio: number | null
          id: string
          material_habitual: string | null
          material_oficial: string | null
          material_promedio: string | null
          merma_muestra_n: number | null
          merma_oficial: number | null
          merma_promedio: number | null
          notas: string | null
          poses_habitual: number | null
          poses_muestra_n: number | null
          poses_oficial: number | null
          poses_promedio: number | null
          promedios_actualizados_at: string | null
          promedios_basados_en_n_ots: number | null
          referencia_cliente: string | null
          ruta_habitual: string | null
          subtipo: string | null
          tintas_habituales: string | null
          tintas_oficial: string | null
          tintas_promedio: string | null
          tipo_engomado_habitual: string | null
          tipo_engomado_oficial: string | null
          tipo_engomado_promedio: string | null
          tipo_producto: string | null
          total_repeticiones: number
          troquel_habitual: string | null
          troquel_oficial: string | null
          troquel_promedio: string | null
          ultima_ot_fecha: string | null
          ultima_ot_numero: string | null
          unidades_por_embalaje_habitual: number | null
          unidades_por_embalaje_muestra_n: number | null
          unidades_por_embalaje_oficial: number | null
          unidades_por_embalaje_promedio: number | null
          updated_at: string | null
        }
        Insert: {
          acabado_habitual?: string | null
          acabado_oficial?: string | null
          acabado_promedio?: string | null
          activo?: boolean
          caja_embalaje_habitual?: string | null
          caja_embalaje_oficial?: string | null
          caja_embalaje_promedio?: string | null
          cliente?: string | null
          codigo: string
          created_at?: string | null
          defaults_proceso?: Json | null
          descripcion?: string | null
          formato_ancho_mm?: number | null
          formato_fondo_mm?: number | null
          formato_largo_mm?: number | null
          fsc?: boolean
          fsc_fecha_validacion?: string | null
          gramaje_habitual?: number | null
          gramaje_muestra_n?: number | null
          gramaje_oficial?: number | null
          gramaje_promedio?: number | null
          horas_desbroce_muestra_n?: number | null
          horas_desbroce_oficial?: number | null
          horas_desbroce_promedio?: number | null
          horas_guillotina_muestra_n?: number | null
          horas_guillotina_oficial?: number | null
          horas_guillotina_promedio?: number | null
          horas_millar_engomado_muestra_n?: number | null
          horas_millar_engomado_oficial?: number | null
          horas_millar_engomado_promedio?: number | null
          horas_millar_impresion_muestra_n?: number | null
          horas_millar_impresion_oficial?: number | null
          horas_millar_impresion_promedio?: number | null
          horas_millar_troquelado_muestra_n?: number | null
          horas_millar_troquelado_oficial?: number | null
          horas_millar_troquelado_promedio?: number | null
          horas_prep_engomado_muestra_n?: number | null
          horas_prep_engomado_oficial?: number | null
          horas_prep_engomado_promedio?: number | null
          horas_prep_impresion_muestra_n?: number | null
          horas_prep_impresion_oficial?: number | null
          horas_prep_impresion_promedio?: number | null
          horas_prep_troquelado_muestra_n?: number | null
          horas_prep_troquelado_oficial?: number | null
          horas_prep_troquelado_promedio?: number | null
          id?: string
          material_habitual?: string | null
          material_oficial?: string | null
          material_promedio?: string | null
          merma_muestra_n?: number | null
          merma_oficial?: number | null
          merma_promedio?: number | null
          notas?: string | null
          poses_habitual?: number | null
          poses_muestra_n?: number | null
          poses_oficial?: number | null
          poses_promedio?: number | null
          promedios_actualizados_at?: string | null
          promedios_basados_en_n_ots?: number | null
          referencia_cliente?: string | null
          ruta_habitual?: string | null
          subtipo?: string | null
          tintas_habituales?: string | null
          tintas_oficial?: string | null
          tintas_promedio?: string | null
          tipo_engomado_habitual?: string | null
          tipo_engomado_oficial?: string | null
          tipo_engomado_promedio?: string | null
          tipo_producto?: string | null
          total_repeticiones?: number
          troquel_habitual?: string | null
          troquel_oficial?: string | null
          troquel_promedio?: string | null
          ultima_ot_fecha?: string | null
          ultima_ot_numero?: string | null
          unidades_por_embalaje_habitual?: number | null
          unidades_por_embalaje_muestra_n?: number | null
          unidades_por_embalaje_oficial?: number | null
          unidades_por_embalaje_promedio?: number | null
          updated_at?: string | null
        }
        Update: {
          acabado_habitual?: string | null
          acabado_oficial?: string | null
          acabado_promedio?: string | null
          activo?: boolean
          caja_embalaje_habitual?: string | null
          caja_embalaje_oficial?: string | null
          caja_embalaje_promedio?: string | null
          cliente?: string | null
          codigo?: string
          created_at?: string | null
          defaults_proceso?: Json | null
          descripcion?: string | null
          formato_ancho_mm?: number | null
          formato_fondo_mm?: number | null
          formato_largo_mm?: number | null
          fsc?: boolean
          fsc_fecha_validacion?: string | null
          gramaje_habitual?: number | null
          gramaje_muestra_n?: number | null
          gramaje_oficial?: number | null
          gramaje_promedio?: number | null
          horas_desbroce_muestra_n?: number | null
          horas_desbroce_oficial?: number | null
          horas_desbroce_promedio?: number | null
          horas_guillotina_muestra_n?: number | null
          horas_guillotina_oficial?: number | null
          horas_guillotina_promedio?: number | null
          horas_millar_engomado_muestra_n?: number | null
          horas_millar_engomado_oficial?: number | null
          horas_millar_engomado_promedio?: number | null
          horas_millar_impresion_muestra_n?: number | null
          horas_millar_impresion_oficial?: number | null
          horas_millar_impresion_promedio?: number | null
          horas_millar_troquelado_muestra_n?: number | null
          horas_millar_troquelado_oficial?: number | null
          horas_millar_troquelado_promedio?: number | null
          horas_prep_engomado_muestra_n?: number | null
          horas_prep_engomado_oficial?: number | null
          horas_prep_engomado_promedio?: number | null
          horas_prep_impresion_muestra_n?: number | null
          horas_prep_impresion_oficial?: number | null
          horas_prep_impresion_promedio?: number | null
          horas_prep_troquelado_muestra_n?: number | null
          horas_prep_troquelado_oficial?: number | null
          horas_prep_troquelado_promedio?: number | null
          id?: string
          material_habitual?: string | null
          material_oficial?: string | null
          material_promedio?: string | null
          merma_muestra_n?: number | null
          merma_oficial?: number | null
          merma_promedio?: number | null
          notas?: string | null
          poses_habitual?: number | null
          poses_muestra_n?: number | null
          poses_oficial?: number | null
          poses_promedio?: number | null
          promedios_actualizados_at?: string | null
          promedios_basados_en_n_ots?: number | null
          referencia_cliente?: string | null
          ruta_habitual?: string | null
          subtipo?: string | null
          tintas_habituales?: string | null
          tintas_oficial?: string | null
          tintas_promedio?: string | null
          tipo_engomado_habitual?: string | null
          tipo_engomado_oficial?: string | null
          tipo_engomado_promedio?: string | null
          tipo_producto?: string | null
          total_repeticiones?: number
          troquel_habitual?: string | null
          troquel_oficial?: string | null
          troquel_promedio?: string | null
          ultima_ot_fecha?: string | null
          ultima_ot_numero?: string | null
          unidades_por_embalaje_habitual?: number | null
          unidades_por_embalaje_muestra_n?: number | null
          unidades_por_embalaje_oficial?: number | null
          unidades_por_embalaje_promedio?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      prod_rutas_plantilla: {
        Row: {
          activo: boolean | null
          creado_at: string | null
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          creado_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean | null
          creado_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      prod_rutas_plantilla_pasos: {
        Row: {
          id: string
          orden: number
          plantilla_id: string | null
          proceso_id: number | null
        }
        Insert: {
          id?: string
          orden: number
          plantilla_id?: string | null
          proceso_id?: number | null
        }
        Update: {
          id?: string
          orden?: number
          plantilla_id?: string | null
          proceso_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prod_rutas_plantilla_pasos_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "prod_rutas_plantilla"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_rutas_plantilla_pasos_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "prod_procesos_cat"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_seguimiento_externos: {
        Row: {
          acabado_id: string | null
          cliente_nombre: string | null
          created_at: string | null
          dias_a_fEntOT: number | null
          dias_en_externo: number | null
          estado: string | null
          f_entrega_ot: string | null
          fecha_entrega_cliente: string | null
          fecha_envio: string | null
          fecha_prevista: string | null
          fecha_recepcion_muelle: string | null
          hojas_enviadas: number | null
          hojas_recibidas_muelle: number | null
          id: string
          id_pedido: number
          notas_logistica: string | null
          num_operacion: number | null
          observaciones: string | null
          orden_diario: number | null
          OT: string | null
          ot_paso_id: string | null
          palets: number | null
          palets_recibidos_muelle: number | null
          pedido_cliente: string | null
          prioridad: string | null
          proveedor_id: string | null
          trabajo_titulo: string | null
          unidades: number | null
          unidades_recibidas_muelle: number | null
          updated_at: string | null
        }
        Insert: {
          acabado_id?: string | null
          cliente_nombre?: string | null
          created_at?: string | null
          dias_a_fEntOT?: number | null
          dias_en_externo?: number | null
          estado?: string | null
          f_entrega_ot?: string | null
          fecha_entrega_cliente?: string | null
          fecha_envio?: string | null
          fecha_prevista?: string | null
          fecha_recepcion_muelle?: string | null
          hojas_enviadas?: number | null
          hojas_recibidas_muelle?: number | null
          id?: string
          id_pedido: number
          notas_logistica?: string | null
          num_operacion?: number | null
          observaciones?: string | null
          orden_diario?: number | null
          OT?: string | null
          ot_paso_id?: string | null
          palets?: number | null
          palets_recibidos_muelle?: number | null
          pedido_cliente?: string | null
          prioridad?: string | null
          proveedor_id?: string | null
          trabajo_titulo?: string | null
          unidades?: number | null
          unidades_recibidas_muelle?: number | null
          updated_at?: string | null
        }
        Update: {
          acabado_id?: string | null
          cliente_nombre?: string | null
          created_at?: string | null
          dias_a_fEntOT?: number | null
          dias_en_externo?: number | null
          estado?: string | null
          f_entrega_ot?: string | null
          fecha_entrega_cliente?: string | null
          fecha_envio?: string | null
          fecha_prevista?: string | null
          fecha_recepcion_muelle?: string | null
          hojas_enviadas?: number | null
          hojas_recibidas_muelle?: number | null
          id?: string
          id_pedido?: number
          notas_logistica?: string | null
          num_operacion?: number | null
          observaciones?: string | null
          orden_diario?: number | null
          OT?: string | null
          ot_paso_id?: string | null
          palets?: number | null
          palets_recibidos_muelle?: number | null
          pedido_cliente?: string | null
          prioridad?: string | null
          proveedor_id?: string | null
          trabajo_titulo?: string | null
          unidades?: number | null
          unidades_recibidas_muelle?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prod_seguimiento_externos_acabado_id_fkey"
            columns: ["acabado_id"]
            isOneToOne: false
            referencedRelation: "prod_cat_acabados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_seguimiento_externos_ot_paso_id_fkey"
            columns: ["ot_paso_id"]
            isOneToOne: false
            referencedRelation: "prod_ot_pasos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_seguimiento_externos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "prod_proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_stock_movimientos: {
        Row: {
          autorizado_por: string | null
          cantidad: number
          created_at: string
          created_by: string | null
          id: string
          notas: string | null
          ot_destino_numero: string | null
          ot_numero: string | null
          ot_origen_numero: string | null
          palet_id: string
          paso_id: string | null
          tipo: string
        }
        Insert: {
          autorizado_por?: string | null
          cantidad: number
          created_at?: string
          created_by?: string | null
          id?: string
          notas?: string | null
          ot_destino_numero?: string | null
          ot_numero?: string | null
          ot_origen_numero?: string | null
          palet_id: string
          paso_id?: string | null
          tipo: string
        }
        Update: {
          autorizado_por?: string | null
          cantidad?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notas?: string | null
          ot_destino_numero?: string | null
          ot_numero?: string | null
          ot_origen_numero?: string | null
          palet_id?: string
          paso_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "prod_stock_movimientos_palet_id_fkey"
            columns: ["palet_id"]
            isOneToOne: false
            referencedRelation: "prod_stock_palets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_stock_movimientos_palet_id_fkey"
            columns: ["palet_id"]
            isOneToOne: false
            referencedRelation: "stock_palets_atp"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_stock_palet_ots: {
        Row: {
          cantidad_reservada: number | null
          created_at: string
          id: string
          ot_numero: string
          palet_id: string
        }
        Insert: {
          cantidad_reservada?: number | null
          created_at?: string
          id?: string
          ot_numero: string
          palet_id: string
        }
        Update: {
          cantidad_reservada?: number | null
          created_at?: string
          id?: string
          ot_numero?: string
          palet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prod_stock_palet_ots_palet_id_fkey"
            columns: ["palet_id"]
            isOneToOne: false
            referencedRelation: "prod_stock_palets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_stock_palet_ots_palet_id_fkey"
            columns: ["palet_id"]
            isOneToOne: false
            referencedRelation: "stock_palets_atp"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_stock_palets: {
        Row: {
          cantidad_actual: number
          cantidad_inicial: number
          cantidad_peso: number | null
          cantidad_peso_unidad: string | null
          codigo_articulo: string | null
          compra_id: string | null
          coste: number | null
          created_at: string
          created_by: string | null
          descripcion_material: string | null
          es_fsc: boolean
          es_pefc: boolean
          es_prueba: boolean
          estado: string
          formato: string | null
          fsc_certificado_proveedor: string | null
          gramaje: number | null
          id: string
          id_stock: number
          last_seen_in_optimus_import_at: string | null
          marca: string | null
          material_nombre: string | null
          nota_entrega: string | null
          notas: string | null
          ot_destino_numero: string | null
          pefc_certificado_proveedor: string | null
          recepcion_id: string | null
          ref_lote: string | null
          ref_lote_proveedor: string | null
          tipo_stock: string
          ubicacion_fila: string | null
          unidad: string
          updated_at: string
        }
        Insert: {
          cantidad_actual?: number
          cantidad_inicial?: number
          cantidad_peso?: number | null
          cantidad_peso_unidad?: string | null
          codigo_articulo?: string | null
          compra_id?: string | null
          coste?: number | null
          created_at?: string
          created_by?: string | null
          descripcion_material?: string | null
          es_fsc?: boolean
          es_pefc?: boolean
          es_prueba?: boolean
          estado?: string
          formato?: string | null
          fsc_certificado_proveedor?: string | null
          gramaje?: number | null
          id?: string
          id_stock?: number
          last_seen_in_optimus_import_at?: string | null
          marca?: string | null
          material_nombre?: string | null
          nota_entrega?: string | null
          notas?: string | null
          ot_destino_numero?: string | null
          pefc_certificado_proveedor?: string | null
          recepcion_id?: string | null
          ref_lote?: string | null
          ref_lote_proveedor?: string | null
          tipo_stock?: string
          ubicacion_fila?: string | null
          unidad?: string
          updated_at?: string
        }
        Update: {
          cantidad_actual?: number
          cantidad_inicial?: number
          cantidad_peso?: number | null
          cantidad_peso_unidad?: string | null
          codigo_articulo?: string | null
          compra_id?: string | null
          coste?: number | null
          created_at?: string
          created_by?: string | null
          descripcion_material?: string | null
          es_fsc?: boolean
          es_pefc?: boolean
          es_prueba?: boolean
          estado?: string
          formato?: string | null
          fsc_certificado_proveedor?: string | null
          gramaje?: number | null
          id?: string
          id_stock?: number
          last_seen_in_optimus_import_at?: string | null
          marca?: string | null
          material_nombre?: string | null
          nota_entrega?: string | null
          notas?: string | null
          ot_destino_numero?: string | null
          pefc_certificado_proveedor?: string | null
          recepcion_id?: string | null
          ref_lote?: string | null
          ref_lote_proveedor?: string | null
          tipo_stock?: string
          ubicacion_fila?: string | null
          unidad?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prod_stock_palets_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "prod_compra_material"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_stock_palets_recepcion_id_fkey"
            columns: ["recepcion_id"]
            isOneToOne: false
            referencedRelation: "prod_recepciones_material"
            referencedColumns: ["id"]
          },
        ]
      }
      prod_troqueles: {
        Row: {
          caucho_acrilico: string | null
          cliente: string | null
          created_at: string | null
          descripcion: string | null
          expulsion: string | null
          fecha_ultima_fab: string | null
          figuras_hoja: string | null
          formato_papel: string | null
          id: string
          maquina: string | null
          material: string | null
          mides: string | null
          notas: string | null
          num_expulsion: string | null
          num_figuras: string | null
          num_troquel: string
          pinza: string | null
          plancha_hendidos: string | null
          proveedor: string | null
          ref_proveedor: string | null
          relieve_seco: string | null
          taco: string | null
          tipo_producto: string | null
        }
        Insert: {
          caucho_acrilico?: string | null
          cliente?: string | null
          created_at?: string | null
          descripcion?: string | null
          expulsion?: string | null
          fecha_ultima_fab?: string | null
          figuras_hoja?: string | null
          formato_papel?: string | null
          id?: string
          maquina?: string | null
          material?: string | null
          mides?: string | null
          notas?: string | null
          num_expulsion?: string | null
          num_figuras?: string | null
          num_troquel: string
          pinza?: string | null
          plancha_hendidos?: string | null
          proveedor?: string | null
          ref_proveedor?: string | null
          relieve_seco?: string | null
          taco?: string | null
          tipo_producto?: string | null
        }
        Update: {
          caucho_acrilico?: string | null
          cliente?: string | null
          created_at?: string | null
          descripcion?: string | null
          expulsion?: string | null
          fecha_ultima_fab?: string | null
          figuras_hoja?: string | null
          formato_papel?: string | null
          id?: string
          maquina?: string | null
          material?: string | null
          mides?: string | null
          notas?: string | null
          num_expulsion?: string | null
          num_figuras?: string | null
          num_troquel?: string
          pinza?: string | null
          plancha_hendidos?: string | null
          proveedor?: string | null
          ref_proveedor?: string | null
          relieve_seco?: string | null
          taco?: string | null
          tipo_producto?: string | null
        }
        Relationships: []
      }
      prod_troqueles_config: {
        Row: {
          caucho_path: string | null
          etiquetas_troqueles_path: string | null
          id: number
          pdf_path: string | null
        }
        Insert: {
          caucho_path?: string | null
          etiquetas_troqueles_path?: string | null
          id?: number
          pdf_path?: string | null
        }
        Update: {
          caucho_path?: string | null
          etiquetas_troqueles_path?: string | null
          id?: number
          pdf_path?: string | null
        }
        Relationships: []
      }
      produccion_ot_despachadas: {
        Row: {
          acabado_pral: string | null
          despachado_at: string | null
          estado_material: string | null
          gramaje: number | null
          horas_engomado_preparacion: number | null
          horas_engomado_tiraje: number | null
          horas_entrada: number | null
          horas_estimadas_engomado: number | null
          horas_estimadas_troquelado: number | null
          horas_tiraje: number | null
          id: string
          material: string | null
          notas: string | null
          num_hojas_brutas: number | null
          num_hojas_netas: number | null
          ot_anterior_id: string | null
          ot_anterior_numero: string | null
          ot_numero: string
          poses: number | null
          referencia_id: string | null
          tamano_hoja: string | null
          tintas: string | null
          tipo_engomado: string | null
          troquel: string | null
        }
        Insert: {
          acabado_pral?: string | null
          despachado_at?: string | null
          estado_material?: string | null
          gramaje?: number | null
          horas_engomado_preparacion?: number | null
          horas_engomado_tiraje?: number | null
          horas_entrada?: number | null
          horas_estimadas_engomado?: number | null
          horas_estimadas_troquelado?: number | null
          horas_tiraje?: number | null
          id?: string
          material?: string | null
          notas?: string | null
          num_hojas_brutas?: number | null
          num_hojas_netas?: number | null
          ot_anterior_id?: string | null
          ot_anterior_numero?: string | null
          ot_numero: string
          poses?: number | null
          referencia_id?: string | null
          tamano_hoja?: string | null
          tintas?: string | null
          tipo_engomado?: string | null
          troquel?: string | null
        }
        Update: {
          acabado_pral?: string | null
          despachado_at?: string | null
          estado_material?: string | null
          gramaje?: number | null
          horas_engomado_preparacion?: number | null
          horas_engomado_tiraje?: number | null
          horas_entrada?: number | null
          horas_estimadas_engomado?: number | null
          horas_estimadas_troquelado?: number | null
          horas_tiraje?: number | null
          id?: string
          material?: string | null
          notas?: string | null
          num_hojas_brutas?: number | null
          num_hojas_netas?: number | null
          ot_anterior_id?: string | null
          ot_anterior_numero?: string | null
          ot_numero?: string
          poses?: number | null
          referencia_id?: string | null
          tamano_hoja?: string | null
          tintas?: string | null
          tipo_engomado?: string | null
          troquel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produccion_ot_despachadas_referencia_id_fkey"
            columns: ["referencia_id"]
            isOneToOne: false
            referencedRelation: "prod_referencias"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          puede_cerrar_ot: boolean
          puede_reabrir_ot: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          puede_cerrar_ot?: boolean
          puede_reabrir_ot?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          puede_cerrar_ot?: boolean
          puede_reabrir_ot?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          id: string
          is_enabled: boolean | null
          module_name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          id?: string
          is_enabled?: boolean | null
          module_name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          id?: string
          is_enabled?: boolean | null
          module_name?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      sys_motivos_pausa: {
        Row: {
          activo: boolean
          categoria: string
          color_hex: string
          created_at: string
          id: string
          label: string
          orden: number
          slug: string
          tipos_maquina: string[] | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria: string
          color_hex: string
          created_at?: string
          id?: string
          label: string
          orden?: number
          slug: string
          tipos_maquina?: string[] | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria?: string
          color_hex?: string
          created_at?: string
          id?: string
          label?: string
          orden?: number
          slug?: string
          tipos_maquina?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      sys_parametros: {
        Row: {
          clave: string
          descripcion: string | null
          id: string
          seccion: string
          updated_at: string
          valor_num: number | null
          valor_text: string | null
        }
        Insert: {
          clave: string
          descripcion?: string | null
          id?: string
          seccion: string
          updated_at?: string
          valor_num?: number | null
          valor_text?: string | null
        }
        Update: {
          clave?: string
          descripcion?: string | null
          id?: string
          seccion?: string
          updated_at?: string
          valor_num?: number | null
          valor_text?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      almacen_control_inteligente: {
        Row: {
          disponible_real: number | null
          material: string | null
          material_id: string | null
          pedido_pendiente: number | null
          reservado_total: number | null
          stock_fisico: number | null
          stock_minimo: number | null
        }
        Relationships: []
      }
      stock_palets_atp: {
        Row: {
          cantidad_fisica: number | null
          cantidad_inicial: number | null
          cantidad_libre: number | null
          cantidad_reservada_total: number | null
          codigo_articulo: string | null
          compra_id: string | null
          coste: number | null
          created_at: string | null
          descripcion_material: string | null
          es_fsc: boolean | null
          es_pefc: boolean | null
          es_prueba: boolean | null
          estado_derivado: string | null
          estado_legacy: string | null
          formato: string | null
          gramaje: number | null
          id: string | null
          id_stock: number | null
          marca: string | null
          material_nombre: string | null
          nota_entrega: string | null
          ot_destino_numero: string | null
          ots_referenciadas: number | null
          recepcion_id: string | null
          ref_lote: string | null
          ref_lote_proveedor: string | null
          reservas_duras: number | null
          sobre_reservado: boolean | null
          tipo_stock: string | null
          ubicacion_fila: string | null
          unidad: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prod_stock_palets_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "prod_compra_material"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prod_stock_palets_recepcion_id_fkey"
            columns: ["recepcion_id"]
            isOneToOne: false
            referencedRelation: "prod_recepciones_material"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calendario_produccion_can_read: { Args: never; Returns: boolean }
      calendario_produccion_can_write_ambito: {
        Args: { p_ambito: string }
        Returns: boolean
      }
      match_documents: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      next_id_stock_sandbox: { Args: never; Returns: number }
      prod_ots_proximo_paso_externo_queue: {
        Args: never
        Returns: {
          cliente: string
          fecha_entrega: string
          ot_id: string
          ot_numero: string
          ot_paso_id: string
          proceso_nombre: string
          trabajo_titulo: string
        }[]
      }
      prod_stock_ajustar_cantidad: {
        Args: { p_notas?: string; p_nueva_cantidad: number; p_palet_id: string }
        Returns: undefined
      }
      prod_stock_asignar_palet_ot: {
        Args: {
          p_cantidad_reservada?: number
          p_notas?: string
          p_ot_numero: string
          p_palet_id: string
        }
        Returns: undefined
      }
      prod_stock_liberar_reserva: {
        Args: {
          p_autorizado_por: string
          p_notas?: string
          p_nuevo_formato?: string
          p_ot_numero: string
          p_palet_id: string
        }
        Returns: undefined
      }
      prod_stock_registrar_consumo: {
        Args: {
          p_cantidad: number
          p_notas?: string
          p_ot_numero: string
          p_palet_id: string
          p_paso_id?: string
        }
        Returns: undefined
      }
      prod_stock_revertir_consumo: {
        Args: {
          p_autorizado_por: string
          p_cantidad: number
          p_notas?: string
          p_nueva_cantidad?: number
          p_nuevo_formato?: string
          p_ot_numero: string
          p_palet_id: string
          p_paso_id?: string
        }
        Returns: undefined
      }
      prod_stock_split_palet: {
        Args: { p_cantidad_split: number; p_notas?: string; p_palet_id: string }
        Returns: {
          new_id_stock: number
          new_palet_id: string
        }[]
      }
      prod_stock_sync_id_stock_seq: { Args: never; Returns: number }
      puede_cerrar_ot_actual: { Args: never; Returns: boolean }
      puede_reabrir_ot_actual: { Args: never; Returns: boolean }
    }
    Enums: {
      paso_estado:
        | "pendiente"
        | "disponible"
        | "en_marcha"
        | "pausado"
        | "finalizado"
      user_role:
        | "admin"
        | "comercial"
        | "produccion"
        | "oficina_tecnica"
        | "administracion"
        | "CTP"
        | "gerencia"
        | "logistica"
        | "ctp"
        | "almacen"
        | "impresion"
        | "digital"
        | "troquelado"
        | "engomado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      paso_estado: [
        "pendiente",
        "disponible",
        "en_marcha",
        "pausado",
        "finalizado",
      ],
      user_role: [
        "admin",
        "comercial",
        "produccion",
        "oficina_tecnica",
        "administracion",
        "CTP",
        "gerencia",
        "logistica",
        "ctp",
        "almacen",
        "impresion",
        "digital",
        "troquelado",
        "engomado",
      ],
    },
  },
} as const

// ─── NOTE: helpers Tables/TablesInsert/TablesUpdate/Enums ya incluidos
//     por el generador Supabase (líneas ~3629+). No duplicar aquí.

