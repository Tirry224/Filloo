/**
 * Types générés depuis la base de données réelle.
 *
 * NE PAS MODIFIER À LA MAIN. Ce fichier est le reflet du schéma déployé ;
 * le corriger à la main ferait exactement ce qu'il est censé empêcher —
 * laisser le code croire à un schéma qui n'existe pas.
 *
 * Pour le régénérer après une migration :
 *   supabase gen types typescript --project-id bfmsruzyrgbndbueikcb
 */

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          actor_role: string | null
          category_id: number | null
          city_id: number | null
          id: number
          merchant_id: string | null
          name: string
          occurred_at: string
          product_id: string | null
          result_count: number | null
          search_query: string | null
        }
        Insert: {
          actor_role?: string | null
          category_id?: number | null
          city_id?: number | null
          id?: never
          merchant_id?: string | null
          name: string
          occurred_at?: string
          product_id?: string | null
          result_count?: number | null
          search_query?: string | null
        }
        Update: {
          actor_role?: string | null
          category_id?: number | null
          city_id?: number | null
          id?: never
          merchant_id?: string | null
          name?: string
          occurred_at?: string
          product_id?: string | null
          result_count?: number | null
          search_query?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: number
          name: string
          position: number
          slug: string
        }
        Insert: {
          id?: number
          name: string
          position?: number
          slug: string
        }
        Update: {
          id?: number
          name?: string
          position?: number
          slug?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          id: number
          name: string
          position: number
        }
        Insert: {
          id?: number
          name: string
          position?: number
        }
        Update: {
          id?: number
          name?: string
          position?: number
        }
        Relationships: []
      }
      conversations: {
        Row: {
          blocked_by: string | null
          client_id: string
          created_at: string
          id: string
          last_message_at: string
          merchant_id: string
        }
        Insert: {
          blocked_by?: string | null
          client_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          merchant_id: string
        }
        Update: {
          blocked_by?: string | null
          client_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          merchant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          address_hint: string | null
          approved_at: string | null
          city_id: number
          created_at: string
          description: string | null
          id: string
          profile_id: string
          rejection_reason: string | null
          shop_name: string
          status: Database["public"]["Enums"]["merchant_status"]
          valider: boolean
          whatsapp_phone: string | null
        }
        Insert: {
          address_hint?: string | null
          approved_at?: string | null
          city_id: number
          created_at?: string
          description?: string | null
          id?: string
          profile_id: string
          rejection_reason?: string | null
          shop_name: string
          status?: Database["public"]["Enums"]["merchant_status"]
          valider?: boolean
          whatsapp_phone?: string | null
        }
        Update: {
          address_hint?: string | null
          approved_at?: string | null
          city_id?: number
          created_at?: string
          description?: string | null
          id?: string
          profile_id?: string
          rejection_reason?: string | null
          shop_name?: string
          status?: Database["public"]["Enums"]["merchant_status"]
          valider?: boolean
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchants_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          product_id: string | null
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          product_id?: string | null
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          product_id?: string | null
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          last_error: string | null
          profile_id: string
          sent_at: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          last_error?: string | null
          profile_id: string
          sent_at?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          last_error?: string | null
          profile_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          position: number
          product_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          position: number
          product_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: number
          contact_count: number
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          is_negotiable: boolean
          merchant_id: string
          price_gnf: number
          status: Database["public"]["Enums"]["product_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category_id: number
          contact_count?: number
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          is_negotiable?: boolean
          merchant_id: string
          price_gnf: number
          status?: Database["public"]["Enums"]["product_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: number
          contact_count?: number
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          is_negotiable?: boolean
          merchant_id?: string
          price_gnf?: number
          status?: Database["public"]["Enums"]["product_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string
          city_id: number | null
          created_at: string
          deleted_at: string | null
          full_name: string
          id: string
          is_deleted: boolean
          is_suspended: boolean
          phone: string
          role: Database["public"]["Enums"]["user_role"]
          suspended_at: string | null
        }
        Insert: {
          auth_user_id: string
          city_id?: number | null
          created_at?: string
          deleted_at?: string | null
          full_name: string
          id?: string
          is_deleted?: boolean
          is_suspended?: boolean
          phone: string
          role: Database["public"]["Enums"]["user_role"]
          suspended_at?: string | null
        }
        Update: {
          auth_user_id?: string
          city_id?: number | null
          created_at?: string
          deleted_at?: string | null
          full_name?: string
          id?: string
          is_deleted?: boolean
          is_suspended?: boolean
          phone?: string
          role?: Database["public"]["Enums"]["user_role"]
          suspended_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_secret: string
          auth_user_id: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          auth_secret: string
          auth_user_id: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          auth_secret?: string
          auth_user_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          handled_at: string | null
          id: string
          reason: string
          reporter_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          id?: string
          reason: string
          reporter_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_merchant: {
        Args: { p_shop_name: string }
        Returns: {
          address_hint: string | null
          approved_at: string | null
          city_id: number
          created_at: string
          description: string | null
          id: string
          profile_id: string
          rejection_reason: string | null
          shop_name: string
          status: Database["public"]["Enums"]["merchant_status"]
          valider: boolean
          whatsapp_phone: string | null
        }
        SetofOptions: {
          from: "*"
          to: "merchants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      conversation_is_open: { Args: { cid: string }; Returns: boolean }
      i_talk_with_merchant: { Args: { mid: string }; Returns: boolean }
      is_active_profile: { Args: { pid: string }; Returns: boolean }
      merchant_is_public: { Args: { mid: string }; Returns: boolean }
      my_merchant_id: { Args: never; Returns: string }
      my_profile_id: {
        Args: { want_role: Database["public"]["Enums"]["user_role"] }
        Returns: string
      }
      owns_profile: { Args: { pid: string }; Returns: boolean }
      photos_orphelines: {
        Args: { age?: unknown; limite?: number }
        Returns: string[]
      }
      purger_mesures: { Args: never; Returns: number }
      reject_merchant: {
        Args: { p_reason: string; p_shop_name: string }
        Returns: {
          address_hint: string | null
          approved_at: string | null
          city_id: number
          created_at: string
          description: string | null
          id: string
          profile_id: string
          rejection_reason: string | null
          shop_name: string
          status: Database["public"]["Enums"]["merchant_status"]
          valider: boolean
          whatsapp_phone: string | null
        }
        SetofOptions: {
          from: "*"
          to: "merchants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resubmit_my_merchant: {
        Args: never
        Returns: {
          address_hint: string | null
          approved_at: string | null
          city_id: number
          created_at: string
          description: string | null
          id: string
          profile_id: string
          rejection_reason: string | null
          shop_name: string
          status: Database["public"]["Enums"]["merchant_status"]
          valider: boolean
          whatsapp_phone: string | null
        }
        SetofOptions: {
          from: "*"
          to: "merchants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_products: {
        Args: {
          p_category_id?: number
          p_city_id?: number
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_sort?: string
        }
        Returns: {
          category_id: number
          category_name: string
          city_id: number
          city_name: string
          contact_count: number
          created_at: string
          image_path: string
          is_featured: boolean
          is_negotiable: boolean
          merchant_id: string
          price_gnf: number
          product_id: string
          shop_name: string
          status: Database["public"]["Enums"]["product_status"]
          title: string
        }[]
      }
    }
    Enums: {
      merchant_status: "pending" | "approved" | "rejected"
      notification_kind:
        | "merchant_approved"
        | "merchant_rejected"
        | "profile_suspended"
      product_status: "draft" | "active" | "sold" | "hidden"
      report_target: "product" | "conversation" | "merchant"
      user_role: "client" | "merchant"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      merchant_status: ["pending", "approved", "rejected"],
      notification_kind: [
        "merchant_approved",
        "merchant_rejected",
        "profile_suspended",
      ],
      product_status: ["draft", "active", "sold", "hidden"],
      report_target: ["product", "conversation", "merchant"],
      user_role: ["client", "merchant"],
    },
  },
} as const
