export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          extensions?: Json
          variables?: Json
          query?: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      card_tags: {
        Row: {
          card_id: string
          tag_id: number
        }
        Insert: {
          card_id: string
          tag_id: number
        }
        Update: {
          card_id?: string
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "card_tags_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          cost_usd: number
          created_at: string
          external_id: string
          has_deep: boolean
          has_guide: boolean
          has_til: boolean
          id: string
          insights: Json | null
          platform: string
          published: boolean
          raw_metadata: Json | null
          status: string
          summary: string | null
          title: string | null
          tokens_used: number
          updated_at: string
          url: string
          vault_path: string | null
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          external_id: string
          has_deep?: boolean
          has_guide?: boolean
          has_til?: boolean
          id: string
          insights?: Json | null
          platform: string
          published?: boolean
          raw_metadata?: Json | null
          status?: string
          summary?: string | null
          title?: string | null
          tokens_used?: number
          updated_at?: string
          url: string
          vault_path?: string | null
        }
        Update: {
          cost_usd?: number
          created_at?: string
          external_id?: string
          has_deep?: boolean
          has_guide?: boolean
          has_til?: boolean
          id?: string
          insights?: Json | null
          platform?: string
          published?: boolean
          raw_metadata?: Json | null
          status?: string
          summary?: string | null
          title?: string | null
          tokens_used?: number
          updated_at?: string
          url?: string
          vault_path?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          card_id: string | null
          data: Json | null
          id: number
          job_id: number | null
          level: string
          ts: string
          type: string
        }
        Insert: {
          card_id?: string | null
          data?: Json | null
          id?: number
          job_id?: number | null
          level?: string
          ts?: string
          type: string
        }
        Update: {
          card_id?: string | null
          data?: Json | null
          id?: number
          job_id?: number | null
          level?: string
          ts?: string
          type?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          attempts: number
          canonical_url: string | null
          card_id: string | null
          created_at: string
          finished_at: string | null
          force: boolean
          id: number
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          picked_at: string | null
          raw_url: string
          status: string
          telegram_chat: number | null
          telegram_msg: number | null
        }
        Insert: {
          attempts?: number
          canonical_url?: string | null
          card_id?: string | null
          created_at?: string
          finished_at?: string | null
          force?: boolean
          id?: number
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          picked_at?: string | null
          raw_url: string
          status?: string
          telegram_chat?: number | null
          telegram_msg?: number | null
        }
        Update: {
          attempts?: number
          canonical_url?: string | null
          card_id?: string | null
          created_at?: string
          finished_at?: string | null
          force?: boolean
          id?: number
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          picked_at?: string | null
          raw_url?: string
          status?: string
          telegram_chat?: number | null
          telegram_msg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          aliases: Json
          canonical_name: string
          id: number
          usage_count: number
        }
        Insert: {
          aliases?: Json
          canonical_name: string
          id?: number
          usage_count?: number
        }
        Update: {
          aliases?: Json
          canonical_name?: string
          id?: number
          usage_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      pick_next_job: {
        Args: Record<PropertyKey, never>
        Returns: {
          attempts: number
          canonical_url: string | null
          card_id: string | null
          created_at: string
          finished_at: string | null
          force: boolean
          id: number
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          picked_at: string | null
          raw_url: string
          status: string
          telegram_chat: number | null
          telegram_msg: number | null
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

