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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_transfer_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          new_email: string
          notes: string | null
          requested_by: string
          status: Database["public"]["Enums"]["admin_transfer_status"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          new_email: string
          notes?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["admin_transfer_status"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          new_email?: string
          notes?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["admin_transfer_status"]
        }
        Relationships: []
      }
      approval_history: {
        Row: {
          action: string
          approver_id: string
          comments: string | null
          created_at: string
          id: string
          request_id: string
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Insert: {
          action: string
          approver_id: string
          comments?: string | null
          created_at?: string
          id?: string
          request_id: string
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Update: {
          action?: string
          approver_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          request_id?: string
          stage?: Database["public"]["Enums"]["approval_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "approval_history_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "approval_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "outing_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          admin_response: string | null
          category: string
          created_at: string
          description: string
          id: string
          is_anonymous: boolean
          responded_at: string | null
          responded_by: string | null
          status: string
          submitted_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          admin_response?: string | null
          category: string
          created_at?: string
          description: string
          id?: string
          is_anonymous?: boolean
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          submitted_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          admin_response?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_anonymous?: boolean
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          submitted_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "complaints_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      notices: {
        Row: {
          content: string
          created_at: string
          id: string
          is_urgent: boolean
          posted_by: string
          target_roles: Database["public"]["Enums"]["user_role"][]
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_urgent?: boolean
          posted_by: string
          target_roles?: Database["public"]["Enums"]["user_role"][]
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_urgent?: boolean
          posted_by?: string
          target_roles?: Database["public"]["Enums"]["user_role"][]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      outing_requests: {
        Row: {
          advisor_approved_at: string | null
          advisor_approved_by: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          current_stage: Database["public"]["Enums"]["approval_stage"]
          destination: string
          final_status: Database["public"]["Enums"]["request_status"]
          from_date: string
          from_time: string | null
          hod_approved_at: string | null
          hod_approved_by: string | null
          id: string
          outing_type: Database["public"]["Enums"]["outing_type"]
          reason: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          student_id: string
          to_date: string
          to_time: string | null
          updated_at: string
          warden_approved_at: string | null
          warden_approved_by: string | null
        }
        Insert: {
          advisor_approved_at?: string | null
          advisor_approved_by?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["approval_stage"]
          destination: string
          final_status?: Database["public"]["Enums"]["request_status"]
          from_date: string
          from_time?: string | null
          hod_approved_at?: string | null
          hod_approved_by?: string | null
          id?: string
          outing_type: Database["public"]["Enums"]["outing_type"]
          reason: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          student_id: string
          to_date: string
          to_time?: string | null
          updated_at?: string
          warden_approved_at?: string | null
          warden_approved_by?: string | null
        }
        Update: {
          advisor_approved_at?: string | null
          advisor_approved_by?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["approval_stage"]
          destination?: string
          final_status?: Database["public"]["Enums"]["request_status"]
          from_date?: string
          from_time?: string | null
          hod_approved_at?: string | null
          hod_approved_by?: string | null
          id?: string
          outing_type?: Database["public"]["Enums"]["outing_type"]
          reason?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          student_id?: string
          to_date?: string
          to_time?: string | null
          updated_at?: string
          warden_approved_at?: string | null
          warden_approved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outing_requests_advisor_approved_by_fkey"
            columns: ["advisor_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "outing_requests_hod_approved_by_fkey"
            columns: ["hod_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "outing_requests_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "outing_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "outing_requests_warden_approved_by_fkey"
            columns: ["warden_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          is_approved: boolean
          is_blocked: boolean
          key_issued_at: string | null
          key_number: string | null
          local_address: string | null
          permanent_address: string | null
          phone: string | null
          photo_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          room_id: string | null
          staff_id: string | null
          student_id: string | null
          updated_at: string
          user_id: string
          year_of_study: number | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email: string
          full_name: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          is_approved?: boolean
          is_blocked?: boolean
          key_issued_at?: string | null
          key_number?: string | null
          local_address?: string | null
          permanent_address?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          room_id?: string | null
          staff_id?: string | null
          student_id?: string | null
          updated_at?: string
          user_id: string
          year_of_study?: number | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          is_approved?: boolean
          is_blocked?: boolean
          key_issued_at?: string | null
          key_number?: string | null
          local_address?: string | null
          permanent_address?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          room_id?: string | null
          staff_id?: string | null
          student_id?: string | null
          updated_at?: string
          user_id?: string
          year_of_study?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number
          created_at: string
          floor: number
          id: string
          key_a_holder: string | null
          key_b_holder: string | null
          occupied: number
          room_number: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          floor: number
          id?: string
          key_a_holder?: string | null
          key_b_holder?: string | null
          occupied?: number
          room_number: string
        }
        Update: {
          capacity?: number
          created_at?: string
          floor?: number
          id?: string
          key_a_holder?: string | null
          key_b_holder?: string | null
          occupied?: number
          room_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_key_a_holder_fkey"
            columns: ["key_a_holder"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_key_b_holder_fkey"
            columns: ["key_b_holder"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_safe_complaints: {
        Args: never
        Returns: {
          admin_response: string
          category: string
          created_at: string
          description: string
          id: string
          is_anonymous: boolean
          responded_at: string
          responded_by: string
          status: string
          submitted_by: string
          title: string
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_approved: { Args: { user_uuid: string }; Returns: boolean }
    }
    Enums: {
      admin_transfer_status: "pending" | "approved" | "rejected"
      approval_stage: "advisor" | "hod" | "warden" | "completed"
      outing_type: "local" | "hometown"
      request_status: "pending" | "approved" | "rejected"
      user_role:
        | "admin"
        | "warden"
        | "advisor"
        | "hod"
        | "student"
        | "principal"
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
      admin_transfer_status: ["pending", "approved", "rejected"],
      approval_stage: ["advisor", "hod", "warden", "completed"],
      outing_type: ["local", "hometown"],
      request_status: ["pending", "approved", "rejected"],
      user_role: ["admin", "warden", "advisor", "hod", "student", "principal"],
    },
  },
} as const
