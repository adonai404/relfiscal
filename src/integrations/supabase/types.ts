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
      companies: {
        Row: {
          api_key: string | null
          cnpj: string
          created_at: string
          created_by: string | null
          folder_id: string | null
          id: string
          nome_fantasia: string
          razao_social: string
          regime: Database["public"]["Enums"]["tax_regime"]
          slug: string
          status: Database["public"]["Enums"]["company_status"]
          uf: string
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          cnpj: string
          created_at?: string
          created_by?: string | null
          folder_id?: string | null
          id?: string
          nome_fantasia: string
          razao_social: string
          regime?: Database["public"]["Enums"]["tax_regime"]
          slug: string
          status?: Database["public"]["Enums"]["company_status"]
          uf: string
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          cnpj?: string
          created_at?: string
          created_by?: string | null
          folder_id?: string | null
          id?: string
          nome_fantasia?: string
          razao_social?: string
          regime?: Database["public"]["Enums"]["tax_regime"]
          slug?: string
          status?: Database["public"]["Enums"]["company_status"]
          uf?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "company_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      company_folders: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      company_tags: {
        Row: {
          company_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      company_users: {
        Row: {
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_column_values: {
        Row: {
          column_id: string
          created_at: string
          id: string
          movement_id: string
          updated_at: string
          value: number
        }
        Insert: {
          column_id: string
          created_at?: string
          id?: string
          movement_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          column_id?: string
          created_at?: string
          id?: string
          movement_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_column_values_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "custom_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_column_values_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "fiscal_movement"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_columns: {
        Row: {
          company_id: string
          created_at: string
          decimals: number
          format: string
          formula: Json
          id: string
          key: string
          kind: string
          label: string
          position: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          decimals?: number
          format?: string
          formula?: Json
          id?: string
          key: string
          kind?: string
          label: string
          position?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          decimals?: number
          format?: string
          formula?: Json
          id?: string
          key?: string
          kind?: string
          label?: string
          position?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "custom_columns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_companies: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_companies_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fiscal_config: {
        Row: {
          aliquota_simples_nacional: number
          auto_calculate_simples_nacional: boolean
          column_order: Json | null
          company_id: string
          created_at: string
          id: string
          label_cofins: string
          label_competencia: string
          label_csll: string
          label_cupom: string | null
          label_difal: string
          label_encargos_patronal: string
          label_entrada: string
          label_folha: string
          label_honorarios: string
          label_icms: string
          label_impostos_federais: string
          label_irpj: string
          label_nfe_entrada: string | null
          label_nfe_saida: string | null
          label_pis: string
          label_saida: string
          label_servico: string | null
          label_simples_nacional: string
          show_cofins_column: boolean
          show_csll_column: boolean
          show_cupom_column: boolean | null
          show_difal_column: boolean
          show_encargos_patronal_column: boolean
          show_folha_column: boolean
          show_honorarios_column: boolean
          show_icms_column: boolean
          show_impostos_federais_column: boolean
          show_irpj_column: boolean
          show_nfe_entrada_column: boolean | null
          show_nfe_saida_column: boolean | null
          show_pis_column: boolean
          show_servico_column: boolean | null
          show_simples_nacional_column: boolean
          tax_columns: Json
          updated_at: string
        }
        Insert: {
          aliquota_simples_nacional?: number
          auto_calculate_simples_nacional?: boolean
          column_order?: Json | null
          company_id: string
          created_at?: string
          id?: string
          label_cofins?: string
          label_competencia?: string
          label_csll?: string
          label_cupom?: string | null
          label_difal?: string
          label_encargos_patronal?: string
          label_entrada?: string
          label_folha?: string
          label_honorarios?: string
          label_icms?: string
          label_impostos_federais?: string
          label_irpj?: string
          label_nfe_entrada?: string | null
          label_nfe_saida?: string | null
          label_pis?: string
          label_saida?: string
          label_servico?: string | null
          label_simples_nacional?: string
          show_cofins_column?: boolean
          show_csll_column?: boolean
          show_cupom_column?: boolean | null
          show_difal_column?: boolean
          show_encargos_patronal_column?: boolean
          show_folha_column?: boolean
          show_honorarios_column?: boolean
          show_icms_column?: boolean
          show_impostos_federais_column?: boolean
          show_irpj_column?: boolean
          show_nfe_entrada_column?: boolean | null
          show_nfe_saida_column?: boolean | null
          show_pis_column?: boolean
          show_servico_column?: boolean | null
          show_simples_nacional_column?: boolean
          tax_columns?: Json
          updated_at?: string
        }
        Update: {
          aliquota_simples_nacional?: number
          auto_calculate_simples_nacional?: boolean
          column_order?: Json | null
          company_id?: string
          created_at?: string
          id?: string
          label_cofins?: string
          label_competencia?: string
          label_csll?: string
          label_cupom?: string | null
          label_difal?: string
          label_encargos_patronal?: string
          label_entrada?: string
          label_folha?: string
          label_honorarios?: string
          label_icms?: string
          label_impostos_federais?: string
          label_irpj?: string
          label_nfe_entrada?: string | null
          label_nfe_saida?: string | null
          label_pis?: string
          label_saida?: string
          label_servico?: string | null
          label_simples_nacional?: string
          show_cofins_column?: boolean
          show_csll_column?: boolean
          show_cupom_column?: boolean | null
          show_difal_column?: boolean
          show_encargos_patronal_column?: boolean
          show_folha_column?: boolean
          show_honorarios_column?: boolean
          show_icms_column?: boolean
          show_impostos_federais_column?: boolean
          show_irpj_column?: boolean
          show_nfe_entrada_column?: boolean | null
          show_nfe_saida_column?: boolean | null
          show_pis_column?: boolean
          show_servico_column?: boolean | null
          show_simples_nacional_column?: boolean
          tax_columns?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_movement: {
        Row: {
          cofins: number
          company_id: string
          competencia: string
          created_at: string
          csll: number
          cupom: number | null
          difal: number
          encargos_patronal: number
          entrada: number
          folha: number
          honorarios: number
          icms: number
          id: string
          impostos_federais: number
          irpj: number
          nfe_entrada: number | null
          nfe_saida: number | null
          pis: number
          saida: number
          servico: number | null
          simples_nacional: number
          updated_at: string
        }
        Insert: {
          cofins?: number
          company_id: string
          competencia: string
          created_at?: string
          csll?: number
          cupom?: number | null
          difal?: number
          encargos_patronal?: number
          entrada?: number
          folha?: number
          honorarios?: number
          icms?: number
          id?: string
          impostos_federais?: number
          irpj?: number
          nfe_entrada?: number | null
          nfe_saida?: number | null
          pis?: number
          saida?: number
          servico?: number | null
          simples_nacional?: number
          updated_at?: string
        }
        Update: {
          cofins?: number
          company_id?: string
          competencia?: string
          created_at?: string
          csll?: number
          cupom?: number | null
          difal?: number
          encargos_patronal?: number
          entrada?: number
          folha?: number
          honorarios?: number
          icms?: number
          id?: string
          impostos_federais?: number
          irpj?: number
          nfe_entrada?: number | null
          nfe_saida?: number | null
          pis?: number
          saida?: number
          servico?: number | null
          simples_nacional?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_movement_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_requested_at: string | null
          approved: boolean
          created_at: string
          customer_id: string | null
          email: string | null
          id: string
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          access_requested_at?: string | null
          approved?: boolean
          created_at?: string
          customer_id?: string | null
          email?: string | null
          id?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          access_requested_at?: string | null
          approved?: boolean
          created_at?: string
          customer_id?: string | null
          email?: string | null
          id?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tax_planning: {
        Row: {
          company_id: string
          created_at: string
          data: Json | null
          group_id: string | null
          id: string
          status: string
          tax_regime: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          data?: Json | null
          group_id?: string | null
          id?: string
          status?: string
          tax_regime: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          data?: Json | null
          group_id?: string | null
          id?: string
          status?: string
          tax_regime?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_planning_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_planning_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tax_planning_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_planning_groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tax_planning_products: {
        Row: {
          cfop: string | null
          company_id: string
          created_at: string
          emission_date: string | null
          id: string
          ncm: string | null
          planning_id: string | null
          product_code: string | null
          product_name: string
          qcom: number | null
          ucom: string | null
          upload_id: string | null
          vcofins: number | null
          vicms: number | null
          vipi: number | null
          vpis: number | null
          vprod: number | null
          vuncom: number | null
          xml_type: string
        }
        Insert: {
          cfop?: string | null
          company_id: string
          created_at?: string
          emission_date?: string | null
          id?: string
          ncm?: string | null
          planning_id?: string | null
          product_code?: string | null
          product_name: string
          qcom?: number | null
          ucom?: string | null
          upload_id?: string | null
          vcofins?: number | null
          vicms?: number | null
          vipi?: number | null
          vpis?: number | null
          vprod?: number | null
          vuncom?: number | null
          xml_type: string
        }
        Update: {
          cfop?: string | null
          company_id?: string
          created_at?: string
          emission_date?: string | null
          id?: string
          ncm?: string | null
          planning_id?: string | null
          product_code?: string | null
          product_name?: string
          qcom?: number | null
          ucom?: string | null
          upload_id?: string | null
          vcofins?: number | null
          vicms?: number | null
          vipi?: number | null
          vpis?: number | null
          vprod?: number | null
          vuncom?: number | null
          xml_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_planning_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_planning_products_planning_id_fkey"
            columns: ["planning_id"]
            isOneToOne: false
            referencedRelation: "tax_planning"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_planning_products_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "tax_planning_xml_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_planning_xml_uploads: {
        Row: {
          company_id: string
          created_at: string
          file_name: string
          id: string
          planning_id: string | null
          uploaded_by: string
          xml_type: string
        }
        Insert: {
          company_id: string
          created_at?: string
          file_name: string
          id?: string
          planning_id?: string | null
          uploaded_by?: string
          xml_type: string
        }
        Update: {
          company_id?: string
          created_at?: string
          file_name?: string
          id?: string
          planning_id?: string | null
          uploaded_by?: string
          xml_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_planning_xml_uploads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_planning_xml_uploads_planning_id_fkey"
            columns: ["planning_id"]
            isOneToOne: false
            referencedRelation: "tax_planning"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_slug: { Args: { input_text: string }; Returns: string }
      get_or_create_import_company: {
        Args: {
          _cnpj: string
          _nome_fantasia?: string
          _razao_social?: string
          _regime?: Database["public"]["Enums"]["tax_regime"]
          _uf?: string
        }
        Returns: {
          cnpj: string
          created: boolean
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      user_has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_active: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin"
      company_status: "ativa" | "inativa" | "arquivada"
      tax_regime: "simples_nacional" | "lucro_presumido" | "lucro_real" | "mei"
      user_status: "ativo" | "bloqueado"
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
      app_role: ["admin", "user", "super_admin"],
      company_status: ["ativa", "inativa", "arquivada"],
      tax_regime: ["simples_nacional", "lucro_presumido", "lucro_real", "mei"],
      user_status: ["ativo", "bloqueado"],
    },
  },
} as const
