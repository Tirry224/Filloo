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
      abonnements: {
        Row: {
          created_at: string
          creee_par_equipe: string | null
          debut_at: string | null
          decidee_at: string | null
          decidee_par: string | null
          fin_at: string | null
          formule: string
          id: string
          merchant_id: string
          motif: string | null
          paiement_confirme_at: string | null
          paiement_confirme_par: string | null
          paiement_declare_at: string | null
          paiement_moyen: string | null
          paiement_numero: string | null
          paiement_reference: string | null
          prix_gnf: number
          rembourse_at: string | null
          rembourse_par: string | null
          statut: string
        }
        Insert: {
          created_at?: string
          creee_par_equipe?: string | null
          debut_at?: string | null
          decidee_at?: string | null
          decidee_par?: string | null
          fin_at?: string | null
          formule: string
          id?: string
          merchant_id: string
          motif?: string | null
          paiement_confirme_at?: string | null
          paiement_confirme_par?: string | null
          paiement_declare_at?: string | null
          paiement_moyen?: string | null
          paiement_numero?: string | null
          paiement_reference?: string | null
          prix_gnf: number
          rembourse_at?: string | null
          rembourse_par?: string | null
          statut?: string
        }
        Update: {
          created_at?: string
          creee_par_equipe?: string | null
          debut_at?: string | null
          decidee_at?: string | null
          decidee_par?: string | null
          fin_at?: string | null
          formule?: string
          id?: string
          merchant_id?: string
          motif?: string | null
          paiement_confirme_at?: string | null
          paiement_confirme_par?: string | null
          paiement_declare_at?: string | null
          paiement_moyen?: string | null
          paiement_numero?: string | null
          paiement_reference?: string | null
          prix_gnf?: number
          rembourse_at?: string | null
          rembourse_par?: string | null
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "abonnements_creee_par_equipe_fkey"
            columns: ["creee_par_equipe"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "abonnements_decidee_par_fkey"
            columns: ["decidee_par"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "abonnements_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonnements_paiement_confirme_par_fkey"
            columns: ["paiement_confirme_par"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "abonnements_rembourse_par_fkey"
            columns: ["rembourse_par"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          actor_role: string | null
          campagne_id: string | null
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
          campagne_id?: string | null
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
          campagne_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "analytics_events_campagne_id_fkey"
            columns: ["campagne_id"]
            isOneToOne: false
            referencedRelation: "campagnes"
            referencedColumns: ["id"]
          },
        ]
      }
      annonce_destinataires: {
        Row: {
          annonce_id: string
          auth_user_id: string
          lue_at: string | null
        }
        Insert: {
          annonce_id: string
          auth_user_id: string
          lue_at?: string | null
        }
        Update: {
          annonce_id?: string
          auth_user_id?: string
          lue_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "annonce_destinataires_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces"
            referencedColumns: ["id"]
          },
        ]
      }
      annonces: {
        Row: {
          auteur_id: string | null
          corps: string
          created_at: string
          etat: Database["public"]["Enums"]["etat_annonce"]
          id: string
          modifiee_at: string | null
          modifiee_par: string | null
          programmee_pour: string | null
          public: Database["public"]["Enums"]["public_annonce"]
          publiee_at: string | null
          retiree_at: string | null
          retiree_par: string | null
          titre: string
        }
        Insert: {
          auteur_id?: string | null
          corps: string
          created_at?: string
          etat?: Database["public"]["Enums"]["etat_annonce"]
          id?: string
          modifiee_at?: string | null
          modifiee_par?: string | null
          programmee_pour?: string | null
          public: Database["public"]["Enums"]["public_annonce"]
          publiee_at?: string | null
          retiree_at?: string | null
          retiree_par?: string | null
          titre: string
        }
        Update: {
          auteur_id?: string | null
          corps?: string
          created_at?: string
          etat?: Database["public"]["Enums"]["etat_annonce"]
          id?: string
          modifiee_at?: string | null
          modifiee_par?: string | null
          programmee_pour?: string | null
          public?: Database["public"]["Enums"]["public_annonce"]
          publiee_at?: string | null
          retiree_at?: string | null
          retiree_par?: string | null
          titre?: string
        }
        Relationships: []
      }
      campagnes: {
        Row: {
          category_id: number | null
          created_at: string
          creee_par_equipe: string | null
          debut_at: string | null
          decidee_at: string | null
          decidee_par: string | null
          duree_jours: number
          fin_at: string | null
          id: string
          merchant_id: string
          motif: string | null
          paiement_confirme_at: string | null
          paiement_confirme_par: string | null
          paiement_declare_at: string | null
          paiement_moyen: string | null
          paiement_numero: string | null
          paiement_reference: string | null
          prix_gnf: number | null
          product_id: string | null
          rembourse_at: string | null
          rembourse_par: string | null
          statut: string
          type: string
        }
        Insert: {
          category_id?: number | null
          created_at?: string
          creee_par_equipe?: string | null
          debut_at?: string | null
          decidee_at?: string | null
          decidee_par?: string | null
          duree_jours: number
          fin_at?: string | null
          id?: string
          merchant_id: string
          motif?: string | null
          paiement_confirme_at?: string | null
          paiement_confirme_par?: string | null
          paiement_declare_at?: string | null
          paiement_moyen?: string | null
          paiement_numero?: string | null
          paiement_reference?: string | null
          prix_gnf?: number | null
          product_id?: string | null
          rembourse_at?: string | null
          rembourse_par?: string | null
          statut?: string
          type: string
        }
        Update: {
          category_id?: number | null
          created_at?: string
          creee_par_equipe?: string | null
          debut_at?: string | null
          decidee_at?: string | null
          decidee_par?: string | null
          duree_jours?: number
          fin_at?: string | null
          id?: string
          merchant_id?: string
          motif?: string | null
          paiement_confirme_at?: string | null
          paiement_confirme_par?: string | null
          paiement_declare_at?: string | null
          paiement_moyen?: string | null
          paiement_numero?: string | null
          paiement_reference?: string | null
          prix_gnf?: number | null
          product_id?: string | null
          rembourse_at?: string | null
          rembourse_par?: string | null
          statut?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "campagnes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campagnes_creee_par_equipe_fkey"
            columns: ["creee_par_equipe"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "campagnes_decidee_par_fkey"
            columns: ["decidee_par"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "campagnes_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campagnes_paiement_confirme_par_fkey"
            columns: ["paiement_confirme_par"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "campagnes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campagnes_rembourse_par_fkey"
            columns: ["rembourse_par"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["auth_user_id"]
          },
        ]
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
      equipe: {
        Row: {
          auth_user_id: string
          created_at: string
          nom: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          nom: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          nom?: string
        }
        Relationships: []
      }
      expo_push_tokens: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          last_used_at: string | null
          plateforme: string | null
          token: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          plateforme?: string | null
          token: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          plateforme?: string | null
          token?: string
        }
        Relationships: []
      }
      fil_equipe: {
        Row: {
          annonce_id: string | null
          auteur_id: string | null
          corps: string
          created_at: string
          de_l_equipe: boolean
          espace: Database["public"]["Enums"]["user_role"]
          fil_de: string
          id: string
          lu_at: string | null
        }
        Insert: {
          annonce_id?: string | null
          auteur_id?: string | null
          corps: string
          created_at?: string
          de_l_equipe: boolean
          espace: Database["public"]["Enums"]["user_role"]
          fil_de: string
          id?: string
          lu_at?: string | null
        }
        Update: {
          annonce_id?: string | null
          auteur_id?: string | null
          corps?: string
          created_at?: string
          de_l_equipe?: boolean
          espace?: Database["public"]["Enums"]["user_role"]
          fil_de?: string
          id?: string
          lu_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fil_equipe_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_equipe: {
        Row: {
          action: string
          auteur: string | null
          auteur_nom: string
          cible_id: string
          cible_type: string
          created_at: string
          id: string
          motif: string | null
        }
        Insert: {
          action: string
          auteur?: string | null
          auteur_nom: string
          cible_id: string
          cible_type: string
          created_at?: string
          id?: string
          motif?: string | null
        }
        Update: {
          action?: string
          auteur?: string | null
          auteur_nom?: string
          cible_id?: string
          cible_type?: string
          created_at?: string
          id?: string
          motif?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_equipe_auteur_fkey"
            columns: ["auteur"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["auth_user_id"]
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
          photo_path: string | null
          profile_id: string
          shop_name: string
          status: Database["public"]["Enums"]["merchant_status"]
          whatsapp_phone: string | null
        }
        Insert: {
          address_hint?: string | null
          approved_at?: string | null
          city_id: number
          created_at?: string
          description?: string | null
          id?: string
          photo_path?: string | null
          profile_id: string
          shop_name: string
          status?: Database["public"]["Enums"]["merchant_status"]
          whatsapp_phone?: string | null
        }
        Update: {
          address_hint?: string | null
          approved_at?: string | null
          city_id?: number
          created_at?: string
          description?: string | null
          id?: string
          photo_path?: string | null
          profile_id?: string
          shop_name?: string
          status?: Database["public"]["Enums"]["merchant_status"]
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
      moyens_paiement: {
        Row: {
          actif: boolean
          id: string
          modifie_at: string | null
          modifie_par: string | null
          moyen: string
          numero: string
          titulaire: string
        }
        Insert: {
          actif?: boolean
          id?: string
          modifie_at?: string | null
          modifie_par?: string | null
          moyen: string
          numero: string
          titulaire: string
        }
        Update: {
          actif?: boolean
          id?: string
          modifie_at?: string | null
          modifie_par?: string | null
          moyen?: string
          numero?: string
          titulaire?: string
        }
        Relationships: [
          {
            foreignKeyName: "moyens_paiement_modifie_par_fkey"
            columns: ["modifie_par"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["auth_user_id"]
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
          masque_par_equipe: boolean
          masque_par_limite: boolean
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
          masque_par_equipe?: boolean
          masque_par_limite?: boolean
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
          masque_par_equipe?: boolean
          masque_par_limite?: boolean
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
          suspension_reason: string | null
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
          suspension_reason?: string | null
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
          suspension_reason?: string | null
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
          decision: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          reason: string
          reporter_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          created_at?: string
          decision?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason: string
          reporter_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          created_at?: string
          decision?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifs_abonnement: {
        Row: {
          formule: string
          id: string
          modifie_at: string | null
          modifie_par: string | null
          prix_gnf: number
        }
        Insert: {
          formule: string
          id?: string
          modifie_at?: string | null
          modifie_par?: string | null
          prix_gnf: number
        }
        Update: {
          formule?: string
          id?: string
          modifie_at?: string | null
          modifie_par?: string | null
          prix_gnf?: number
        }
        Relationships: [
          {
            foreignKeyName: "tarifs_abonnement_modifie_par_fkey"
            columns: ["modifie_par"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      tarifs_publicite: {
        Row: {
          duree_jours: number
          id: string
          modifie_at: string | null
          modifie_par: string | null
          prix_gnf: number
          type: string
        }
        Insert: {
          duree_jours: number
          id?: string
          modifie_at?: string | null
          modifie_par?: string | null
          prix_gnf: number
          type: string
        }
        Update: {
          duree_jours?: number
          id?: string
          modifie_at?: string | null
          modifie_par?: string | null
          prix_gnf?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarifs_publicite_modifie_par_fkey"
            columns: ["modifie_par"]
            isOneToOne: false
            referencedRelation: "equipe"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abonnements_equipe: {
        Args: never
        Returns: {
          created_at: string
          creee_par_equipe: string | null
          debut_at: string | null
          fin_at: string | null
          formule: string
          id: string
          merchant_id: string
          motif: string | null
          paiement_confirme_at: string | null
          paiement_declare_at: string | null
          paiement_moyen: string | null
          paiement_numero: string | null
          paiement_reference: string | null
          prix_gnf: number
          rembourse_at: string | null
          shop_name: string
          statut: string
        }[]
      }
      annonce_concerne: {
        Args: {
          p_espace: Database["public"]["Enums"]["user_role"]
          p_public: Database["public"]["Enums"]["public_annonce"]
        }
        Returns: boolean
      }
      annuler_abonnement: { Args: { p_id: string }; Returns: undefined }
      annuler_campagne: { Args: { p_id: string }; Returns: undefined }
      appliquer_limites_abonnement: { Args: never; Returns: undefined }
      badges_boutiques: {
        Args: { p_merchants: string[] }
        Returns: {
          formule: string
          merchant_id: string
        }[]
      }
      boite_equipe: {
        Args: never
        Returns: {
          dernier_at: string
          dernier_corps: string
          dernier_de_l_equipe: boolean
          espace: Database["public"]["Enums"]["user_role"]
          fil_de: string
          nom: string
          non_lus: number
        }[]
      }
      boutiques_mises_en_avant: {
        Args: { p_limit?: number }
        Returns: {
          campagne_id: string
          city_name: string
          merchant_id: string
          produits_actifs: number
          shop_name: string
          shop_photo_path: string | null
        }[]
      }
      campagnes_equipe: {
        Args: never
        Returns: {
          category_id: number | null
          category_name: string | null
          created_at: string
          creee_par_equipe: string | null
          debut_at: string | null
          duree_jours: number
          fin_at: string | null
          id: string
          merchant_id: string
          motif: string | null
          paiement_confirme_at: string | null
          paiement_declare_at: string | null
          paiement_moyen: string | null
          paiement_numero: string | null
          paiement_reference: string | null
          prix_gnf: number | null
          product_id: string | null
          produit_titre: string | null
          rembourse_at: string | null
          shop_name: string
          statut: string
          type: string
        }[]
      }
      comptes_suspendus: {
        Args: never
        Returns: {
          nom: string
          profile_id: string
          role: string
          shop_name: string
          suspension_reason: string
        }[]
      }
      conversation_is_open: { Args: { cid: string }; Returns: boolean }
      creer_abonnement_equipe: {
        Args: {
          p_formule: string
          p_merchant: string
          p_moyen?: string
          p_reference?: string
        }
        Returns: string
      }
      creer_campagne_equipe: {
        Args: {
          p_category?: number
          p_duree?: number
          p_merchant: string
          p_moyen?: string
          p_product?: string
          p_reference?: string
          p_type: string
        }
        Returns: string
      }
      debut_prochaine_periode: {
        Args: { p_formule: string; p_merchant: string }
        Returns: string
      }
      decider_abonnement: {
        Args: { p_accepter: boolean; p_id: string; p_motif?: string }
        Returns: undefined
      }
      decider_campagne: {
        Args: { p_accepter: boolean; p_id: string; p_motif?: string }
        Returns: undefined
      }
      declarer_paiement: {
        Args: {
          p_id: string
          p_moyen: string
          p_numero: string
          p_reference: string
        }
        Returns: undefined
      }
      declarer_paiement_abonnement: {
        Args: {
          p_id: string
          p_moyen: string
          p_numero: string
          p_reference: string
        }
        Returns: undefined
      }
      demander_abonnement: { Args: { p_formule: string }; Returns: string }
      demander_campagne: {
        Args: {
          p_category?: number
          p_duree?: number
          p_product?: string
          p_type: string
        }
        Returns: string
      }
      enregistrer_telephone: {
        Args: { p_plateforme: string; p_token: string }
        Returns: undefined
      }
      fixer_moyen_paiement: {
        Args: {
          p_actif: boolean
          p_moyen: string
          p_numero: string
          p_titulaire: string
        }
        Returns: undefined
      }
      fixer_tarif: {
        Args: { p_duree: number; p_prix: number; p_type: string }
        Returns: undefined
      }
      fixer_tarif_abonnement: {
        Args: { p_formule: string; p_prix: number }
        Returns: undefined
      }
      formule_de: { Args: { p_merchant: string }; Returns: string }
      i_talk_with_merchant: { Args: { mid: string }; Returns: boolean }
      interrompre_abonnement: {
        Args: { p_id: string; p_motif: string }
        Returns: undefined
      }
      interrompre_campagne: {
        Args: { p_id: string; p_motif: string }
        Returns: undefined
      }
      is_active_profile: { Args: { pid: string }; Returns: boolean }
      je_peux_ecrire_a_l_equipe: {
        Args: { p_espace: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      je_suis_de_l_equipe: { Args: never; Returns: boolean }
      lecteurs_annonce: {
        Args: { p_annonce: string }
        Returns: {
          auth_user_id: string
          lue_at: string
          nom: string
        }[]
      }
      ma_formule: {
        Args: never
        Returns: {
          en_grace: boolean
          fin_at: string | null
          formule: string
          limite_produits: number | null
        }[]
      }
      marquer_abonnement_rembourse: {
        Args: { p_id: string }
        Returns: undefined
      }
      marquer_annonces_lues: {
        Args: { p_espace: Database["public"]["Enums"]["user_role"] }
        Returns: undefined
      }
      marquer_fil_equipe_lu: {
        Args: { p_espace: Database["public"]["Enums"]["user_role"] }
        Returns: undefined
      }
      marquer_fil_lu_par_l_equipe: {
        Args: { p_espace: Database["public"]["Enums"]["user_role"]; p_fil_de: string }
        Returns: undefined
      }
      marquer_rembourse: { Args: { p_id: string }; Returns: undefined }
      masquer_produit: {
        Args: { p_motif: string; p_product: string }
        Returns: undefined
      }
      merchant_is_public: { Args: { mid: string }; Returns: boolean }
      messages_signales: {
        Args: { p_report: string }
        Returns: {
          body: string
          created_at: string
          id: string
          sender_id: string
        }[]
      }
      modifier_ma_boutique: {
        Args: {
          p_adresse: string
          p_auth_user_id: string
          p_description: string
          p_nom: string
          p_photo_path: string
          p_ville_id: number
          p_whatsapp: string
        }
        Returns: string
      }
      modifier_mes_informations: {
        Args: { p_auth_user_id: string; p_nom: string; p_telephone: string }
        Returns: number
      }
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
      produits_les_plus_vus: {
        Args: { p_jours?: number }
        Returns: {
          contacts: number
          product_id: string
          titre: string
          vues: number
        }[]
      }
      produits_sponsorises: {
        Args: { p_category_id?: number; p_limit?: number; p_query?: string }
        Returns: {
          campagne_id: string
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
          shop_photo_path: string | null
          status: Database["public"]["Enums"]["product_status"]
          title: string
        }[]
      }
      publier_annonces_programmees: { Args: never; Returns: string[] }
      purger_mesures: { Args: never; Returns: number }
      reactiver_profil: {
        Args: { p_motif: string; p_profile: string }
        Returns: undefined
      }
      restaurer_produits_masques: {
        Args: { p_merchant: string }
        Returns: undefined
      }
      resultats_campagnes: {
        Args: never
        Returns: {
          campagne_id: string
          clics: number
          vues: number
        }[]
      }
      revenus_abonnements: {
        Args: never
        Returns: {
          abonnements: number
          encaisse_gnf: number
          mois: string
          rembourse_gnf: number
        }[]
      }
      revenus_publicite: {
        Args: never
        Returns: {
          campagnes: number
          encaisse_gnf: number
          mois: string
          rembourse_gnf: number
        }[]
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
          shop_photo_path: string | null
          status: Database["public"]["Enums"]["product_status"]
          title: string
        }[]
      }
      signalements_a_traiter: {
        Args: never
        Returns: {
          conv_client_nom: string
          conv_client_profile_id: string
          conv_merchant_profile_id: string
          conv_shop_name: string
          created_at: string
          id: string
          merchant_profile_id: string
          produit_status: string
          produit_titre: string
          reason: string
          reporter_id: string
          reporter_nom: string
          shop_name: string
          target_id: string
          target_type: string
        }[]
      }
      statistiques_boutique: {
        Args: { p_jours?: number }
        Returns: {
          boutique_vues: number
          contacts: number
          jour: string
          produits_vus: number
          whatsapp: number
        }[]
      }
      suivi_chiffres: { Args: { depuis: string }; Returns: Json }
      suspendre_profil: {
        Args: { p_motif: string; p_profile: string }
        Returns: undefined
      }
      tendances_filloo: {
        Args: { p_jours?: number }
        Returns: {
          genre: string
          libelle: string
          total: number
        }[]
      }
      traiter_signalement: {
        Args: { p_decision: string; p_report: string }
        Returns: undefined
      }
    }
    Enums: {
      etat_annonce: "brouillon" | "programmee" | "publiee" | "retiree"
      merchant_status: "pending" | "approved" | "rejected"
      notification_kind:
        | "merchant_approved"
        | "merchant_rejected"
        | "profile_suspended"
      product_status: "draft" | "active" | "sold" | "hidden"
      public_annonce: "tous" | "clients" | "commercants"
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
      etat_annonce: ["brouillon", "programmee", "publiee", "retiree"],
      merchant_status: ["pending", "approved", "rejected"],
      notification_kind: [
        "merchant_approved",
        "merchant_rejected",
        "profile_suspended",
      ],
      product_status: ["draft", "active", "sold", "hidden"],
      public_annonce: ["tous", "clients", "commercants"],
      report_target: ["product", "conversation", "merchant"],
      user_role: ["client", "merchant"],
    },
  },
} as const
