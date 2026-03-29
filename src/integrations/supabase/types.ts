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
      attendant_exclusions: {
        Row: {
          attendant_name: string
          company_id: string
          created_at: string
          excluded: boolean
          excluded_at: string | null
          excluded_by: string | null
          id: string
          normalized_name: string
          origin: string
          updated_at: string
        }
        Insert: {
          attendant_name: string
          company_id: string
          created_at?: string
          excluded?: boolean
          excluded_at?: string | null
          excluded_by?: string | null
          id?: string
          normalized_name: string
          origin?: string
          updated_at?: string
        }
        Update: {
          attendant_name?: string
          company_id?: string
          created_at?: string
          excluded?: boolean
          excluded_at?: string | null
          excluded_by?: string | null
          id?: string
          normalized_name?: string
          origin?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendant_exclusions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      attendants: {
        Row: {
          active: boolean
          base: string | null
          company_id: string | null
          created_at: string
          departamento: string | null
          empresa: string | null
          id: string
          name: string
          nickname: string | null
          participates_evaluation: boolean
          role_type: string
          sector: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          base?: string | null
          company_id?: string | null
          created_at?: string
          departamento?: string | null
          empresa?: string | null
          id?: string
          name: string
          nickname?: string | null
          participates_evaluation?: boolean
          role_type?: string
          sector?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          base?: string | null
          company_id?: string | null
          created_at?: string
          departamento?: string | null
          empresa?: string | null
          id?: string
          name?: string
          nickname?: string | null
          participates_evaluation?: boolean
          role_type?: string
          sector?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      credit_analyses: {
        Row: {
          ajuste_manual: boolean
          company_id: string | null
          cpf_cnpj: string
          created_at: string
          data_ajuste: string | null
          decisao_final: string | null
          doc_type: string
          faixa_original: string | null
          id: string
          motivo_ajuste: string | null
          nome: string | null
          observacao_ajuste: string | null
          observacoes: string | null
          regra_aplicada: string | null
          resultado: Json | null
          sector_id: string | null
          status: string
          user_id: string
          user_name: string | null
          usuario_ajuste: string | null
        }
        Insert: {
          ajuste_manual?: boolean
          company_id?: string | null
          cpf_cnpj: string
          created_at?: string
          data_ajuste?: string | null
          decisao_final?: string | null
          doc_type?: string
          faixa_original?: string | null
          id?: string
          motivo_ajuste?: string | null
          nome?: string | null
          observacao_ajuste?: string | null
          observacoes?: string | null
          regra_aplicada?: string | null
          resultado?: Json | null
          sector_id?: string | null
          status?: string
          user_id: string
          user_name?: string | null
          usuario_ajuste?: string | null
        }
        Update: {
          ajuste_manual?: boolean
          company_id?: string | null
          cpf_cnpj?: string
          created_at?: string
          data_ajuste?: string | null
          decisao_final?: string | null
          doc_type?: string
          faixa_original?: string | null
          id?: string
          motivo_ajuste?: string | null
          nome?: string | null
          observacao_ajuste?: string | null
          observacoes?: string | null
          regra_aplicada?: string | null
          resultado?: Json | null
          sector_id?: string | null
          status?: string
          user_id?: string
          user_name?: string | null
          usuario_ajuste?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_analyses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_analyses_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      document_analyses: {
        Row: {
          cpf_cnpj: string
          created_at: string
          credit_analysis_id: string | null
          decisao_documental: string
          decisao_sugerida: string | null
          id: string
          justificativa_divergencia: string | null
          motivo: string | null
          motivo_sugestao: string | null
          nome: string | null
          observacao: string | null
          status: string
          updated_at: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          cpf_cnpj: string
          created_at?: string
          credit_analysis_id?: string | null
          decisao_documental?: string
          decisao_sugerida?: string | null
          id?: string
          justificativa_divergencia?: string | null
          motivo?: string | null
          motivo_sugestao?: string | null
          nome?: string | null
          observacao?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          cpf_cnpj?: string
          created_at?: string
          credit_analysis_id?: string | null
          decisao_documental?: string
          decisao_sugerida?: string | null
          id?: string
          justificativa_divergencia?: string | null
          motivo?: string | null
          motivo_sugestao?: string | null
          nome?: string | null
          observacao?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_analyses_credit_analysis_id_fkey"
            columns: ["credit_analysis_id"]
            isOneToOne: false
            referencedRelation: "credit_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      document_items: {
        Row: {
          alertas: Json | null
          campos_extraidos: Json | null
          confianca_ocr: number | null
          cpf_confere: boolean
          created_at: string
          data_emissao: string | null
          data_exclusao: string | null
          data_fim_contrato: string | null
          data_inicio_contrato: string | null
          data_revisao: string | null
          divergencias: Json | null
          document_analysis_id: string
          documento_recebido: boolean
          endereco_confere: boolean
          excluido_por: string | null
          file_name: string | null
          file_url: string | null
          hash_arquivo: string | null
          id: string
          legivel: boolean
          motivo_exclusao: string | null
          nome_confere: boolean
          observacao: string | null
          revisado_por: string | null
          risco_documental: string | null
          status_documento: string | null
          status_ocr: string | null
          suspeita_fraude: boolean | null
          texto_extraido: string | null
          tipo: string
          valido: boolean
        }
        Insert: {
          alertas?: Json | null
          campos_extraidos?: Json | null
          confianca_ocr?: number | null
          cpf_confere?: boolean
          created_at?: string
          data_emissao?: string | null
          data_exclusao?: string | null
          data_fim_contrato?: string | null
          data_inicio_contrato?: string | null
          data_revisao?: string | null
          divergencias?: Json | null
          document_analysis_id: string
          documento_recebido?: boolean
          endereco_confere?: boolean
          excluido_por?: string | null
          file_name?: string | null
          file_url?: string | null
          hash_arquivo?: string | null
          id?: string
          legivel?: boolean
          motivo_exclusao?: string | null
          nome_confere?: boolean
          observacao?: string | null
          revisado_por?: string | null
          risco_documental?: string | null
          status_documento?: string | null
          status_ocr?: string | null
          suspeita_fraude?: boolean | null
          texto_extraido?: string | null
          tipo: string
          valido?: boolean
        }
        Update: {
          alertas?: Json | null
          campos_extraidos?: Json | null
          confianca_ocr?: number | null
          cpf_confere?: boolean
          created_at?: string
          data_emissao?: string | null
          data_exclusao?: string | null
          data_fim_contrato?: string | null
          data_inicio_contrato?: string | null
          data_revisao?: string | null
          divergencias?: Json | null
          document_analysis_id?: string
          documento_recebido?: boolean
          endereco_confere?: boolean
          excluido_por?: string | null
          file_name?: string | null
          file_url?: string | null
          hash_arquivo?: string | null
          id?: string
          legivel?: boolean
          motivo_exclusao?: string | null
          nome_confere?: boolean
          observacao?: string | null
          revisado_por?: string | null
          risco_documental?: string | null
          status_documento?: string | null
          status_ocr?: string | null
          suspeita_fraude?: boolean | null
          texto_extraido?: string | null
          tipo?: string
          valido?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "document_items_document_analysis_id_fkey"
            columns: ["document_analysis_id"]
            isOneToOne: false
            referencedRelation: "document_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          atendente: string
          atualizacao_cadastral: string
          audit_log: Json | null
          bonus: boolean
          classificacao: string
          company_id: string | null
          created_at: string
          data: string
          data_avaliacao: string
          excluded_at: string | null
          excluded_by: string | null
          excluded_from_ranking: boolean
          exclusion_reason: string | null
          full_report: Json | null
          id: string
          nota: number
          parent_evaluation_id: string | null
          pdf_url: string | null
          pontos_melhoria: string[] | null
          prompt_version: string
          protocolo: string
          resultado_validado: boolean
          sector_id: string | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          atendente: string
          atualizacao_cadastral?: string
          audit_log?: Json | null
          bonus?: boolean
          classificacao: string
          company_id?: string | null
          created_at?: string
          data: string
          data_avaliacao?: string
          excluded_at?: string | null
          excluded_by?: string | null
          excluded_from_ranking?: boolean
          exclusion_reason?: string | null
          full_report?: Json | null
          id?: string
          nota: number
          parent_evaluation_id?: string | null
          pdf_url?: string | null
          pontos_melhoria?: string[] | null
          prompt_version?: string
          protocolo: string
          resultado_validado?: boolean
          sector_id?: string | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          atendente?: string
          atualizacao_cadastral?: string
          audit_log?: Json | null
          bonus?: boolean
          classificacao?: string
          company_id?: string | null
          created_at?: string
          data?: string
          data_avaliacao?: string
          excluded_at?: string | null
          excluded_by?: string | null
          excluded_from_ranking?: boolean
          exclusion_reason?: string | null
          full_report?: Json | null
          id?: string
          nota?: number
          parent_evaluation_id?: string | null
          pdf_url?: string | null
          pontos_melhoria?: string[] | null
          prompt_version?: string
          protocolo?: string
          resultado_validado?: boolean
          sector_id?: string | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_parent_evaluation_id_fkey"
            columns: ["parent_evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      mentoria_batch_files: {
        Row: {
          atendente: string | null
          batch_id: string
          canal: string | null
          classificacao: string | null
          created_at: string
          data_atendimento: string | null
          error_message: string | null
          extracted_path: string | null
          extracted_text: string | null
          file_name: string
          file_path: string | null
          file_size: number | null
          has_audio: boolean | null
          id: string
          nota: number | null
          parsed_messages: Json | null
          protocolo: string | null
          result: Json | null
          status: string
        }
        Insert: {
          atendente?: string | null
          batch_id: string
          canal?: string | null
          classificacao?: string | null
          created_at?: string
          data_atendimento?: string | null
          error_message?: string | null
          extracted_path?: string | null
          extracted_text?: string | null
          file_name: string
          file_path?: string | null
          file_size?: number | null
          has_audio?: boolean | null
          id?: string
          nota?: number | null
          parsed_messages?: Json | null
          protocolo?: string | null
          result?: Json | null
          status?: string
        }
        Update: {
          atendente?: string | null
          batch_id?: string
          canal?: string | null
          classificacao?: string | null
          created_at?: string
          data_atendimento?: string | null
          error_message?: string | null
          extracted_path?: string | null
          extracted_text?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          has_audio?: boolean | null
          id?: string
          nota?: number | null
          parsed_messages?: Json | null
          protocolo?: string | null
          result?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentoria_batch_files_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "mentoria_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      mentoria_batches: {
        Row: {
          batch_code: string
          created_at: string
          id: string
          ignored_files: number
          original_file_name: string | null
          source_type: string
          status: string
          summary: Json | null
          total_files_in_source: number
          total_pdfs: number
          updated_at: string
          upload_path: string | null
          user_id: string
        }
        Insert: {
          batch_code: string
          created_at?: string
          id?: string
          ignored_files?: number
          original_file_name?: string | null
          source_type?: string
          status?: string
          summary?: Json | null
          total_files_in_source?: number
          total_pdfs?: number
          updated_at?: string
          upload_path?: string | null
          user_id: string
        }
        Update: {
          batch_code?: string
          created_at?: string
          id?: string
          ignored_files?: number
          original_file_name?: string | null
          source_type?: string
          status?: string
          summary?: Json | null
          total_files_in_source?: number
          total_pdfs?: number
          updated_at?: string
          upload_path?: string | null
          user_id?: string
        }
        Relationships: []
      }
      monthly_closings: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string | null
          created_at: string
          id: string
          month: number
          nota_media: number
          reopen_history: Json | null
          reopened_at: string | null
          reopened_by: string | null
          snapshot: Json | null
          status: string
          total_bonus: number
          total_mentorias: number
          user_id: string
          year: number
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          month: number
          nota_media?: number
          reopen_history?: Json | null
          reopened_at?: string | null
          reopened_by?: string | null
          snapshot?: Json | null
          status?: string
          total_bonus?: number
          total_mentorias?: number
          user_id: string
          year: number
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          month?: number
          nota_media?: number
          reopen_history?: Json | null
          reopened_at?: string | null
          reopened_by?: string | null
          snapshot?: Json | null
          status?: string
          total_bonus?: number
          total_mentorias?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_closings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_mentorings: {
        Row: {
          atendente: string | null
          classificacao_interna: string | null
          cliente: string | null
          created_at: string
          data_atendimento: string | null
          error_message: string | null
          id: string
          nota_interna: number | null
          pdf_url: string | null
          pontos_melhoria: string[] | null
          pontos_obtidos: number | null
          pontos_possiveis: number | null
          protocolo: string | null
          resultado: Json | null
          status: string
          tipo: string | null
          user_id: string
        }
        Insert: {
          atendente?: string | null
          classificacao_interna?: string | null
          cliente?: string | null
          created_at?: string
          data_atendimento?: string | null
          error_message?: string | null
          id?: string
          nota_interna?: number | null
          pdf_url?: string | null
          pontos_melhoria?: string[] | null
          pontos_obtidos?: number | null
          pontos_possiveis?: number | null
          protocolo?: string | null
          resultado?: Json | null
          status?: string
          tipo?: string | null
          user_id: string
        }
        Update: {
          atendente?: string | null
          classificacao_interna?: string | null
          cliente?: string | null
          created_at?: string
          data_atendimento?: string | null
          error_message?: string | null
          id?: string
          nota_interna?: number | null
          pdf_url?: string | null
          pontos_melhoria?: string[] | null
          pontos_obtidos?: number | null
          pontos_possiveis?: number | null
          protocolo?: string | null
          resultado?: Json | null
          status?: string
          tipo?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          attendant_id: string | null
          company_id: string | null
          created_at: string
          deleted_at: string | null
          force_password_change: boolean
          full_name: string | null
          id: string
        }
        Insert: {
          active?: boolean
          attendant_id?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          force_password_change?: boolean
          full_name?: string | null
          id: string
        }
        Update: {
          active?: boolean
          attendant_id?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          force_password_change?: boolean
          full_name?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_attendant_id_fkey"
            columns: ["attendant_id"]
            isOneToOne: false
            referencedRelation: "attendants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sectors: {
        Row: {
          created_at: string
          id: string
          sector_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sector_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sector_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_company_id: { Args: never; Returns: string }
      get_my_sector_ids: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "auditoria"
        | "credito"
        | "credit_manual"
        | "credit_upload"
        | "mentoria_atendente"
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
      app_role: [
        "admin",
        "user",
        "auditoria",
        "credito",
        "credit_manual",
        "credit_upload",
        "mentoria_atendente",
      ],
    },
  },
} as const
