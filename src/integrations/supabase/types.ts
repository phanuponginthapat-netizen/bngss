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
      academic_events: {
        Row: {
          academic_year: number | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          event_date: string
          event_type: string
          id: string
          is_notified: boolean
          location: string | null
          school_id: string | null
          semester: number | null
          source_ref_id: string | null
          source_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          academic_year?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_date: string
          event_type?: string
          id?: string
          is_notified?: boolean
          location?: string | null
          school_id?: string | null
          semester?: number | null
          source_ref_id?: string | null
          source_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          academic_year?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_date?: string
          event_type?: string
          id?: string
          is_notified?: boolean
          location?: string | null
          school_id?: string | null
          semester?: number | null
          source_ref_id?: string | null
          source_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_periods: {
        Row: {
          academic_year_be: number
          created_at: string
          end_date: string
          final_date: string | null
          fix_window_open: boolean
          id: string
          is_closed: boolean
          is_current: boolean
          midterm_date: string | null
          note: string | null
          semester: number
          start_date: string
          updated_at: string
        }
        Insert: {
          academic_year_be: number
          created_at?: string
          end_date: string
          final_date?: string | null
          fix_window_open?: boolean
          id?: string
          is_closed?: boolean
          is_current?: boolean
          midterm_date?: string | null
          note?: string | null
          semester: number
          start_date: string
          updated_at?: string
        }
        Update: {
          academic_year_be?: number
          created_at?: string
          end_date?: string
          final_date?: string | null
          fix_window_open?: boolean
          id?: string
          is_closed?: boolean
          is_current?: boolean
          midterm_date?: string | null
          note?: string | null
          semester?: number
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      account_balances: {
        Row: {
          account_name: string
          balance: number
          created_at: string
          fiscal_year: number
          id: string
          month: number
          notes: string | null
          school_id: string | null
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          account_name: string
          balance?: number
          created_at?: string
          fiscal_year?: number
          id?: string
          month?: number
          notes?: string | null
          school_id?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          account_name?: string
          balance?: number
          created_at?: string
          fiscal_year?: number
          id?: string
          month?: number
          notes?: string | null
          school_id?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_balances_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plans: {
        Row: {
          academic_year: number | null
          act_details: string | null
          act_score: number | null
          attachments: string[] | null
          budget_amount: number | null
          budget_source: string | null
          check_details: string | null
          check_score: number | null
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          do_details: string | null
          do_score: number | null
          end_date: string | null
          fiscal_year: number | null
          id: string
          kpi_indicator: string | null
          kpi_target: string | null
          objective: string | null
          overall_result: string | null
          plan_code: string | null
          plan_details: string | null
          plan_score: number | null
          responsible_person: string | null
          school_id: string | null
          start_date: string | null
          status: string
          strategy: string | null
          title: string
          updated_at: string
        }
        Insert: {
          academic_year?: number | null
          act_details?: string | null
          act_score?: number | null
          attachments?: string[] | null
          budget_amount?: number | null
          budget_source?: string | null
          check_details?: string | null
          check_score?: number | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          do_details?: string | null
          do_score?: number | null
          end_date?: string | null
          fiscal_year?: number | null
          id?: string
          kpi_indicator?: string | null
          kpi_target?: string | null
          objective?: string | null
          overall_result?: string | null
          plan_code?: string | null
          plan_details?: string | null
          plan_score?: number | null
          responsible_person?: string | null
          school_id?: string | null
          start_date?: string | null
          status?: string
          strategy?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          academic_year?: number | null
          act_details?: string | null
          act_score?: number | null
          attachments?: string[] | null
          budget_amount?: number | null
          budget_source?: string | null
          check_details?: string | null
          check_score?: number | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          do_details?: string | null
          do_score?: number | null
          end_date?: string | null
          fiscal_year?: number | null
          id?: string
          kpi_indicator?: string | null
          kpi_target?: string | null
          objective?: string | null
          overall_result?: string | null
          plan_code?: string | null
          plan_details?: string | null
          plan_score?: number | null
          responsible_person?: string | null
          school_id?: string | null
          start_date?: string | null
          status?: string
          strategy?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          academic_period_id: string | null
          allow_alumni: boolean
          budget: number | null
          category: string
          certificate_url: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          criteria: Json
          description: string | null
          end_at: string | null
          format: string
          gallery_images: Json
          id: string
          level: string | null
          live_stream_url: string | null
          location: string | null
          max_participants: number | null
          max_score: number | null
          participant_names: string | null
          registration_deadline: string | null
          registration_open: boolean
          report_summary: string | null
          result_summary: string | null
          results_published: boolean
          results_published_at: string | null
          rules: string | null
          scoring_mode: string
          sports_day_meet_id: string | null
          start_at: string | null
          status: string
          supervisor_teachers: string | null
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          academic_period_id?: string | null
          allow_alumni?: boolean
          budget?: number | null
          category?: string
          certificate_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          criteria?: Json
          description?: string | null
          end_at?: string | null
          format?: string
          gallery_images?: Json
          id?: string
          level?: string | null
          live_stream_url?: string | null
          location?: string | null
          max_participants?: number | null
          max_score?: number | null
          participant_names?: string | null
          registration_deadline?: string | null
          registration_open?: boolean
          report_summary?: string | null
          result_summary?: string | null
          results_published?: boolean
          results_published_at?: string | null
          rules?: string | null
          scoring_mode?: string
          sports_day_meet_id?: string | null
          start_at?: string | null
          status?: string
          supervisor_teachers?: string | null
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          academic_period_id?: string | null
          allow_alumni?: boolean
          budget?: number | null
          category?: string
          certificate_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          criteria?: Json
          description?: string | null
          end_at?: string | null
          format?: string
          gallery_images?: Json
          id?: string
          level?: string | null
          live_stream_url?: string | null
          location?: string | null
          max_participants?: number | null
          max_score?: number | null
          participant_names?: string | null
          registration_deadline?: string | null
          registration_open?: boolean
          report_summary?: string | null
          result_summary?: string | null
          results_published?: boolean
          results_published_at?: string | null
          rules?: string | null
          scoring_mode?: string
          sports_day_meet_id?: string | null
          start_at?: string | null
          status?: string
          supervisor_teachers?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_sports_day_meet_id_fkey"
            columns: ["sports_day_meet_id"]
            isOneToOne: false
            referencedRelation: "sports_day_meets"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_matches: {
        Row: {
          activity_id: string
          bracket_slot: string | null
          court: string | null
          created_at: string
          id: string
          match_no: number
          notes: string | null
          participant_a_id: string | null
          participant_b_id: string | null
          round: number
          scheduled_at: string | null
          score_a: number | null
          score_b: number | null
          status: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          activity_id: string
          bracket_slot?: string | null
          court?: string | null
          created_at?: string
          id?: string
          match_no?: number
          notes?: string | null
          participant_a_id?: string | null
          participant_b_id?: string | null
          round?: number
          scheduled_at?: string | null
          score_a?: number | null
          score_b?: number | null
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          activity_id?: string
          bracket_slot?: string | null
          court?: string | null
          created_at?: string
          id?: string
          match_no?: number
          notes?: string | null
          participant_a_id?: string | null
          participant_b_id?: string | null
          round?: number
          scheduled_at?: string | null
          score_a?: number | null
          score_b?: number | null
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_matches_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_matches_participant_a_id_fkey"
            columns: ["participant_a_id"]
            isOneToOne: false
            referencedRelation: "activity_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_matches_participant_b_id_fkey"
            columns: ["participant_b_id"]
            isOneToOne: false
            referencedRelation: "activity_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "activity_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_participants: {
        Row: {
          activity_id: string
          bib_no: string | null
          created_at: string
          id: string
          is_team_leader: boolean
          sports_day_house_id: string | null
          student_id: string
          team_logo_url: string | null
          team_members: Json
          team_name: string | null
        }
        Insert: {
          activity_id: string
          bib_no?: string | null
          created_at?: string
          id?: string
          is_team_leader?: boolean
          sports_day_house_id?: string | null
          student_id: string
          team_logo_url?: string | null
          team_members?: Json
          team_name?: string | null
        }
        Update: {
          activity_id?: string
          bib_no?: string | null
          created_at?: string
          id?: string
          is_team_leader?: boolean
          sports_day_house_id?: string | null
          student_id?: string
          team_logo_url?: string | null
          team_members?: Json
          team_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_sports_day_house_id_fkey"
            columns: ["sports_day_house_id"]
            isOneToOne: false
            referencedRelation: "sports_day_houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_posts: {
        Row: {
          activity_id: string
          id: string
          image_url: string | null
          posted_at: string
          posted_by: string | null
          wall_post_id: string | null
        }
        Insert: {
          activity_id: string
          id?: string
          image_url?: string | null
          posted_at?: string
          posted_by?: string | null
          wall_post_id?: string | null
        }
        Update: {
          activity_id?: string
          id?: string
          image_url?: string | null
          posted_at?: string
          posted_by?: string | null
          wall_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_posts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_scores: {
        Row: {
          activity_id: string
          criteria_scores: Json
          id: string
          judge_id: string | null
          note: string | null
          participant_id: string
          rank: number | null
          recorded_at: string
          score: number | null
          updated_at: string
        }
        Insert: {
          activity_id: string
          criteria_scores?: Json
          id?: string
          judge_id?: string | null
          note?: string | null
          participant_id: string
          rank?: number | null
          recorded_at?: string
          score?: number | null
          updated_at?: string
        }
        Update: {
          activity_id?: string
          criteria_scores?: Json
          id?: string
          judge_id?: string | null
          note?: string | null
          participant_id?: string
          rank?: number | null
          recorded_at?: string
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_scores_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_scores_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "activity_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_permission_grants: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          module_key: string
          notes: string | null
          scope: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          module_key: string
          notes?: string | null
          scope?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          module_key?: string
          notes?: string | null
          scope?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admissions: {
        Row: {
          academic_year: number | null
          applicant_first_name: string
          applicant_last_name: string
          applicant_prefix: string | null
          applied_at: string
          created_at: string
          exam_room: string | null
          exam_score: number | null
          exam_seat: number | null
          grade_applying: string
          id: string
          parent_name: string | null
          parent_phone: string | null
          previous_school: string | null
          school_id: string | null
          status: string
        }
        Insert: {
          academic_year?: number | null
          applicant_first_name: string
          applicant_last_name: string
          applicant_prefix?: string | null
          applied_at?: string
          created_at?: string
          exam_room?: string | null
          exam_score?: number | null
          exam_seat?: number | null
          grade_applying: string
          id?: string
          parent_name?: string | null
          parent_phone?: string | null
          previous_school?: string | null
          school_id?: string | null
          status?: string
        }
        Update: {
          academic_year?: number | null
          applicant_first_name?: string
          applicant_last_name?: string
          applicant_prefix?: string | null
          applied_at?: string
          created_at?: string
          exam_room?: string | null
          exam_score?: number | null
          exam_seat?: number | null
          grade_applying?: string
          id?: string
          parent_name?: string | null
          parent_phone?: string | null
          previous_school?: string | null
          school_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "admissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_logs: {
        Row: {
          content: string
          created_at: string
          id: string
          model: string | null
          risk_flags: string[] | null
          risk_level: string | null
          role: string
          sentiment: string | null
          session_id: string | null
          tokens_in: number | null
          tokens_out: number | null
          topic: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          model?: string | null
          risk_flags?: string[] | null
          risk_level?: string | null
          role: string
          sentiment?: string | null
          session_id?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          topic?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          model?: string | null
          risk_flags?: string[] | null
          risk_level?: string | null
          role?: string
          sentiment?: string | null
          session_id?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          topic?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      ai_provider_keys: {
        Row: {
          api_key: string
          cooldown_until: string | null
          created_at: string
          daily_limit: number | null
          id: string
          label: string | null
          last_error: string | null
          last_reset_date: string
          last_used_at: string | null
          priority: number
          provider_type: string
          status: string
          updated_at: string
          used_today: number
          used_total: number
        }
        Insert: {
          api_key: string
          cooldown_until?: string | null
          created_at?: string
          daily_limit?: number | null
          id?: string
          label?: string | null
          last_error?: string | null
          last_reset_date?: string
          last_used_at?: string | null
          priority?: number
          provider_type: string
          status?: string
          updated_at?: string
          used_today?: number
          used_total?: number
        }
        Update: {
          api_key?: string
          cooldown_until?: string | null
          created_at?: string
          daily_limit?: number | null
          id?: string
          label?: string | null
          last_error?: string | null
          last_reset_date?: string
          last_used_at?: string | null
          priority?: number
          provider_type?: string
          status?: string
          updated_at?: string
          used_today?: number
          used_total?: number
        }
        Relationships: []
      }
      ai_providers: {
        Row: {
          api_key: string | null
          base_url: string
          created_at: string
          enabled: boolean
          extra_headers: Json | null
          id: string
          model: string
          monthly_call_limit: number | null
          name: string
          notes: string | null
          priority: number
          provider_type: string
          supports_json: boolean
          supports_vision: boolean
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          base_url: string
          created_at?: string
          enabled?: boolean
          extra_headers?: Json | null
          id?: string
          model: string
          monthly_call_limit?: number | null
          name: string
          notes?: string | null
          priority?: number
          provider_type?: string
          supports_json?: boolean
          supports_vision?: boolean
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          base_url?: string
          created_at?: string
          enabled?: boolean
          extra_headers?: Json | null
          id?: string
          model?: string
          monthly_call_limit?: number | null
          name?: string
          notes?: string | null
          priority?: number
          provider_type?: string
          supports_json?: boolean
          supports_vision?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          called_by: string | null
          created_at: string
          error_message: string | null
          estimated_cost: number | null
          function_name: string | null
          id: string
          latency_ms: number | null
          model: string | null
          provider_id: string | null
          provider_name: string | null
          success: boolean | null
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          called_by?: string | null
          created_at?: string
          error_message?: string | null
          estimated_cost?: number | null
          function_name?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          provider_id?: string | null
          provider_name?: string | null
          success?: boolean | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          called_by?: string | null
          created_at?: string
          error_message?: string | null
          estimated_cost?: number | null
          function_name?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          provider_id?: string | null
          provider_name?: string | null
          success?: boolean | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers_meta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_user_memory: {
        Row: {
          created_at: string
          facts: string[] | null
          last_topic: string | null
          message_count: number
          preferences: Json | null
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          facts?: string[] | null
          last_topic?: string | null
          message_count?: number
          preferences?: Json | null
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          facts?: string[] | null
          last_topic?: string | null
          message_count?: number
          preferences?: Json | null
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alumni_university: {
        Row: {
          alumni_user_id: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          current_company: string | null
          current_position: string | null
          degree: string | null
          faculty: string | null
          graduation_year: number
          id: string
          is_employed: boolean | null
          major: string | null
          notes: string | null
          student_id: string | null
          university: string
          updated_at: string
        }
        Insert: {
          alumni_user_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          current_company?: string | null
          current_position?: string | null
          degree?: string | null
          faculty?: string | null
          graduation_year: number
          id?: string
          is_employed?: boolean | null
          major?: string | null
          notes?: string | null
          student_id?: string | null
          university: string
          updated_at?: string
        }
        Update: {
          alumni_user_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          current_company?: string | null
          current_position?: string | null
          degree?: string | null
          faculty?: string | null
          graduation_year?: number
          id?: string
          is_employed?: boolean | null
          major?: string | null
          notes?: string | null
          student_id?: string | null
          university?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alumni_university_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumni_university_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      app_secrets: {
        Row: {
          category: string
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          category?: string
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          category?: string
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      app_user_connections: {
        Row: {
          account_email: string | null
          account_name: string | null
          connected_at: string
          connection_key: string
          connector_id: string
          external_user_id: string
          id: string
          last_used_at: string | null
          revoked_at: string | null
          scopes: string[] | null
          user_id: string
        }
        Insert: {
          account_email?: string | null
          account_name?: string | null
          connected_at?: string
          connection_key: string
          connector_id: string
          external_user_id: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          scopes?: string[] | null
          user_id: string
        }
        Update: {
          account_email?: string | null
          account_name?: string | null
          connected_at?: string
          connection_key?: string
          connector_id?: string
          external_user_id?: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          scopes?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      archive_logs: {
        Row: {
          archive_path: string | null
          cutoff_year: number
          id: string
          ran_at: string
          ran_by: string | null
          retention_years: number
          summary: Json
        }
        Insert: {
          archive_path?: string | null
          cutoff_year: number
          id?: string
          ran_at?: string
          ran_by?: string | null
          retention_years?: number
          summary?: Json
        }
        Update: {
          archive_path?: string | null
          cutoff_year?: number
          id?: string
          ran_at?: string
          ran_by?: string | null
          retention_years?: number
          summary?: Json
        }
        Relationships: []
      }
      assessment_criteria: {
        Row: {
          academic_year: number | null
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          title: string
        }
        Insert: {
          academic_year?: number | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title: string
        }
        Update: {
          academic_year?: number | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title?: string
        }
        Relationships: []
      }
      asset_damage_reports: {
        Row: {
          asset_id: string
          created_at: string
          description: string
          id: string
          report_date: string
          reported_by_user_id: string | null
          reporter_name: string | null
          resolution_notes: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          description: string
          id?: string
          report_date?: string
          reported_by_user_id?: string | null
          reporter_name?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          description?: string
          id?: string
          report_date?: string
          reported_by_user_id?: string | null
          reporter_name?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_damage_reports_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_damage_reports_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets_public_lookup"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          acquisition_cost: number
          acquisition_date: string | null
          asset_code: string
          asset_name: string
          barcode: string | null
          budget_source: string | null
          building: string | null
          category: string
          condition: string | null
          created_at: string
          current_value: number | null
          depreciation_rate: number | null
          fiscal_year: number | null
          floor: string | null
          gfmis_code: string | null
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          notes: string | null
          photo_url: string | null
          photos: Json
          quantity: number
          responsible_person: string | null
          responsible_user_id: string | null
          room: string | null
          school_id: string | null
          serial_number: string | null
          status: string
          supplier: string | null
          useful_life_years: number | null
          warranty_until: string | null
        }
        Insert: {
          acquisition_cost?: number
          acquisition_date?: string | null
          asset_code: string
          asset_name: string
          barcode?: string | null
          budget_source?: string | null
          building?: string | null
          category?: string
          condition?: string | null
          created_at?: string
          current_value?: number | null
          depreciation_rate?: number | null
          fiscal_year?: number | null
          floor?: string | null
          gfmis_code?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          notes?: string | null
          photo_url?: string | null
          photos?: Json
          quantity?: number
          responsible_person?: string | null
          responsible_user_id?: string | null
          room?: string | null
          school_id?: string | null
          serial_number?: string | null
          status?: string
          supplier?: string | null
          useful_life_years?: number | null
          warranty_until?: string | null
        }
        Update: {
          acquisition_cost?: number
          acquisition_date?: string | null
          asset_code?: string
          asset_name?: string
          barcode?: string | null
          budget_source?: string | null
          building?: string | null
          category?: string
          condition?: string | null
          created_at?: string
          current_value?: number | null
          depreciation_rate?: number | null
          fiscal_year?: number | null
          floor?: string | null
          gfmis_code?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          notes?: string | null
          photo_url?: string | null
          photos?: Json
          quantity?: number
          responsible_person?: string | null
          responsible_user_id?: string | null
          room?: string | null
          school_id?: string | null
          serial_number?: string | null
          status?: string
          supplier?: string | null
          useful_life_years?: number | null
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          academic_year: number | null
          attendance_date: string
          created_at: string
          id: string
          notes: string | null
          recorded_by: string | null
          school_id: string | null
          semester: number | null
          status: string
          student_id: string | null
          subject_id: string | null
        }
        Insert: {
          academic_year?: number | null
          attendance_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          school_id?: string | null
          semester?: number | null
          status?: string
          student_id?: string | null
          subject_id?: string | null
        }
        Update: {
          academic_year?: number | null
          attendance_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          school_id?: string | null
          semester?: number | null
          status?: string
          student_id?: string | null
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_table: string | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      behavior_records: {
        Row: {
          behavior_type: string
          created_at: string
          description: string
          id: string
          images: Json
          points: number | null
          record_date: string
          recorded_by: string | null
          school_id: string | null
          student_id: string | null
        }
        Insert: {
          behavior_type?: string
          created_at?: string
          description: string
          id?: string
          images?: Json
          points?: number | null
          record_date?: string
          recorded_by?: string | null
          school_id?: string | null
          student_id?: string | null
        }
        Update: {
          behavior_type?: string
          created_at?: string
          description?: string
          id?: string
          images?: Json
          points?: number | null
          record_date?: string
          recorded_by?: string | null
          school_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "behavior_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavior_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavior_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      browser_logs: {
        Row: {
          action: string
          created_at: string
          domain: string
          id: string
          reason: string | null
          url: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action?: string
          created_at?: string
          domain: string
          id?: string
          reason?: string | null
          url: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          domain?: string
          id?: string
          reason?: string | null
          url?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      browser_shortcuts: {
        Row: {
          bg_class: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          label_en: string
          label_th: string
          logo_url: string | null
          sort_order: number
          target_url: string
          updated_at: string
          visible_roles: string[]
        }
        Insert: {
          bg_class?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label_en: string
          label_th: string
          logo_url?: string | null
          sort_order?: number
          target_url: string
          updated_at?: string
          visible_roles?: string[]
        }
        Update: {
          bg_class?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label_en?: string
          label_th?: string
          logo_url?: string | null
          sort_order?: number
          target_url?: string
          updated_at?: string
          visible_roles?: string[]
        }
        Relationships: []
      }
      budget_allocations: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          department: string | null
          fiscal_year_id: string | null
          id: string
          is_locked: boolean
          note: string | null
          project_id: string | null
          source_id: string | null
          updated_at: string
          used_amount: number
        }
        Insert: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          fiscal_year_id?: string | null
          id?: string
          is_locked?: boolean
          note?: string | null
          project_id?: string | null
          source_id?: string | null
          updated_at?: string
          used_amount?: number
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          fiscal_year_id?: string | null
          id?: string
          is_locked?: boolean
          note?: string | null
          project_id?: string | null
          source_id?: string | null
          updated_at?: string
          used_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_allocations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_allocations_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "hub_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_budget_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "budget_allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_financial_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "budget_allocations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "budget_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_approvals: {
        Row: {
          acted_at: string
          action: string
          approver_id: string | null
          comment: string | null
          id: string
          request_id: string
          signature_url: string | null
          step_index: number
          step_role: string
        }
        Insert: {
          acted_at?: string
          action: string
          approver_id?: string | null
          comment?: string | null
          id?: string
          request_id: string
          signature_url?: string | null
          step_index: number
          step_role: string
        }
        Update: {
          acted_at?: string
          action?: string
          approver_id?: string | null
          comment?: string | null
          id?: string
          request_id?: string
          signature_url?: string | null
          step_index?: number
          step_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "budget_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          detail: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          detail?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          detail?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      budget_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      budget_requests: {
        Row: {
          activity_id: string | null
          amount: number
          approved_at: string | null
          attachments: Json | null
          category_id: string | null
          created_at: string
          current_step: number
          department: string | null
          description: string | null
          fiscal_year_id: string | null
          id: string
          project_id: string | null
          purpose: string | null
          request_no: string | null
          requester_id: string | null
          source_id: string | null
          status: string
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          amount: number
          approved_at?: string | null
          attachments?: Json | null
          category_id?: string | null
          created_at?: string
          current_step?: number
          department?: string | null
          description?: string | null
          fiscal_year_id?: string | null
          id?: string
          project_id?: string | null
          purpose?: string | null
          request_no?: string | null
          requester_id?: string | null
          source_id?: string | null
          status?: string
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          amount?: number
          approved_at?: string | null
          attachments?: Json | null
          category_id?: string | null
          created_at?: string
          current_step?: number
          department?: string | null
          description?: string | null
          fiscal_year_id?: string | null
          id?: string
          project_id?: string | null
          purpose?: string | null
          request_no?: string | null
          requester_id?: string | null
          source_id?: string | null
          status?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_requests_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "project_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_requests_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "hub_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_budget_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "budget_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_financial_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "budget_requests_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "budget_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_sources: {
        Row: {
          budget_amount: number
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          fiscal_year_id: string | null
          id: string
          is_active: boolean
          name: string
          received_amount: number
          source_type: string
          updated_at: string
          used_amount: number
        }
        Insert: {
          budget_amount?: number
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fiscal_year_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          received_amount?: number
          source_type?: string
          updated_at?: string
          used_amount?: number
        }
        Update: {
          budget_amount?: number
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fiscal_year_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          received_amount?: number
          source_type?: string
          updated_at?: string
          used_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_sources_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_transactions: {
        Row: {
          amount: number
          approved_by: string | null
          budget_source: string | null
          category: string
          created_at: string
          description: string
          fiscal_year: number | null
          id: string
          notes: string | null
          project_name: string | null
          quarter: number | null
          receipt_number: string | null
          school_id: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          amount?: number
          approved_by?: string | null
          budget_source?: string | null
          category?: string
          created_at?: string
          description: string
          fiscal_year?: number | null
          id?: string
          notes?: string | null
          project_name?: string | null
          quarter?: number | null
          receipt_number?: string | null
          school_id?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          budget_source?: string | null
          category?: string
          created_at?: string
          description?: string
          fiscal_year?: number | null
          id?: string
          notes?: string | null
          project_name?: string | null
          quarter?: number | null
          receipt_number?: string | null
          school_id?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_transactions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_transfers: {
        Row: {
          amount: number
          approved_by: string | null
          created_at: string
          created_by: string | null
          fiscal_year_id: string | null
          from_allocation_id: string | null
          id: string
          reason: string | null
          to_allocation_id: string | null
          transfer_type: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          fiscal_year_id?: string | null
          from_allocation_id?: string | null
          id?: string
          reason?: string | null
          to_allocation_id?: string | null
          transfer_type?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          fiscal_year_id?: string | null
          from_allocation_id?: string | null
          id?: string
          reason?: string | null
          to_allocation_id?: string | null
          transfer_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_transfers_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_transfers_from_allocation_id_fkey"
            columns: ["from_allocation_id"]
            isOneToOne: false
            referencedRelation: "budget_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_transfers_to_allocation_id_fkey"
            columns: ["to_allocation_id"]
            isOneToOne: false
            referencedRelation: "budget_allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_routes: {
        Row: {
          capacity: number | null
          code: string | null
          created_at: string
          driver_personnel_id: string | null
          id: string
          is_active: boolean
          monthly_fee: number | null
          name: string
          school_id: string | null
          updated_at: string
          vehicle_color: string | null
          vehicle_plate: string | null
        }
        Insert: {
          capacity?: number | null
          code?: string | null
          created_at?: string
          driver_personnel_id?: string | null
          id?: string
          is_active?: boolean
          monthly_fee?: number | null
          name: string
          school_id?: string | null
          updated_at?: string
          vehicle_color?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          capacity?: number | null
          code?: string | null
          created_at?: string
          driver_personnel_id?: string | null
          id?: string
          is_active?: boolean
          monthly_fee?: number | null
          name?: string
          school_id?: string | null
          updated_at?: string
          vehicle_color?: string | null
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bus_routes_driver_personnel_id_fkey"
            columns: ["driver_personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_routes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_stops: {
        Row: {
          created_at: string
          dropoff_time: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          pickup_time: string | null
          route_id: string
          sequence: number
        }
        Insert: {
          created_at?: string
          dropoff_time?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          pickup_time?: string | null
          route_id: string
          sequence?: number
        }
        Update: {
          created_at?: string
          dropoff_time?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          pickup_time?: string | null
          route_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "bus_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "bus_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_students: {
        Row: {
          created_at: string
          dropoff_stop_id: string | null
          end_date: string | null
          id: string
          is_active: boolean
          pickup_stop_id: string | null
          route_id: string
          start_date: string
          student_id: string
        }
        Insert: {
          created_at?: string
          dropoff_stop_id?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          pickup_stop_id?: string | null
          route_id: string
          start_date?: string
          student_id: string
        }
        Update: {
          created_at?: string
          dropoff_stop_id?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          pickup_stop_id?: string | null
          route_id?: string
          start_date?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_students_dropoff_stop_id_fkey"
            columns: ["dropoff_stop_id"]
            isOneToOne: false
            referencedRelation: "bus_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_students_pickup_stop_id_fkey"
            columns: ["pickup_stop_id"]
            isOneToOne: false
            referencedRelation: "bus_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_students_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "bus_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      cafeteria_menus: {
        Row: {
          allergens: string[] | null
          capacity: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          meal_type: string
          menu_date: string
          name: string
          ordered_count: number
          price: number
          school_id: string | null
          updated_at: string
        }
        Insert: {
          allergens?: string[] | null
          capacity?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          meal_type?: string
          menu_date: string
          name: string
          ordered_count?: number
          price?: number
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          allergens?: string[] | null
          capacity?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          meal_type?: string
          menu_date?: string
          name?: string
          ordered_count?: number
          price?: number
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafeteria_menus_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      cafeteria_orders: {
        Row: {
          created_at: string
          id: string
          menu_id: string
          notes: string | null
          ordered_by: string | null
          paid: boolean
          paid_at: string | null
          qty: number
          status: string
          student_id: string | null
          total_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_id: string
          notes?: string | null
          ordered_by?: string | null
          paid?: boolean
          paid_at?: string | null
          qty?: number
          status?: string
          student_id?: string | null
          total_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_id?: string
          notes?: string | null
          ordered_by?: string | null
          paid?: boolean
          paid_at?: string | null
          qty?: number
          status?: string
          student_id?: string | null
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafeteria_orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "cafeteria_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafeteria_orders_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafeteria_orders_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      cctv_cameras: {
        Row: {
          created_at: string
          hls_url: string | null
          id: string
          is_active: boolean
          location: string
          name: string
          notes: string | null
          rtsp_url: string | null
          school_id: string | null
          snapshot_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          hls_url?: string | null
          id?: string
          is_active?: boolean
          location: string
          name: string
          notes?: string | null
          rtsp_url?: string | null
          school_id?: string | null
          snapshot_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          hls_url?: string | null
          id?: string
          is_active?: boolean
          location?: string
          name?: string
          notes?: string | null
          rtsp_url?: string | null
          school_id?: string | null
          snapshot_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cctv_cameras_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          last_message_at: string
          last_message_preview: string | null
          name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_group?: boolean
          last_message_at?: string
          last_message_preview?: string | null
          name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_group?: boolean
          last_message_at?: string
          last_message_preview?: string | null
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachments: Json
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          is_deleted: boolean
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          attachments?: Json
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          attachments?: Json
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          conversation_id: string
          id: string
          is_muted: boolean
          joined_at: string
          last_read_at: string
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reports: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          message_id: string | null
          reason: string
          reported_user_id: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      classrooms: {
        Row: {
          academic_year: number
          capacity: number | null
          created_at: string
          grade_level: string
          homeroom_teacher: string | null
          homeroom_teacher_2: string | null
          homeroom_teacher_2_id: string | null
          homeroom_teacher_id: string | null
          homeroom_teachers: string[] | null
          id: string
          name: string
          reference_grade_level: string | null
          school_id: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: number
          capacity?: number | null
          created_at?: string
          grade_level: string
          homeroom_teacher?: string | null
          homeroom_teacher_2?: string | null
          homeroom_teacher_2_id?: string | null
          homeroom_teacher_id?: string | null
          homeroom_teachers?: string[] | null
          id?: string
          name: string
          reference_grade_level?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: number
          capacity?: number | null
          created_at?: string
          grade_level?: string
          homeroom_teacher?: string | null
          homeroom_teacher_2?: string | null
          homeroom_teacher_2_id?: string | null
          homeroom_teacher_id?: string | null
          homeroom_teachers?: string[] | null
          id?: string
          name?: string
          reference_grade_level?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classrooms_homeroom_teacher_2_id_fkey"
            columns: ["homeroom_teacher_2_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classrooms_homeroom_teacher_id_fkey"
            columns: ["homeroom_teacher_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classrooms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      club_advisors: {
        Row: {
          club_id: string
          created_at: string
          id: string
          is_lead: boolean
          role_title: string | null
          teacher_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          is_lead?: boolean
          role_title?: string | null
          teacher_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          is_lead?: boolean
          role_title?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_advisors_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_announcements: {
        Row: {
          audience: string
          body: string | null
          club_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          kind: string
          pinned: boolean
          starts_at: string | null
          title: string
        }
        Insert: {
          audience?: string
          body?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          pinned?: boolean
          starts_at?: string | null
          title: string
        }
        Update: {
          audience?: string
          body?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          pinned?: boolean
          starts_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_announcements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_applications: {
        Row: {
          club_id: string
          created_at: string
          id: string
          reason: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_applications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      club_attendance: {
        Row: {
          club_id: string
          created_at: string
          id: string
          note: string | null
          recorded_by: string | null
          session_date: string
          status: string
          student_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          note?: string | null
          recorded_by?: string | null
          session_date: string
          status?: string
          student_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          note?: string | null
          recorded_by?: string | null
          session_date?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_attendance_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      club_feed_posts: {
        Row: {
          author_id: string
          body: string | null
          club_id: string
          created_at: string
          id: string
          images: Json
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          club_id: string
          created_at?: string
          id?: string
          images?: Json
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          club_id?: string
          created_at?: string
          id?: string
          images?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_feed_posts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          id: string
          joined_at: string
          note: string | null
          position: string
          status: string
          student_id: string
        }
        Insert: {
          club_id: string
          id?: string
          joined_at?: string
          note?: string | null
          position?: string
          status?: string
          student_id: string
        }
        Update: {
          club_id?: string
          id?: string
          joined_at?: string
          note?: string | null
          position?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      club_works: {
        Row: {
          attachments: Json | null
          award: string | null
          club_id: string
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          title: string
          updated_at: string
          work_date: string | null
        }
        Insert: {
          attachments?: Json | null
          award?: string | null
          club_id: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          work_date?: string | null
        }
        Update: {
          attachments?: Json | null
          award?: string | null
          club_id?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          work_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_works_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          academic_year: number | null
          capacity: number | null
          category: string | null
          code: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          goals: string | null
          id: string
          is_special: boolean
          location: string | null
          logo_url: string | null
          meeting_day: string | null
          meeting_period: string | null
          name: string
          recruit_end: string | null
          recruit_open: boolean
          recruit_start: string | null
          semester: number | null
          special_kind: string | null
          status: string
          updated_at: string
        }
        Insert: {
          academic_year?: number | null
          capacity?: number | null
          category?: string | null
          code?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          goals?: string | null
          id?: string
          is_special?: boolean
          location?: string | null
          logo_url?: string | null
          meeting_day?: string | null
          meeting_period?: string | null
          name: string
          recruit_end?: string | null
          recruit_open?: boolean
          recruit_start?: string | null
          semester?: number | null
          special_kind?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          academic_year?: number | null
          capacity?: number | null
          category?: string | null
          code?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          goals?: string | null
          id?: string
          is_special?: boolean
          location?: string | null
          logo_url?: string | null
          meeting_day?: string | null
          meeting_period?: string | null
          name?: string
          recruit_end?: string | null
          recruit_open?: boolean
          recruit_start?: string | null
          semester?: number | null
          special_kind?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_menu_items: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean | null
          label: string
          page_id: string | null
          sort_order: number | null
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean | null
          label: string
          page_id?: string | null
          sort_order?: number | null
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean | null
          label?: string
          page_id?: string | null
          sort_order?: number | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_menu_items_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "cms_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_pages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_published: boolean | null
          slug: string
          sort_order: number | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_published?: boolean | null
          slug: string
          sort_order?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_published?: boolean | null
          slug?: string
          sort_order?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      config_bundles: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          content: Json
          created_at: string
          id: string
          notes: string | null
          source_url: string | null
          status: string
          version: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          content: Json
          created_at?: string
          id?: string
          notes?: string | null
          source_url?: string | null
          status?: string
          version: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          content?: Json
          created_at?: string
          id?: string
          notes?: string | null
          source_url?: string | null
          status?: string
          version?: string
        }
        Relationships: []
      }
      coop_members: {
        Row: {
          balance: number
          created_at: string
          full_name: string
          id: string
          joined_at: string
          loan_balance: number
          member_no: string
          school_id: string | null
          shares: number
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          balance?: number
          created_at?: string
          full_name: string
          id?: string
          joined_at?: string
          loan_balance?: number
          member_no: string
          school_id?: string | null
          shares?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          balance?: number
          created_at?: string
          full_name?: string
          id?: string
          joined_at?: string
          loan_balance?: number
          member_no?: string
          school_id?: string | null
          shares?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coop_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      coop_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          id: string
          member_id: string
          notes: string | null
          performed_by: string | null
          reference: string | null
          type: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          id?: string
          member_id: string
          notes?: string | null
          performed_by?: string | null
          reference?: string | null
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          id?: string
          member_id?: string
          notes?: string | null
          performed_by?: string | null
          reference?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "coop_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "coop_members"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_shortcuts: {
        Row: {
          bg_class: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          label_en: string
          label_th: string
          logo_url: string | null
          open_in_new_tab: boolean
          sort_order: number
          target_url: string
          updated_at: string
          visible_roles: string[]
        }
        Insert: {
          bg_class?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label_en: string
          label_th: string
          logo_url?: string | null
          open_in_new_tab?: boolean
          sort_order?: number
          target_url: string
          updated_at?: string
          visible_roles?: string[]
        }
        Update: {
          bg_class?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label_en?: string
          label_th?: string
          logo_url?: string | null
          open_in_new_tab?: boolean
          sort_order?: number
          target_url?: string
          updated_at?: string
          visible_roles?: string[]
        }
        Relationships: []
      }
      director_signatures: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          notes: string | null
          position: string
          signature_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          notes?: string | null
          position?: string
          signature_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          notes?: string | null
          position?: string
          signature_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      disbursements: {
        Row: {
          amount: number
          attachments: Json | null
          category_id: string | null
          created_at: string
          created_by: string | null
          disburse_date: string | null
          disbursement_no: string | null
          disbursement_type: string | null
          fiscal_year_id: string | null
          id: string
          note: string | null
          payee: string | null
          payer_id: string | null
          project_id: string | null
          request_id: string | null
          source_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          attachments?: Json | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          disburse_date?: string | null
          disbursement_no?: string | null
          disbursement_type?: string | null
          fiscal_year_id?: string | null
          id?: string
          note?: string | null
          payee?: string | null
          payer_id?: string | null
          project_id?: string | null
          request_id?: string | null
          source_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          attachments?: Json | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          disburse_date?: string | null
          disbursement_no?: string | null
          disbursement_type?: string | null
          fiscal_year_id?: string | null
          id?: string
          note?: string | null
          payee?: string | null
          payer_id?: string | null
          project_id?: string | null
          request_id?: string | null
          source_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disbursements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disbursements_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disbursements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "hub_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disbursements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_budget_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "disbursements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_financial_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "disbursements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "budget_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disbursements_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "budget_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      district_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[]
        }
        Relationships: []
      }
      district_feed_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          id: string
          ip_address: string | null
          method: string
          query_params: Json | null
          response_size: number | null
          status_code: number | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: string | null
          method: string
          query_params?: Json | null
          response_size?: number | null
          status_code?: number | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: string | null
          method?: string
          query_params?: Json | null
          response_size?: number | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "district_feed_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "district_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      district_snapshots: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          payload: Json
          school_id: string | null
          snapshot_date: string
          snapshot_type: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          payload: Json
          school_id?: string | null
          snapshot_date?: string
          snapshot_type?: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          payload?: Json
          school_id?: string | null
          snapshot_date?: string
          snapshot_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "district_snapshots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      document_recipients: {
        Row: {
          created_at: string
          document_id: string
          id: string
          is_read: boolean
          read_at: string | null
          recipient_name: string
          recipient_type: string
          recipient_user_id: string | null
          replied_at: string | null
          reply_file_name: string | null
          reply_file_url: string | null
          reply_file_urls: Json
          reply_message: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          recipient_name: string
          recipient_type?: string
          recipient_user_id?: string | null
          replied_at?: string | null
          reply_file_name?: string | null
          reply_file_url?: string | null
          reply_file_urls?: Json
          reply_message?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          recipient_name?: string
          recipient_type?: string
          recipient_user_id?: string | null
          replied_at?: string | null
          reply_file_name?: string | null
          reply_file_url?: string | null
          reply_file_urls?: Json
          reply_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_recipients_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          doc_date: string
          doc_number: string
          doc_type: string
          file_name: string | null
          file_url: string | null
          file_urls: Json
          from_department: string | null
          id: string
          notes: string | null
          school_id: string | null
          status: string
          title: string
          to_department: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doc_date?: string
          doc_number: string
          doc_type?: string
          file_name?: string | null
          file_url?: string | null
          file_urls?: Json
          from_department?: string | null
          id?: string
          notes?: string | null
          school_id?: string | null
          status?: string
          title: string
          to_department?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doc_date?: string
          doc_number?: string
          doc_type?: string
          file_name?: string | null
          file_url?: string | null
          file_urls?: Json
          from_department?: string | null
          id?: string
          notes?: string | null
          school_id?: string | null
          status?: string
          title?: string
          to_department?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          day_of_week: number | null
          duty_date: string | null
          end_time: string | null
          id: string
          location_id: string
          notes: string | null
          role_label: string | null
          school_id: string | null
          start_time: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day_of_week?: number | null
          duty_date?: string | null
          end_time?: string | null
          id?: string
          location_id: string
          notes?: string | null
          role_label?: string | null
          school_id?: string | null
          start_time?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day_of_week?: number | null
          duty_date?: string | null
          end_time?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          role_label?: string | null
          school_id?: string | null
          start_time?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "duty_assignments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "duty_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_locations: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          school_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          school_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      duty_logs: {
        Row: {
          assignment_id: string | null
          attachments: Json | null
          category: string | null
          content: string
          created_at: string
          id: string
          location_id: string | null
          log_date: string
          log_time: string
          reported_by: string | null
          school_id: string | null
          teacher_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          attachments?: Json | null
          category?: string | null
          content: string
          created_at?: string
          id?: string
          location_id?: string | null
          log_date?: string
          log_time?: string
          reported_by?: string | null
          school_id?: string | null
          teacher_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          attachments?: Json | null
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          location_id?: string | null
          log_date?: string
          log_time?: string
          reported_by?: string | null
          school_id?: string | null
          teacher_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "duty_logs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "duty_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_logs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "duty_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_logs_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      early_childhood_dev: {
        Row: {
          academic_year: number | null
          assessed_at: string | null
          assessor_name: string | null
          created_at: string
          emotional_score: number | null
          id: string
          intellectual_score: number | null
          notes: string | null
          overall_level: string | null
          physical_score: number | null
          school_id: string | null
          semester: number | null
          social_score: number | null
          student_id: string | null
        }
        Insert: {
          academic_year?: number | null
          assessed_at?: string | null
          assessor_name?: string | null
          created_at?: string
          emotional_score?: number | null
          id?: string
          intellectual_score?: number | null
          notes?: string | null
          overall_level?: string | null
          physical_score?: number | null
          school_id?: string | null
          semester?: number | null
          social_score?: number | null
          student_id?: string | null
        }
        Update: {
          academic_year?: number | null
          assessed_at?: string | null
          assessor_name?: string | null
          created_at?: string
          emotional_score?: number | null
          id?: string
          intellectual_score?: number | null
          notes?: string | null
          overall_level?: string | null
          physical_score?: number | null
          school_id?: string | null
          semester?: number | null
          social_score?: number | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "early_childhood_dev_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "early_childhood_dev_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "early_childhood_dev_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      early_warning_alerts: {
        Row: {
          alert_type: string
          assigned_to: string | null
          created_at: string
          factors: Json | null
          generated_at: string
          id: string
          recommendation: string | null
          resolved_at: string | null
          risk_score: number
          school_id: string | null
          severity: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          assigned_to?: string | null
          created_at?: string
          factors?: Json | null
          generated_at?: string
          id?: string
          recommendation?: string | null
          resolved_at?: string | null
          risk_score?: number
          school_id?: string | null
          severity?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          assigned_to?: string | null
          created_at?: string
          factors?: Json | null
          generated_at?: string
          id?: string
          recommendation?: string | null
          resolved_at?: string | null
          risk_score?: number
          school_id?: string | null
          severity?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "early_warning_alerts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "early_warning_alerts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "early_warning_alerts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      eform_attachments: {
        Row: {
          created_at: string
          eform_id: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          eform_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          eform_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eform_attachments_eform_id_fkey"
            columns: ["eform_id"]
            isOneToOne: false
            referencedRelation: "eforms"
            referencedColumns: ["id"]
          },
        ]
      }
      eform_recipients: {
        Row: {
          created_at: string
          eform_id: string
          id: string
          read_at: string | null
          recipient_id: string
          recipient_name: string | null
          recipient_role: string | null
          reject_reason: string | null
          rejected_at: string | null
          replied_at: string | null
          reply_text: string | null
          signature_text: string | null
          signed_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          eform_id: string
          id?: string
          read_at?: string | null
          recipient_id: string
          recipient_name?: string | null
          recipient_role?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          replied_at?: string | null
          reply_text?: string | null
          signature_text?: string | null
          signed_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          eform_id?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          recipient_name?: string | null
          recipient_role?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          replied_at?: string | null
          reply_text?: string | null
          signature_text?: string | null
          signed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "eform_recipients_eform_id_fkey"
            columns: ["eform_id"]
            isOneToOne: false
            referencedRelation: "eforms"
            referencedColumns: ["id"]
          },
        ]
      }
      eform_templates: {
        Row: {
          category: string | null
          content_html: string
          created_at: string
          created_by: string | null
          description: string | null
          fields: Json
          font_family: string
          font_size_pt: number
          id: string
          is_active: boolean
          name: string
          page_size: string
          school_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          content_html?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          font_family?: string
          font_size_pt?: number
          id?: string
          is_active?: boolean
          name: string
          page_size?: string
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          content_html?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          font_family?: string
          font_size_pt?: number
          id?: string
          is_active?: boolean
          name?: string
          page_size?: string
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eform_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      eforms: {
        Row: {
          category: string | null
          content_html: string
          created_at: string
          form_data: Json | null
          id: string
          school_id: string | null
          sender_id: string
          sender_name: string | null
          status: string
          template_id: string | null
          title: string
          updated_at: string
          urgency: string | null
        }
        Insert: {
          category?: string | null
          content_html: string
          created_at?: string
          form_data?: Json | null
          id?: string
          school_id?: string | null
          sender_id: string
          sender_name?: string | null
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          category?: string | null
          content_html?: string
          created_at?: string
          form_data?: Json | null
          id?: string
          school_id?: string | null
          sender_id?: string
          sender_name?: string | null
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eforms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_broadcasts: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          is_pinned: boolean
          message: string
          sent_at: string
          sent_by: string | null
          severity: string
          title: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_pinned?: boolean
          message: string
          sent_at?: string
          sent_by?: string | null
          severity?: string
          title: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_pinned?: boolean
          message?: string
          sent_at?: string
          sent_by?: string | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          academic_year: number
          classroom_id: string | null
          enrolled_at: string
          enrollment_type: string
          id: string
          school_id: string | null
          semester: number | null
          status: string
          student_id: string
          subject_id: string
        }
        Insert: {
          academic_year?: number
          classroom_id?: string | null
          enrolled_at?: string
          enrollment_type?: string
          id?: string
          school_id?: string | null
          semester?: number | null
          status?: string
          student_id: string
          subject_id: string
        }
        Update: {
          academic_year?: number
          classroom_id?: string | null
          enrolled_at?: string
          enrollment_type?: string
          id?: string
          school_id?: string | null
          semester?: number | null
          status?: string
          student_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          component_stack: string | null
          context: Json | null
          created_at: string
          id: string
          message: string
          source: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          component_stack?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          source?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          component_stack?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          source?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      exam_questions: {
        Row: {
          bloom_level: string | null
          choices: Json
          correct_answer: string
          created_at: string
          exam_id: string
          explanation: string | null
          id: string
          indicator_code: string | null
          indicator_description: string | null
          question_no: number
          question_text: string
          reference: string | null
        }
        Insert: {
          bloom_level?: string | null
          choices?: Json
          correct_answer: string
          created_at?: string
          exam_id: string
          explanation?: string | null
          id?: string
          indicator_code?: string | null
          indicator_description?: string | null
          question_no: number
          question_text: string
          reference?: string | null
        }
        Update: {
          bloom_level?: string | null
          choices?: Json
          correct_answer?: string
          created_at?: string
          exam_id?: string
          explanation?: string | null
          id?: string
          indicator_code?: string | null
          indicator_description?: string | null
          question_no?: number
          question_text?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_sheets: {
        Row: {
          created_at: string
          exam_id: string
          id: string
          layout_config: Json
          sheet_code: string | null
          student_code_digits: number
        }
        Insert: {
          created_at?: string
          exam_id: string
          id?: string
          layout_config?: Json
          sheet_code?: string | null
          student_code_digits?: number
        }
        Update: {
          created_at?: string
          exam_id?: string
          id?: string
          layout_config?: Json
          sheet_code?: string | null
          student_code_digits?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_sheets_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_submissions: {
        Row: {
          answers: Json
          correct_map: Json
          created_at: string
          exam_id: string
          graded_at: string
          graded_by: string | null
          graded_image_url: string | null
          id: string
          percentage: number
          scan_image_url: string | null
          score: number
          student_code_detected: string | null
          student_id: string | null
          student_name_snapshot: string | null
          total: number
        }
        Insert: {
          answers?: Json
          correct_map?: Json
          created_at?: string
          exam_id: string
          graded_at?: string
          graded_by?: string | null
          graded_image_url?: string | null
          id?: string
          percentage?: number
          scan_image_url?: string | null
          score?: number
          student_code_detected?: string | null
          student_id?: string | null
          student_name_snapshot?: string | null
          total?: number
        }
        Update: {
          answers?: Json
          correct_map?: Json
          created_at?: string
          exam_id?: string
          graded_at?: string
          graded_by?: string | null
          graded_image_url?: string | null
          id?: string
          percentage?: number
          scan_image_url?: string | null
          score?: number
          student_code_detected?: string | null
          student_id?: string | null
          student_name_snapshot?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_submissions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          academic_year: number | null
          classroom_id: string | null
          created_at: string
          id: string
          instructions: string | null
          level: string
          question_count: number
          reference_sources: Json
          semester: number | null
          status: string
          subject_id: string | null
          teacher_id: string
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: number | null
          classroom_id?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          level?: string
          question_count?: number
          reference_sources?: Json
          semester?: number | null
          status?: string
          subject_id?: string | null
          teacher_id: string
          title: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: number | null
          classroom_id?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          level?: string
          question_count?: number
          reference_sources?: Json
          semester?: number | null
          status?: string
          subject_id?: string | null
          teacher_id?: string
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_catalog: {
        Row: {
          category: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          met: number
          name: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          met: number
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          met?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      face_registration_history: {
        Row: {
          action: string
          id: string
          new_count: number
          notes: string | null
          performed_at: string
          performed_by: string | null
          photo_urls: string[]
          previous_count: number
          reason: string | null
          request_id: string | null
          student_id: string
        }
        Insert: {
          action: string
          id?: string
          new_count?: number
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          photo_urls?: string[]
          previous_count?: number
          reason?: string | null
          request_id?: string | null
          student_id: string
        }
        Update: {
          action?: string
          id?: string
          new_count?: number
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          photo_urls?: string[]
          previous_count?: number
          reason?: string | null
          request_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "face_registration_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "face_registration_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_registration_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_registration_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      face_registration_requests: {
        Row: {
          created_at: string
          descriptors: Json
          id: string
          photo_urls: string[]
          reason: string | null
          request_type: string
          requested_by: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descriptors?: Json
          id?: string
          photo_urls?: string[]
          reason?: string | null
          request_type?: string
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descriptors?: Json
          id?: string
          photo_urls?: string[]
          reason?: string | null
          request_type?: string
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "face_registration_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_registration_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      face_scan_logs: {
        Row: {
          captured_face_url: string | null
          confidence: number | null
          created_at: string
          device_label: string | null
          entry_method: string
          id: string
          scan_date: string
          scan_time: string
          scan_type: string
          scanned_by: string | null
          school_id: string | null
          student_id: string
        }
        Insert: {
          captured_face_url?: string | null
          confidence?: number | null
          created_at?: string
          device_label?: string | null
          entry_method?: string
          id?: string
          scan_date?: string
          scan_time?: string
          scan_type?: string
          scanned_by?: string | null
          school_id?: string | null
          student_id: string
        }
        Update: {
          captured_face_url?: string | null
          confidence?: number | null
          created_at?: string
          device_label?: string | null
          entry_method?: string
          id?: string
          scan_date?: string
          scan_time?: string
          scan_type?: string
          scanned_by?: string | null
          school_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "face_scan_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_scan_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_years: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          is_current: boolean
          note: string | null
          start_date: string
          status: string
          updated_at: string
          year_be: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          is_current?: boolean
          note?: string | null
          start_date: string
          status?: string
          updated_at?: string
          year_be: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          is_current?: boolean
          note?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          year_be?: number
        }
        Relationships: []
      }
      fitness_achievements: {
        Row: {
          code: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          metric: string
          name: string
          reward_points: number
          threshold: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          metric: string
          name: string
          reward_points?: number
          threshold: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          metric?: string
          name?: string
          reward_points?: number
          threshold?: number
        }
        Relationships: []
      }
      fitness_exercise_logs: {
        Row: {
          created_at: string
          custom_name: string | null
          duration_min: number
          exercise_id: string | null
          id: string
          kcal_burned: number
          log_date: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_name?: string | null
          duration_min: number
          exercise_id?: string | null
          id?: string
          kcal_burned: number
          log_date?: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          custom_name?: string | null
          duration_min?: number
          exercise_id?: string | null
          id?: string
          kcal_burned?: number
          log_date?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fitness_exercise_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_food_logs: {
        Row: {
          created_at: string
          custom_name: string | null
          food_id: string | null
          id: string
          kcal: number
          log_date: string
          meal_type: string
          note: string | null
          portion: number
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_name?: string | null
          food_id?: string | null
          id?: string
          kcal: number
          log_date?: string
          meal_type?: string
          note?: string | null
          portion?: number
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_name?: string | null
          food_id?: string | null
          id?: string
          kcal?: number
          log_date?: string
          meal_type?: string
          note?: string | null
          portion?: number
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fitness_food_logs_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "food_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_points_ledger: {
        Row: {
          created_at: string
          id: string
          points: number
          reason: string
          source_id: string | null
          source_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          reason: string
          source_id?: string | null
          source_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reason?: string
          source_id?: string | null
          source_type?: string
          user_id?: string
        }
        Relationships: []
      }
      fitness_profiles: {
        Row: {
          activity_level: string
          birth_date: string | null
          created_at: string
          daily_kcal_target: number | null
          goal: string
          height_cm: number | null
          sex: string | null
          target_weight_kg: number | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string
          birth_date?: string | null
          created_at?: string
          daily_kcal_target?: number | null
          goal?: string
          height_cm?: number | null
          sex?: string | null
          target_weight_kg?: number | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string
          birth_date?: string | null
          created_at?: string
          daily_kcal_target?: number | null
          goal?: string
          height_cm?: number | null
          sex?: string | null
          target_weight_kg?: number | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      fitness_redemptions: {
        Row: {
          cost_points: number
          created_at: string
          delivered_at: string | null
          delivered_by: string | null
          id: string
          note: string | null
          reward_id: string
          status: string
          user_id: string
        }
        Insert: {
          cost_points: number
          created_at?: string
          delivered_at?: string | null
          delivered_by?: string | null
          id?: string
          note?: string | null
          reward_id: string
          status?: string
          user_id: string
        }
        Update: {
          cost_points?: number
          created_at?: string
          delivered_at?: string | null
          delivered_by?: string | null
          id?: string
          note?: string | null
          reward_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fitness_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "fitness_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_rewards: {
        Row: {
          cost_points: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          stock: number
          updated_at: string
        }
        Insert: {
          cost_points: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          stock?: number
          updated_at?: string
        }
        Update: {
          cost_points?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      fitness_sleep_logs: {
        Row: {
          bedtime: string | null
          created_at: string
          duration_minutes: number
          id: string
          note: string | null
          quality: number | null
          sleep_date: string
          updated_at: string
          user_id: string
          wake_time: string | null
        }
        Insert: {
          bedtime?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          note?: string | null
          quality?: number | null
          sleep_date: string
          updated_at?: string
          user_id: string
          wake_time?: string | null
        }
        Update: {
          bedtime?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          note?: string | null
          quality?: number | null
          sleep_date?: string
          updated_at?: string
          user_id?: string
          wake_time?: string | null
        }
        Relationships: []
      }
      fitness_user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fitness_user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "fitness_achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      food_catalog: {
        Row: {
          carb_g: number | null
          category: string
          created_at: string
          fat_g: number | null
          id: string
          is_active: boolean
          kcal_per_serving: number
          name: string
          protein_g: number | null
          serving_label: string | null
          updated_at: string
        }
        Insert: {
          carb_g?: number | null
          category?: string
          created_at?: string
          fat_g?: number | null
          id?: string
          is_active?: boolean
          kcal_per_serving: number
          name: string
          protein_g?: number | null
          serving_label?: string | null
          updated_at?: string
        }
        Update: {
          carb_g?: number | null
          category?: string
          created_at?: string
          fat_g?: number | null
          id?: string
          is_active?: boolean
          kcal_per_serving?: number
          name?: string
          protein_g?: number | null
          serving_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      form_submissions: {
        Row: {
          created_at: string
          data: Json
          id: string
          ip_address: string | null
          school_id: string | null
          status: string
          student_id: string | null
          submitted_by: string | null
          submitter_contact: string | null
          submitter_name: string | null
          synced_refs: Json
          template_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          ip_address?: string | null
          school_id?: string | null
          status?: string
          student_id?: string | null
          submitted_by?: string | null
          submitter_contact?: string | null
          submitter_name?: string | null
          synced_refs?: Json
          template_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          ip_address?: string | null
          school_id?: string | null
          status?: string
          student_id?: string | null
          submitted_by?: string | null
          submitter_contact?: string | null
          submitter_name?: string | null
          synced_refs?: Json
          template_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "pdf_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          code: string
          content_html: string
          created_at: string
          id: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          content_html?: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          content_html?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      game_hub_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[]
        }
        Relationships: []
      }
      game_hub_games: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          embed_code: string | null
          id: string
          is_active: boolean
          max_age: number | null
          max_grade: number | null
          min_age: number | null
          min_grade: number | null
          play_count: number
          tags: string[]
          title: string
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          embed_code?: string | null
          id?: string
          is_active?: boolean
          max_age?: number | null
          max_grade?: number | null
          min_age?: number | null
          min_grade?: number | null
          play_count?: number
          tags?: string[]
          title: string
          type: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          embed_code?: string | null
          id?: string
          is_active?: boolean
          max_age?: number | null
          max_grade?: number | null
          min_age?: number | null
          min_grade?: number | null
          play_count?: number
          tags?: string[]
          title?: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      game_hub_scores: {
        Row: {
          auth_user_id: string | null
          duration_sec: number | null
          game_id: string
          id: string
          meta: Json
          played_at: string
          score: number
          source: string
          student_id: string
        }
        Insert: {
          auth_user_id?: string | null
          duration_sec?: number | null
          game_id: string
          id?: string
          meta?: Json
          played_at?: string
          score?: number
          source?: string
          student_id: string
        }
        Update: {
          auth_user_id?: string | null
          duration_sec?: number | null
          game_id?: string
          id?: string
          meta?: Json
          played_at?: string
          score?: number
          source?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_hub_scores_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_hub_games"
            referencedColumns: ["id"]
          },
        ]
      }
      garbage_badges: {
        Row: {
          code: string
          created_at: string
          criteria_type: string
          criteria_value: number
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          tier: string
        }
        Insert: {
          code: string
          created_at?: string
          criteria_type: string
          criteria_value: number
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          tier?: string
        }
        Update: {
          code?: string
          created_at?: string
          criteria_type?: string
          criteria_value?: number
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tier?: string
        }
        Relationships: []
      }
      garbage_deposits: {
        Row: {
          created_at: string
          id: string
          item_id: string
          notes: string | null
          personnel_id: string | null
          points_earned: number
          quantity: number
          recorded_by: string | null
          recorded_by_name: string | null
          student_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          personnel_id?: string | null
          points_earned: number
          quantity: number
          recorded_by?: string | null
          recorded_by_name?: string | null
          student_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          personnel_id?: string | null
          points_earned?: number
          quantity?: number
          recorded_by?: string | null
          recorded_by_name?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garbage_deposits_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "garbage_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garbage_deposits_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garbage_deposits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garbage_deposits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      garbage_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          points_per_unit: number
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          points_per_unit: number
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          points_per_unit?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      garbage_personnel_points: {
        Row: {
          personnel_id: string
          total_points: number
          updated_at: string
        }
        Insert: {
          personnel_id: string
          total_points?: number
          updated_at?: string
        }
        Update: {
          personnel_id?: string
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garbage_personnel_points_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: true
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      garbage_redemptions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          personnel_id: string | null
          points_used: number
          quantity: number
          recorded_by: string | null
          recorded_by_name: string | null
          reward_id: string
          student_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          personnel_id?: string | null
          points_used: number
          quantity?: number
          recorded_by?: string | null
          recorded_by_name?: string | null
          reward_id: string
          student_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          personnel_id?: string | null
          points_used?: number
          quantity?: number
          recorded_by?: string | null
          recorded_by_name?: string | null
          reward_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garbage_redemptions_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garbage_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "garbage_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garbage_redemptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garbage_redemptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      garbage_rewards: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          points_cost: number
          stock: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          points_cost: number
          stock?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          points_cost?: number
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      garbage_student_points: {
        Row: {
          student_id: string
          total_points: number
          updated_at: string
        }
        Insert: {
          student_id: string
          total_points?: number
          updated_at?: string
        }
        Update: {
          student_id?: string
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garbage_student_points_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garbage_student_points_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      garbage_user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          personnel_id: string | null
          student_id: string | null
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          personnel_id?: string | null
          student_id?: string | null
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          personnel_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garbage_user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "garbage_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garbage_user_badges_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garbage_user_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garbage_user_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      google_chat_logs: {
        Row: {
          created_at: string
          department: string | null
          error_text: string | null
          http_status: number | null
          id: string
          message: string | null
          notification_type: string | null
          payload: Json | null
          reference_id: string | null
          reference_table: string | null
          status: string
          title: string | null
          webhook_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          error_text?: string | null
          http_status?: number | null
          id?: string
          message?: string | null
          notification_type?: string | null
          payload?: Json | null
          reference_id?: string | null
          reference_table?: string | null
          status?: string
          title?: string | null
          webhook_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          error_text?: string | null
          http_status?: number | null
          id?: string
          message?: string | null
          notification_type?: string | null
          payload?: Json | null
          reference_id?: string | null
          reference_table?: string | null
          status?: string
          title?: string | null
          webhook_id?: string | null
        }
        Relationships: []
      }
      google_chat_webhooks: {
        Row: {
          created_at: string
          custom_messages: Json | null
          department: string
          id: string
          is_active: boolean
          notification_types: string[] | null
          updated_at: string
          webhook_name: string
          webhook_url: string
        }
        Insert: {
          created_at?: string
          custom_messages?: Json | null
          department: string
          id?: string
          is_active?: boolean
          notification_types?: string[] | null
          updated_at?: string
          webhook_name?: string
          webhook_url: string
        }
        Update: {
          created_at?: string
          custom_messages?: Json | null
          department?: string
          id?: string
          is_active?: boolean
          notification_types?: string[] | null
          updated_at?: string
          webhook_name?: string
          webhook_url?: string
        }
        Relationships: []
      }
      guidance_records: {
        Row: {
          counselor_id: string | null
          created_at: string
          follow_up_at: string | null
          id: string
          is_confidential: boolean
          notes: string | null
          school_id: string | null
          session_date: string
          student_id: string
          topic: string
          type: string
          updated_at: string
        }
        Insert: {
          counselor_id?: string | null
          created_at?: string
          follow_up_at?: string | null
          id?: string
          is_confidential?: boolean
          notes?: string | null
          school_id?: string | null
          session_date?: string
          student_id: string
          topic: string
          type?: string
          updated_at?: string
        }
        Update: {
          counselor_id?: string | null
          created_at?: string
          follow_up_at?: string | null
          id?: string
          is_confidential?: boolean
          notes?: string | null
          school_id?: string | null
          session_date?: string
          student_id?: string
          topic?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guidance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guidance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guidance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      health_measurements: {
        Row: {
          bmi: number | null
          created_at: string
          height_cm: number | null
          id: string
          measured_at: string
          notes: string | null
          recorded_by: string | null
          school_id: string | null
          student_id: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          bmi?: number | null
          created_at?: string
          height_cm?: number | null
          id?: string
          measured_at?: string
          notes?: string | null
          recorded_by?: string | null
          school_id?: string | null
          student_id: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          bmi?: number | null
          created_at?: string
          height_cm?: number | null
          id?: string
          measured_at?: string
          notes?: string | null
          recorded_by?: string | null
          school_id?: string | null
          student_id?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_measurements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_measurements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_measurements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      health_records: {
        Row: {
          created_at: string
          follow_up_needed: boolean | null
          id: string
          nurse_name: string | null
          school_id: string | null
          student_id: string | null
          symptoms: string
          treatment: string | null
          visit_date: string
        }
        Insert: {
          created_at?: string
          follow_up_needed?: boolean | null
          id?: string
          nurse_name?: string | null
          school_id?: string | null
          student_id?: string | null
          symptoms: string
          treatment?: string | null
          visit_date?: string
        }
        Update: {
          created_at?: string
          follow_up_needed?: boolean | null
          id?: string
          nurse_name?: string | null
          school_id?: string | null
          student_id?: string | null
          symptoms?: string
          treatment?: string | null
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      home_visit_summaries: {
        Row: {
          academic_year: number
          created_at: string
          created_by: string | null
          data: Json
          id: string
          reporter_name: string | null
          reporter_position: string | null
          school_id: string | null
          semester: number
          updated_at: string
        }
        Insert: {
          academic_year: number
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          reporter_name?: string | null
          reporter_position?: string | null
          school_id?: string | null
          semester: number
          updated_at?: string
        }
        Update: {
          academic_year?: number
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          reporter_name?: string | null
          reporter_position?: string | null
          school_id?: string | null
          semester?: number
          updated_at?: string
        }
        Relationships: []
      }
      home_visits: {
        Row: {
          academic_year: number | null
          classroom_id: string | null
          created_at: string
          created_by: string | null
          distance_to_school: number | null
          family_marital_status: string | null
          family_status: string | null
          form_code: string | null
          guardian_education: string | null
          guardian_first_name: string | null
          guardian_id_card: string | null
          guardian_last_name: string | null
          guardian_no_id_card: boolean | null
          guardian_occupation: string | null
          guardian_phone: string | null
          guardian_prefix: string | null
          guardian_relation: string | null
          has_computer: boolean | null
          has_internet: boolean | null
          has_state_welfare: boolean | null
          home_condition: string | null
          house_ownership: string | null
          household_members: Json | null
          household_status: Json | null
          id: string
          income_per_month: number | null
          latitude: number | null
          living_with: string | null
          longitude: number | null
          num_family_members: number | null
          officer_certified: boolean | null
          officer_id_card: string | null
          officer_name: string | null
          officer_position: string | null
          officer_reject_reason: string | null
          photo_urls: string[] | null
          poverty_status: string | null
          recommendations: string | null
          school_id: string | null
          semester: number | null
          student_condition: string | null
          student_id: string | null
          student_money_per_day: number | null
          travel_cost_per_month: number | null
          travel_method: string | null
          travel_time_minutes: number | null
          visit_date: string
          visitor_name: string
        }
        Insert: {
          academic_year?: number | null
          classroom_id?: string | null
          created_at?: string
          created_by?: string | null
          distance_to_school?: number | null
          family_marital_status?: string | null
          family_status?: string | null
          form_code?: string | null
          guardian_education?: string | null
          guardian_first_name?: string | null
          guardian_id_card?: string | null
          guardian_last_name?: string | null
          guardian_no_id_card?: boolean | null
          guardian_occupation?: string | null
          guardian_phone?: string | null
          guardian_prefix?: string | null
          guardian_relation?: string | null
          has_computer?: boolean | null
          has_internet?: boolean | null
          has_state_welfare?: boolean | null
          home_condition?: string | null
          house_ownership?: string | null
          household_members?: Json | null
          household_status?: Json | null
          id?: string
          income_per_month?: number | null
          latitude?: number | null
          living_with?: string | null
          longitude?: number | null
          num_family_members?: number | null
          officer_certified?: boolean | null
          officer_id_card?: string | null
          officer_name?: string | null
          officer_position?: string | null
          officer_reject_reason?: string | null
          photo_urls?: string[] | null
          poverty_status?: string | null
          recommendations?: string | null
          school_id?: string | null
          semester?: number | null
          student_condition?: string | null
          student_id?: string | null
          student_money_per_day?: number | null
          travel_cost_per_month?: number | null
          travel_method?: string | null
          travel_time_minutes?: number | null
          visit_date?: string
          visitor_name: string
        }
        Update: {
          academic_year?: number | null
          classroom_id?: string | null
          created_at?: string
          created_by?: string | null
          distance_to_school?: number | null
          family_marital_status?: string | null
          family_status?: string | null
          form_code?: string | null
          guardian_education?: string | null
          guardian_first_name?: string | null
          guardian_id_card?: string | null
          guardian_last_name?: string | null
          guardian_no_id_card?: boolean | null
          guardian_occupation?: string | null
          guardian_phone?: string | null
          guardian_prefix?: string | null
          guardian_relation?: string | null
          has_computer?: boolean | null
          has_internet?: boolean | null
          has_state_welfare?: boolean | null
          home_condition?: string | null
          house_ownership?: string | null
          household_members?: Json | null
          household_status?: Json | null
          id?: string
          income_per_month?: number | null
          latitude?: number | null
          living_with?: string | null
          longitude?: number | null
          num_family_members?: number | null
          officer_certified?: boolean | null
          officer_id_card?: string | null
          officer_name?: string | null
          officer_position?: string | null
          officer_reject_reason?: string | null
          photo_urls?: string[] | null
          poverty_status?: string | null
          recommendations?: string | null
          school_id?: string | null
          semester?: number | null
          student_condition?: string | null
          student_id?: string | null
          student_money_per_day?: number | null
          travel_cost_per_month?: number | null
          travel_method?: string | null
          travel_time_minutes?: number | null
          visit_date?: string
          visitor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_visits_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_visits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_visits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_visits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      homeroom_records: {
        Row: {
          absent_students: string | null
          academic_year: number | null
          activity_details: string | null
          advisor_notes: string | null
          classroom_id: string | null
          created_at: string
          homeroom_date: string | null
          id: string
          parent_contact: string | null
          school_id: string | null
          semester: number | null
          student_count: number | null
          student_id: string | null
          topic: string | null
          visit_date: string | null
        }
        Insert: {
          absent_students?: string | null
          academic_year?: number | null
          activity_details?: string | null
          advisor_notes?: string | null
          classroom_id?: string | null
          created_at?: string
          homeroom_date?: string | null
          id?: string
          parent_contact?: string | null
          school_id?: string | null
          semester?: number | null
          student_count?: number | null
          student_id?: string | null
          topic?: string | null
          visit_date?: string | null
        }
        Update: {
          absent_students?: string | null
          academic_year?: number | null
          activity_details?: string | null
          advisor_notes?: string | null
          classroom_id?: string | null
          created_at?: string
          homeroom_date?: string | null
          id?: string
          parent_contact?: string | null
          school_id?: string | null
          semester?: number | null
          student_count?: number | null
          student_id?: string | null
          topic?: string | null
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homeroom_records_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeroom_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeroom_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homeroom_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_assignments: {
        Row: {
          answer_fields: Json
          assigned_by: string | null
          classroom_id: string | null
          content_html: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          pdf_pages: number | null
          pdf_path: string | null
          school_id: string | null
          status: string
          subject_id: string | null
          title: string
          total_score: number | null
          worksheet_fields: Json
        }
        Insert: {
          answer_fields?: Json
          assigned_by?: string | null
          classroom_id?: string | null
          content_html?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          pdf_pages?: number | null
          pdf_path?: string | null
          school_id?: string | null
          status?: string
          subject_id?: string | null
          title: string
          total_score?: number | null
          worksheet_fields?: Json
        }
        Update: {
          answer_fields?: Json
          assigned_by?: string | null
          classroom_id?: string | null
          content_html?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          pdf_pages?: number | null
          pdf_path?: string | null
          school_id?: string | null
          status?: string
          subject_id?: string | null
          title?: string
          total_score?: number | null
          worksheet_fields?: Json
        }
        Relationships: [
          {
            foreignKeyName: "homework_assignments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_submissions: {
        Row: {
          answers: Json
          assignment_id: string
          attachments: Json
          auto_score: number | null
          created_at: string
          feedback: string | null
          field_results: Json
          final_score: number | null
          graded_at: string | null
          graded_by: string | null
          id: string
          school_id: string | null
          score: number | null
          status: string
          student_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          answers?: Json
          assignment_id: string
          attachments?: Json
          auto_score?: number | null
          created_at?: string
          feedback?: string | null
          field_results?: Json
          final_score?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          school_id?: string | null
          score?: number | null
          status?: string
          student_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          assignment_id?: string
          attachments?: Json
          auto_score?: number | null
          created_at?: string
          feedback?: string | null
          field_results?: Json
          final_score?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          school_id?: string | null
          score?: number | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_project_budgets: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          project_id: string
          received_date: string
          reference_no: string | null
          source: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id: string
          received_date?: string
          reference_no?: string | null
          source?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          received_date?: string
          reference_no?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "hub_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_budget_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "hub_project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_financial_summary"
            referencedColumns: ["project_id"]
          },
        ]
      }
      hub_project_expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          notes: string | null
          project_id: string
          receipt_no: string | null
          receipt_url: string | null
          vendor: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          project_id: string
          receipt_no?: string | null
          receipt_url?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          project_id?: string
          receipt_no?: string | null
          receipt_url?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_project_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "hub_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_project_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_budget_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "hub_project_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_financial_summary"
            referencedColumns: ["project_id"]
          },
        ]
      }
      hub_project_updates: {
        Row: {
          created_at: string
          created_by: string | null
          details: string | null
          feed_to_hub: boolean
          id: string
          is_published: boolean
          participants_count: number | null
          period_label: string | null
          photos: Json
          progress_percent: number | null
          project_id: string
          summary: string | null
          title: string
          update_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          details?: string | null
          feed_to_hub?: boolean
          id?: string
          is_published?: boolean
          participants_count?: number | null
          period_label?: string | null
          photos?: Json
          progress_percent?: number | null
          project_id: string
          summary?: string | null
          title: string
          update_date?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          details?: string | null
          feed_to_hub?: boolean
          id?: string
          is_published?: boolean
          participants_count?: number | null
          period_label?: string | null
          photos?: Json
          progress_percent?: number | null
          project_id?: string
          summary?: string | null
          title?: string
          update_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "hub_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_budget_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "hub_project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_financial_summary"
            referencedColumns: ["project_id"]
          },
        ]
      }
      hub_projects: {
        Row: {
          budget_received: number
          budget_spent: number
          category: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          end_date: string | null
          evaluation_plan: string | null
          feed_to_hub: boolean
          fiscal_year: number
          fiscal_year_id: string | null
          goals: string | null
          hub_project_code: string | null
          id: string
          impacts: string | null
          kpi_indicators: Json | null
          name: string
          objectives: string | null
          outcomes: string | null
          outputs: string | null
          principle: string | null
          responsible_person: string | null
          responsible_user_id: string | null
          risks: string | null
          school_id: string | null
          sdgs: Json | null
          start_date: string | null
          status: string
          strategic_plan_id: string | null
          target_beneficiaries: number | null
          updated_at: string
          workflow_status: string | null
        }
        Insert: {
          budget_received?: number
          budget_spent?: number
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          end_date?: string | null
          evaluation_plan?: string | null
          feed_to_hub?: boolean
          fiscal_year?: number
          fiscal_year_id?: string | null
          goals?: string | null
          hub_project_code?: string | null
          id?: string
          impacts?: string | null
          kpi_indicators?: Json | null
          name: string
          objectives?: string | null
          outcomes?: string | null
          outputs?: string | null
          principle?: string | null
          responsible_person?: string | null
          responsible_user_id?: string | null
          risks?: string | null
          school_id?: string | null
          sdgs?: Json | null
          start_date?: string | null
          status?: string
          strategic_plan_id?: string | null
          target_beneficiaries?: number | null
          updated_at?: string
          workflow_status?: string | null
        }
        Update: {
          budget_received?: number
          budget_spent?: number
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          end_date?: string | null
          evaluation_plan?: string | null
          feed_to_hub?: boolean
          fiscal_year?: number
          fiscal_year_id?: string | null
          goals?: string | null
          hub_project_code?: string | null
          id?: string
          impacts?: string | null
          kpi_indicators?: Json | null
          name?: string
          objectives?: string | null
          outcomes?: string | null
          outputs?: string | null
          principle?: string | null
          responsible_person?: string | null
          responsible_user_id?: string | null
          risks?: string | null
          school_id?: string | null
          sdgs?: Json | null
          start_date?: string | null
          status?: string
          strategic_plan_id?: string | null
          target_beneficiaries?: number | null
          updated_at?: string
          workflow_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_projects_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_projects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_projects_strategic_plan_id_fkey"
            columns: ["strategic_plan_id"]
            isOneToOne: false
            referencedRelation: "strategic_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ict_devices: {
        Row: {
          asset_code: string
          brand: string | null
          category: Database["public"]["Enums"]["ict_device_category"]
          created_at: string
          created_by: string | null
          id: string
          model: string | null
          name: string
          notes: string | null
          photo_url: string | null
          school_id: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["ict_device_status"]
          updated_at: string
        }
        Insert: {
          asset_code: string
          brand?: string | null
          category?: Database["public"]["Enums"]["ict_device_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          name: string
          notes?: string | null
          photo_url?: string | null
          school_id?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["ict_device_status"]
          updated_at?: string
        }
        Update: {
          asset_code?: string
          brand?: string | null
          category?: Database["public"]["Enums"]["ict_device_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          name?: string
          notes?: string | null
          photo_url?: string | null
          school_id?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["ict_device_status"]
          updated_at?: string
        }
        Relationships: []
      }
      ict_loans: {
        Row: {
          batch_id: string | null
          borrow_notes: string | null
          borrow_photo_url: string | null
          borrowed_at: string
          borrowed_by: string | null
          classroom_id: string | null
          condition_on_return: string | null
          created_at: string
          device_id: string
          expected_return_at: string | null
          id: string
          overdue_notified_at: string | null
          period_no: number | null
          period_number: number | null
          personnel_id: string | null
          quantity: number
          return_notes: string | null
          return_photo_url: string | null
          returned_at: string | null
          returned_by: string | null
          school_id: string | null
          session_date: string | null
          status: Database["public"]["Enums"]["ict_loan_status"]
          student_id: string | null
          subject_id: string | null
          subject_name: string | null
          teaching_topic: string | null
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          borrow_notes?: string | null
          borrow_photo_url?: string | null
          borrowed_at?: string
          borrowed_by?: string | null
          classroom_id?: string | null
          condition_on_return?: string | null
          created_at?: string
          device_id: string
          expected_return_at?: string | null
          id?: string
          overdue_notified_at?: string | null
          period_no?: number | null
          period_number?: number | null
          personnel_id?: string | null
          quantity?: number
          return_notes?: string | null
          return_photo_url?: string | null
          returned_at?: string | null
          returned_by?: string | null
          school_id?: string | null
          session_date?: string | null
          status?: Database["public"]["Enums"]["ict_loan_status"]
          student_id?: string | null
          subject_id?: string | null
          subject_name?: string | null
          teaching_topic?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          borrow_notes?: string | null
          borrow_photo_url?: string | null
          borrowed_at?: string
          borrowed_by?: string | null
          classroom_id?: string | null
          condition_on_return?: string | null
          created_at?: string
          device_id?: string
          expected_return_at?: string | null
          id?: string
          overdue_notified_at?: string | null
          period_no?: number | null
          period_number?: number | null
          personnel_id?: string | null
          quantity?: number
          return_notes?: string | null
          return_photo_url?: string | null
          returned_at?: string | null
          returned_by?: string | null
          school_id?: string | null
          session_date?: string | null
          status?: Database["public"]["Enums"]["ict_loan_status"]
          student_id?: string | null
          subject_id?: string | null
          subject_name?: string | null
          teaching_topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ict_loans_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ict_loans_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "ict_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ict_loans_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ict_loans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ict_loans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ict_loans_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      id_plan_records: {
        Row: {
          academic_year: number | null
          applications: string[]
          assigned_teachers: Json
          attachment_paths: string[]
          certificate_url: string | null
          created_at: string
          description: string | null
          duration_days: number | null
          end_datetime: string | null
          id: string
          image_paths: string[]
          knowledge_summary: string[]
          location: string | null
          notes: string | null
          objectives: string[]
          order_doc_path: string | null
          order_ref_date: string | null
          order_ref_number: string | null
          order_ref_type: string | null
          order_ref_type_other: string | null
          organizer: string | null
          personnel_id: string | null
          plan_type: string
          start_datetime: string | null
          status: string
          title: string
          training_date: string | null
          training_hours: number | null
        }
        Insert: {
          academic_year?: number | null
          applications?: string[]
          assigned_teachers?: Json
          attachment_paths?: string[]
          certificate_url?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number | null
          end_datetime?: string | null
          id?: string
          image_paths?: string[]
          knowledge_summary?: string[]
          location?: string | null
          notes?: string | null
          objectives?: string[]
          order_doc_path?: string | null
          order_ref_date?: string | null
          order_ref_number?: string | null
          order_ref_type?: string | null
          order_ref_type_other?: string | null
          organizer?: string | null
          personnel_id?: string | null
          plan_type?: string
          start_datetime?: string | null
          status?: string
          title: string
          training_date?: string | null
          training_hours?: number | null
        }
        Update: {
          academic_year?: number | null
          applications?: string[]
          assigned_teachers?: Json
          attachment_paths?: string[]
          certificate_url?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number | null
          end_datetime?: string | null
          id?: string
          image_paths?: string[]
          knowledge_summary?: string[]
          location?: string | null
          notes?: string | null
          objectives?: string[]
          order_doc_path?: string | null
          order_ref_date?: string | null
          order_ref_number?: string | null
          order_ref_type?: string | null
          order_ref_type_other?: string | null
          organizer?: string | null
          personnel_id?: string | null
          plan_type?: string
          start_datetime?: string | null
          status?: string
          title?: string
          training_date?: string | null
          training_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "id_plan_records_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      import_mapping_memory: {
        Row: {
          created_at: string
          created_by: string | null
          entity_type: string
          hit_count: number
          id: string
          raw_text_norm: string
          resolved_id: string
          resolved_label: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_type: string
          hit_count?: number
          id?: string
          raw_text_norm: string
          resolved_id: string
          resolved_label?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_type?: string
          hit_count?: number
          id?: string
          raw_text_norm?: string
          resolved_id?: string
          resolved_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inbox_items: {
        Row: {
          action_url: string | null
          category: string | null
          created_at: string
          id: string
          is_archived: boolean
          is_read: boolean
          item_type: string
          message: string | null
          notification_id: string | null
          priority: string
          reference_id: string | null
          reference_table: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_read?: boolean
          item_type?: string
          message?: string | null
          notification_id?: string | null
          priority?: string
          reference_id?: string | null
          reference_table?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_read?: boolean
          item_type?: string
          message?: string | null
          notification_id?: string | null
          priority?: string
          reference_id?: string | null
          reference_table?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_items_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      incomplete_grade_fix_requests: {
        Row: {
          academic_year: number
          assigned_task: string | null
          classroom_id: string | null
          completed_at: string | null
          created_at: string
          exam_date: string | null
          exam_location: string | null
          grade_type: Database["public"]["Enums"]["incomplete_grade_type"]
          id: string
          report_id: string | null
          responded_at: string | null
          responded_by: string | null
          semester: number
          status: Database["public"]["Enums"]["incomplete_grade_fix_status"]
          student_id: string
          student_note: string | null
          subject_id: string
          submitted_by: string | null
          teacher_id: string | null
          teacher_note: string | null
          updated_at: string
        }
        Insert: {
          academic_year: number
          assigned_task?: string | null
          classroom_id?: string | null
          completed_at?: string | null
          created_at?: string
          exam_date?: string | null
          exam_location?: string | null
          grade_type: Database["public"]["Enums"]["incomplete_grade_type"]
          id?: string
          report_id?: string | null
          responded_at?: string | null
          responded_by?: string | null
          semester: number
          status?: Database["public"]["Enums"]["incomplete_grade_fix_status"]
          student_id: string
          student_note?: string | null
          subject_id: string
          submitted_by?: string | null
          teacher_id?: string | null
          teacher_note?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: number
          assigned_task?: string | null
          classroom_id?: string | null
          completed_at?: string | null
          created_at?: string
          exam_date?: string | null
          exam_location?: string | null
          grade_type?: Database["public"]["Enums"]["incomplete_grade_type"]
          id?: string
          report_id?: string | null
          responded_at?: string | null
          responded_by?: string | null
          semester?: number
          status?: Database["public"]["Enums"]["incomplete_grade_fix_status"]
          student_id?: string
          student_note?: string | null
          subject_id?: string
          submitted_by?: string | null
          teacher_id?: string | null
          teacher_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomplete_grade_fix_requests_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomplete_grade_fix_requests_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "incomplete_grade_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomplete_grade_fix_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomplete_grade_fix_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomplete_grade_fix_requests_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomplete_grade_fix_requests_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      incomplete_grade_reports: {
        Row: {
          academic_year: number
          classroom_id: string | null
          classroom_room: number | null
          created_at: string
          fix_deadline: string | null
          grade_level_text: string | null
          grade_type: Database["public"]["Enums"]["incomplete_grade_type"]
          id: string
          reason: string | null
          reported_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          semester: number
          source: string | null
          status: Database["public"]["Enums"]["incomplete_grade_status"]
          student_id: string
          student_no: number | null
          subject_id: string | null
          subject_name_text: string | null
          teacher_id: string | null
          teacher_name_text: string | null
          updated_at: string
        }
        Insert: {
          academic_year: number
          classroom_id?: string | null
          classroom_room?: number | null
          created_at?: string
          fix_deadline?: string | null
          grade_level_text?: string | null
          grade_type: Database["public"]["Enums"]["incomplete_grade_type"]
          id?: string
          reason?: string | null
          reported_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          semester: number
          source?: string | null
          status?: Database["public"]["Enums"]["incomplete_grade_status"]
          student_id: string
          student_no?: number | null
          subject_id?: string | null
          subject_name_text?: string | null
          teacher_id?: string | null
          teacher_name_text?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: number
          classroom_id?: string | null
          classroom_room?: number | null
          created_at?: string
          fix_deadline?: string | null
          grade_level_text?: string | null
          grade_type?: Database["public"]["Enums"]["incomplete_grade_type"]
          id?: string
          reason?: string | null
          reported_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          semester?: number
          source?: string | null
          status?: Database["public"]["Enums"]["incomplete_grade_status"]
          student_id?: string
          student_no?: number | null
          subject_id?: string | null
          subject_name_text?: string | null
          teacher_id?: string | null
          teacher_name_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomplete_grade_reports_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomplete_grade_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomplete_grade_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomplete_grade_reports_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomplete_grade_reports_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      iot_devices: {
        Row: {
          api_token: string | null
          base_url: string | null
          color: string | null
          created_at: string
          created_by: string | null
          dashboard_group: string | null
          description: string | null
          device_type: string
          display_order: number
          entity_id: string | null
          icon: string | null
          id: string
          is_active: boolean
          json_path: string | null
          last_error: string | null
          last_fetched_at: string | null
          last_status: string | null
          last_value: string | null
          last_value_numeric: number | null
          location: string | null
          meta: Json | null
          name: string
          poll_interval_seconds: number
          request_path: string | null
          source_type: string
          system_category: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          api_token?: string | null
          base_url?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          dashboard_group?: string | null
          description?: string | null
          device_type?: string
          display_order?: number
          entity_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          json_path?: string | null
          last_error?: string | null
          last_fetched_at?: string | null
          last_status?: string | null
          last_value?: string | null
          last_value_numeric?: number | null
          location?: string | null
          meta?: Json | null
          name: string
          poll_interval_seconds?: number
          request_path?: string | null
          source_type?: string
          system_category?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          api_token?: string | null
          base_url?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          dashboard_group?: string | null
          description?: string | null
          device_type?: string
          display_order?: number
          entity_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          json_path?: string | null
          last_error?: string | null
          last_fetched_at?: string | null
          last_status?: string | null
          last_value?: string | null
          last_value_numeric?: number | null
          location?: string | null
          meta?: Json | null
          name?: string
          poll_interval_seconds?: number
          request_path?: string | null
          source_type?: string
          system_category?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      iot_readings: {
        Row: {
          device_id: string
          id: number
          recorded_at: string
          status: string | null
          value: string | null
          value_numeric: number | null
        }
        Insert: {
          device_id: string
          id?: number
          recorded_at?: string
          status?: string | null
          value?: string | null
          value_numeric?: number | null
        }
        Update: {
          device_id?: string
          id?: number
          recorded_at?: string
          status?: string | null
          value?: string | null
          value_numeric?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "iot_readings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "iot_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_devices: {
        Row: {
          config_updated_at: string | null
          created_at: string
          device_id: string
          extension_installed: boolean
          hostname: string | null
          id: string
          ip_address: string | null
          kiosk_mode: string | null
          last_seen_at: string
          meta: Json
          screen_resolution: string | null
          status: string
          updated_at: string
          uptime_sec: number
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          config_updated_at?: string | null
          created_at?: string
          device_id: string
          extension_installed?: boolean
          hostname?: string | null
          id?: string
          ip_address?: string | null
          kiosk_mode?: string | null
          last_seen_at?: string
          meta?: Json
          screen_resolution?: string | null
          status?: string
          updated_at?: string
          uptime_sec?: number
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          config_updated_at?: string | null
          created_at?: string
          device_id?: string
          extension_installed?: boolean
          hostname?: string | null
          id?: string
          ip_address?: string | null
          kiosk_mode?: string | null
          last_seen_at?: string
          meta?: Json
          screen_resolution?: string | null
          status?: string
          updated_at?: string
          uptime_sec?: number
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      learning_center_bookings: {
        Row: {
          booking_date: string
          classroom_id: string | null
          classroom_name: string | null
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          period: number | null
          room_id: string | null
          school_id: string | null
          start_time: string
          status: string
          subject_id: string | null
          subject_name: string | null
          teacher_id: string | null
          teacher_name: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          booking_date: string
          classroom_id?: string | null
          classroom_name?: string | null
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          period?: number | null
          room_id?: string | null
          school_id?: string | null
          start_time: string
          status?: string
          subject_id?: string | null
          subject_name?: string | null
          teacher_id?: string | null
          teacher_name: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          booking_date?: string
          classroom_id?: string | null
          classroom_name?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          period?: number | null
          room_id?: string | null
          school_id?: string | null
          start_time?: string
          status?: string
          subject_id?: string | null
          subject_name?: string | null
          teacher_id?: string | null
          teacher_name?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_center_bookings_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_center_bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "special_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_center_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_center_bookings_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_center_bookings_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_contents: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          entry_file: string | null
          external_url: string | null
          grade_level: string | null
          id: string
          is_active: boolean
          kind: string
          owner_id: string
          public_slug: string | null
          school_id: string
          size_bytes: number
          storage_path: string | null
          subject_group: string | null
          subject_id: string | null
          title: string
          tracking_enabled: boolean
          updated_at: string
          view_count: number
          visibility: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          entry_file?: string | null
          external_url?: string | null
          grade_level?: string | null
          id?: string
          is_active?: boolean
          kind: string
          owner_id: string
          public_slug?: string | null
          school_id: string
          size_bytes?: number
          storage_path?: string | null
          subject_group?: string | null
          subject_id?: string | null
          title: string
          tracking_enabled?: boolean
          updated_at?: string
          view_count?: number
          visibility?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          entry_file?: string | null
          external_url?: string | null
          grade_level?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          owner_id?: string
          public_slug?: string | null
          school_id?: string
          size_bytes?: number
          storage_path?: string | null
          subject_group?: string | null
          subject_id?: string | null
          title?: string
          tracking_enabled?: boolean
          updated_at?: string
          view_count?: number
          visibility?: string
        }
        Relationships: []
      }
      learning_views: {
        Row: {
          content_id: string
          duration_seconds: number
          id: string
          is_anonymous: boolean
          last_heartbeat_at: string
          started_at: string
          user_id: string | null
        }
        Insert: {
          content_id: string
          duration_seconds?: number
          id?: string
          is_anonymous?: boolean
          last_heartbeat_at?: string
          started_at?: string
          user_id?: string | null
        }
        Update: {
          content_id?: string
          duration_seconds?: number
          id?: string
          is_anonymous?: boolean
          last_heartbeat_at?: string
          started_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_views_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "learning_contents"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plans: {
        Row: {
          academic_year: number
          assessment_criteria: string | null
          assessment_method: string | null
          attachment_urls: string[] | null
          classroom_id: string | null
          competencies: string[] | null
          content: string | null
          created_at: string
          desired_characteristics: string[] | null
          grade_level: string | null
          hours: number | null
          id: string
          indicators: string[] | null
          key_concept: string | null
          learning_standard: string | null
          lesson_no: number | null
          lesson_title: string | null
          materials: string | null
          objectives: string | null
          reading_thinking_writing: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          school_id: string | null
          semester: number
          status: string
          subject_id: string | null
          submitted_at: string | null
          teacher_id: string | null
          teaching_process: string | null
          unit_no: number | null
          unit_title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year: number
          assessment_criteria?: string | null
          assessment_method?: string | null
          attachment_urls?: string[] | null
          classroom_id?: string | null
          competencies?: string[] | null
          content?: string | null
          created_at?: string
          desired_characteristics?: string[] | null
          grade_level?: string | null
          hours?: number | null
          id?: string
          indicators?: string[] | null
          key_concept?: string | null
          learning_standard?: string | null
          lesson_no?: number | null
          lesson_title?: string | null
          materials?: string | null
          objectives?: string | null
          reading_thinking_writing?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          school_id?: string | null
          semester: number
          status?: string
          subject_id?: string | null
          submitted_at?: string | null
          teacher_id?: string | null
          teaching_process?: string | null
          unit_no?: number | null
          unit_title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year?: number
          assessment_criteria?: string | null
          assessment_method?: string | null
          attachment_urls?: string[] | null
          classroom_id?: string | null
          competencies?: string[] | null
          content?: string | null
          created_at?: string
          desired_characteristics?: string[] | null
          grade_level?: string | null
          hours?: number | null
          id?: string
          indicators?: string[] | null
          key_concept?: string | null
          learning_standard?: string | null
          lesson_no?: number | null
          lesson_title?: string | null
          materials?: string | null
          objectives?: string | null
          reading_thinking_writing?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          school_id?: string | null
          semester?: number
          status?: string
          subject_id?: string | null
          submitted_at?: string | null
          teacher_id?: string | null
          teaching_process?: string | null
          unit_no?: number | null
          unit_title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          author: string | null
          barcode: string | null
          category: string | null
          copies_available: number
          copies_total: number
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          isbn: string | null
          language: string | null
          location: string | null
          publisher: string | null
          school_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          barcode?: string | null
          category?: string | null
          copies_available?: number
          copies_total?: number
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          isbn?: string | null
          language?: string | null
          location?: string | null
          publisher?: string | null
          school_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          barcode?: string | null
          category?: string | null
          copies_available?: number
          copies_total?: number
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          isbn?: string | null
          language?: string | null
          location?: string | null
          publisher?: string | null
          school_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_books_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      library_loans: {
        Row: {
          book_id: string
          borrower_student_id: string | null
          borrower_user_id: string | null
          created_at: string
          due_at: string
          fine_amount: number | null
          fine_paid: boolean | null
          id: string
          loaned_at: string
          loaned_by: string | null
          notes: string | null
          returned_at: string | null
          updated_at: string
        }
        Insert: {
          book_id: string
          borrower_student_id?: string | null
          borrower_user_id?: string | null
          created_at?: string
          due_at: string
          fine_amount?: number | null
          fine_paid?: boolean | null
          id?: string
          loaned_at?: string
          loaned_by?: string | null
          notes?: string | null
          returned_at?: string | null
          updated_at?: string
        }
        Update: {
          book_id?: string
          borrower_student_id?: string | null
          borrower_user_id?: string | null
          created_at?: string
          due_at?: string
          fine_amount?: number | null
          fine_paid?: boolean | null
          id?: string
          loaned_at?: string
          loaned_by?: string | null
          notes?: string | null
          returned_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_loans_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_loans_borrower_student_id_fkey"
            columns: ["borrower_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_loans_borrower_student_id_fkey"
            columns: ["borrower_student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      line_richmenu_state: {
        Row: {
          content_hash: string
          image_path: string | null
          richmenu_id: string | null
          role: string
          source: string
          updated_at: string
        }
        Insert: {
          content_hash: string
          image_path?: string | null
          richmenu_id?: string | null
          role: string
          source?: string
          updated_at?: string
        }
        Update: {
          content_hash?: string
          image_path?: string | null
          richmenu_id?: string | null
          role?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      line_sessions: {
        Row: {
          created_at: string
          expires_at: string
          intent: string
          line_user_id: string
          payload: Json
          step: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          intent: string
          line_user_id: string
          payload?: Json
          step: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          intent?: string
          line_user_id?: string
          payload?: Json
          step?: string
        }
        Relationships: []
      }
      line_user_preferences: {
        Row: {
          attendance_alerts: boolean
          behavior_alerts: boolean
          created_at: string
          digest_enabled: boolean
          digest_time: string
          face_scan_alerts: boolean
          grade_alerts: boolean
          line_user_id: string
          news_alerts: boolean
          updated_at: string
        }
        Insert: {
          attendance_alerts?: boolean
          behavior_alerts?: boolean
          created_at?: string
          digest_enabled?: boolean
          digest_time?: string
          face_scan_alerts?: boolean
          grade_alerts?: boolean
          line_user_id: string
          news_alerts?: boolean
          updated_at?: string
        }
        Update: {
          attendance_alerts?: boolean
          behavior_alerts?: boolean
          created_at?: string
          digest_enabled?: boolean
          digest_time?: string
          face_scan_alerts?: boolean
          grade_alerts?: boolean
          line_user_id?: string
          news_alerts?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      line_vault_drive_trash: {
        Row: {
          attempts: number
          created_at: string
          drive_file_id: string
          id: string
          last_error: string | null
          line_group_id: string | null
          processed_at: string | null
          source_item_id: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          drive_file_id: string
          id?: string
          last_error?: string | null
          line_group_id?: string | null
          processed_at?: string | null
          source_item_id?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          drive_file_id?: string
          id?: string
          last_error?: string | null
          line_group_id?: string | null
          processed_at?: string | null
          source_item_id?: string | null
          status?: string
        }
        Relationships: []
      }
      line_vault_groups: {
        Row: {
          auto_capture: boolean
          calendar_digest_time: string
          created_at: string
          default_category: string | null
          default_visibility: string
          department: Database["public"]["Enums"]["school_department"] | null
          drive_folder_id: string | null
          drive_root_folder_id: string | null
          drive_root_url: string | null
          group_name: string
          id: string
          last_attendance_digest_date: string | null
          last_calendar_digest_date: string | null
          last_notified_at: string | null
          line_group_id: string
          notes: string | null
          notify_attendance: boolean
          notify_calendar: boolean
          notify_cooldown_minutes: number
          notify_leaves: boolean
          notify_on_capture: boolean
          notify_substitute: boolean
          updated_at: string
        }
        Insert: {
          auto_capture?: boolean
          calendar_digest_time?: string
          created_at?: string
          default_category?: string | null
          default_visibility?: string
          department?: Database["public"]["Enums"]["school_department"] | null
          drive_folder_id?: string | null
          drive_root_folder_id?: string | null
          drive_root_url?: string | null
          group_name: string
          id?: string
          last_attendance_digest_date?: string | null
          last_calendar_digest_date?: string | null
          last_notified_at?: string | null
          line_group_id: string
          notes?: string | null
          notify_attendance?: boolean
          notify_calendar?: boolean
          notify_cooldown_minutes?: number
          notify_leaves?: boolean
          notify_on_capture?: boolean
          notify_substitute?: boolean
          updated_at?: string
        }
        Update: {
          auto_capture?: boolean
          calendar_digest_time?: string
          created_at?: string
          default_category?: string | null
          default_visibility?: string
          department?: Database["public"]["Enums"]["school_department"] | null
          drive_folder_id?: string | null
          drive_root_folder_id?: string | null
          drive_root_url?: string | null
          group_name?: string
          id?: string
          last_attendance_digest_date?: string | null
          last_calendar_digest_date?: string | null
          last_notified_at?: string | null
          line_group_id?: string
          notes?: string | null
          notify_attendance?: boolean
          notify_calendar?: boolean
          notify_cooldown_minutes?: number
          notify_leaves?: boolean
          notify_on_capture?: boolean
          notify_substitute?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      line_vault_items: {
        Row: {
          academic_year: number | null
          category: string | null
          created_at: string
          department: Database["public"]["Enums"]["school_department"] | null
          description: string | null
          drive_file_id: string | null
          drive_web_view_link: string | null
          id: string
          is_pinned: boolean
          kind: string
          line_group_id: string | null
          line_image_set_id: string | null
          line_message_id: string | null
          line_sender_name: string | null
          line_sender_user_id: string | null
          mime_type: string | null
          note_text: string | null
          original_filename: string | null
          semester: number | null
          size_bytes: number | null
          source: string
          storage_path: string | null
          tags: string[]
          thumbnail_path: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          academic_year?: number | null
          category?: string | null
          created_at?: string
          department?: Database["public"]["Enums"]["school_department"] | null
          description?: string | null
          drive_file_id?: string | null
          drive_web_view_link?: string | null
          id?: string
          is_pinned?: boolean
          kind: string
          line_group_id?: string | null
          line_image_set_id?: string | null
          line_message_id?: string | null
          line_sender_name?: string | null
          line_sender_user_id?: string | null
          mime_type?: string | null
          note_text?: string | null
          original_filename?: string | null
          semester?: number | null
          size_bytes?: number | null
          source?: string
          storage_path?: string | null
          tags?: string[]
          thumbnail_path?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          academic_year?: number | null
          category?: string | null
          created_at?: string
          department?: Database["public"]["Enums"]["school_department"] | null
          description?: string | null
          drive_file_id?: string | null
          drive_web_view_link?: string | null
          id?: string
          is_pinned?: boolean
          kind?: string
          line_group_id?: string | null
          line_image_set_id?: string | null
          line_message_id?: string | null
          line_sender_name?: string | null
          line_sender_user_id?: string | null
          mime_type?: string | null
          note_text?: string | null
          original_filename?: string | null
          semester?: number | null
          size_bytes?: number | null
          source?: string
          storage_path?: string | null
          tags?: string[]
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: []
      }
      mascot_advice_cache: {
        Row: {
          context_snapshot: Json | null
          generated_at: string
          messages: Json
          next_refresh_at: string
          role: string | null
          user_id: string
        }
        Insert: {
          context_snapshot?: Json | null
          generated_at?: string
          messages?: Json
          next_refresh_at?: string
          role?: string | null
          user_id: string
        }
        Update: {
          context_snapshot?: Json | null
          generated_at?: string
          messages?: Json
          next_refresh_at?: string
          role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mfa_settings: {
        Row: {
          backup_codes: string[] | null
          created_at: string
          enabled: boolean
          id: string
          last_used_at: string | null
          totp_secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_codes?: string[] | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_used_at?: string | null
          totp_secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_codes?: string[] | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_used_at?: string | null
          totp_secret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mou_records: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          file_url: string | null
          id: string
          notes: string | null
          partner_contact: string | null
          partner_name: string
          responsible_person: string | null
          school_id: string | null
          scope: string | null
          start_date: string
          status: string
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          partner_contact?: string | null
          partner_name: string
          responsible_person?: string | null
          school_id?: string | null
          scope?: string | null
          start_date: string
          status?: string
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          partner_contact?: string | null
          partner_name?: string
          responsible_person?: string | null
          school_id?: string | null
          scope?: string | null
          start_date?: string
          status?: string
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mou_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      news_posts: {
        Row: {
          audience: string
          author: string | null
          author_id: string | null
          category: string
          content: string | null
          cover_image_url: string | null
          created_at: string
          id: string
          is_pinned: boolean
          is_published: boolean | null
          link_url: string | null
          pin_order: number | null
          published_at: string | null
          school_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          author?: string | null
          author_id?: string | null
          category?: string
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_published?: boolean | null
          link_url?: string | null
          pin_order?: number | null
          published_at?: string | null
          school_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          author?: string | null
          author_id?: string | null
          category?: string
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_published?: boolean | null
          link_url?: string | null
          pin_order?: number | null
          published_at?: string | null
          school_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_posts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_log: {
        Row: {
          channel: string
          created_at: string
          id: string
          notification_type: string | null
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          status: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          notification_type?: string | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          notification_type?: string | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          line_enabled: boolean
          min_push_severity: string
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          type_overrides: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          line_enabled?: boolean
          min_push_severity?: string
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          type_overrides?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          line_enabled?: boolean
          min_push_severity?: string
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          type_overrides?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      offsite_requests: {
        Row: {
          acting_teacher: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          leave_time: string | null
          location: string | null
          notes: string | null
          personnel_id: string
          photo_url: string | null
          reason: string | null
          rejected_reason: string | null
          request_date: string
          request_type: string
          return_date: string | null
          return_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acting_teacher?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          leave_time?: string | null
          location?: string | null
          notes?: string | null
          personnel_id: string
          photo_url?: string | null
          reason?: string | null
          rejected_reason?: string | null
          request_date?: string
          request_type?: string
          return_date?: string | null
          return_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acting_teacher?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          leave_time?: string | null
          location?: string | null
          notes?: string | null
          personnel_id?: string
          photo_url?: string | null
          reason?: string | null
          rejected_reason?: string | null
          request_date?: string
          request_type?: string
          return_date?: string | null
          return_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offsite_requests_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      pa_agreements: {
        Row: {
          academic_year: number | null
          created_at: string
          created_by: string | null
          evaluated_at: string | null
          evaluator_comments: string | null
          evaluator_name: string | null
          evaluator_position: string | null
          id: string
          part1_d1_score: number | null
          part1_d2_score: number | null
          part1_d3_score: number | null
          part2_score: number | null
          pdf_file_name: string | null
          pdf_file_url: string | null
          personnel_id: string | null
          position_type: string
          result_level: string | null
          status: string
          submitted_at: string | null
          title: string | null
          total_score: number | null
          updated_at: string
        }
        Insert: {
          academic_year?: number | null
          created_at?: string
          created_by?: string | null
          evaluated_at?: string | null
          evaluator_comments?: string | null
          evaluator_name?: string | null
          evaluator_position?: string | null
          id?: string
          part1_d1_score?: number | null
          part1_d2_score?: number | null
          part1_d3_score?: number | null
          part2_score?: number | null
          pdf_file_name?: string | null
          pdf_file_url?: string | null
          personnel_id?: string | null
          position_type?: string
          result_level?: string | null
          status?: string
          submitted_at?: string | null
          title?: string | null
          total_score?: number | null
          updated_at?: string
        }
        Update: {
          academic_year?: number | null
          created_at?: string
          created_by?: string | null
          evaluated_at?: string | null
          evaluator_comments?: string | null
          evaluator_name?: string | null
          evaluator_position?: string | null
          id?: string
          part1_d1_score?: number | null
          part1_d2_score?: number | null
          part1_d3_score?: number | null
          part2_score?: number | null
          pdf_file_name?: string | null
          pdf_file_url?: string | null
          personnel_id?: string | null
          position_type?: string
          result_level?: string | null
          status?: string
          submitted_at?: string | null
          title?: string | null
          total_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pa_agreements_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      pa_indicator_scores: {
        Row: {
          created_at: string
          domain: number
          evaluator_comment: string | null
          evidence: string | null
          evidence_images: string[] | null
          id: string
          indicator_number: number
          indicator_title: string
          max_score: number | null
          pa_agreement_id: string
          score: number | null
        }
        Insert: {
          created_at?: string
          domain?: number
          evaluator_comment?: string | null
          evidence?: string | null
          evidence_images?: string[] | null
          id?: string
          indicator_number: number
          indicator_title: string
          max_score?: number | null
          pa_agreement_id: string
          score?: number | null
        }
        Update: {
          created_at?: string
          domain?: number
          evaluator_comment?: string | null
          evidence?: string | null
          evidence_images?: string[] | null
          id?: string
          indicator_number?: number
          indicator_title?: string
          max_score?: number | null
          pa_agreement_id?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pa_indicator_scores_pa_agreement_id_fkey"
            columns: ["pa_agreement_id"]
            isOneToOne: false
            referencedRelation: "pa_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      padlet_boards: {
        Row: {
          allow_guest_post: boolean
          background: string | null
          classroom_id: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          layout: string
          owner_id: string
          share_code: string | null
          subject_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          allow_guest_post?: boolean
          background?: string | null
          classroom_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          layout?: string
          owner_id: string
          share_code?: string | null
          subject_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          allow_guest_post?: boolean
          background?: string | null
          classroom_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          layout?: string
          owner_id?: string
          share_code?: string | null
          subject_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      padlet_notes: {
        Row: {
          attachments: Json
          author_id: string | null
          author_name: string | null
          board_id: string
          color: string | null
          column_key: string | null
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          likes: number
          link_url: string | null
          position: number
          updated_at: string
        }
        Insert: {
          attachments?: Json
          author_id?: string | null
          author_name?: string | null
          board_id: string
          color?: string | null
          column_key?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          likes?: number
          link_url?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          attachments?: Json
          author_id?: string | null
          author_name?: string | null
          board_id?: string
          color?: string | null
          column_key?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          likes?: number
          link_url?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "padlet_notes_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "padlet_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          data_schema: Json | null
          description: string | null
          fields: Json
          id: string
          is_active: boolean
          is_public: boolean
          name: string
          page_count: number
          page_height: number | null
          page_width: number | null
          public_slug: string | null
          require_student_code: boolean
          source_pdf_path: string | null
          source_pdf_url: string
          sync_targets: Json
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          data_schema?: Json | null
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          is_public?: boolean
          name: string
          page_count?: number
          page_height?: number | null
          page_width?: number | null
          public_slug?: string | null
          require_student_code?: boolean
          source_pdf_path?: string | null
          source_pdf_url: string
          sync_targets?: Json
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          data_schema?: Json | null
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          is_public?: boolean
          name?: string
          page_count?: number
          page_height?: number | null
          page_width?: number | null
          public_slug?: string | null
          require_student_code?: boolean
          source_pdf_path?: string | null
          source_pdf_url?: string
          sync_targets?: Json
          updated_at?: string
        }
        Relationships: []
      }
      pdpa_consents: {
        Row: {
          accepted: boolean
          accepted_at: string
          consent_version: string
          created_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted?: boolean
          accepted_at?: string
          consent_version?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted?: boolean
          accepted_at?: string
          consent_version?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pdpa_requests: {
        Row: {
          created_at: string
          details: string | null
          id: string
          processed_at: string | null
          processed_by: string | null
          request_type: string
          response_notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          request_type: string
          response_notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          request_type?: string
          response_notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personnel: {
        Row: {
          academic_standing: string | null
          created_at: string
          department: string
          email: string | null
          employee_code: string
          first_name: string
          hire_date: string | null
          id: string
          last_name: string
          phone: string | null
          position: string
          position_level: string | null
          prefix: string | null
          school_id: string | null
          status: string
          subject_group: string | null
          teaching_level: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          academic_standing?: string | null
          created_at?: string
          department?: string
          email?: string | null
          employee_code: string
          first_name: string
          hire_date?: string | null
          id?: string
          last_name: string
          phone?: string | null
          position?: string
          position_level?: string | null
          prefix?: string | null
          school_id?: string | null
          status?: string
          subject_group?: string | null
          teaching_level?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          academic_standing?: string | null
          created_at?: string
          department?: string
          email?: string | null
          employee_code?: string
          first_name?: string
          hire_date?: string | null
          id?: string
          last_name?: string
          phone?: string | null
          position?: string
          position_level?: string | null
          prefix?: string | null
          school_id?: string | null
          status?: string
          subject_group?: string | null
          teaching_level?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_assessments: {
        Row: {
          academic_year: number | null
          answers: Json
          assessment_type: string
          created_at: string
          id: string
          result_summary: string | null
          scores: Json | null
          total_score: number | null
          user_id: string
        }
        Insert: {
          academic_year?: number | null
          answers?: Json
          assessment_type?: string
          created_at?: string
          id?: string
          result_summary?: string | null
          scores?: Json | null
          total_score?: number | null
          user_id: string
        }
        Update: {
          academic_year?: number | null
          answers?: Json
          assessment_type?: string
          created_at?: string
          id?: string
          result_summary?: string | null
          scores?: Json | null
          total_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          display_mode: string
          file_name: string | null
          file_size: number | null
          id: string
          is_pinned: boolean
          media_type: string
          media_url: string
          school_id: string | null
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          view_count: number
          visibility: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          display_mode?: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_pinned?: boolean
          media_type: string
          media_url: string
          school_id?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          view_count?: number
          visibility?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          display_mode?: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_pinned?: boolean
          media_type?: string
          media_url?: string
          school_id?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          view_count?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      pp5_files: {
        Row: {
          academic_year: number
          created_at: string
          file_name: string
          file_path: string
          file_url: string
          grade_level: string
          id: string
          personnel_id: string | null
          semester: number | null
          subject_code: string | null
          subject_id: string | null
          subject_name: string | null
          teacher_name: string | null
          uploaded_by: string | null
        }
        Insert: {
          academic_year?: number
          created_at?: string
          file_name: string
          file_path: string
          file_url: string
          grade_level: string
          id?: string
          personnel_id?: string | null
          semester?: number | null
          subject_code?: string | null
          subject_id?: string | null
          subject_name?: string | null
          teacher_name?: string | null
          uploaded_by?: string | null
        }
        Update: {
          academic_year?: number
          created_at?: string
          file_name?: string
          file_path?: string
          file_url?: string
          grade_level?: string
          id?: string
          personnel_id?: string | null
          semester?: number | null
          subject_code?: string | null
          subject_id?: string | null
          subject_name?: string | null
          teacher_name?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pp5_files_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pp5_files_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      pp6_files: {
        Row: {
          academic_year: number
          classroom_id: string | null
          classroom_name: string | null
          created_at: string
          file_name: string
          file_path: string
          file_url: string
          grade_level: string
          id: string
          personnel_id: string | null
          semester: number | null
          subject_id: string | null
          teacher_name: string | null
          uploaded_by: string | null
        }
        Insert: {
          academic_year?: number
          classroom_id?: string | null
          classroom_name?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_url: string
          grade_level: string
          id?: string
          personnel_id?: string | null
          semester?: number | null
          subject_id?: string | null
          teacher_name?: string | null
          uploaded_by?: string | null
        }
        Update: {
          academic_year?: number
          classroom_id?: string | null
          classroom_name?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_url?: string
          grade_level?: string
          id?: string
          personnel_id?: string | null
          semester?: number | null
          subject_id?: string | null
          teacher_name?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pp6_files_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pp6_files_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pp6_files_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      print_template_versions: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          snapshot: Json
          template_id: string
          version: number
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          snapshot: Json
          template_id: string
          version: number
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          snapshot?: Json
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "print_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "print_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      print_templates: {
        Row: {
          analyze_error: string | null
          analyze_status: string
          analyzed_at: string | null
          background_url: string | null
          body_html: string
          category: string | null
          code: string
          created_at: string
          css: string | null
          description: string | null
          field_map: Json
          fill_count: number
          footer_html: string | null
          header_html: string | null
          id: string
          is_active: boolean
          is_default: boolean
          is_default_for_category: boolean
          is_system_master: boolean
          last_used_at: string | null
          margin_bottom: number
          margin_left: number
          margin_right: number
          margin_top: number
          name: string
          orientation: string
          overlay_mode: boolean
          paper: string
          published_at: string | null
          sample_data: Json
          shared_with_roles: string[]
          source_pdf_pages: number | null
          source_pdf_path: string | null
          updated_at: string
          updated_by: string | null
          variables: Json
          version: number
        }
        Insert: {
          analyze_error?: string | null
          analyze_status?: string
          analyzed_at?: string | null
          background_url?: string | null
          body_html?: string
          category?: string | null
          code: string
          created_at?: string
          css?: string | null
          description?: string | null
          field_map?: Json
          fill_count?: number
          footer_html?: string | null
          header_html?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_default_for_category?: boolean
          is_system_master?: boolean
          last_used_at?: string | null
          margin_bottom?: number
          margin_left?: number
          margin_right?: number
          margin_top?: number
          name: string
          orientation?: string
          overlay_mode?: boolean
          paper?: string
          published_at?: string | null
          sample_data?: Json
          shared_with_roles?: string[]
          source_pdf_pages?: number | null
          source_pdf_path?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: Json
          version?: number
        }
        Update: {
          analyze_error?: string | null
          analyze_status?: string
          analyzed_at?: string | null
          background_url?: string | null
          body_html?: string
          category?: string | null
          code?: string
          created_at?: string
          css?: string | null
          description?: string | null
          field_map?: Json
          fill_count?: number
          footer_html?: string | null
          header_html?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_default_for_category?: boolean
          is_system_master?: boolean
          last_used_at?: string | null
          margin_bottom?: number
          margin_left?: number
          margin_right?: number
          margin_top?: number
          name?: string
          orientation?: string
          overlay_mode?: boolean
          paper?: string
          published_at?: string | null
          sample_data?: Json
          shared_with_roles?: string[]
          source_pdf_pages?: number | null
          source_pdf_path?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: Json
          version?: number
        }
        Relationships: []
      }
      procurement_advances: {
        Row: {
          amount: number
          approved_at: string | null
          borrowed_at: string | null
          borrower_id: string
          cleared_at: string | null
          created_at: string
          disbursed_at: string | null
          due_date: string | null
          id: string
          notes: string | null
          purpose: string
          refund_amount: number
          repaid_amount: number
          school_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          borrowed_at?: string | null
          borrower_id: string
          cleared_at?: string | null
          created_at?: string
          disbursed_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          purpose: string
          refund_amount?: number
          repaid_amount?: number
          school_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          borrowed_at?: string | null
          borrower_id?: string
          cleared_at?: string | null
          created_at?: string
          disbursed_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          purpose?: string
          refund_amount?: number
          repaid_amount?: number
          school_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_advances_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_documents: {
        Row: {
          advance_id: string | null
          created_at: string
          doc_type: string
          file_name: string
          file_path: string
          id: string
          procurement_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          advance_id?: string | null
          created_at?: string
          doc_type?: string
          file_name: string
          file_path: string
          id?: string
          procurement_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          advance_id?: string | null
          created_at?: string
          doc_type?: string
          file_name?: string
          file_path?: string
          id?: string
          procurement_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procurement_documents_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "procurement_advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_documents_procurement_id_fkey"
            columns: ["procurement_id"]
            isOneToOne: false
            referencedRelation: "procurement_records"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_records: {
        Row: {
          activity_id: string | null
          advance_request_id: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          case_type: string
          category_id: string | null
          cleared_at: string | null
          contract_number: string | null
          created_at: string
          description: string
          egp_number: string | null
          egpeasy_number: string | null
          fiscal_year: number | null
          fiscal_year_id: string | null
          id: string
          method: string
          notes: string | null
          procurement_date: string
          procurement_type: string
          project_id: string | null
          project_name: string | null
          purchased_at: string | null
          received_at: string | null
          request_type: string
          requested_by: string | null
          school_id: string | null
          source_id: string | null
          status: string
          tor_text: string | null
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          activity_id?: string | null
          advance_request_id?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          case_type?: string
          category_id?: string | null
          cleared_at?: string | null
          contract_number?: string | null
          created_at?: string
          description: string
          egp_number?: string | null
          egpeasy_number?: string | null
          fiscal_year?: number | null
          fiscal_year_id?: string | null
          id?: string
          method?: string
          notes?: string | null
          procurement_date?: string
          procurement_type?: string
          project_id?: string | null
          project_name?: string | null
          purchased_at?: string | null
          received_at?: string | null
          request_type?: string
          requested_by?: string | null
          school_id?: string | null
          source_id?: string | null
          status?: string
          tor_text?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          activity_id?: string | null
          advance_request_id?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          case_type?: string
          category_id?: string | null
          cleared_at?: string | null
          contract_number?: string | null
          created_at?: string
          description?: string
          egp_number?: string | null
          egpeasy_number?: string | null
          fiscal_year?: number | null
          fiscal_year_id?: string | null
          id?: string
          method?: string
          notes?: string | null
          procurement_date?: string
          procurement_type?: string
          project_id?: string | null
          project_name?: string | null
          purchased_at?: string | null
          received_at?: string | null
          request_type?: string
          requested_by?: string | null
          school_id?: string | null
          source_id?: string | null
          status?: string
          tor_text?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procurement_records_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "project_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_records_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_records_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "hub_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_budget_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "procurement_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_financial_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "procurement_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_records_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "budget_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_linked: boolean
          address: string | null
          avatar_full_url: string | null
          avatar_url: string | null
          bio: string | null
          blood_type: string | null
          cover_photo_url: string | null
          cover_thumb_url: string | null
          created_at: string
          date_of_birth: string | null
          department: string | null
          education_history: Json | null
          emergency_contact: string | null
          emergency_phone: string | null
          employee_code: string | null
          facebook_url: string | null
          first_name: string | null
          gender: string | null
          google_email: string | null
          hire_date: string | null
          id: string
          is_approved: boolean
          last_name: string | null
          leave_date: string | null
          line_id: string | null
          line_user_id: string | null
          linked_at: string | null
          mascot_config: Json | null
          must_change_password: boolean
          nickname: string | null
          pdpa_accepted_at: string | null
          pdpa_version: string | null
          phone: string | null
          position_title: string | null
          school_id: string | null
          student_code: string | null
          updated_at: string
          work_history: Json | null
        }
        Insert: {
          account_linked?: boolean
          address?: string | null
          avatar_full_url?: string | null
          avatar_url?: string | null
          bio?: string | null
          blood_type?: string | null
          cover_photo_url?: string | null
          cover_thumb_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          education_history?: Json | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          employee_code?: string | null
          facebook_url?: string | null
          first_name?: string | null
          gender?: string | null
          google_email?: string | null
          hire_date?: string | null
          id: string
          is_approved?: boolean
          last_name?: string | null
          leave_date?: string | null
          line_id?: string | null
          line_user_id?: string | null
          linked_at?: string | null
          mascot_config?: Json | null
          must_change_password?: boolean
          nickname?: string | null
          pdpa_accepted_at?: string | null
          pdpa_version?: string | null
          phone?: string | null
          position_title?: string | null
          school_id?: string | null
          student_code?: string | null
          updated_at?: string
          work_history?: Json | null
        }
        Update: {
          account_linked?: boolean
          address?: string | null
          avatar_full_url?: string | null
          avatar_url?: string | null
          bio?: string | null
          blood_type?: string | null
          cover_photo_url?: string | null
          cover_thumb_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          education_history?: Json | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          employee_code?: string | null
          facebook_url?: string | null
          first_name?: string | null
          gender?: string | null
          google_email?: string | null
          hire_date?: string | null
          id?: string
          is_approved?: boolean
          last_name?: string | null
          leave_date?: string | null
          line_id?: string | null
          line_user_id?: string | null
          linked_at?: string | null
          mascot_config?: Json | null
          must_change_password?: boolean
          nickname?: string | null
          pdpa_accepted_at?: string | null
          pdpa_version?: string | null
          phone?: string | null
          position_title?: string | null
          school_id?: string | null
          student_code?: string | null
          updated_at?: string
          work_history?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      project_activities: {
        Row: {
          budget_amount: number
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          progress_pct: number
          project_id: string
          responsible_person: string | null
          sort_order: number
          spent_amount: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget_amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          progress_pct?: number
          project_id: string
          responsible_person?: string | null
          sort_order?: number
          spent_amount?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget_amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          progress_pct?: number
          project_id?: string
          responsible_person?: string | null
          sort_order?: number
          spent_amount?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "hub_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_budget_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_financial_summary"
            referencedColumns: ["project_id"]
          },
        ]
      }
      promotion_runs: {
        Row: {
          academic_year: number
          created_at: string
          id: string
          rolled_back_at: string | null
          rolled_back_by: string | null
          run_at: string
          run_by: string | null
          snapshot: Json
          summary: Json
        }
        Insert: {
          academic_year: number
          created_at?: string
          id?: string
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          run_at?: string
          run_by?: string | null
          snapshot?: Json
          summary?: Json
        }
        Update: {
          academic_year?: number
          created_at?: string
          id?: string
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          run_at?: string
          run_by?: string | null
          snapshot?: Json
          summary?: Json
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      question_bank: {
        Row: {
          bloom_level: string | null
          choices: Json | null
          correct_answer: string | null
          created_at: string
          difficulty: string
          explanation: string | null
          grade_level: string | null
          id: string
          is_public: boolean
          owner_id: string | null
          question: string
          question_type: string
          school_id: string | null
          subject_id: string | null
          subject_name: string | null
          tags: string[] | null
          topic: string | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          bloom_level?: string | null
          choices?: Json | null
          correct_answer?: string | null
          created_at?: string
          difficulty?: string
          explanation?: string | null
          grade_level?: string | null
          id?: string
          is_public?: boolean
          owner_id?: string | null
          question: string
          question_type?: string
          school_id?: string | null
          subject_id?: string | null
          subject_name?: string | null
          tags?: string[] | null
          topic?: string | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          bloom_level?: string | null
          choices?: Json | null
          correct_answer?: string | null
          created_at?: string
          difficulty?: string
          explanation?: string | null
          grade_level?: string | null
          id?: string
          is_public?: boolean
          owner_id?: string | null
          question?: string
          question_type?: string
          school_id?: string | null
          subject_id?: string | null
          subject_name?: string | null
          tags?: string[] | null
          topic?: string | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_logs: {
        Row: {
          blocked: boolean
          created_at: string
          function_name: string
          id: string
          identifier: string
          request_count: number
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          function_name: string
          id?: string
          identifier: string
          request_count?: number
        }
        Update: {
          blocked?: boolean
          created_at?: string
          function_name?: string
          id?: string
          identifier?: string
          request_count?: number
        }
        Relationships: []
      }
      role_notification_defaults: {
        Row: {
          category: string
          gchat: boolean
          id: string
          in_app: boolean
          line: boolean
          min_severity: string
          push: boolean
          role: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          gchat?: boolean
          id?: string
          in_app?: boolean
          line?: boolean
          min_severity?: string
          push?: boolean
          role: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          gchat?: boolean
          id?: string
          in_app?: boolean
          line?: boolean
          min_severity?: string
          push?: boolean
          role?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      room_bookings: {
        Row: {
          approval_notes: string | null
          approved_by: string | null
          attendees_count: number | null
          booked_by: string
          created_at: string
          end_time: string
          equipment_needed: string | null
          id: string
          purpose: string
          room_id: string | null
          room_name: string | null
          school_id: string | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          approval_notes?: string | null
          approved_by?: string | null
          attendees_count?: number | null
          booked_by: string
          created_at?: string
          end_time: string
          equipment_needed?: string | null
          id?: string
          purpose: string
          room_id?: string | null
          room_name?: string | null
          school_id?: string | null
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          approval_notes?: string | null
          approved_by?: string | null
          attendees_count?: number | null
          booked_by?: string
          created_at?: string
          end_time?: string
          equipment_needed?: string | null
          id?: string
          purpose?: string
          room_id?: string | null
          room_name?: string | null
          school_id?: string | null
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "special_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_records: {
        Row: {
          base_salary: number | null
          created_at: string
          decoration_request: string | null
          deductions: number | null
          id: string
          net_salary: number | null
          notes: string | null
          other_allowance: number | null
          personnel_id: string | null
          position_allowance: number | null
          promotion_round: string | null
          salary_month: number
          salary_step: string | null
          salary_year: number
          school_id: string | null
        }
        Insert: {
          base_salary?: number | null
          created_at?: string
          decoration_request?: string | null
          deductions?: number | null
          id?: string
          net_salary?: number | null
          notes?: string | null
          other_allowance?: number | null
          personnel_id?: string | null
          position_allowance?: number | null
          promotion_round?: string | null
          salary_month: number
          salary_step?: string | null
          salary_year: number
          school_id?: string | null
        }
        Update: {
          base_salary?: number | null
          created_at?: string
          decoration_request?: string | null
          deductions?: number | null
          id?: string
          net_salary?: number | null
          notes?: string | null
          other_allowance?: number | null
          personnel_id?: string | null
          position_allowance?: number | null
          promotion_round?: string | null
          salary_month?: number
          salary_step?: string | null
          salary_year?: number
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_records_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      sar_evidences: {
        Row: {
          academic_year: string
          created_at: string
          description: string | null
          evidence_title: string
          evidence_url: string | null
          id: string
          indicator_name: string
          indicator_no: string
          quality_level: string | null
          school_id: string | null
          standard_no: number
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          academic_year: string
          created_at?: string
          description?: string | null
          evidence_title: string
          evidence_url?: string | null
          id?: string
          indicator_name: string
          indicator_no: string
          quality_level?: string | null
          school_id?: string | null
          standard_no: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          academic_year?: string
          created_at?: string
          description?: string | null
          evidence_title?: string
          evidence_url?: string | null
          id?: string
          indicator_name?: string
          indicator_no?: string
          quality_level?: string | null
          school_id?: string | null
          standard_no?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sar_evidences_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      saraban_documents: {
        Row: {
          assigned_to: string | null
          book_no: string | null
          created_at: string
          created_by: string | null
          direction: string
          doc_date: string
          doc_no: string
          file_url: string | null
          file_urls: Json
          from_org: string | null
          id: string
          notes: string | null
          received_date: string | null
          school_id: string | null
          secrecy: string
          status: string
          subject: string
          to_dept: string | null
          updated_at: string
          urgency: string
        }
        Insert: {
          assigned_to?: string | null
          book_no?: string | null
          created_at?: string
          created_by?: string | null
          direction: string
          doc_date: string
          doc_no: string
          file_url?: string | null
          file_urls?: Json
          from_org?: string | null
          id?: string
          notes?: string | null
          received_date?: string | null
          school_id?: string | null
          secrecy?: string
          status?: string
          subject: string
          to_dept?: string | null
          updated_at?: string
          urgency?: string
        }
        Update: {
          assigned_to?: string | null
          book_no?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          doc_date?: string
          doc_no?: string
          file_url?: string | null
          file_urls?: Json
          from_org?: string | null
          id?: string
          notes?: string | null
          received_date?: string | null
          school_id?: string | null
          secrecy?: string
          status?: string
          subject?: string
          to_dept?: string | null
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "saraban_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          academic_year: number | null
          classroom_id: string | null
          created_at: string
          day_of_week: number
          duration_periods: number
          end_time: string | null
          id: string
          period: number
          room: string | null
          school_id: string | null
          semester: number | null
          start_time: string | null
          subject_id: string | null
          subject_name_raw: string | null
          teacher_id: string | null
          teacher_name: string | null
        }
        Insert: {
          academic_year?: number | null
          classroom_id?: string | null
          created_at?: string
          day_of_week: number
          duration_periods?: number
          end_time?: string | null
          id?: string
          period: number
          room?: string | null
          school_id?: string | null
          semester?: number | null
          start_time?: string | null
          subject_id?: string | null
          subject_name_raw?: string | null
          teacher_id?: string | null
          teacher_name?: string | null
        }
        Update: {
          academic_year?: number | null
          classroom_id?: string | null
          created_at?: string
          day_of_week?: number
          duration_periods?: number
          end_time?: string | null
          id?: string
          period?: number
          room?: string | null
          school_id?: string | null
          semester?: number | null
          start_time?: string | null
          subject_id?: string | null
          subject_name_raw?: string | null
          teacher_id?: string | null
          teacher_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarship_awards: {
        Row: {
          amount: number
          awarded_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          scholarship_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          awarded_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          scholarship_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          awarded_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          scholarship_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_awards_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_awards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_awards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarships: {
        Row: {
          academic_year: string | null
          amount_per_award: number
          apply_end: string | null
          apply_start: string | null
          created_at: string
          created_by: string | null
          criteria: string | null
          id: string
          name: string
          quota: number | null
          school_id: string | null
          status: string
          total_budget: number | null
          type: string
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          amount_per_award?: number
          apply_end?: string | null
          apply_start?: string | null
          created_at?: string
          created_by?: string | null
          criteria?: string | null
          id?: string
          name: string
          quota?: number | null
          school_id?: string | null
          status?: string
          total_budget?: number | null
          type?: string
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          amount_per_award?: number
          apply_end?: string | null
          apply_start?: string | null
          created_at?: string
          created_by?: string | null
          criteria?: string | null
          id?: string
          name?: string
          quota?: number | null
          school_id?: string | null
          status?: string
          total_budget?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_lunch_records: {
        Row: {
          academic_year: number | null
          actual_eaters: number | null
          budget_source: string | null
          cost_per_head: number | null
          created_at: string
          created_by: string | null
          id: string
          lunch_date: string
          menu_description: string | null
          menu_name: string
          notes: string | null
          nutrition_info: string | null
          photo_url: string | null
          prepared_by: string | null
          school_id: string | null
          semester: number | null
          student_count: number
          total_cost: number | null
          updated_at: string
        }
        Insert: {
          academic_year?: number | null
          actual_eaters?: number | null
          budget_source?: string | null
          cost_per_head?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          lunch_date?: string
          menu_description?: string | null
          menu_name: string
          notes?: string | null
          nutrition_info?: string | null
          photo_url?: string | null
          prepared_by?: string | null
          school_id?: string | null
          semester?: number | null
          student_count?: number
          total_cost?: number | null
          updated_at?: string
        }
        Update: {
          academic_year?: number | null
          actual_eaters?: number | null
          budget_source?: string | null
          cost_per_head?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          lunch_date?: string
          menu_description?: string | null
          menu_name?: string
          notes?: string | null
          nutrition_info?: string | null
          photo_url?: string | null
          prepared_by?: string | null
          school_id?: string | null
          semester?: number | null
          student_count?: number
          total_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_lunch_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_milk_records: {
        Row: {
          academic_year: number | null
          actual_recipients: number | null
          batch_number: string | null
          budget_source: string | null
          created_at: string
          created_by: string | null
          distribution_date: string
          expiry_date: string | null
          grade_levels: string[] | null
          id: string
          milk_brand: string | null
          milk_type: string
          notes: string | null
          quality_status: string | null
          quantity_boxes: number
          school_id: string | null
          semester: number | null
          student_count: number
          supplier: string | null
          temperature_check: number | null
          total_cost: number | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          academic_year?: number | null
          actual_recipients?: number | null
          batch_number?: string | null
          budget_source?: string | null
          created_at?: string
          created_by?: string | null
          distribution_date?: string
          expiry_date?: string | null
          grade_levels?: string[] | null
          id?: string
          milk_brand?: string | null
          milk_type?: string
          notes?: string | null
          quality_status?: string | null
          quantity_boxes?: number
          school_id?: string | null
          semester?: number | null
          student_count?: number
          supplier?: string | null
          temperature_check?: number | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          academic_year?: number | null
          actual_recipients?: number | null
          batch_number?: string | null
          budget_source?: string | null
          created_at?: string
          created_by?: string | null
          distribution_date?: string
          expiry_date?: string | null
          grade_levels?: string[] | null
          id?: string
          milk_brand?: string | null
          milk_type?: string
          notes?: string | null
          quality_status?: string | null
          quantity_boxes?: number
          school_id?: string | null
          semester?: number | null
          student_count?: number
          supplier?: string | null
          temperature_check?: number | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_milk_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      school_test_scores: {
        Row: {
          academic_year: number
          area_avg: number | null
          avg_score: number | null
          created_at: string
          grade_level: string
          id: string
          national_avg: number | null
          notes: string | null
          school_id: string
          student_count: number | null
          subject: string
          test_type: string
          updated_at: string
        }
        Insert: {
          academic_year: number
          area_avg?: number | null
          avg_score?: number | null
          created_at?: string
          grade_level: string
          id?: string
          national_avg?: number | null
          notes?: string | null
          school_id: string
          student_count?: number | null
          subject: string
          test_type: string
          updated_at?: string
        }
        Update: {
          academic_year?: number
          area_avg?: number | null
          avg_score?: number | null
          created_at?: string
          grade_level?: string
          id?: string
          national_avg?: number | null
          notes?: string | null
          school_id?: string
          student_count?: number | null
          subject?: string
          test_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_test_scores_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          central_hub_consent: boolean
          central_hub_consent_at: string | null
          central_hub_consent_by: string | null
          created_at: string
          director_name: string | null
          district: string | null
          email: string | null
          id: string
          is_active: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          obec_code: string | null
          phone: string | null
          postal_code: string | null
          province: string | null
          school_code: string
          school_name: string
          short_name: string | null
          size_category: string | null
          total_personnel: number | null
          total_students: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          central_hub_consent?: boolean
          central_hub_consent_at?: string | null
          central_hub_consent_by?: string | null
          created_at?: string
          director_name?: string | null
          district?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          obec_code?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          school_code: string
          school_name: string
          short_name?: string | null
          size_category?: string | null
          total_personnel?: number | null
          total_students?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          central_hub_consent?: boolean
          central_hub_consent_at?: string | null
          central_hub_consent_by?: string | null
          created_at?: string
          director_name?: string | null
          district?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          obec_code?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          school_code?: string
          school_name?: string
          short_name?: string | null
          size_category?: string | null
          total_personnel?: number | null
          total_students?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      sdq_records: {
        Row: {
          academic_year: number | null
          assessment_by: string | null
          assessment_type: string | null
          conduct_score: number | null
          created_at: string
          emotional_score: number | null
          hyperactivity_score: number | null
          id: string
          peer_score: number | null
          prosocial_score: number | null
          school_id: string | null
          student_id: string | null
          total_difficulty: number | null
        }
        Insert: {
          academic_year?: number | null
          assessment_by?: string | null
          assessment_type?: string | null
          conduct_score?: number | null
          created_at?: string
          emotional_score?: number | null
          hyperactivity_score?: number | null
          id?: string
          peer_score?: number | null
          prosocial_score?: number | null
          school_id?: string | null
          student_id?: string | null
          total_difficulty?: number | null
        }
        Update: {
          academic_year?: number | null
          assessment_by?: string | null
          assessment_type?: string | null
          conduct_score?: number | null
          created_at?: string
          emotional_score?: number | null
          hyperactivity_score?: number | null
          id?: string
          peer_score?: number | null
          prosocial_score?: number | null
          school_id?: string | null
          student_id?: string | null
          total_difficulty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sdq_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdq_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdq_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          broadcast_error: string | null
          broadcasted_at: string | null
          content: string | null
          created_at: string
          external_id: string
          fetched_at: string
          id: string
          media_urls: string[] | null
          page_id: string | null
          permalink: string | null
          platform: string
          posted_at: string | null
          raw: Json | null
          thumbnail_url: string | null
        }
        Insert: {
          broadcast_error?: string | null
          broadcasted_at?: string | null
          content?: string | null
          created_at?: string
          external_id: string
          fetched_at?: string
          id?: string
          media_urls?: string[] | null
          page_id?: string | null
          permalink?: string | null
          platform?: string
          posted_at?: string | null
          raw?: Json | null
          thumbnail_url?: string | null
        }
        Update: {
          broadcast_error?: string | null
          broadcasted_at?: string | null
          content?: string | null
          created_at?: string
          external_id?: string
          fetched_at?: string
          id?: string
          media_urls?: string[] | null
          page_id?: string | null
          permalink?: string | null
          platform?: string
          posted_at?: string | null
          raw?: Json | null
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      special_rooms: {
        Row: {
          capacity: number | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          location: string | null
          name: string
          school_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location?: string | null
          name: string
          school_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location?: string | null
          name?: string
          school_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_rooms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_day_bonus_points: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          category: string
          created_at: string
          description: string | null
          house_id: string
          id: string
          meet_id: string
          points: number
          updated_at: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          category: string
          created_at?: string
          description?: string | null
          house_id: string
          id?: string
          meet_id: string
          points?: number
          updated_at?: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          category?: string
          created_at?: string
          description?: string | null
          house_id?: string
          id?: string
          meet_id?: string
          points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sports_day_bonus_points_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "sports_day_houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sports_day_bonus_points_meet_id_fkey"
            columns: ["meet_id"]
            isOneToOne: false
            referencedRelation: "sports_day_meets"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_day_house_members: {
        Row: {
          created_at: string
          house_id: string
          id: string
          meet_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          house_id: string
          id?: string
          meet_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          house_id?: string
          id?: string
          meet_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sports_day_house_members_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "sports_day_houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sports_day_house_members_meet_id_fkey"
            columns: ["meet_id"]
            isOneToOne: false
            referencedRelation: "sports_day_meets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sports_day_house_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sports_day_house_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_day_houses: {
        Row: {
          advisor_user_id: string | null
          captain_student_id: string | null
          color: string
          created_at: string
          emblem_url: string | null
          id: string
          meet_id: string
          motto: string | null
          name: string
          sort_order: number
          tent_location: string | null
          updated_at: string
        }
        Insert: {
          advisor_user_id?: string | null
          captain_student_id?: string | null
          color?: string
          created_at?: string
          emblem_url?: string | null
          id?: string
          meet_id: string
          motto?: string | null
          name: string
          sort_order?: number
          tent_location?: string | null
          updated_at?: string
        }
        Update: {
          advisor_user_id?: string | null
          captain_student_id?: string | null
          color?: string
          created_at?: string
          emblem_url?: string | null
          id?: string
          meet_id?: string
          motto?: string | null
          name?: string
          sort_order?: number
          tent_location?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sports_day_houses_captain_student_id_fkey"
            columns: ["captain_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sports_day_houses_captain_student_id_fkey"
            columns: ["captain_student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sports_day_houses_meet_id_fkey"
            columns: ["meet_id"]
            isOneToOne: false
            referencedRelation: "sports_day_meets"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_day_meets: {
        Row: {
          academic_period_id: string | null
          academic_year: string | null
          bronze_points: number
          closing_at: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          gold_points: number
          id: string
          opening_at: string | null
          silver_points: number
          start_date: string | null
          status: string
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          academic_period_id?: string | null
          academic_year?: string | null
          bronze_points?: number
          closing_at?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          gold_points?: number
          id?: string
          opening_at?: string | null
          silver_points?: number
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          academic_period_id?: string | null
          academic_year?: string | null
          bronze_points?: number
          closing_at?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          gold_points?: number
          id?: string
          opening_at?: string | null
          silver_points?: number
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sports_day_meets_academic_period_id_fkey"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "academic_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_evaluations: {
        Row: {
          academic_year: number | null
          comments: string | null
          created_at: string
          evaluation_type: string
          evaluator_name: string
          id: string
          max_score: number | null
          personnel_id: string | null
          score: number | null
        }
        Insert: {
          academic_year?: number | null
          comments?: string | null
          created_at?: string
          evaluation_type?: string
          evaluator_name: string
          id?: string
          max_score?: number | null
          personnel_id?: string | null
          score?: number | null
        }
        Update: {
          academic_year?: number | null
          comments?: string | null
          created_at?: string
          evaluation_type?: string
          evaluator_name?: string
          id?: string
          max_score?: number | null
          personnel_id?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_evaluations_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_leaves: {
        Row: {
          acting_teacher: string | null
          approved_at: string | null
          approved_by: string | null
          attachment_url: string | null
          contact_phone: string | null
          created_at: string
          end_date: string
          id: string
          leave_type: string
          personnel_id: string | null
          reason: string | null
          rejected_reason: string | null
          start_date: string
          status: string
        }
        Insert: {
          acting_teacher?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          contact_phone?: string | null
          created_at?: string
          end_date: string
          id?: string
          leave_type?: string
          personnel_id?: string | null
          reason?: string | null
          rejected_reason?: string | null
          start_date: string
          status?: string
        }
        Update: {
          acting_teacher?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          contact_phone?: string | null
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          personnel_id?: string | null
          reason?: string | null
          rejected_reason?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_leaves_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_plans: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          fiscal_year_id: string | null
          id: string
          level: string
          measure_unit: string | null
          parent_id: string | null
          sort_order: number
          target_value: string | null
          title: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fiscal_year_id?: string | null
          id?: string
          level: string
          measure_unit?: string | null
          parent_id?: string | null
          sort_order?: number
          target_value?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fiscal_year_id?: string | null
          id?: string
          level?: string
          measure_unit?: string | null
          parent_id?: string | null
          sort_order?: number
          target_value?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategic_plans_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_plans_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "strategic_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      student_assessment_scores: {
        Row: {
          academic_year: number | null
          assessed_by: string | null
          created_at: string
          criteria_id: string
          id: string
          level: string | null
          notes: string | null
          score: number | null
          semester: number | null
          student_id: string
        }
        Insert: {
          academic_year?: number | null
          assessed_by?: string | null
          created_at?: string
          criteria_id: string
          id?: string
          level?: string | null
          notes?: string | null
          score?: number | null
          semester?: number | null
          student_id: string
        }
        Update: {
          academic_year?: number | null
          assessed_by?: string | null
          created_at?: string
          criteria_id?: string
          id?: string
          level?: string | null
          notes?: string | null
          score?: number | null
          semester?: number | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_assessment_scores_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "assessment_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_assessment_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_assessment_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      student_column_scores: {
        Row: {
          column_id: string
          created_at: string
          id: string
          score: number | null
          student_id: string
        }
        Insert: {
          column_id: string
          created_at?: string
          id?: string
          score?: number | null
          student_id: string
        }
        Update: {
          column_id?: string
          created_at?: string
          id?: string
          score?: number | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_column_scores_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "subject_score_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_column_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_column_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      student_enrollment_history: {
        Row: {
          academic_year: number
          classroom_id: string | null
          classroom_name: string | null
          created_at: string
          end_date: string | null
          grade_level: string | null
          id: string
          notes: string | null
          start_date: string | null
          status: string
          student_id: string
        }
        Insert: {
          academic_year: number
          classroom_id?: string | null
          classroom_name?: string | null
          created_at?: string
          end_date?: string | null
          grade_level?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          student_id: string
        }
        Update: {
          academic_year?: number
          classroom_id?: string | null
          classroom_name?: string | null
          created_at?: string
          end_date?: string | null
          grade_level?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          student_id?: string
        }
        Relationships: []
      }
      student_face_descriptors: {
        Row: {
          captured_by: string | null
          created_at: string
          descriptor: number[]
          embedding_v2: number[] | null
          face_image: string | null
          id: string
          metrics: Json | null
          model_version: string
          quality_score: number | null
          sample_index: number
          source: string | null
          student_id: string
        }
        Insert: {
          captured_by?: string | null
          created_at?: string
          descriptor: number[]
          embedding_v2?: number[] | null
          face_image?: string | null
          id?: string
          metrics?: Json | null
          model_version?: string
          quality_score?: number | null
          sample_index?: number
          source?: string | null
          student_id: string
        }
        Update: {
          captured_by?: string | null
          created_at?: string
          descriptor?: number[]
          embedding_v2?: number[] | null
          face_image?: string | null
          id?: string
          metrics?: Json | null
          model_version?: string
          quality_score?: number | null
          sample_index?: number
          source?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_face_descriptors_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_face_descriptors_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      student_leaves: {
        Row: {
          approved_by: string | null
          attachment_url: string | null
          created_at: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          start_date: string
          status: string
          student_id: string | null
        }
        Insert: {
          approved_by?: string | null
          attachment_url?: string | null
          created_at?: string
          end_date: string
          id?: string
          leave_type?: string
          reason?: string | null
          start_date: string
          status?: string
          student_id?: string | null
        }
        Update: {
          approved_by?: string | null
          attachment_url?: string | null
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          start_date?: string
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_leaves_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_leaves_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      student_scores: {
        Row: {
          academic_year: number | null
          assignment_score: number | null
          attendance_score: number | null
          created_at: string
          final_score: number | null
          grade: string | null
          grade_point: number | null
          id: string
          midterm_score: number | null
          semester: number | null
          student_code: string | null
          student_name: string
          subject_id: string
          total_score: number | null
          updated_at: string
        }
        Insert: {
          academic_year?: number | null
          assignment_score?: number | null
          attendance_score?: number | null
          created_at?: string
          final_score?: number | null
          grade?: string | null
          grade_point?: number | null
          id?: string
          midterm_score?: number | null
          semester?: number | null
          student_code?: string | null
          student_name: string
          subject_id: string
          total_score?: number | null
          updated_at?: string
        }
        Update: {
          academic_year?: number | null
          assignment_score?: number | null
          attendance_score?: number | null
          created_at?: string
          final_score?: number | null
          grade?: string | null
          grade_point?: number | null
          id?: string
          midterm_score?: number | null
          semester?: number | null
          student_code?: string | null
          student_name?: string
          subject_id?: string
          total_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_scores_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_screenings: {
        Row: {
          academic_year: number | null
          category: string
          created_at: string
          economic_status: string | null
          id: string
          notes: string | null
          protection_status: string | null
          screened_by: string | null
          screening_type: string
          student_id: string | null
        }
        Insert: {
          academic_year?: number | null
          category?: string
          created_at?: string
          economic_status?: string | null
          id?: string
          notes?: string | null
          protection_status?: string | null
          screened_by?: string | null
          screening_type?: string
          student_id?: string | null
        }
        Update: {
          academic_year?: number | null
          category?: string
          created_at?: string
          economic_status?: string | null
          id?: string
          notes?: string | null
          protection_status?: string | null
          screened_by?: string | null
          screening_type?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_screenings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_screenings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      student_subsidies: {
        Row: {
          academic_year: number | null
          amount: number
          approved_by: string | null
          created_at: string
          disbursement_date: string | null
          id: string
          income_per_month: number | null
          is_eligible: boolean | null
          notes: string | null
          screening_result: string | null
          semester: number | null
          status: string
          student_id: string | null
          subsidy_type: string
        }
        Insert: {
          academic_year?: number | null
          amount?: number
          approved_by?: string | null
          created_at?: string
          disbursement_date?: string | null
          id?: string
          income_per_month?: number | null
          is_eligible?: boolean | null
          notes?: string | null
          screening_result?: string | null
          semester?: number | null
          status?: string
          student_id?: string | null
          subsidy_type?: string
        }
        Update: {
          academic_year?: number | null
          amount?: number
          approved_by?: string | null
          created_at?: string
          disbursement_date?: string | null
          id?: string
          income_per_month?: number | null
          is_eligible?: boolean | null
          notes?: string | null
          screening_result?: string | null
          semester?: number | null
          status?: string
          student_id?: string | null
          subsidy_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subsidies_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subsidies_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          admission_date: string | null
          auth_email: string | null
          auth_user_id: string | null
          birth_province: string | null
          blood_type: string | null
          classroom_id: string | null
          created_at: string
          date_of_birth: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          ethnicity: string | null
          father_id: string | null
          father_name: string | null
          father_occupation: string | null
          father_phone: string | null
          first_name: string
          gender: string | null
          graduated_at: string | null
          graduation_gpa: number | null
          graduation_level: string | null
          graduation_year: number | null
          guardian_name: string | null
          guardian_phone: string | null
          guardian_relation: string | null
          height: number | null
          id: string
          inclusion_classroom_id: string | null
          is_special_needs: boolean
          last_name: string
          line_user_id: string | null
          line_user_id_2: string | null
          line_user_id_3: string | null
          mother_id: string | null
          mother_name: string | null
          mother_occupation: string | null
          mother_phone: string | null
          national_id: string | null
          nationality: string | null
          parent_name_1: string | null
          parent_name_2: string | null
          parent_name_3: string | null
          parent_phone_1: string | null
          parent_phone_2: string | null
          parent_phone_3: string | null
          parent_relation_1: string | null
          parent_relation_2: string | null
          parent_relation_3: string | null
          parent_user_id: string | null
          parent_user_id_2: string | null
          phone: string | null
          photo_url: string | null
          prefix: string | null
          previous_school: string | null
          religion: string | null
          school_id: string | null
          special_needs: string | null
          special_needs_type: string | null
          status: string
          student_code: string
          transition_pending_at: string | null
          transition_pending_to: string | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          address?: string | null
          admission_date?: string | null
          auth_email?: string | null
          auth_user_id?: string | null
          birth_province?: string | null
          blood_type?: string | null
          classroom_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          ethnicity?: string | null
          father_id?: string | null
          father_name?: string | null
          father_occupation?: string | null
          father_phone?: string | null
          first_name: string
          gender?: string | null
          graduated_at?: string | null
          graduation_gpa?: number | null
          graduation_level?: string | null
          graduation_year?: number | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relation?: string | null
          height?: number | null
          id?: string
          inclusion_classroom_id?: string | null
          is_special_needs?: boolean
          last_name: string
          line_user_id?: string | null
          line_user_id_2?: string | null
          line_user_id_3?: string | null
          mother_id?: string | null
          mother_name?: string | null
          mother_occupation?: string | null
          mother_phone?: string | null
          national_id?: string | null
          nationality?: string | null
          parent_name_1?: string | null
          parent_name_2?: string | null
          parent_name_3?: string | null
          parent_phone_1?: string | null
          parent_phone_2?: string | null
          parent_phone_3?: string | null
          parent_relation_1?: string | null
          parent_relation_2?: string | null
          parent_relation_3?: string | null
          parent_user_id?: string | null
          parent_user_id_2?: string | null
          phone?: string | null
          photo_url?: string | null
          prefix?: string | null
          previous_school?: string | null
          religion?: string | null
          school_id?: string | null
          special_needs?: string | null
          special_needs_type?: string | null
          status?: string
          student_code: string
          transition_pending_at?: string | null
          transition_pending_to?: string | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          address?: string | null
          admission_date?: string | null
          auth_email?: string | null
          auth_user_id?: string | null
          birth_province?: string | null
          blood_type?: string | null
          classroom_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          ethnicity?: string | null
          father_id?: string | null
          father_name?: string | null
          father_occupation?: string | null
          father_phone?: string | null
          first_name?: string
          gender?: string | null
          graduated_at?: string | null
          graduation_gpa?: number | null
          graduation_level?: string | null
          graduation_year?: number | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relation?: string | null
          height?: number | null
          id?: string
          inclusion_classroom_id?: string | null
          is_special_needs?: boolean
          last_name?: string
          line_user_id?: string | null
          line_user_id_2?: string | null
          line_user_id_3?: string | null
          mother_id?: string | null
          mother_name?: string | null
          mother_occupation?: string | null
          mother_phone?: string | null
          national_id?: string | null
          nationality?: string | null
          parent_name_1?: string | null
          parent_name_2?: string | null
          parent_name_3?: string | null
          parent_phone_1?: string | null
          parent_phone_2?: string | null
          parent_phone_3?: string | null
          parent_relation_1?: string | null
          parent_relation_2?: string | null
          parent_relation_3?: string | null
          parent_user_id?: string | null
          parent_user_id_2?: string | null
          phone?: string | null
          photo_url?: string | null
          prefix?: string | null
          previous_school?: string | null
          religion?: string | null
          school_id?: string | null
          special_needs?: string | null
          special_needs_type?: string | null
          status?: string
          student_code?: string
          transition_pending_at?: string | null
          transition_pending_to?: string | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_inclusion_classroom_id_fkey"
            columns: ["inclusion_classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_grading_config: {
        Row: {
          created_at: string
          id: string
          subject_id: string
          updated_at: string
          updated_by: string | null
          weight_during: number
          weight_final: number
        }
        Insert: {
          created_at?: string
          id?: string
          subject_id: string
          updated_at?: string
          updated_by?: string | null
          weight_during?: number
          weight_final?: number
        }
        Update: {
          created_at?: string
          id?: string
          subject_id?: string
          updated_at?: string
          updated_by?: string | null
          weight_during?: number
          weight_final?: number
        }
        Relationships: [
          {
            foreignKeyName: "subject_grading_config_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: true
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_group_heads: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          id: string
          notes: string | null
          position: Database["public"]["Enums"]["subject_group_position"]
          subject_group: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          position?: Database["public"]["Enums"]["subject_group_position"]
          subject_group: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          position?: Database["public"]["Enums"]["subject_group_position"]
          subject_group?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subject_indicators: {
        Row: {
          created_at: string
          description: string | null
          id: string
          personnel_id: string | null
          sort_order: number | null
          subject_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          personnel_id?: string | null
          sort_order?: number | null
          subject_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          personnel_id?: string | null
          sort_order?: number | null
          subject_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_indicators_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_indicators_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_score_columns: {
        Row: {
          column_name: string
          column_type: string
          created_at: string
          half: string
          id: string
          indicator_id: string | null
          is_enabled: boolean
          max_score: number
          personnel_id: string | null
          sort_order: number | null
          subject_id: string
        }
        Insert: {
          column_name: string
          column_type?: string
          created_at?: string
          half?: string
          id?: string
          indicator_id?: string | null
          is_enabled?: boolean
          max_score?: number
          personnel_id?: string | null
          sort_order?: number | null
          subject_id: string
        }
        Update: {
          column_name?: string
          column_type?: string
          created_at?: string
          half?: string
          id?: string
          indicator_id?: string | null
          is_enabled?: boolean
          max_score?: number
          personnel_id?: string | null
          sort_order?: number | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_score_columns_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "subject_indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_score_columns_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_score_columns_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          academic_year: number | null
          code: string
          created_at: string
          credits: number
          grade_level: string | null
          hours_per_week: number
          id: string
          name_en: string | null
          name_th: string
          pp5_period_dates: string[]
          school_id: string | null
          semester: number | null
          subject_type: string
          updated_at: string
          weeks_per_semester: number
          weight_assignment: number
          weight_attendance: number
          weight_final: number
          weight_midterm: number
        }
        Insert: {
          academic_year?: number | null
          code: string
          created_at?: string
          credits?: number
          grade_level?: string | null
          hours_per_week?: number
          id?: string
          name_en?: string | null
          name_th: string
          pp5_period_dates?: string[]
          school_id?: string | null
          semester?: number | null
          subject_type?: string
          updated_at?: string
          weeks_per_semester?: number
          weight_assignment?: number
          weight_attendance?: number
          weight_final?: number
          weight_midterm?: number
        }
        Update: {
          academic_year?: number | null
          code?: string
          created_at?: string
          credits?: number
          grade_level?: string | null
          hours_per_week?: number
          id?: string
          name_en?: string | null
          name_th?: string
          pp5_period_dates?: string[]
          school_id?: string | null
          semester?: number | null
          subject_type?: string
          updated_at?: string
          weeks_per_semester?: number
          weight_assignment?: number
          weight_attendance?: number
          weight_final?: number
          weight_midterm?: number
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      substitute_teaching: {
        Row: {
          classroom_id: string | null
          created_at: string
          id: string
          leave_id: string | null
          notes: string | null
          original_teacher: string
          period: string
          proof_photo_url: string | null
          proof_uploaded_at: string | null
          proof_uploaded_by: string | null
          status: string
          subject_id: string | null
          substitute_teacher: string | null
          teaching_date: string
        }
        Insert: {
          classroom_id?: string | null
          created_at?: string
          id?: string
          leave_id?: string | null
          notes?: string | null
          original_teacher: string
          period: string
          proof_photo_url?: string | null
          proof_uploaded_at?: string | null
          proof_uploaded_by?: string | null
          status?: string
          subject_id?: string | null
          substitute_teacher?: string | null
          teaching_date?: string
        }
        Update: {
          classroom_id?: string | null
          created_at?: string
          id?: string
          leave_id?: string | null
          notes?: string | null
          original_teacher?: string
          period?: string
          proof_photo_url?: string | null
          proof_uploaded_at?: string | null
          proof_uploaded_by?: string | null
          status?: string
          subject_id?: string | null
          substitute_teacher?: string | null
          teaching_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "substitute_teaching_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitute_teaching_leave_id_fkey"
            columns: ["leave_id"]
            isOneToOne: false
            referencedRelation: "staff_leaves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitute_teaching_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          annotated_file_url: string | null
          assigned_by: string | null
          assigned_date: string
          assigned_to_student_id: string | null
          assigned_to_user_id: string | null
          attachments: Json
          classroom_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          feedback: string | null
          grade: number | null
          id: string
          max_score: number | null
          notes: string | null
          replies: Json
          status: string
          subject_id: string | null
          submission_file_url: string | null
          submission_text: string | null
          submissions: Json
          submitted_at: string | null
          task_type: string
          title: string
          updated_at: string
          worksheet_id: string | null
        }
        Insert: {
          annotated_file_url?: string | null
          assigned_by?: string | null
          assigned_date?: string
          assigned_to_student_id?: string | null
          assigned_to_user_id?: string | null
          attachments?: Json
          classroom_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          feedback?: string | null
          grade?: number | null
          id?: string
          max_score?: number | null
          notes?: string | null
          replies?: Json
          status?: string
          subject_id?: string | null
          submission_file_url?: string | null
          submission_text?: string | null
          submissions?: Json
          submitted_at?: string | null
          task_type?: string
          title: string
          updated_at?: string
          worksheet_id?: string | null
        }
        Update: {
          annotated_file_url?: string | null
          assigned_by?: string | null
          assigned_date?: string
          assigned_to_student_id?: string | null
          assigned_to_user_id?: string | null
          attachments?: Json
          classroom_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          feedback?: string | null
          grade?: number | null
          id?: string
          max_score?: number | null
          notes?: string | null
          replies?: Json
          status?: string
          subject_id?: string | null
          submission_file_url?: string | null
          submission_text?: string | null
          submissions?: Json
          submitted_at?: string | null
          task_type?: string
          title?: string
          updated_at?: string
          worksheet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_assigned_to_student_id_fkey"
            columns: ["assigned_to_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_assigned_to_student_id_fkey"
            columns: ["assigned_to_student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignments: {
        Row: {
          academic_year: number | null
          classroom_id: string | null
          created_at: string
          id: string
          personnel_id: string
          semester: number | null
          subject_id: string
        }
        Insert: {
          academic_year?: number | null
          classroom_id?: string | null
          created_at?: string
          id?: string
          personnel_id: string
          semester?: number | null
          subject_id: string
        }
        Update: {
          academic_year?: number | null
          classroom_id?: string | null
          created_at?: string
          id?: string
          personnel_id?: string
          semester?: number | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_logbook: {
        Row: {
          academic_year: number | null
          activities: string | null
          classroom_id: string | null
          created_at: string
          evidence_urls: string[] | null
          id: string
          lesson_plan_id: string | null
          next_plan: string | null
          period: number | null
          problems: string | null
          reflection: string | null
          school_id: string | null
          semester: number | null
          solutions: string | null
          students_absent: number | null
          students_present: number | null
          students_total: number | null
          subject_id: string | null
          teacher_id: string | null
          teaching_date: string
          teaching_result: string | null
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year?: number | null
          activities?: string | null
          classroom_id?: string | null
          created_at?: string
          evidence_urls?: string[] | null
          id?: string
          lesson_plan_id?: string | null
          next_plan?: string | null
          period?: number | null
          problems?: string | null
          reflection?: string | null
          school_id?: string | null
          semester?: number | null
          solutions?: string | null
          students_absent?: number | null
          students_present?: number | null
          students_total?: number | null
          subject_id?: string | null
          teacher_id?: string | null
          teaching_date: string
          teaching_result?: string | null
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year?: number | null
          activities?: string | null
          classroom_id?: string | null
          created_at?: string
          evidence_urls?: string[] | null
          id?: string
          lesson_plan_id?: string | null
          next_plan?: string | null
          period?: number | null
          problems?: string | null
          reflection?: string | null
          school_id?: string | null
          semester?: number | null
          solutions?: string | null
          students_absent?: number | null
          students_present?: number | null
          students_total?: number | null
          subject_id?: string | null
          teacher_id?: string | null
          teaching_date?: string
          teaching_result?: string | null
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_logbook_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_logbook_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_logbook_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_logbook_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_reflection_attachments: {
        Row: {
          caption: string | null
          created_at: string
          display_order: number | null
          file_name: string | null
          file_url: string
          id: string
          reflection_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          display_order?: number | null
          file_name?: string | null
          file_url: string
          id?: string
          reflection_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          display_order?: number | null
          file_name?: string | null
          file_url?: string
          id?: string
          reflection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_reflection_attachments_reflection_id_fkey"
            columns: ["reflection_id"]
            isOneToOne: false
            referencedRelation: "teaching_reflections"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_reflection_signature_settings: {
        Row: {
          align: string
          created_at: string
          id: string
          offset_x_mm: number
          offset_y_mm: number
          override_name: string | null
          override_position: string | null
          render_mode: string
          role: string
          show_comment_line: boolean
          signature_id: string | null
          size_preset: string
          size_px: number
          updated_at: string
        }
        Insert: {
          align?: string
          created_at?: string
          id?: string
          offset_x_mm?: number
          offset_y_mm?: number
          override_name?: string | null
          override_position?: string | null
          render_mode?: string
          role: string
          show_comment_line?: boolean
          signature_id?: string | null
          size_preset?: string
          size_px?: number
          updated_at?: string
        }
        Update: {
          align?: string
          created_at?: string
          id?: string
          offset_x_mm?: number
          offset_y_mm?: number
          override_name?: string | null
          override_position?: string | null
          render_mode?: string
          role?: string
          show_comment_line?: boolean
          signature_id?: string | null
          size_preset?: string
          size_px?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_reflection_signature_settings_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "director_signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_reflection_signatures: {
        Row: {
          comment: string | null
          id: string
          reflection_id: string
          signature_url: string | null
          signed_at: string
          signer_id: string
          signer_name: string | null
          signer_role: Database["public"]["Enums"]["reflection_signer_role"]
        }
        Insert: {
          comment?: string | null
          id?: string
          reflection_id: string
          signature_url?: string | null
          signed_at?: string
          signer_id: string
          signer_name?: string | null
          signer_role: Database["public"]["Enums"]["reflection_signer_role"]
        }
        Update: {
          comment?: string | null
          id?: string
          reflection_id?: string
          signature_url?: string | null
          signed_at?: string
          signer_id?: string
          signer_name?: string | null
          signer_role?: Database["public"]["Enums"]["reflection_signer_role"]
        }
        Relationships: [
          {
            foreignKeyName: "teaching_reflection_signatures_reflection_id_fkey"
            columns: ["reflection_id"]
            isOneToOne: false
            referencedRelation: "teaching_reflections"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_reflections: {
        Row: {
          academic_period_id: string | null
          assessment_data: Json | null
          classroom_id: string | null
          created_at: string
          current_step: number
          hours_taught: number | null
          id: string
          learning_outcomes: string | null
          lesson_date: string
          lesson_topic: string
          pass_percent: number | null
          period_no: number | null
          problems: string | null
          score_attitude: number | null
          score_knowledge: number | null
          score_process: number | null
          status: Database["public"]["Enums"]["reflection_status"]
          students_fail: number | null
          students_pass: number | null
          students_total: number | null
          subject_group: string | null
          subject_id: string | null
          suggestions: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          academic_period_id?: string | null
          assessment_data?: Json | null
          classroom_id?: string | null
          created_at?: string
          current_step?: number
          hours_taught?: number | null
          id?: string
          learning_outcomes?: string | null
          lesson_date?: string
          lesson_topic: string
          pass_percent?: number | null
          period_no?: number | null
          problems?: string | null
          score_attitude?: number | null
          score_knowledge?: number | null
          score_process?: number | null
          status?: Database["public"]["Enums"]["reflection_status"]
          students_fail?: number | null
          students_pass?: number | null
          students_total?: number | null
          subject_group?: string | null
          subject_id?: string | null
          suggestions?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          academic_period_id?: string | null
          assessment_data?: Json | null
          classroom_id?: string | null
          created_at?: string
          current_step?: number
          hours_taught?: number | null
          id?: string
          learning_outcomes?: string | null
          lesson_date?: string
          lesson_topic?: string
          pass_percent?: number | null
          period_no?: number | null
          problems?: string | null
          score_attitude?: number | null
          score_knowledge?: number | null
          score_process?: number | null
          status?: Database["public"]["Enums"]["reflection_status"]
          students_fail?: number | null
          students_pass?: number | null
          students_total?: number | null
          subject_group?: string | null
          subject_id?: string | null
          suggestions?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_reflections_academic_period_id_fkey"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "academic_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_reflections_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_reflections_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      template_fill_history: {
        Row: {
          created_at: string
          data: Json
          filled_by: string | null
          id: string
          output_pdf_path: string | null
          student_id: string | null
          template_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          filled_by?: string | null
          id?: string
          output_pdf_path?: string | null
          student_id?: string | null
          template_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          filled_by?: string | null
          id?: string
          output_pdf_path?: string | null
          student_id?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_fill_history_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "print_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      time_clock: {
        Row: {
          clock_date: string
          clock_in: string | null
          clock_in_photo_url: string | null
          clock_lat: number | null
          clock_lng: number | null
          clock_out: string | null
          clock_out_photo_url: string | null
          created_at: string
          gps_verified: boolean | null
          id: string
          is_offsite: boolean
          notes: string | null
          offsite_location: string | null
          offsite_reason: string | null
          personnel_id: string | null
          status: string
          student_id: string | null
        }
        Insert: {
          clock_date?: string
          clock_in?: string | null
          clock_in_photo_url?: string | null
          clock_lat?: number | null
          clock_lng?: number | null
          clock_out?: string | null
          clock_out_photo_url?: string | null
          created_at?: string
          gps_verified?: boolean | null
          id?: string
          is_offsite?: boolean
          notes?: string | null
          offsite_location?: string | null
          offsite_reason?: string | null
          personnel_id?: string | null
          status?: string
          student_id?: string | null
        }
        Update: {
          clock_date?: string
          clock_in?: string | null
          clock_in_photo_url?: string | null
          clock_lat?: number | null
          clock_lng?: number | null
          clock_out?: string | null
          clock_out_photo_url?: string | null
          created_at?: string
          gps_verified?: boolean | null
          id?: string
          is_offsite?: boolean
          notes?: string | null
          offsite_location?: string | null
          offsite_reason?: string | null
          personnel_id?: string | null
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_clock_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_clock_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_clock_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tuition_invoices: {
        Row: {
          academic_year: string | null
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          id: string
          invoice_no: string
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          payment_ref: string | null
          qr_payload: string | null
          receipt_url: string | null
          school_id: string | null
          semester: number | null
          status: string
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          id?: string
          invoice_no?: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          qr_payload?: string | null
          receipt_url?: string | null
          school_id?: string | null
          semester?: number | null
          status?: string
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          id?: string
          invoice_no?: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          qr_payload?: string | null
          receipt_url?: string | null
          school_id?: string | null
          semester?: number | null
          status?: string
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tuition_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tutoring_bookings: {
        Row: {
          booked_at: string
          id: string
          session_id: string
          status: string
          student_id: string | null
          user_id: string | null
        }
        Insert: {
          booked_at?: string
          id?: string
          session_id: string
          status?: string
          student_id?: string | null
          user_id?: string | null
        }
        Update: {
          booked_at?: string
          id?: string
          session_id?: string
          status?: string
          student_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutoring_bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutoring_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutoring_bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutoring_bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tutoring_sessions: {
        Row: {
          booked_count: number
          capacity: number
          created_at: string
          description: string | null
          end_time: string
          fee: number | null
          grade_levels: string[] | null
          id: string
          is_free: boolean
          location: string | null
          online_url: string | null
          school_id: string | null
          start_time: string
          status: string
          subject_name: string
          teacher_id: string
          topic: string
          updated_at: string
        }
        Insert: {
          booked_count?: number
          capacity?: number
          created_at?: string
          description?: string | null
          end_time: string
          fee?: number | null
          grade_levels?: string[] | null
          id?: string
          is_free?: boolean
          location?: string | null
          online_url?: string | null
          school_id?: string | null
          start_time: string
          status?: string
          subject_name: string
          teacher_id: string
          topic: string
          updated_at?: string
        }
        Update: {
          booked_count?: number
          capacity?: number
          created_at?: string
          description?: string | null
          end_time?: string
          fee?: number | null
          grade_levels?: string[] | null
          id?: string
          is_free?: boolean
          location?: string | null
          online_url?: string | null
          school_id?: string | null
          start_time?: string
          status?: string
          subject_name?: string
          teacher_id?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutoring_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      upstream_subscription: {
        Row: {
          auto_pull: boolean
          bundle_url: string
          created_at: string
          id: string
          last_error: string | null
          last_pulled_at: string | null
          last_status: string | null
          last_version: string | null
          name: string
          updated_at: string
        }
        Insert: {
          auto_pull?: boolean
          bundle_url: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_pulled_at?: string | null
          last_status?: string | null
          last_version?: string | null
          name?: string
          updated_at?: string
        }
        Update: {
          auto_pull?: boolean
          bundle_url?: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_pulled_at?: string | null
          last_status?: string | null
          last_version?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_dashboard_widgets: {
        Row: {
          color_theme: string
          config: Json | null
          created_at: string
          enabled: boolean
          id: string
          position: number
          size: string
          updated_at: string
          user_id: string
          widget_key: string
        }
        Insert: {
          color_theme?: string
          config?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          position?: number
          size?: string
          updated_at?: string
          user_id: string
          widget_key: string
        }
        Update: {
          color_theme?: string
          config?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          position?: number
          size?: string
          updated_at?: string
          user_id?: string
          widget_key?: string
        }
        Relationships: []
      }
      user_departments: {
        Row: {
          assigned_by: string | null
          created_at: string
          department: Database["public"]["Enums"]["school_department"]
          dept_role: Database["public"]["Enums"]["dept_role"]
          id: string
          is_head: boolean
          notes: string | null
          position: Database["public"]["Enums"]["dept_position"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          department: Database["public"]["Enums"]["school_department"]
          dept_role?: Database["public"]["Enums"]["dept_role"]
          id?: string
          is_head?: boolean
          notes?: string | null
          position?: Database["public"]["Enums"]["dept_position"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          department?: Database["public"]["Enums"]["school_department"]
          dept_role?: Database["public"]["Enums"]["dept_role"]
          id?: string
          is_head?: boolean
          notes?: string | null
          position?: Database["public"]["Enums"]["dept_position"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_subject_groups: {
        Row: {
          assigned_by: string | null
          created_at: string
          group_role: Database["public"]["Enums"]["dept_role"]
          id: string
          notes: string | null
          subject_group: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          group_role?: Database["public"]["Enums"]["dept_role"]
          id?: string
          notes?: string | null
          subject_group: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          group_role?: Database["public"]["Enums"]["dept_role"]
          id?: string
          notes?: string | null
          subject_group?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vaccine_records: {
        Row: {
          administered_by: string | null
          created_at: string
          date_administered: string
          dose_number: number | null
          id: string
          lot_number: string | null
          notes: string | null
          student_id: string | null
          vaccine_name: string
        }
        Insert: {
          administered_by?: string | null
          created_at?: string
          date_administered?: string
          dose_number?: number | null
          id?: string
          lot_number?: string | null
          notes?: string | null
          student_id?: string | null
          vaccine_name: string
        }
        Update: {
          administered_by?: string | null
          created_at?: string
          date_administered?: string
          dose_number?: number | null
          id?: string
          lot_number?: string | null
          notes?: string | null
          student_id?: string | null
          vaccine_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccine_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccine_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_bookings: {
        Row: {
          approval_notes: string | null
          approved_by: string | null
          booked_by: string
          created_at: string
          destination: string
          driver_name: string | null
          end_time: string
          fuel_cost: number | null
          id: string
          odometer_end: number | null
          odometer_start: number | null
          passengers_count: number | null
          purpose: string
          school_id: string | null
          start_time: string
          status: string
          updated_at: string
          vehicle_name: string
          vehicle_plate: string | null
        }
        Insert: {
          approval_notes?: string | null
          approved_by?: string | null
          booked_by: string
          created_at?: string
          destination: string
          driver_name?: string | null
          end_time: string
          fuel_cost?: number | null
          id?: string
          odometer_end?: number | null
          odometer_start?: number | null
          passengers_count?: number | null
          purpose: string
          school_id?: string | null
          start_time: string
          status?: string
          updated_at?: string
          vehicle_name: string
          vehicle_plate?: string | null
        }
        Update: {
          approval_notes?: string | null
          approved_by?: string | null
          booked_by?: string
          created_at?: string
          destination?: string
          driver_name?: string | null
          end_time?: string
          fuel_cost?: number | null
          id?: string
          odometer_end?: number | null
          odometer_start?: number | null
          passengers_count?: number | null
          purpose?: string
          school_id?: string | null
          start_time?: string
          status?: string
          updated_at?: string
          vehicle_name?: string
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_logs: {
        Row: {
          badge_no: string | null
          check_in: string
          check_out: string | null
          contact_person_name: string | null
          contact_personnel_id: string | null
          created_at: string
          id: string
          id_card_last4: string | null
          notes: string | null
          organization: string | null
          photo_url: string | null
          purpose: string
          recorded_by: string | null
          school_id: string | null
          vehicle_plate: string | null
          visitor_name: string
          visitor_phone: string | null
        }
        Insert: {
          badge_no?: string | null
          check_in?: string
          check_out?: string | null
          contact_person_name?: string | null
          contact_personnel_id?: string | null
          created_at?: string
          id?: string
          id_card_last4?: string | null
          notes?: string | null
          organization?: string | null
          photo_url?: string | null
          purpose: string
          recorded_by?: string | null
          school_id?: string | null
          vehicle_plate?: string | null
          visitor_name: string
          visitor_phone?: string | null
        }
        Update: {
          badge_no?: string | null
          check_in?: string
          check_out?: string | null
          contact_person_name?: string | null
          contact_personnel_id?: string | null
          created_at?: string
          id?: string
          id_card_last4?: string | null
          notes?: string | null
          organization?: string | null
          photo_url?: string | null
          purpose?: string
          recorded_by?: string | null
          school_id?: string | null
          vehicle_plate?: string | null
          visitor_name?: string
          visitor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitor_logs_contact_personnel_id_fkey"
            columns: ["contact_personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      wall_post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wall_post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "wall_post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wall_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "wall_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      wall_post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wall_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "wall_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      wall_posts: {
        Row: {
          author_id: string
          comment_count: number
          content: string | null
          created_at: string
          id: string
          is_pinned: boolean
          link_type: string | null
          link_url: string | null
          media_urls: string[]
          reaction_count: number
          school_id: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id: string
          comment_count?: number
          content?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          link_type?: string | null
          link_url?: string | null
          media_urls?: string[]
          reaction_count?: number
          school_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string
          comment_count?: number
          content?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          link_type?: string | null
          link_url?: string | null
          media_urls?: string[]
          reaction_count?: number
          school_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "wall_posts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      webauthn_challenges: {
        Row: {
          challenge: string
          created_at: string
          id: string
          kind: string
          user_id: string | null
        }
        Insert: {
          challenge: string
          created_at?: string
          id?: string
          kind: string
          user_id?: string | null
        }
        Update: {
          challenge?: string
          created_at?: string
          id?: string
          kind?: string
          user_id?: string | null
        }
        Relationships: []
      }
      webauthn_credentials: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          device_label: string | null
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[] | null
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          device_label?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string[] | null
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          device_label?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      worksheet_submissions: {
        Row: {
          answers: Json
          classroom: string | null
          id: string
          score: number
          student_id: string | null
          student_name: string | null
          submitted_at: string
          total: number
          worksheet_id: string
        }
        Insert: {
          answers?: Json
          classroom?: string | null
          id?: string
          score?: number
          student_id?: string | null
          student_name?: string | null
          submitted_at?: string
          total?: number
          worksheet_id: string
        }
        Update: {
          answers?: Json
          classroom?: string | null
          id?: string
          score?: number
          student_id?: string | null
          student_name?: string | null
          submitted_at?: string
          total?: number
          worksheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worksheet_submissions_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      worksheets: {
        Row: {
          cover_image: string | null
          created_at: string
          created_by: string | null
          description: string | null
          grade_level: string | null
          id: string
          is_published: boolean
          page_count: number | null
          questions: Json
          school_id: string | null
          share_code: string
          source_type: string | null
          source_url: string | null
          subject_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          grade_level?: string | null
          id?: string
          is_published?: boolean
          page_count?: number | null
          questions?: Json
          school_id?: string | null
          share_code?: string
          source_type?: string | null
          source_url?: string | null
          subject_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          grade_level?: string | null
          id?: string
          is_published?: boolean
          page_count?: number | null
          questions?: Json
          school_id?: string | null
          share_code?: string
          source_type?: string | null
          source_url?: string | null
          subject_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "worksheets_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ai_provider_keys_meta: {
        Row: {
          cooldown_until: string | null
          created_at: string | null
          daily_limit: number | null
          has_key: boolean | null
          id: string | null
          label: string | null
          last_error: string | null
          last_reset_date: string | null
          last_used_at: string | null
          priority: number | null
          provider_type: string | null
          status: string | null
          updated_at: string | null
          used_today: number | null
          used_total: number | null
        }
        Insert: {
          cooldown_until?: string | null
          created_at?: string | null
          daily_limit?: number | null
          has_key?: never
          id?: string | null
          label?: string | null
          last_error?: string | null
          last_reset_date?: string | null
          last_used_at?: string | null
          priority?: number | null
          provider_type?: string | null
          status?: string | null
          updated_at?: string | null
          used_today?: number | null
          used_total?: number | null
        }
        Update: {
          cooldown_until?: string | null
          created_at?: string | null
          daily_limit?: number | null
          has_key?: never
          id?: string | null
          label?: string | null
          last_error?: string | null
          last_reset_date?: string | null
          last_used_at?: string | null
          priority?: number | null
          provider_type?: string | null
          status?: string | null
          updated_at?: string | null
          used_today?: number | null
          used_total?: number | null
        }
        Relationships: []
      }
      ai_provider_keys_safe: {
        Row: {
          api_key_masked: string | null
          cooldown_until: string | null
          created_at: string | null
          daily_limit: number | null
          id: string | null
          label: string | null
          last_error: string | null
          last_reset_date: string | null
          last_used_at: string | null
          priority: number | null
          provider_type: string | null
          status: string | null
          updated_at: string | null
          used_today: number | null
          used_total: number | null
        }
        Insert: {
          api_key_masked?: never
          cooldown_until?: string | null
          created_at?: string | null
          daily_limit?: number | null
          id?: string | null
          label?: string | null
          last_error?: string | null
          last_reset_date?: string | null
          last_used_at?: string | null
          priority?: number | null
          provider_type?: string | null
          status?: string | null
          updated_at?: string | null
          used_today?: number | null
          used_total?: number | null
        }
        Update: {
          api_key_masked?: never
          cooldown_until?: string | null
          created_at?: string | null
          daily_limit?: number | null
          id?: string | null
          label?: string | null
          last_error?: string | null
          last_reset_date?: string | null
          last_used_at?: string | null
          priority?: number | null
          provider_type?: string | null
          status?: string | null
          updated_at?: string | null
          used_today?: number | null
          used_total?: number | null
        }
        Relationships: []
      }
      ai_providers_meta: {
        Row: {
          base_url: string | null
          created_at: string | null
          enabled: boolean | null
          extra_headers: Json | null
          has_key: boolean | null
          id: string | null
          model: string | null
          monthly_call_limit: number | null
          name: string | null
          notes: string | null
          priority: number | null
          provider_type: string | null
          supports_json: boolean | null
          supports_vision: boolean | null
          updated_at: string | null
        }
        Insert: {
          base_url?: string | null
          created_at?: string | null
          enabled?: boolean | null
          extra_headers?: Json | null
          has_key?: never
          id?: string | null
          model?: string | null
          monthly_call_limit?: number | null
          name?: string | null
          notes?: string | null
          priority?: number | null
          provider_type?: string | null
          supports_json?: boolean | null
          supports_vision?: boolean | null
          updated_at?: string | null
        }
        Update: {
          base_url?: string | null
          created_at?: string | null
          enabled?: boolean | null
          extra_headers?: Json | null
          has_key?: never
          id?: string | null
          model?: string | null
          monthly_call_limit?: number | null
          name?: string | null
          notes?: string | null
          priority?: number | null
          provider_type?: string | null
          supports_json?: boolean | null
          supports_vision?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_providers_safe: {
        Row: {
          api_key_masked: string | null
          base_url: string | null
          created_at: string | null
          enabled: boolean | null
          extra_headers: Json | null
          id: string | null
          model: string | null
          monthly_call_limit: number | null
          name: string | null
          notes: string | null
          priority: number | null
          provider_type: string | null
          supports_json: boolean | null
          supports_vision: boolean | null
          updated_at: string | null
        }
        Insert: {
          api_key_masked?: never
          base_url?: string | null
          created_at?: string | null
          enabled?: boolean | null
          extra_headers?: Json | null
          id?: string | null
          model?: string | null
          monthly_call_limit?: number | null
          name?: string | null
          notes?: string | null
          priority?: number | null
          provider_type?: string | null
          supports_json?: boolean | null
          supports_vision?: boolean | null
          updated_at?: string | null
        }
        Update: {
          api_key_masked?: never
          base_url?: string | null
          created_at?: string | null
          enabled?: boolean | null
          extra_headers?: Json | null
          id?: string | null
          model?: string | null
          monthly_call_limit?: number | null
          name?: string | null
          notes?: string | null
          priority?: number | null
          provider_type?: string | null
          supports_json?: boolean | null
          supports_vision?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_usage_summary: {
        Row: {
          active_days: number | null
          last_used_at: string | null
          messages_sent: number | null
          negative_messages: number | null
          positive_messages: number | null
          risky_messages: number | null
          top_topic: string | null
          user_id: string | null
        }
        Relationships: []
      }
      app_secrets_meta: {
        Row: {
          category: string | null
          description: string | null
          has_value: boolean | null
          key: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          description?: string | null
          has_value?: never
          key?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          description?: string | null
          has_value?: never
          key?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      assets_public_lookup: {
        Row: {
          asset_code: string | null
          asset_name: string | null
          category: string | null
          id: string | null
          location: string | null
          status: string | null
        }
        Insert: {
          asset_code?: string | null
          asset_name?: string | null
          category?: string | null
          id?: string | null
          location?: string | null
          status?: string | null
        }
        Update: {
          asset_code?: string | null
          asset_name?: string | null
          category?: string | null
          id?: string | null
          location?: string | null
          status?: string | null
        }
        Relationships: []
      }
      google_chat_webhooks_meta: {
        Row: {
          created_at: string | null
          custom_messages: Json | null
          department: string | null
          has_url: boolean | null
          id: string | null
          is_active: boolean | null
          notification_types: string[] | null
          updated_at: string | null
          webhook_name: string | null
        }
        Insert: {
          created_at?: string | null
          custom_messages?: Json | null
          department?: string | null
          has_url?: never
          id?: string | null
          is_active?: boolean | null
          notification_types?: string[] | null
          updated_at?: string | null
          webhook_name?: string | null
        }
        Update: {
          created_at?: string | null
          custom_messages?: Json | null
          department?: string | null
          has_url?: never
          id?: string | null
          is_active?: boolean | null
          notification_types?: string[] | null
          updated_at?: string | null
          webhook_name?: string | null
        }
        Relationships: []
      }
      social_posts_public: {
        Row: {
          content: string | null
          created_at: string | null
          external_id: string | null
          id: string | null
          media_urls: string[] | null
          permalink: string | null
          platform: string | null
          posted_at: string | null
          thumbnail_url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          external_id?: string | null
          id?: string | null
          media_urls?: string[] | null
          permalink?: string | null
          platform?: string | null
          posted_at?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          external_id?: string | null
          id?: string | null
          media_urls?: string[] | null
          permalink?: string | null
          platform?: string | null
          posted_at?: string | null
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      students_safe: {
        Row: {
          address: string | null
          admission_date: string | null
          auth_user_id: string | null
          birth_province: string | null
          blood_type: string | null
          classroom_id: string | null
          created_at: string | null
          date_of_birth: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          ethnicity: string | null
          father_name: string | null
          father_occupation: string | null
          father_phone: string | null
          first_name: string | null
          gender: string | null
          graduated_at: string | null
          graduation_gpa: number | null
          graduation_level: string | null
          graduation_year: number | null
          guardian_name: string | null
          guardian_phone: string | null
          guardian_relation: string | null
          height: number | null
          id: string | null
          last_name: string | null
          mother_name: string | null
          mother_occupation: string | null
          mother_phone: string | null
          nationality: string | null
          phone: string | null
          photo_url: string | null
          prefix: string | null
          previous_school: string | null
          religion: string | null
          school_id: string | null
          special_needs: string | null
          status: string | null
          student_code: string | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          address?: string | null
          admission_date?: string | null
          auth_user_id?: string | null
          birth_province?: string | null
          blood_type?: string | null
          classroom_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          ethnicity?: string | null
          father_name?: string | null
          father_occupation?: string | null
          father_phone?: string | null
          first_name?: string | null
          gender?: string | null
          graduated_at?: string | null
          graduation_gpa?: number | null
          graduation_level?: string | null
          graduation_year?: number | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relation?: string | null
          height?: number | null
          id?: string | null
          last_name?: string | null
          mother_name?: string | null
          mother_occupation?: string | null
          mother_phone?: string | null
          nationality?: string | null
          phone?: string | null
          photo_url?: string | null
          prefix?: string | null
          previous_school?: string | null
          religion?: string | null
          school_id?: string | null
          special_needs?: string | null
          status?: string | null
          student_code?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          address?: string | null
          admission_date?: string | null
          auth_user_id?: string | null
          birth_province?: string | null
          blood_type?: string | null
          classroom_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          ethnicity?: string | null
          father_name?: string | null
          father_occupation?: string | null
          father_phone?: string | null
          first_name?: string | null
          gender?: string | null
          graduated_at?: string | null
          graduation_gpa?: number | null
          graduation_level?: string | null
          graduation_year?: number | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relation?: string | null
          height?: number | null
          id?: string | null
          last_name?: string | null
          mother_name?: string | null
          mother_occupation?: string | null
          mother_phone?: string | null
          nationality?: string | null
          phone?: string | null
          photo_url?: string | null
          prefix?: string | null
          previous_school?: string | null
          religion?: string | null
          school_id?: string | null
          special_needs?: string | null
          status?: string | null
          student_code?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      v_project_budget_totals: {
        Row: {
          allocated_budget: number | null
          fiscal_year_id: string | null
          hub_budget: number | null
          project_id: string | null
          project_name: string | null
          total_budget: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_projects_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
        ]
      }
      v_project_financial_summary: {
        Row: {
          fiscal_year_id: string | null
          pending: number | null
          project_id: string | null
          project_name: string | null
          remaining: number | null
          spent: number | null
          total_budget: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_projects_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
        ]
      }
      v_project_ledger: {
        Row: {
          amount: number | null
          category_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          entry_date: string | null
          fiscal_year_id: string | null
          id: string | null
          project_id: string | null
          source_id: string | null
          source_table: string | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _staff_check: { Args: { _uid: string }; Returns: boolean }
      app_base_url: { Args: never; Returns: string }
      archive_and_purge_old_data: {
        Args: { _retention_years?: number }
        Returns: Json
      }
      archive_old_data: { Args: never; Returns: Json }
      auto_period_maintenance: { Args: never; Returns: Json }
      auto_set_current_period: {
        Args: never
        Returns: {
          academic_year_be: number
          semester: number
        }[]
      }
      can_access_eform_attachment: {
        Args: { _eform_id: string; _user_id: string }
        Returns: boolean
      }
      can_sign_reflection: {
        Args: {
          _reflection_id: string
          _role: Database["public"]["Enums"]["reflection_signer_role"]
          _user_id: string
        }
        Returns: boolean
      }
      can_upload_eform_attachment: {
        Args: { _object_name: string; _user_id: string }
        Returns: boolean
      }
      cleanup_expired_line_sessions: { Args: never; Returns: undefined }
      create_next_year_periods: {
        Args: { closing_year_be: number }
        Returns: undefined
      }
      ensure_default_app_secrets: { Args: never; Returns: undefined }
      finalize_past_substitute_teaching: { Args: never; Returns: number }
      find_profile_id_by_code: { Args: { _code: string }; Returns: string }
      fitness_check_achievements: {
        Args: { _user_id: string }
        Returns: undefined
      }
      fitness_points_balance: { Args: { _user_id: string }; Returns: number }
      get_admin_dashboard_stats: { Args: never; Returns: Json }
      get_app_secret: { Args: { _key: string }; Returns: string }
      get_available_academic_years: { Args: never; Returns: number[] }
      get_chat_user_profiles: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          employee_code: string
          first_name: string
          id: string
          last_name: string
          nickname: string
          student_code: string
        }[]
      }
      get_classroom_subject_teachers: {
        Args: { _classroom_id: string }
        Returns: {
          department: string
          email: string
          first_name: string
          last_name: string
          personnel_id: string
          phone: string
          position_name: string
          prefix: string
          subject_code: string
          subject_id: string
          subject_name_th: string
        }[]
      }
      get_cloud_usage_summary: { Args: never; Returns: Json }
      get_my_personnel: {
        Args: never
        Returns: {
          academic_standing: string | null
          created_at: string
          department: string
          email: string | null
          employee_code: string
          first_name: string
          hire_date: string | null
          id: string
          last_name: string
          phone: string | null
          position: string
          position_level: string | null
          prefix: string | null
          school_id: string | null
          status: string
          subject_group: string | null
          teaching_level: string | null
          updated_at: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "personnel"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_student: {
        Args: never
        Returns: {
          address: string | null
          admission_date: string | null
          auth_email: string | null
          auth_user_id: string | null
          birth_province: string | null
          blood_type: string | null
          classroom_id: string | null
          created_at: string
          date_of_birth: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          ethnicity: string | null
          father_id: string | null
          father_name: string | null
          father_occupation: string | null
          father_phone: string | null
          first_name: string
          gender: string | null
          graduated_at: string | null
          graduation_gpa: number | null
          graduation_level: string | null
          graduation_year: number | null
          guardian_name: string | null
          guardian_phone: string | null
          guardian_relation: string | null
          height: number | null
          id: string
          inclusion_classroom_id: string | null
          is_special_needs: boolean
          last_name: string
          line_user_id: string | null
          line_user_id_2: string | null
          line_user_id_3: string | null
          mother_id: string | null
          mother_name: string | null
          mother_occupation: string | null
          mother_phone: string | null
          national_id: string | null
          nationality: string | null
          parent_name_1: string | null
          parent_name_2: string | null
          parent_name_3: string | null
          parent_phone_1: string | null
          parent_phone_2: string | null
          parent_phone_3: string | null
          parent_relation_1: string | null
          parent_relation_2: string | null
          parent_relation_3: string | null
          parent_user_id: string | null
          parent_user_id_2: string | null
          phone: string | null
          photo_url: string | null
          prefix: string | null
          previous_school: string | null
          religion: string | null
          school_id: string | null
          special_needs: string | null
          special_needs_type: string | null
          status: string
          student_code: string
          transition_pending_at: string | null
          transition_pending_to: string | null
          updated_at: string
          weight: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "students"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_personnel_avatars: {
        Args: { _user_ids: string[] }
        Returns: {
          avatar_url: string
          id: string
          position_title: string
        }[]
      }
      get_personnel_contact: {
        Args: { _personnel_id: string }
        Returns: {
          email: string
          phone: string
        }[]
      }
      get_personnel_directory: {
        Args: never
        Returns: {
          avatar_url: string
          department: string
          employee_code: string
          first_name: string
          gender: string
          hire_date: string
          id: string
          last_name: string
          nickname: string
          position_title: string
        }[]
      }
      get_profiles_public: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          department: string
          employee_code: string
          first_name: string
          id: string
          last_name: string
          nickname: string
          position_title: string
          student_code: string
        }[]
      }
      get_public_org_chart: {
        Args: never
        Returns: {
          academic_standing: string
          avatar_url: string
          department: string
          first_name: string
          id: string
          last_name: string
          position_level: string
          position_title: string
          prefix: string
          sort_rank: number
          subject_group: string
          user_id: string
        }[]
      }
      get_public_profile: {
        Args: { _id: string }
        Returns: {
          avatar_url: string
          cover_photo_url: string
          department: string
          email: string
          first_name: string
          id: string
          last_name: string
          nickname: string
          phone: string
          position_title: string
          school_name: string
        }[]
      }
      get_purge_preview: { Args: { _retention_years?: number }; Returns: Json }
      get_staff_profiles: {
        Args: never
        Returns: {
          first_name: string
          id: string
          last_name: string
          phone: string
          position_title: string
        }[]
      }
      get_student_avatars_by_codes: {
        Args: { _codes: string[] }
        Returns: {
          avatar_url: string
          student_code: string
        }[]
      }
      get_student_pii: {
        Args: { _student_id: string }
        Returns: {
          address: string
          emergency_phone: string
          father_id: string
          father_phone: string
          guardian_phone: string
          mother_id: string
          mother_phone: string
          national_id: string
          parent_phone_1: string
          parent_phone_2: string
          parent_phone_3: string
          phone: string
        }[]
      }
      get_user_departments: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["school_department"][]
      }
      get_user_dept_role: {
        Args: {
          _dept: Database["public"]["Enums"]["school_department"]
          _user_id: string
        }
        Returns: Database["public"]["Enums"]["dept_role"]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_school_id: { Args: { _user_id: string }; Returns: string }
      has_admin_module: {
        Args: { _module_key: string; _uid: string }
        Returns: boolean
      }
      has_department: {
        Args: {
          _dept: Database["public"]["Enums"]["school_department"]
          _user_id: string
        }
        Returns: boolean
      }
      has_dept_position: {
        Args: {
          _department: Database["public"]["Enums"]["school_department"]
          _min_position?: Database["public"]["Enums"]["dept_position"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_subject_group_position: {
        Args: {
          _group: string
          _min_position?: Database["public"]["Enums"]["subject_group_position"]
          _user_id: string
        }
        Returns: boolean
      }
      homeroom_classroom_ids_of: {
        Args: { _user_id: string }
        Returns: string[]
      }
      is_admin_or_director: { Args: { _user_id?: string }; Returns: boolean }
      is_budget_planner: { Args: { _user_id: string }; Returns: boolean }
      is_chat_admin: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_chat_participant: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_club_advisor: {
        Args: { _club: string; _user: string }
        Returns: boolean
      }
      is_club_member: {
        Args: { _club: string; _user: string }
        Returns: boolean
      }
      is_club_president: {
        Args: { _club: string; _user: string }
        Returns: boolean
      }
      is_document_owner: {
        Args: { _doc: string; _user: string }
        Returns: boolean
      }
      is_document_recipient: {
        Args: { _doc: string; _user: string }
        Returns: boolean
      }
      is_eform_recipient: {
        Args: { _eform_id: string; _user_id: string }
        Returns: boolean
      }
      is_eform_sender: {
        Args: { _eform_id: string; _user_id: string }
        Returns: boolean
      }
      is_homeroom_of_classroom: {
        Args: { _classroom_id: string; _user_id: string }
        Returns: boolean
      }
      is_homeroom_teacher_of: {
        Args: { _student_id: string; _user_id?: string }
        Returns: boolean
      }
      is_homeroom_teacher_of_student: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
      is_parent_of: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
      is_parent_of_student: {
        Args: { _student_id: string; _user_id?: string }
        Returns: boolean
      }
      is_staff_user: { Args: { _uid: string }; Returns: boolean }
      is_subject_group_head: {
        Args: { _group: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _uid: string }; Returns: boolean }
      is_teacher_assigned_to_classroom: {
        Args: { _classroom_id: string; _user_id: string }
        Returns: boolean
      }
      is_teacher_of_student: {
        Args: { _student_id: string; _user_id?: string }
        Returns: boolean
      }
      is_template_public: { Args: { _tid: string }; Returns: boolean }
      line_vault_dispatch: {
        Args: { category: string; payload: Json }
        Returns: undefined
      }
      link_line_to_student_slot: {
        Args: { _line_user_id: string; _student_id: string }
        Returns: number
      }
      list_school_members: {
        Args: never
        Returns: {
          avatar_url: string
          department: string
          email: string
          employee_code: string
          first_name: string
          id: string
          last_name: string
          position_title: string
          student_code: string
        }[]
      }
      log_audit_event: {
        Args: {
          _action: string
          _details?: Json
          _resource_id?: string
          _resource_type?: string
        }
        Returns: string
      }
      lookup_student_for_public_form: {
        Args: { _code: string }
        Returns: {
          address: string
          admission_date: string
          birth_province: string
          blood_type: string
          classroom_id: string
          date_of_birth: string
          emergency_contact: string
          emergency_phone: string
          ethnicity: string
          father_id: string
          father_name: string
          father_occupation: string
          father_phone: string
          first_name: string
          gender: string
          guardian_name: string
          guardian_phone: string
          guardian_relation: string
          height: number
          id: string
          is_special_needs: boolean
          last_name: string
          mother_id: string
          mother_name: string
          mother_occupation: string
          mother_phone: string
          national_id: string
          nationality: string
          phone: string
          photo_url: string
          prefix: string
          previous_school: string
          religion: string
          school_id: string
          special_needs: string
          special_needs_type: string
          student_code: string
          weight: number
        }[]
      }
      normalize_thai_teacher_name: { Args: { input: string }; Returns: string }
      notify_activity_participants_tomorrow: { Args: never; Returns: undefined }
      notify_google_chat: {
        Args: {
          _department?: string
          _fields?: Json
          _message: string
          _notification_type: string
          _reference_id?: string
          _reference_table?: string
          _severity?: string
          _title: string
          _url?: string
        }
        Returns: undefined
      }
      recompute_budget_usage: {
        Args: {
          p_category_id: string
          p_fiscal_year_id: string
          p_project_id: string
          p_source_id: string
        }
        Returns: undefined
      }
      recompute_personnel_teaching_level: { Args: never; Returns: undefined }
      remind_incomplete_grades: { Args: never; Returns: Json }
      reset_content_data: { Args: never; Returns: Json }
      resolve_scanned_student: {
        Args: { _input: string }
        Returns: {
          auth_user_id: string
          classroom_id: string
          classroom_name: string
          first_name: string
          grade_level: string
          id: string
          last_name: string
          photo_url: string
          prefix: string
          student_code: string
        }[]
      }
      resync_all_budget_usage: { Args: never; Returns: undefined }
      search_chat_users: {
        Args: { _term: string }
        Returns: {
          avatar_url: string
          classroom_id: string
          department: string
          employee_code: string
          first_name: string
          id: string
          last_name: string
          nickname: string
          rank_score: number
          role: string
          student_code: string
        }[]
      }
      search_public_profiles: {
        Args: { _q: string }
        Returns: {
          avatar_url: string
          employee_code: string
          first_name: string
          id: string
          last_name: string
          nickname: string
          role_label: string
          student_code: string
        }[]
      }
      send_line_to_student_parents: {
        Args: {
          _image_url?: string
          _message: string
          _student_id: string
          _title: string
        }
        Returns: undefined
      }
      set_app_secret: {
        Args: {
          _category?: string
          _description?: string
          _key: string
          _value: string
        }
        Returns: undefined
      }
      student_in_user_school: {
        Args: { _student_id: string }
        Returns: boolean
      }
      user_can_view_news_audience: {
        Args: { _audience: string }
        Returns: boolean
      }
      user_in_school_department: {
        Args: { _dept: Database["public"]["Enums"]["school_department"] }
        Returns: boolean
      }
      validate_schedules: {
        Args: { _sem?: number; _year?: number }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "teacher"
        | "student"
        | "director"
        | "alumni"
        | "parent"
        | "super_admin"
        | "area_admin"
        | "school_admin"
        | "observer"
      dept_position: "head" | "deputy" | "assistant" | "member"
      dept_role: "member" | "head" | "deputy_head" | "section_head"
      ict_device_category:
        | "notebook"
        | "tablet"
        | "mobile"
        | "camera"
        | "projector"
        | "other"
      ict_device_status:
        | "available"
        | "borrowed"
        | "maintenance"
        | "lost"
        | "retired"
      ict_loan_status: "active" | "returned" | "overdue" | "lost"
      incomplete_grade_fix_status:
        | "pending"
        | "accepted"
        | "assigned"
        | "completed"
        | "rejected"
      incomplete_grade_status: "pending" | "resolved" | "cancelled"
      incomplete_grade_type: "0" | "ร" | "มส"
      reflection_signer_role:
        | "teacher"
        | "head_subject"
        | "academic_head"
        | "deputy"
        | "director"
      reflection_status:
        | "draft"
        | "submitted"
        | "head_signed"
        | "academic_signed"
        | "deputy_signed"
        | "director_signed"
        | "returned"
      school_department:
        | "academic"
        | "student_affairs"
        | "general_admin"
        | "personnel"
        | "budget_planning"
        | "director_office"
        | "finance_personnel"
      subject_group_position: "head" | "deputy" | "secretary"
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
        "teacher",
        "student",
        "director",
        "alumni",
        "parent",
        "super_admin",
        "area_admin",
        "school_admin",
        "observer",
      ],
      dept_position: ["head", "deputy", "assistant", "member"],
      dept_role: ["member", "head", "deputy_head", "section_head"],
      ict_device_category: [
        "notebook",
        "tablet",
        "mobile",
        "camera",
        "projector",
        "other",
      ],
      ict_device_status: [
        "available",
        "borrowed",
        "maintenance",
        "lost",
        "retired",
      ],
      ict_loan_status: ["active", "returned", "overdue", "lost"],
      incomplete_grade_fix_status: [
        "pending",
        "accepted",
        "assigned",
        "completed",
        "rejected",
      ],
      incomplete_grade_status: ["pending", "resolved", "cancelled"],
      incomplete_grade_type: ["0", "ร", "มส"],
      reflection_signer_role: [
        "teacher",
        "head_subject",
        "academic_head",
        "deputy",
        "director",
      ],
      reflection_status: [
        "draft",
        "submitted",
        "head_signed",
        "academic_signed",
        "deputy_signed",
        "director_signed",
        "returned",
      ],
      school_department: [
        "academic",
        "student_affairs",
        "general_admin",
        "personnel",
        "budget_planning",
        "director_office",
        "finance_personnel",
      ],
      subject_group_position: ["head", "deputy", "secretary"],
    },
  },
} as const
