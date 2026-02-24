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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_alert_history: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          condition: string
          id: string
          message: string | null
          metric_type: string
          metric_value: number
          resolved_at: string | null
          rule_id: string | null
          rule_name: string
          status: string
          threshold: number
          triggered_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          condition: string
          id?: string
          message?: string | null
          metric_type: string
          metric_value: number
          resolved_at?: string | null
          rule_id?: string | null
          rule_name: string
          status?: string
          threshold: number
          triggered_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          condition?: string
          id?: string
          message?: string | null
          metric_type?: string
          metric_value?: number
          resolved_at?: string | null
          rule_id?: string | null
          rule_name?: string
          status?: string
          threshold?: number
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_alert_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "admin_alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_alert_rules: {
        Row: {
          condition: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_enabled: boolean
          metric_type: string
          name: string
          notification_channels: string[] | null
          notification_emails: string[] | null
          threshold: number
          time_window_hours: number
          updated_at: string
        }
        Insert: {
          condition: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          metric_type: string
          name: string
          notification_channels?: string[] | null
          notification_emails?: string[] | null
          threshold: number
          time_window_hours?: number
          updated_at?: string
        }
        Update: {
          condition?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          metric_type?: string
          name?: string
          notification_channels?: string[] | null
          notification_emails?: string[] | null
          threshold?: number
          time_window_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action_type: string
          actor_email: string | null
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          ip_address: unknown
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          actor_email?: string | null
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          actor_email?: string | null
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_test_accounts: {
        Row: {
          account_id: string | null
          account_name: string
          api_credentials: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          platform: string
        }
        Insert: {
          account_id?: string | null
          account_name: string
          api_credentials?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          platform: string
        }
        Update: {
          account_id?: string | null
          account_name?: string
          api_credentials?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          platform?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string | null
          id: string
          role: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_instruction_history: {
        Row: {
          action: string
          after_state: Json | null
          before_state: Json | null
          change_reason: string | null
          changed_at: string
          changed_by: string | null
          id: string
          instruction_set_id: string
        }
        Insert: {
          action: string
          after_state?: Json | null
          before_state?: Json | null
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          instruction_set_id: string
        }
        Update: {
          action?: string
          after_state?: Json | null
          before_state?: Json | null
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          instruction_set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_instruction_history_instruction_set_id_fkey"
            columns: ["instruction_set_id"]
            isOneToOne: false
            referencedRelation: "ai_instruction_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_instruction_sets: {
        Row: {
          banned_phrases: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          feature_type: Database["public"]["Enums"]["ai_feature_type"]
          freeform_instructions: string | null
          id: string
          is_active: boolean
          locale: string | null
          name: string
          organization_id: string | null
          priority: number
          scope: Database["public"]["Enums"]["ai_instruction_scope"]
          tone_guidelines: string[] | null
          updated_at: string
        }
        Insert: {
          banned_phrases?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          feature_type: Database["public"]["Enums"]["ai_feature_type"]
          freeform_instructions?: string | null
          id?: string
          is_active?: boolean
          locale?: string | null
          name: string
          organization_id?: string | null
          priority?: number
          scope?: Database["public"]["Enums"]["ai_instruction_scope"]
          tone_guidelines?: string[] | null
          updated_at?: string
        }
        Update: {
          banned_phrases?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          feature_type?: Database["public"]["Enums"]["ai_feature_type"]
          freeform_instructions?: string | null
          id?: string
          is_active?: boolean
          locale?: string | null
          name?: string
          organization_id?: string | null
          priority?: number
          scope?: Database["public"]["Enums"]["ai_instruction_scope"]
          tone_guidelines?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_instruction_sets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_video_providers: {
        Row: {
          api_base_url: string | null
          cost_per_second: number | null
          created_at: string | null
          default_prompt: string | null
          default_prompt_916: string | null
          display_name: string
          id: string
          is_enabled: boolean | null
          priority: number | null
          updated_at: string | null
        }
        Insert: {
          api_base_url?: string | null
          cost_per_second?: number | null
          created_at?: string | null
          default_prompt?: string | null
          default_prompt_916?: string | null
          display_name: string
          id: string
          is_enabled?: boolean | null
          priority?: number | null
          updated_at?: string | null
        }
        Update: {
          api_base_url?: string | null
          cost_per_second?: number | null
          created_at?: string | null
          default_prompt?: string | null
          default_prompt_916?: string | null
          display_name?: string
          id?: string
          is_enabled?: boolean | null
          priority?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      airtable_field_reference: {
        Row: {
          created_at: string | null
          field_name: string | null
          field_type: string | null
          id: string
          notes: string | null
        }
        Insert: {
          created_at?: string | null
          field_name?: string | null
          field_type?: string | null
          id: string
          notes?: string | null
        }
        Update: {
          created_at?: string | null
          field_name?: string | null
          field_type?: string | null
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      airtable_listings: {
        Row: {
          address: string | null
          address_line_1: string | null
          address_town: string | null
          airtable_record_id: string | null
          archived: boolean | null
          automation_enabled: boolean | null
          bathrooms: string | null
          bedrooms: string | null
          ber_rating: string | null
          booking_link: string | null
          building_size_sqm: string | null
          building_type: string | null
          caption_pool: Json | null
          category: string | null
          client_id: string | null
          county: string | null
          created_at: string | null
          date_posted: string | null
          description: string | null
          eircode: string | null
          ensuite: string | null
          error_message: string | null
          furnished: string | null
          hero_photo_url: string | null
          id: string
          land_size_acres: string | null
          listing_title: string | null
          live_url: string | null
          new_status_set_date: string | null
          previous_status: string | null
          price: string | null
          slug: string | null
          sm_posting_status: string | null
          social_media_photos: Json | null
          specs: string | null
          status: string | null
          status_changed_at: string | null
          status_changed_date: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          address_line_1?: string | null
          address_town?: string | null
          airtable_record_id?: string | null
          archived?: boolean | null
          automation_enabled?: boolean | null
          bathrooms?: string | null
          bedrooms?: string | null
          ber_rating?: string | null
          booking_link?: string | null
          building_size_sqm?: string | null
          building_type?: string | null
          caption_pool?: Json | null
          category?: string | null
          client_id?: string | null
          county?: string | null
          created_at?: string | null
          date_posted?: string | null
          description?: string | null
          eircode?: string | null
          ensuite?: string | null
          error_message?: string | null
          furnished?: string | null
          hero_photo_url?: string | null
          id: string
          land_size_acres?: string | null
          listing_title?: string | null
          live_url?: string | null
          new_status_set_date?: string | null
          previous_status?: string | null
          price?: string | null
          slug?: string | null
          sm_posting_status?: string | null
          social_media_photos?: Json | null
          specs?: string | null
          status?: string | null
          status_changed_at?: string | null
          status_changed_date?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          address_line_1?: string | null
          address_town?: string | null
          airtable_record_id?: string | null
          archived?: boolean | null
          automation_enabled?: boolean | null
          bathrooms?: string | null
          bedrooms?: string | null
          ber_rating?: string | null
          booking_link?: string | null
          building_size_sqm?: string | null
          building_type?: string | null
          caption_pool?: Json | null
          category?: string | null
          client_id?: string | null
          county?: string | null
          created_at?: string | null
          date_posted?: string | null
          description?: string | null
          eircode?: string | null
          ensuite?: string | null
          error_message?: string | null
          furnished?: string | null
          hero_photo_url?: string | null
          id?: string
          land_size_acres?: string | null
          listing_title?: string | null
          live_url?: string | null
          new_status_set_date?: string | null
          previous_status?: string | null
          price?: string | null
          slug?: string | null
          sm_posting_status?: string | null
          social_media_photos?: Json | null
          specs?: string | null
          status?: string | null
          status_changed_at?: string | null
          status_changed_date?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          airtable_record_id: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          edge_function: string | null
          error_message: string | null
          execution_id: string
          id: string
          listing_id: string | null
          metadata: Json | null
          parent_execution_id: string | null
          started_at: string
          step_name: string
          step_status: string
        }
        Insert: {
          airtable_record_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          edge_function?: string | null
          error_message?: string | null
          execution_id: string
          id?: string
          listing_id?: string | null
          metadata?: Json | null
          parent_execution_id?: string | null
          started_at?: string
          step_name: string
          step_status?: string
        }
        Update: {
          airtable_record_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          edge_function?: string | null
          error_message?: string | null
          execution_id?: string
          id?: string
          listing_id?: string | null
          metadata?: Json | null
          parent_execution_id?: string | null
          started_at?: string
          step_name?: string
          step_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unified_schedule_dashboard"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      automation_secrets: {
        Row: {
          created_at: string | null
          key: string
          value: string
        }
        Insert: {
          created_at?: string | null
          key: string
          value: string
        }
        Update: {
          created_at?: string | null
          key?: string
          value?: string
        }
        Relationships: []
      }
      automation_workflows: {
        Row: {
          aspect_ratio_requirements: Json | null
          completed_at: string | null
          content_job_id: string | null
          created_at: string | null
          current_state: string
          current_step_description: string | null
          error_count: number | null
          estimated_completion_at: string | null
          execution_id: string | null
          failed_at: string | null
          id: string
          is_active: boolean | null
          is_completed: boolean | null
          is_failed: boolean | null
          is_test: boolean | null
          last_error: string | null
          last_error_at: string | null
          listing_id: string
          manual_intervention_required: boolean | null
          max_retries: number | null
          post_type: string | null
          previous_state: string | null
          progress_percentage: number | null
          recovery_options: Json | null
          retry_count: number | null
          started_at: string | null
          state_data: Json | null
          template_id: string | null
          test_content_type_id: string | null
          trigger_metadata: Json | null
          triggered_by: string | null
          updated_at: string | null
        }
        Insert: {
          aspect_ratio_requirements?: Json | null
          completed_at?: string | null
          content_job_id?: string | null
          created_at?: string | null
          current_state?: string
          current_step_description?: string | null
          error_count?: number | null
          estimated_completion_at?: string | null
          execution_id?: string | null
          failed_at?: string | null
          id?: string
          is_active?: boolean | null
          is_completed?: boolean | null
          is_failed?: boolean | null
          is_test?: boolean | null
          last_error?: string | null
          last_error_at?: string | null
          listing_id: string
          manual_intervention_required?: boolean | null
          max_retries?: number | null
          post_type?: string | null
          previous_state?: string | null
          progress_percentage?: number | null
          recovery_options?: Json | null
          retry_count?: number | null
          started_at?: string | null
          state_data?: Json | null
          template_id?: string | null
          test_content_type_id?: string | null
          trigger_metadata?: Json | null
          triggered_by?: string | null
          updated_at?: string | null
        }
        Update: {
          aspect_ratio_requirements?: Json | null
          completed_at?: string | null
          content_job_id?: string | null
          created_at?: string | null
          current_state?: string
          current_step_description?: string | null
          error_count?: number | null
          estimated_completion_at?: string | null
          execution_id?: string | null
          failed_at?: string | null
          id?: string
          is_active?: boolean | null
          is_completed?: boolean | null
          is_failed?: boolean | null
          is_test?: boolean | null
          last_error?: string | null
          last_error_at?: string | null
          listing_id?: string
          manual_intervention_required?: boolean | null
          max_retries?: number | null
          post_type?: string | null
          previous_state?: string | null
          progress_percentage?: number | null
          recovery_options?: Json | null
          retry_count?: number | null
          started_at?: string | null
          state_data?: Json | null
          template_id?: string | null
          test_content_type_id?: string | null
          trigger_metadata?: Json | null
          triggered_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_workflows_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_workflows_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unified_schedule_dashboard"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "automation_workflows_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recurring_schedule_summary"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "automation_workflows_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recurring_schedule_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_workflows_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "unified_schedule_dashboard"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "automation_workflows_test_content_type_id_fkey"
            columns: ["test_content_type_id"]
            isOneToOne: false
            referencedRelation: "content_type_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_profiles: {
        Row: {
          created_at: string
          id: string
          is_sponsored: boolean | null
          metadata: Json | null
          organization_id: string
          sponsored_reason: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_ends_at: string | null
          subscription_plan: string | null
          subscription_started_at: string | null
          subscription_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_sponsored?: boolean | null
          metadata?: Json | null
          organization_id: string
          sponsored_reason?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_plan?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_sponsored?: boolean | null
          metadata?: Json | null
          organization_id?: string
          sponsored_reason?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_plan?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_profiles: {
        Row: {
          bedrooms_required: number[] | null
          budget_max: number | null
          budget_min: number | null
          created_at: string
          email: string
          id: string
          interested_properties: string[] | null
          last_contact_at: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string
          property_alert_id: string | null
          property_enquiry_id: string | null
          source: string
          source_id: string | null
          stage: Database["public"]["Enums"]["buyer_stage_enum"]
          updated_at: string
        }
        Insert: {
          bedrooms_required?: number[] | null
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          email: string
          id?: string
          interested_properties?: string[] | null
          last_contact_at?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone: string
          property_alert_id?: string | null
          property_enquiry_id?: string | null
          source?: string
          source_id?: string | null
          stage?: Database["public"]["Enums"]["buyer_stage_enum"]
          updated_at?: string
        }
        Update: {
          bedrooms_required?: number[] | null
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          email?: string
          id?: string
          interested_properties?: string[] | null
          last_contact_at?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string
          property_alert_id?: string | null
          property_enquiry_id?: string | null
          source?: string
          source_id?: string | null
          stage?: Database["public"]["Enums"]["buyer_stage_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_profiles_property_alert_id_fkey"
            columns: ["property_alert_id"]
            isOneToOne: false
            referencedRelation: "property_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_profiles_property_enquiry_id_fkey"
            columns: ["property_enquiry_id"]
            isOneToOne: false
            referencedRelation: "property_enquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      client_settings: {
        Row: {
          client_id: string | null
          created_at: string | null
          default_posting_days: Json | null
          default_time_window_end: string | null
          default_time_window_start: string | null
          disabled_music_tracks: Json | null
          email_font_size_16x9: string | null
          email_font_size_9x16: string | null
          email_position_16x9_x: string | null
          email_position_16x9_y: string | null
          email_position_9x16_x: string | null
          email_position_9x16_y: string | null
          endcard_16x9_path: string | null
          endcard_9x16_path: string | null
          endcard_background_color: string | null
          endcard_email: string | null
          endcard_email_color: string | null
          endcard_logo_url: string | null
          endcard_top_text: string | null
          endcard_top_text_color: string | null
          for_sale_post1_delay_minutes: string | null
          id: string | null
          logo_position_16x9_x: string | null
          logo_position_16x9_y: string | null
          logo_position_9x16_x: string | null
          logo_position_9x16_y: string | null
          logo_size_16x9: string | null
          logo_size_9x16: string | null
          new_listing_banner_duration_weeks: string | null
          new_listing_initial_duration_weeks: string | null
          new_listing_initial_frequency: string | null
          new_listing_ongoing_frequency: string | null
          new_listing_post1_delay_minutes: string | null
          new_listing_post2_delay_days: string | null
          new_listing_post3_delay_days: string | null
          psr_color: string | null
          psr_font_size_16x9: string | null
          psr_font_size_9x16: string | null
          psr_license_number: string | null
          psr_position_16x9_x: string | null
          psr_position_16x9_y: string | null
          psr_position_9x16_x: string | null
          psr_position_9x16_y: string | null
          sale_agreed_duration_weeks: string | null
          sale_agreed_frequency: string | null
          sold_duration_weeks: string | null
          sold_frequency: string | null
          tiktok_rotation_state: Json | null
          top_text_font_size_16x9: string | null
          top_text_font_size_9x16: string | null
          top_text_position_16x9_x: string | null
          top_text_position_16x9_y: string | null
          top_text_position_9x16_x: string | null
          top_text_position_9x16_y: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          default_posting_days?: Json | null
          default_time_window_end?: string | null
          default_time_window_start?: string | null
          disabled_music_tracks?: Json | null
          email_font_size_16x9?: string | null
          email_font_size_9x16?: string | null
          email_position_16x9_x?: string | null
          email_position_16x9_y?: string | null
          email_position_9x16_x?: string | null
          email_position_9x16_y?: string | null
          endcard_16x9_path?: string | null
          endcard_9x16_path?: string | null
          endcard_background_color?: string | null
          endcard_email?: string | null
          endcard_email_color?: string | null
          endcard_logo_url?: string | null
          endcard_top_text?: string | null
          endcard_top_text_color?: string | null
          for_sale_post1_delay_minutes?: string | null
          id?: string | null
          logo_position_16x9_x?: string | null
          logo_position_16x9_y?: string | null
          logo_position_9x16_x?: string | null
          logo_position_9x16_y?: string | null
          logo_size_16x9?: string | null
          logo_size_9x16?: string | null
          new_listing_banner_duration_weeks?: string | null
          new_listing_initial_duration_weeks?: string | null
          new_listing_initial_frequency?: string | null
          new_listing_ongoing_frequency?: string | null
          new_listing_post1_delay_minutes?: string | null
          new_listing_post2_delay_days?: string | null
          new_listing_post3_delay_days?: string | null
          psr_color?: string | null
          psr_font_size_16x9?: string | null
          psr_font_size_9x16?: string | null
          psr_license_number?: string | null
          psr_position_16x9_x?: string | null
          psr_position_16x9_y?: string | null
          psr_position_9x16_x?: string | null
          psr_position_9x16_y?: string | null
          sale_agreed_duration_weeks?: string | null
          sale_agreed_frequency?: string | null
          sold_duration_weeks?: string | null
          sold_frequency?: string | null
          tiktok_rotation_state?: Json | null
          top_text_font_size_16x9?: string | null
          top_text_font_size_9x16?: string | null
          top_text_position_16x9_x?: string | null
          top_text_position_16x9_y?: string | null
          top_text_position_9x16_x?: string | null
          top_text_position_9x16_y?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          default_posting_days?: Json | null
          default_time_window_end?: string | null
          default_time_window_start?: string | null
          disabled_music_tracks?: Json | null
          email_font_size_16x9?: string | null
          email_font_size_9x16?: string | null
          email_position_16x9_x?: string | null
          email_position_16x9_y?: string | null
          email_position_9x16_x?: string | null
          email_position_9x16_y?: string | null
          endcard_16x9_path?: string | null
          endcard_9x16_path?: string | null
          endcard_background_color?: string | null
          endcard_email?: string | null
          endcard_email_color?: string | null
          endcard_logo_url?: string | null
          endcard_top_text?: string | null
          endcard_top_text_color?: string | null
          for_sale_post1_delay_minutes?: string | null
          id?: string | null
          logo_position_16x9_x?: string | null
          logo_position_16x9_y?: string | null
          logo_position_9x16_x?: string | null
          logo_position_9x16_y?: string | null
          logo_size_16x9?: string | null
          logo_size_9x16?: string | null
          new_listing_banner_duration_weeks?: string | null
          new_listing_initial_duration_weeks?: string | null
          new_listing_initial_frequency?: string | null
          new_listing_ongoing_frequency?: string | null
          new_listing_post1_delay_minutes?: string | null
          new_listing_post2_delay_days?: string | null
          new_listing_post3_delay_days?: string | null
          psr_color?: string | null
          psr_font_size_16x9?: string | null
          psr_font_size_9x16?: string | null
          psr_license_number?: string | null
          psr_position_16x9_x?: string | null
          psr_position_16x9_y?: string | null
          psr_position_9x16_x?: string | null
          psr_position_9x16_y?: string | null
          sale_agreed_duration_weeks?: string | null
          sale_agreed_frequency?: string | null
          sold_duration_weeks?: string | null
          sold_frequency?: string | null
          tiktok_rotation_state?: Json | null
          top_text_font_size_16x9?: string | null
          top_text_font_size_9x16?: string | null
          top_text_position_16x9_x?: string | null
          top_text_position_16x9_y?: string | null
          top_text_position_9x16_x?: string | null
          top_text_position_9x16_y?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      client_settings_log: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          changes: string | null
          client_id: string | null
          id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          changes?: string | null
          client_id?: string | null
          id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          changes?: string | null
          client_id?: string | null
          id?: string
        }
        Relationships: []
      }
      client_social_accounts: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          is_enabled: boolean | null
          upload_post_account_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id: string
          is_enabled?: boolean | null
          upload_post_account_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          upload_post_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_social_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean | null
          airtable_api_key: string | null
          airtable_base_id: string | null
          airtable_clients_base_id: string | null
          airtable_clients_table_name: string | null
          airtable_table_name: string | null
          airtable_webhook_id: string | null
          business_address: string | null
          client_email: string | null
          client_name: string
          contact_name: string | null
          created_at: string | null
          domain: string | null
          facebook_url: string | null
          id: string
          last_synced_at: string | null
          logo_url: string | null
          notes: string | null
          organization_id: string
          phone_number: string | null
          psr_license_number: string | null
          settings_access_token: string | null
          sync_error_message: string | null
          sync_status: string | null
          token_generated_at: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          active?: boolean | null
          airtable_api_key?: string | null
          airtable_base_id?: string | null
          airtable_clients_base_id?: string | null
          airtable_clients_table_name?: string | null
          airtable_table_name?: string | null
          airtable_webhook_id?: string | null
          business_address?: string | null
          client_email?: string | null
          client_name: string
          contact_name?: string | null
          created_at?: string | null
          domain?: string | null
          facebook_url?: string | null
          id?: string
          last_synced_at?: string | null
          logo_url?: string | null
          notes?: string | null
          organization_id: string
          phone_number?: string | null
          psr_license_number?: string | null
          settings_access_token?: string | null
          sync_error_message?: string | null
          sync_status?: string | null
          token_generated_at?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean | null
          airtable_api_key?: string | null
          airtable_base_id?: string | null
          airtable_clients_base_id?: string | null
          airtable_clients_table_name?: string | null
          airtable_table_name?: string | null
          airtable_webhook_id?: string | null
          business_address?: string | null
          client_email?: string | null
          client_name?: string
          contact_name?: string | null
          created_at?: string | null
          domain?: string | null
          facebook_url?: string | null
          id?: string
          last_synced_at?: string | null
          logo_url?: string | null
          notes?: string | null
          organization_id?: string
          phone_number?: string | null
          psr_license_number?: string | null
          settings_access_token?: string | null
          sync_error_message?: string | null
          sync_status?: string | null
          token_generated_at?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_type_definitions: {
        Row: {
          category: string
          config_schema: Json | null
          created_at: string | null
          display_name: string
          frequency_weight: number | null
          id: string
          is_default: boolean | null
          is_enabled_globally: boolean | null
          platform_capabilities: Json | null
          provider: string | null
          type_key: string
        }
        Insert: {
          category: string
          config_schema?: Json | null
          created_at?: string | null
          display_name: string
          frequency_weight?: number | null
          id?: string
          is_default?: boolean | null
          is_enabled_globally?: boolean | null
          platform_capabilities?: Json | null
          provider?: string | null
          type_key: string
        }
        Update: {
          category?: string
          config_schema?: Json | null
          created_at?: string | null
          display_name?: string
          frequency_weight?: number | null
          id?: string
          is_default?: boolean | null
          is_enabled_globally?: boolean | null
          platform_capabilities?: Json | null
          provider?: string | null
          type_key?: string
        }
        Relationships: []
      }
      content_type_video_style2_settings: {
        Row: {
          ai_provider: string
          aspect_ratio: string
          caption_position: string
          caption_style: string
          content_type_id: string
          created_at: string
          id: string
          motion_prompt_169: string | null
          motion_prompt_916: string | null
          music_mode: string
          music_track_url: string | null
          photo_count_max: number
          photo_count_min: number
          transition_type: string
          updated_at: string
        }
        Insert: {
          ai_provider?: string
          aspect_ratio?: string
          caption_position?: string
          caption_style?: string
          content_type_id: string
          created_at?: string
          id?: string
          motion_prompt_169?: string | null
          motion_prompt_916?: string | null
          music_mode?: string
          music_track_url?: string | null
          photo_count_max?: number
          photo_count_min?: number
          transition_type?: string
          updated_at?: string
        }
        Update: {
          ai_provider?: string
          aspect_ratio?: string
          caption_position?: string
          caption_style?: string
          content_type_id?: string
          created_at?: string
          id?: string
          motion_prompt_169?: string | null
          motion_prompt_916?: string | null
          music_mode?: string
          music_track_url?: string | null
          photo_count_max?: number
          photo_count_min?: number
          transition_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_type_video_style2_settings_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: true
            referencedRelation: "content_type_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      creatomate_templates: {
        Row: {
          cached_at: string | null
          category: string | null
          id: string
          is_enabled: boolean | null
          name: string
          preview_url: string | null
          template_data: Json | null
          thumbnail_url: string | null
        }
        Insert: {
          cached_at?: string | null
          category?: string | null
          id: string
          is_enabled?: boolean | null
          name: string
          preview_url?: string | null
          template_data?: Json | null
          thumbnail_url?: string | null
        }
        Update: {
          cached_at?: string | null
          category?: string | null
          id?: string
          is_enabled?: boolean | null
          name?: string
          preview_url?: string | null
          template_data?: Json | null
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          created_by: string | null
          description: string | null
          feature_details: Json | null
          feature_type: string | null
          id: string
          metadata: Json | null
          organization_id: string
          request_id: string | null
          source: string
          source_app: string | null
          stripe_checkout_session_id: string | null
          stripe_event_id: string | null
          stripe_payment_intent_id: string | null
          transaction_type: string
          user_id: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          feature_details?: Json | null
          feature_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          request_id?: string | null
          source: string
          source_app?: string | null
          stripe_checkout_session_id?: string | null
          stripe_event_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_type: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          feature_details?: Json | null
          feature_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          request_id?: string | null
          source?: string
          source_app?: string | null
          stripe_checkout_session_id?: string | null
          stripe_event_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packs: {
        Row: {
          created_at: string
          credits: number
          currency: string
          description: string | null
          discount_percentage: number | null
          display_order: number | null
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          price_cents: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits: number
          currency?: string
          description?: string | null
          discount_percentage?: number | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          price_cents: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          currency?: string
          description?: string | null
          discount_percentage?: number | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          price_cents?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          description: string | null
          feature_type: Database["public"]["Enums"]["feature_type"] | null
          id: string
          ip_address: unknown
          metadata: Json | null
          organization_id: string
          request_id: string | null
          source: Database["public"]["Enums"]["credit_source"] | null
          source_app: string | null
          stripe_checkout_session_id: string | null
          stripe_event_id: string | null
          stripe_payment_intent_id: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          feature_type?: Database["public"]["Enums"]["feature_type"] | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id: string
          request_id?: string | null
          source?: Database["public"]["Enums"]["credit_source"] | null
          source_app?: string | null
          stripe_checkout_session_id?: string | null
          stripe_event_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          feature_type?: Database["public"]["Enums"]["feature_type"] | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id?: string
          request_id?: string | null
          source?: Database["public"]["Enums"]["credit_source"] | null
          source_app?: string | null
          stripe_checkout_session_id?: string | null
          stripe_event_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_usage_events: {
        Row: {
          created_at: string
          credits_consumed: number
          feature_details: Json | null
          feature_type: Database["public"]["Enums"]["feature_type"]
          id: string
          organization_id: string
          processing_time_ms: number | null
          source_app: string
          success: boolean | null
          transaction_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          credits_consumed: number
          feature_details?: Json | null
          feature_type: Database["public"]["Enums"]["feature_type"]
          id?: string
          organization_id: string
          processing_time_ms?: number | null
          source_app: string
          success?: boolean | null
          transaction_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          credits_consumed?: number
          feature_details?: Json | null
          feature_type?: Database["public"]["Enums"]["feature_type"]
          id?: string
          organization_id?: string
          processing_time_ms?: number | null
          source_app?: string
          success?: boolean | null
          transaction_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_usage_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "credit_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["crm_activity_type_enum"]
          buyer_profile_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metadata: Json | null
          organization_id: string
          seller_profile_id: string | null
          title: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["crm_activity_type_enum"]
          buyer_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          seller_profile_id?: string | null
          title: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["crm_activity_type_enum"]
          buyer_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          seller_profile_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_buyer_profile_id_fkey"
            columns: ["buyer_profile_id"]
            isOneToOne: false
            referencedRelation: "buyer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_video_analytics: {
        Row: {
          created_at: string | null
          device_type: string | null
          event_type: string
          id: string
          max_percentage: number | null
          referrer: string | null
          session_id: string
          user_agent: string | null
          video_duration_seconds: number | null
          watch_time_seconds: number | null
        }
        Insert: {
          created_at?: string | null
          device_type?: string | null
          event_type: string
          id?: string
          max_percentage?: number | null
          referrer?: string | null
          session_id: string
          user_agent?: string | null
          video_duration_seconds?: number | null
          watch_time_seconds?: number | null
        }
        Update: {
          created_at?: string | null
          device_type?: string | null
          event_type?: string
          id?: string
          max_percentage?: number | null
          referrer?: string | null
          session_id?: string
          user_agent?: string | null
          video_duration_seconds?: number | null
          watch_time_seconds?: number | null
        }
        Relationships: []
      }
      discount_code_usage: {
        Row: {
          credits_granted: number | null
          discount_code_id: string
          id: string
          organization_id: string
          redeemed_at: string | null
          redeemed_by: string | null
        }
        Insert: {
          credits_granted?: number | null
          discount_code_id: string
          id?: string
          organization_id: string
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Update: {
          credits_granted?: number | null
          discount_code_id?: string
          id?: string
          organization_id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_code_usage_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          applicable_plans: string[] | null
          code: string
          created_at: string | null
          created_by: string | null
          credit_grant_amount: number | null
          currency: string | null
          current_uses: number | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          max_uses_per_org: number | null
          min_months: number | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_plans?: string[] | null
          code: string
          created_at?: string | null
          created_by?: string | null
          credit_grant_amount?: number | null
          currency?: string | null
          current_uses?: number | null
          description?: string | null
          discount_type?: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_org?: number | null
          min_months?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_plans?: string[] | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          credit_grant_amount?: number | null
          currency?: string | null
          current_uses?: number | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_org?: number | null
          min_months?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          organization_id: string | null
          subject: string
          template_key: string
          template_name: string
          updated_at: string
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          organization_id?: string | null
          subject: string
          template_key: string
          template_name: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          organization_id?: string | null
          subject?: string
          template_key?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          applies_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_enabled: boolean
          name: string
          organization_ids: string[] | null
          updated_at: string
        }
        Insert: {
          applies_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          name: string
          organization_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          applies_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          name?: string
          organization_ids?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      gdpr_data_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          export_file_url: string | null
          id: string
          notes: string | null
          organization_id: string | null
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          request_type: string
          requester_email: string
          requester_name: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          export_file_url?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          request_type: string
          requester_email: string
          requester_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          export_file_url?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          request_type?: string
          requester_email?: string
          requester_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gdpr_data_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      i18n_translations: {
        Row: {
          created_at: string | null
          id: number
          key: string
          locale: string
          namespace: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          key: string
          locale?: string
          namespace: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: number
          key?: string
          locale?: string
          namespace?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      impersonation_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          organization_id: string
          reason: string | null
          started_at: string
          super_admin_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          organization_id: string
          reason?: string | null
          started_at?: string
          super_admin_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          started_at?: string
          super_admin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          order_index: string | null
          phase_name: string | null
          phase_number: string | null
          status: string | null
          task_description: string | null
          task_name: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id: string
          order_index?: string | null
          phase_name?: string | null
          phase_number?: string | null
          status?: string | null
          task_description?: string | null
          task_name?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          order_index?: string | null
          phase_name?: string | null
          phase_number?: string | null
          status?: string | null
          task_description?: string | null
          task_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_magnets: {
        Row: {
          brand_config: Json | null
          created_at: string | null
          id: string
          is_enabled: boolean | null
          organization_id: string
          slug: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          brand_config?: Json | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          organization_id: string
          slug?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          brand_config?: Json | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          organization_id?: string
          slug?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_magnets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_submissions: {
        Row: {
          answers_json: Json
          band: string | null
          campaign_id: string | null
          comparable_sales: Json | null
          confidence: string | null
          consent: boolean | null
          created_at: string | null
          drivers_json: Json | null
          email: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          estimate_high: number | null
          estimate_low: number | null
          headline_gaps: Json | null
          id: string
          lead_magnet_id: string | null
          market_insights: string | null
          market_trend: string | null
          name: string | null
          organization_id: string
          phone: string | null
          post_id: string | null
          research_snapshot_id: string | null
          research_source: string | null
          rules_version: string | null
          score: number | null
          seller_profile_id: string | null
          todo_json: Json | null
          utm_campaign: string | null
          utm_source: string | null
          valuation_model_version: string | null
          version: string | null
        }
        Insert: {
          answers_json?: Json
          band?: string | null
          campaign_id?: string | null
          comparable_sales?: Json | null
          confidence?: string | null
          consent?: boolean | null
          created_at?: string | null
          drivers_json?: Json | null
          email?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          estimate_high?: number | null
          estimate_low?: number | null
          headline_gaps?: Json | null
          id?: string
          lead_magnet_id?: string | null
          market_insights?: string | null
          market_trend?: string | null
          name?: string | null
          organization_id: string
          phone?: string | null
          post_id?: string | null
          research_snapshot_id?: string | null
          research_source?: string | null
          rules_version?: string | null
          score?: number | null
          seller_profile_id?: string | null
          todo_json?: Json | null
          utm_campaign?: string | null
          utm_source?: string | null
          valuation_model_version?: string | null
          version?: string | null
        }
        Update: {
          answers_json?: Json
          band?: string | null
          campaign_id?: string | null
          comparable_sales?: Json | null
          confidence?: string | null
          consent?: boolean | null
          created_at?: string | null
          drivers_json?: Json | null
          email?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          estimate_high?: number | null
          estimate_low?: number | null
          headline_gaps?: Json | null
          id?: string
          lead_magnet_id?: string | null
          market_insights?: string | null
          market_trend?: string | null
          name?: string | null
          organization_id?: string
          phone?: string | null
          post_id?: string | null
          research_snapshot_id?: string | null
          research_source?: string | null
          rules_version?: string | null
          score?: number | null
          seller_profile_id?: string | null
          todo_json?: Json | null
          utm_campaign?: string | null
          utm_source?: string | null
          valuation_model_version?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_submissions_lead_magnet_id_fkey"
            columns: ["lead_magnet_id"]
            isOneToOne: false
            referencedRelation: "lead_magnets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_post_counters: {
        Row: {
          id: string
          last_content_type: string | null
          listing_id: string
          organization_id: string
          post_count: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          last_content_type?: string | null
          listing_id: string
          organization_id: string
          post_count?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          last_content_type?: string | null
          listing_id?: string
          organization_id?: string
          post_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      listing_posting_schedule: {
        Row: {
          airtable_listing_id: string | null
          aspect_ratio: string | null
          banner_expires_at: string | null
          content_job_id: string | null
          content_type: string | null
          created_at: string | null
          error_message: string | null
          generation_run_id: string | null
          id: string
          is_cancelled: boolean | null
          is_recurring: boolean | null
          is_test: boolean | null
          jitter_seconds: number | null
          listing_id: string | null
          listing_status: string | null
          organization_id: string | null
          parent_execution_id: string | null
          platforms_to_post: string[] | null
          post_category: string
          post_number: number | null
          post_type: string
          posted_at: string | null
          quiz_image_url: string | null
          quiz_image_url_link: string | null
          quiz_image_url_link_in_bio: string | null
          quiz_type: string | null
          randomized_time: string | null
          recurring_template_id: string | null
          scheduled_for: string
          show_new_banner: boolean | null
          sibling_video_history_id: string | null
          slot_id: string | null
          status: string | null
          time_window_end: string | null
          time_window_start: string | null
          upload_post_request_id: string | null
          video_generation_completed_at: string | null
          video_generation_started_at: string | null
          video_generation_status: string | null
          video_history_id: string | null
          video_request_execution_id: string | null
          video_url_16x9: string | null
          video_url_9x16: string | null
        }
        Insert: {
          airtable_listing_id?: string | null
          aspect_ratio?: string | null
          banner_expires_at?: string | null
          content_job_id?: string | null
          content_type?: string | null
          created_at?: string | null
          error_message?: string | null
          generation_run_id?: string | null
          id?: string
          is_cancelled?: boolean | null
          is_recurring?: boolean | null
          is_test?: boolean | null
          jitter_seconds?: number | null
          listing_id?: string | null
          listing_status?: string | null
          organization_id?: string | null
          parent_execution_id?: string | null
          platforms_to_post?: string[] | null
          post_category?: string
          post_number?: number | null
          post_type: string
          posted_at?: string | null
          quiz_image_url?: string | null
          quiz_image_url_link?: string | null
          quiz_image_url_link_in_bio?: string | null
          quiz_type?: string | null
          randomized_time?: string | null
          recurring_template_id?: string | null
          scheduled_for: string
          show_new_banner?: boolean | null
          sibling_video_history_id?: string | null
          slot_id?: string | null
          status?: string | null
          time_window_end?: string | null
          time_window_start?: string | null
          upload_post_request_id?: string | null
          video_generation_completed_at?: string | null
          video_generation_started_at?: string | null
          video_generation_status?: string | null
          video_history_id?: string | null
          video_request_execution_id?: string | null
          video_url_16x9?: string | null
          video_url_9x16?: string | null
        }
        Update: {
          airtable_listing_id?: string | null
          aspect_ratio?: string | null
          banner_expires_at?: string | null
          content_job_id?: string | null
          content_type?: string | null
          created_at?: string | null
          error_message?: string | null
          generation_run_id?: string | null
          id?: string
          is_cancelled?: boolean | null
          is_recurring?: boolean | null
          is_test?: boolean | null
          jitter_seconds?: number | null
          listing_id?: string | null
          listing_status?: string | null
          organization_id?: string | null
          parent_execution_id?: string | null
          platforms_to_post?: string[] | null
          post_category?: string
          post_number?: number | null
          post_type?: string
          posted_at?: string | null
          quiz_image_url?: string | null
          quiz_image_url_link?: string | null
          quiz_image_url_link_in_bio?: string | null
          quiz_type?: string | null
          randomized_time?: string | null
          recurring_template_id?: string | null
          scheduled_for?: string
          show_new_banner?: boolean | null
          sibling_video_history_id?: string | null
          slot_id?: string | null
          status?: string | null
          time_window_end?: string | null
          time_window_start?: string | null
          upload_post_request_id?: string | null
          video_generation_completed_at?: string | null
          video_generation_started_at?: string | null
          video_generation_status?: string | null
          video_history_id?: string | null
          video_request_execution_id?: string | null
          video_url_16x9?: string | null
          video_url_9x16?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_listing_posting_schedule_slot_id"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "listing_schedule_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sibling_video_history"
            columns: ["sibling_video_history_id"]
            isOneToOne: false
            referencedRelation: "video_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_posting_schedule_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_posting_schedule_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unified_schedule_dashboard"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_posting_schedule_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_posting_schedule_video_history_id_fkey"
            columns: ["video_history_id"]
            isOneToOne: false
            referencedRelation: "video_history"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_schedule_slots: {
        Row: {
          aspect_ratio: string | null
          created_at: string | null
          day_of_week: string | null
          has_post: boolean
          id: string
          phase: string
          slot_time: string | null
          template_id: string | null
          time_slot: string | null
          week_start_date: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          created_at?: string | null
          day_of_week?: string | null
          has_post?: boolean
          id?: string
          phase?: string
          slot_time?: string | null
          template_id?: string | null
          time_slot?: string | null
          week_start_date?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          created_at?: string | null
          day_of_week?: string | null
          has_post?: boolean
          id?: string
          phase?: string
          slot_time?: string | null
          template_id?: string | null
          time_slot?: string | null
          week_start_date?: string | null
        }
        Relationships: []
      }
      listing_status_verifications: {
        Row: {
          automation_error: string | null
          automation_execution_id: string | null
          automation_triggered: boolean | null
          created_at: string | null
          detected_at: string
          id: string
          listing_id: string
          new_status: string
          old_status: string | null
          organization_id: string
          updated_at: string | null
          verification_scheduled_for: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          automation_error?: string | null
          automation_execution_id?: string | null
          automation_triggered?: boolean | null
          created_at?: string | null
          detected_at?: string
          id?: string
          listing_id: string
          new_status: string
          old_status?: string | null
          organization_id: string
          updated_at?: string | null
          verification_scheduled_for: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          automation_error?: string | null
          automation_execution_id?: string | null
          automation_triggered?: boolean | null
          created_at?: string | null
          detected_at?: string
          id?: string
          listing_id?: string
          new_status?: string
          old_status?: string | null
          organization_id?: string
          updated_at?: string | null
          verification_scheduled_for?: string
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_status_verifications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_status_verifications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unified_schedule_dashboard"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_status_verifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          address: string | null
          address_detail: string | null
          address_town: string | null
          airtable_record_id: string | null
          archived: boolean | null
          automation_enabled: boolean | null
          bathrooms: number | null
          bedrooms: number | null
          ber_rating: string | null
          booking_link: string | null
          building_type: string | null
          category: string | null
          client_id: string | null
          county: string | null
          created_at: string | null
          date_posted: string | null
          description: string | null
          eircode: string | null
          ensuite: number | null
          error_message: string | null
          floor_area_size: number | null
          furnished: string | null
          hero_photo: string | null
          id: string
          land_size: number | null
          live_url: string | null
          new_status_set_date: string | null
          organization_id: string
          photos: Json | null
          previous_status: string | null
          price: number | null
          slug: string | null
          sm_posting_status: string | null
          social_media_photos: Json | null
          specs: string | null
          status: string | null
          status_changed_date: string | null
          title: string | null
          updated_at: string | null
          video_status: string | null
        }
        Insert: {
          address?: string | null
          address_detail?: string | null
          address_town?: string | null
          airtable_record_id?: string | null
          archived?: boolean | null
          automation_enabled?: boolean | null
          bathrooms?: number | null
          bedrooms?: number | null
          ber_rating?: string | null
          booking_link?: string | null
          building_type?: string | null
          category?: string | null
          client_id?: string | null
          county?: string | null
          created_at?: string | null
          date_posted?: string | null
          description?: string | null
          eircode?: string | null
          ensuite?: number | null
          error_message?: string | null
          floor_area_size?: number | null
          furnished?: string | null
          hero_photo?: string | null
          id?: string
          land_size?: number | null
          live_url?: string | null
          new_status_set_date?: string | null
          organization_id: string
          photos?: Json | null
          previous_status?: string | null
          price?: number | null
          slug?: string | null
          sm_posting_status?: string | null
          social_media_photos?: Json | null
          specs?: string | null
          status?: string | null
          status_changed_date?: string | null
          title?: string | null
          updated_at?: string | null
          video_status?: string | null
        }
        Update: {
          address?: string | null
          address_detail?: string | null
          address_town?: string | null
          airtable_record_id?: string | null
          archived?: boolean | null
          automation_enabled?: boolean | null
          bathrooms?: number | null
          bedrooms?: number | null
          ber_rating?: string | null
          booking_link?: string | null
          building_type?: string | null
          category?: string | null
          client_id?: string | null
          county?: string | null
          created_at?: string | null
          date_posted?: string | null
          description?: string | null
          eircode?: string | null
          ensuite?: number | null
          error_message?: string | null
          floor_area_size?: number | null
          furnished?: string | null
          hero_photo?: string | null
          id?: string
          land_size?: number | null
          live_url?: string | null
          new_status_set_date?: string | null
          organization_id?: string
          photos?: Json | null
          previous_status?: string | null
          price?: number | null
          slug?: string | null
          sm_posting_status?: string | null
          social_media_photos?: Json | null
          specs?: string | null
          status?: string | null
          status_changed_date?: string | null
          title?: string | null
          updated_at?: string | null
          video_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      market_research_cache: {
        Row: {
          area_key: string
          created_at: string | null
          expires_at: string
          id: string
          property_type: string
          research_json: Json
        }
        Insert: {
          area_key: string
          created_at?: string | null
          expires_at: string
          id?: string
          property_type: string
          research_json?: Json
        }
        Update: {
          area_key?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          property_type?: string
          research_json?: Json
        }
        Relationships: []
      }
      marketing_content: {
        Row: {
          created_at: string | null
          display_order: number | null
          headline: string | null
          id: string
          image_url: string | null
          is_enabled: boolean | null
          organization_id: string
          paragraph_1: string | null
          paragraph_2: string | null
          paragraph_3: string | null
          section_key: string
          subheadline: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          headline?: string | null
          id?: string
          image_url?: string | null
          is_enabled?: boolean | null
          organization_id: string
          paragraph_1?: string | null
          paragraph_2?: string | null
          paragraph_3?: string | null
          section_key: string
          subheadline?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          headline?: string | null
          id?: string
          image_url?: string | null
          is_enabled?: boolean | null
          organization_id?: string
          paragraph_1?: string | null
          paragraph_2?: string | null
          paragraph_3?: string | null
          section_key?: string
          subheadline?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_content_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_demo_clips: {
        Row: {
          ai_clip_url: string | null
          ai_job_id: string | null
          ai_provider: string | null
          caption: string | null
          created_at: string | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          motion_prompt: string | null
          order_index: number | null
          session_id: string | null
          source_image_url: string
          status: string | null
          transition_type: string | null
          updated_at: string | null
          upscale_job_id: string | null
          upscale_status: string | null
          upscaled_image_url: string | null
        }
        Insert: {
          ai_clip_url?: string | null
          ai_job_id?: string | null
          ai_provider?: string | null
          caption?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          motion_prompt?: string | null
          order_index?: number | null
          session_id?: string | null
          source_image_url: string
          status?: string | null
          transition_type?: string | null
          updated_at?: string | null
          upscale_job_id?: string | null
          upscale_status?: string | null
          upscaled_image_url?: string | null
        }
        Update: {
          ai_clip_url?: string | null
          ai_job_id?: string | null
          ai_provider?: string | null
          caption?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          motion_prompt?: string | null
          order_index?: number | null
          session_id?: string | null
          source_image_url?: string
          status?: string | null
          transition_type?: string | null
          updated_at?: string | null
          upscale_job_id?: string | null
          upscale_status?: string | null
          upscaled_image_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_demo_clips_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "marketing_demo_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_demo_sessions: {
        Row: {
          ai_provider: string | null
          aspect_ratio: string | null
          client_name: string
          created_at: string | null
          created_by: string | null
          end_card_16x9_url: string | null
          end_card_9x16_url: string | null
          end_card_background_color: string | null
          end_card_domain: string | null
          end_card_license_number: string | null
          end_card_logo_url: string | null
          end_card_settings: Json | null
          end_card_text_color: string | null
          error_message: string | null
          expires_at: string | null
          final_video_url: string | null
          id: string
          motion_prompt: string | null
          property_description: string | null
          selected_image_urls: string[] | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ai_provider?: string | null
          aspect_ratio?: string | null
          client_name: string
          created_at?: string | null
          created_by?: string | null
          end_card_16x9_url?: string | null
          end_card_9x16_url?: string | null
          end_card_background_color?: string | null
          end_card_domain?: string | null
          end_card_license_number?: string | null
          end_card_logo_url?: string | null
          end_card_settings?: Json | null
          end_card_text_color?: string | null
          error_message?: string | null
          expires_at?: string | null
          final_video_url?: string | null
          id?: string
          motion_prompt?: string | null
          property_description?: string | null
          selected_image_urls?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_provider?: string | null
          aspect_ratio?: string | null
          client_name?: string
          created_at?: string | null
          created_by?: string | null
          end_card_16x9_url?: string | null
          end_card_9x16_url?: string | null
          end_card_background_color?: string | null
          end_card_domain?: string | null
          end_card_license_number?: string | null
          end_card_logo_url?: string | null
          end_card_settings?: Json | null
          end_card_text_color?: string | null
          error_message?: string | null
          expires_at?: string | null
          final_video_url?: string | null
          id?: string
          motion_prompt?: string | null
          property_description?: string | null
          selected_image_urls?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      migration_plans: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          plan_content: Json | null
          plan_description: string | null
          plan_name: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id: string
          plan_content?: Json | null
          plan_description?: string | null
          plan_name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          plan_content?: Json | null
          plan_description?: string | null
          plan_name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      onboarding_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          dismissed_at: string | null
          id: string
          organization_id: string
          tasks_completed: Json | null
          updated_at: string | null
          welcome_seen_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          dismissed_at?: string | null
          id?: string
          organization_id: string
          tasks_completed?: Json | null
          updated_at?: string | null
          welcome_seen_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          dismissed_at?: string | null
          id?: string
          organization_id?: string
          tasks_completed?: Json | null
          updated_at?: string | null
          welcome_seen_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_content_type_settings: {
        Row: {
          content_type_key: string
          created_at: string | null
          frequency_override: number | null
          id: string
          is_enabled: boolean | null
          organization_id: string
        }
        Insert: {
          content_type_key: string
          created_at?: string | null
          frequency_override?: number | null
          id?: string
          is_enabled?: boolean | null
          organization_id: string
        }
        Update: {
          content_type_key?: string
          created_at?: string | null
          frequency_override?: number | null
          id?: string
          is_enabled?: boolean | null
          organization_id?: string
        }
        Relationships: []
      }
      org_end_card_settings: {
        Row: {
          background_color: string | null
          created_at: string | null
          email: string | null
          email_size_16x9: number | null
          email_size_9x16: number | null
          email_x_16x9: number | null
          email_x_9x16: number | null
          email_y_16x9: number | null
          email_y_9x16: number | null
          endcard_16x9_path: string | null
          endcard_9x16_path: string | null
          id: string
          logo_size_16x9: number | null
          logo_size_9x16: number | null
          logo_url: string | null
          logo_x_16x9: number | null
          logo_x_9x16: number | null
          logo_y_16x9: number | null
          logo_y_9x16: number | null
          organization_id: string
          psr_license_number: string | null
          psr_size_16x9: number | null
          psr_size_9x16: number | null
          psr_x_16x9: number | null
          psr_x_9x16: number | null
          psr_y_16x9: number | null
          psr_y_9x16: number | null
          show_email: boolean | null
          show_website: boolean | null
          text_color: string | null
          top_text: string | null
          top_text_size_16x9: number | null
          top_text_size_9x16: number | null
          top_text_x_16x9: number | null
          top_text_x_9x16: number | null
          top_text_y_16x9: number | null
          top_text_y_9x16: number | null
          updated_at: string | null
          website: string | null
          website_size_16x9: number | null
          website_size_9x16: number | null
          website_x_16x9: number | null
          website_x_9x16: number | null
          website_y_16x9: number | null
          website_y_9x16: number | null
        }
        Insert: {
          background_color?: string | null
          created_at?: string | null
          email?: string | null
          email_size_16x9?: number | null
          email_size_9x16?: number | null
          email_x_16x9?: number | null
          email_x_9x16?: number | null
          email_y_16x9?: number | null
          email_y_9x16?: number | null
          endcard_16x9_path?: string | null
          endcard_9x16_path?: string | null
          id?: string
          logo_size_16x9?: number | null
          logo_size_9x16?: number | null
          logo_url?: string | null
          logo_x_16x9?: number | null
          logo_x_9x16?: number | null
          logo_y_16x9?: number | null
          logo_y_9x16?: number | null
          organization_id: string
          psr_license_number?: string | null
          psr_size_16x9?: number | null
          psr_size_9x16?: number | null
          psr_x_16x9?: number | null
          psr_x_9x16?: number | null
          psr_y_16x9?: number | null
          psr_y_9x16?: number | null
          show_email?: boolean | null
          show_website?: boolean | null
          text_color?: string | null
          top_text?: string | null
          top_text_size_16x9?: number | null
          top_text_size_9x16?: number | null
          top_text_x_16x9?: number | null
          top_text_x_9x16?: number | null
          top_text_y_16x9?: number | null
          top_text_y_9x16?: number | null
          updated_at?: string | null
          website?: string | null
          website_size_16x9?: number | null
          website_size_9x16?: number | null
          website_x_16x9?: number | null
          website_x_9x16?: number | null
          website_y_16x9?: number | null
          website_y_9x16?: number | null
        }
        Update: {
          background_color?: string | null
          created_at?: string | null
          email?: string | null
          email_size_16x9?: number | null
          email_size_9x16?: number | null
          email_x_16x9?: number | null
          email_x_9x16?: number | null
          email_y_16x9?: number | null
          email_y_9x16?: number | null
          endcard_16x9_path?: string | null
          endcard_9x16_path?: string | null
          id?: string
          logo_size_16x9?: number | null
          logo_size_9x16?: number | null
          logo_url?: string | null
          logo_x_16x9?: number | null
          logo_x_9x16?: number | null
          logo_y_16x9?: number | null
          logo_y_9x16?: number | null
          organization_id?: string
          psr_license_number?: string | null
          psr_size_16x9?: number | null
          psr_size_9x16?: number | null
          psr_x_16x9?: number | null
          psr_x_9x16?: number | null
          psr_y_16x9?: number | null
          psr_y_9x16?: number | null
          show_email?: boolean | null
          show_website?: boolean | null
          text_color?: string | null
          top_text?: string | null
          top_text_size_16x9?: number | null
          top_text_size_9x16?: number | null
          top_text_x_16x9?: number | null
          top_text_x_9x16?: number | null
          top_text_y_16x9?: number | null
          top_text_y_9x16?: number | null
          updated_at?: string | null
          website?: string | null
          website_size_16x9?: number | null
          website_size_9x16?: number | null
          website_x_16x9?: number | null
          website_x_9x16?: number | null
          website_y_16x9?: number | null
          website_y_9x16?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "org_end_card_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_quiz_image_exclusions: {
        Row: {
          created_at: string | null
          id: string
          image_category: string
          image_name: string
          organization_id: string
          quiz_type_key: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_category: string
          image_name: string
          organization_id: string
          quiz_type_key: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_category?: string
          image_name?: string
          organization_id?: string
          quiz_type_key?: string
        }
        Relationships: []
      }
      org_quiz_posting_config: {
        Row: {
          created_at: string | null
          id: string
          is_quiz_posting_enabled: boolean | null
          organization_id: string
          quiz_frequency_mode: string
          quiz_frequency_value: number
          quiz_slot_percentage: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_quiz_posting_enabled?: boolean | null
          organization_id: string
          quiz_frequency_mode?: string
          quiz_frequency_value?: number
          quiz_slot_percentage?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_quiz_posting_enabled?: boolean | null
          organization_id?: string
          quiz_frequency_mode?: string
          quiz_frequency_value?: number
          quiz_slot_percentage?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_quiz_posting_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_quiz_settings: {
        Row: {
          created_at: string | null
          frequency_weight: number | null
          id: string
          is_enabled: boolean | null
          organization_id: string
          quiz_type_key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          frequency_weight?: number | null
          id?: string
          is_enabled?: boolean | null
          organization_id: string
          quiz_type_key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          frequency_weight?: number | null
          id?: string
          is_enabled?: boolean | null
          organization_id?: string
          quiz_type_key?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_quiz_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_quiz_settings_quiz_type_key_fkey"
            columns: ["quiz_type_key"]
            isOneToOne: false
            referencedRelation: "quiz_type_definitions"
            referencedColumns: ["type_key"]
          },
        ]
      }
      org_social_targets: {
        Row: {
          alternate_index: number | null
          content_format: string | null
          created_at: string
          id: string
          is_active: boolean | null
          metadata: Json | null
          organization_id: string
          platform: string
          post_mode: string | null
          post_strategy: Json | null
          post_type: string | null
          post_types: string[] | null
          strategy_type: string | null
          target_id: string
          target_name: string
          target_picture: string | null
          target_type: string
        }
        Insert: {
          alternate_index?: number | null
          content_format?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          organization_id: string
          platform: string
          post_mode?: string | null
          post_strategy?: Json | null
          post_type?: string | null
          post_types?: string[] | null
          strategy_type?: string | null
          target_id: string
          target_name: string
          target_picture?: string | null
          target_type: string
        }
        Update: {
          alternate_index?: number | null
          content_format?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          organization_id?: string
          platform?: string
          post_mode?: string | null
          post_strategy?: Json | null
          post_type?: string | null
          post_types?: string[] | null
          strategy_type?: string | null
          target_id?: string
          target_name?: string
          target_picture?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_social_targets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_connected_socials: {
        Row: {
          account_id: string
          created_at: string | null
          display_name: string | null
          handle: string | null
          id: string
          is_active: boolean | null
          organization_id: string
          platform: string
          profile_picture_url: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string
          is_active?: boolean | null
          organization_id: string
          platform: string
          profile_picture_url?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string
          platform?: string
          profile_picture_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_connected_socials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_credit_balances: {
        Row: {
          balance: number
          created_at: string
          last_transaction_at: string | null
          organization_id: string
          total_credits_consumed: number
          total_credits_purchased: number
          transaction_count: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          last_transaction_at?: string | null
          organization_id: string
          total_credits_consumed?: number
          total_credits_purchased?: number
          transaction_count?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          last_transaction_at?: string | null
          organization_id?: string
          total_credits_consumed?: number
          total_credits_purchased?: number
          transaction_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_credit_balances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          created_at: string | null
          default_posting_days: number[] | null
          generate_videos_immediately: boolean | null
          id: string
          new_listing_banner_duration_weeks: number | null
          new_listing_launch_duration_weeks: number | null
          new_listing_launch_frequency: number | null
          new_listing_ongoing_duration_weeks: number | null
          new_listing_ongoing_frequency: number | null
          organization_id: string
          post_immediately_on_status_change: boolean | null
          published_duration_weeks: number | null
          published_frequency: number | null
          sale_agreed_duration_weeks: number | null
          sale_agreed_frequency: number | null
          schedule_duration_weeks: number | null
          sold_duration_weeks: number | null
          sold_frequency: number | null
          status_verification_delay_minutes: number | null
          time_window_end: string | null
          time_window_start: string | null
          updated_at: string | null
          video_aspect_ratios: string[] | null
        }
        Insert: {
          created_at?: string | null
          default_posting_days?: number[] | null
          generate_videos_immediately?: boolean | null
          id?: string
          new_listing_banner_duration_weeks?: number | null
          new_listing_launch_duration_weeks?: number | null
          new_listing_launch_frequency?: number | null
          new_listing_ongoing_duration_weeks?: number | null
          new_listing_ongoing_frequency?: number | null
          organization_id: string
          post_immediately_on_status_change?: boolean | null
          published_duration_weeks?: number | null
          published_frequency?: number | null
          sale_agreed_duration_weeks?: number | null
          sale_agreed_frequency?: number | null
          schedule_duration_weeks?: number | null
          sold_duration_weeks?: number | null
          sold_frequency?: number | null
          status_verification_delay_minutes?: number | null
          time_window_end?: string | null
          time_window_start?: string | null
          updated_at?: string | null
          video_aspect_ratios?: string[] | null
        }
        Update: {
          created_at?: string | null
          default_posting_days?: number[] | null
          generate_videos_immediately?: boolean | null
          id?: string
          new_listing_banner_duration_weeks?: number | null
          new_listing_launch_duration_weeks?: number | null
          new_listing_launch_frequency?: number | null
          new_listing_ongoing_duration_weeks?: number | null
          new_listing_ongoing_frequency?: number | null
          organization_id?: string
          post_immediately_on_status_change?: boolean | null
          published_duration_weeks?: number | null
          published_frequency?: number | null
          sale_agreed_duration_weeks?: number | null
          sale_agreed_frequency?: number | null
          schedule_duration_weeks?: number | null
          sold_duration_weeks?: number | null
          sold_frequency?: number | null
          status_verification_delay_minutes?: number | null
          time_window_end?: string | null
          time_window_start?: string | null
          updated_at?: string | null
          video_aspect_ratios?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_social_accounts: {
        Row: {
          created_at: string | null
          id: string
          is_enabled: boolean | null
          organization_id: string
          updated_at: string | null
          upload_post_account_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          organization_id: string
          updated_at?: string | null
          upload_post_account_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          organization_id?: string
          updated_at?: string | null
          upload_post_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_social_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          account_status: string | null
          business_address: string | null
          business_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country_code: string | null
          created_at: string | null
          credit_spending_enabled: boolean | null
          currency: string | null
          custom_domain: string | null
          domain: string | null
          favicon_url: string | null
          from_email: string | null
          from_name: string | null
          hide_public_site: boolean | null
          id: string
          is_active: boolean | null
          is_comped: boolean | null
          locale: string | null
          logo_url: string | null
          notification_emails: string[] | null
          primary_color: string | null
          property_services: string[] | null
          psr_licence_number: string | null
          secondary_color: string | null
          slug: string
          timezone: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string | null
          vat_rate: number | null
          video_prefs: Json | null
        }
        Insert: {
          account_status?: string | null
          business_address?: string | null
          business_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string | null
          credit_spending_enabled?: boolean | null
          currency?: string | null
          custom_domain?: string | null
          domain?: string | null
          favicon_url?: string | null
          from_email?: string | null
          from_name?: string | null
          hide_public_site?: boolean | null
          id?: string
          is_active?: boolean | null
          is_comped?: boolean | null
          locale?: string | null
          logo_url?: string | null
          notification_emails?: string[] | null
          primary_color?: string | null
          property_services?: string[] | null
          psr_licence_number?: string | null
          secondary_color?: string | null
          slug: string
          timezone?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          vat_rate?: number | null
          video_prefs?: Json | null
        }
        Update: {
          account_status?: string | null
          business_address?: string | null
          business_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string | null
          credit_spending_enabled?: boolean | null
          currency?: string | null
          custom_domain?: string | null
          domain?: string | null
          favicon_url?: string | null
          from_email?: string | null
          from_name?: string | null
          hide_public_site?: boolean | null
          id?: string
          is_active?: boolean | null
          is_comped?: boolean | null
          locale?: string | null
          logo_url?: string | null
          notification_emails?: string[] | null
          primary_color?: string | null
          property_services?: string[] | null
          psr_licence_number?: string | null
          secondary_color?: string | null
          slug?: string
          timezone?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          vat_rate?: number | null
          video_prefs?: Json | null
        }
        Relationships: []
      }
      photo_upscale_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_id: string | null
          listing_id: string
          organization_id: string
          original_file_size: number | null
          original_url: string
          photo_index: number | null
          photo_type: string
          scale_factor: number | null
          started_at: string | null
          status: string
          updated_at: string
          upscaled_file_size: number | null
          upscaled_url: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_id?: string | null
          listing_id: string
          organization_id: string
          original_file_size?: number | null
          original_url: string
          photo_index?: number | null
          photo_type: string
          scale_factor?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          upscaled_file_size?: number | null
          upscaled_url?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_id?: string | null
          listing_id?: string
          organization_id?: string
          original_file_size?: number | null
          original_url?: string
          photo_index?: number | null
          photo_type?: string
          scale_factor?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          upscaled_file_size?: number | null
          upscaled_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_upscale_jobs_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_upscale_jobs_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unified_schedule_dashboard"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "photo_upscale_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_invite_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          label: string | null
          usage_count: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          usage_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      plan_definitions: {
        Row: {
          annual_price_cents: number | null
          created_at: string | null
          description: string | null
          display_name: string
          display_order: number | null
          features: Json | null
          id: string
          included_credits: number | null
          is_active: boolean | null
          limits: Json | null
          max_users: number | null
          monthly_credits: number | null
          monthly_price_cents: number | null
          name: string
          stripe_annual_price_id: string | null
          stripe_monthly_price_id: string | null
          updated_at: string | null
        }
        Insert: {
          annual_price_cents?: number | null
          created_at?: string | null
          description?: string | null
          display_name: string
          display_order?: number | null
          features?: Json | null
          id?: string
          included_credits?: number | null
          is_active?: boolean | null
          limits?: Json | null
          max_users?: number | null
          monthly_credits?: number | null
          monthly_price_cents?: number | null
          name: string
          stripe_annual_price_id?: string | null
          stripe_monthly_price_id?: string | null
          updated_at?: string | null
        }
        Update: {
          annual_price_cents?: number | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          display_order?: number | null
          features?: Json | null
          id?: string
          included_credits?: number | null
          is_active?: boolean | null
          limits?: Json | null
          max_users?: number | null
          monthly_credits?: number | null
          monthly_price_cents?: number | null
          name?: string
          stripe_annual_price_id?: string | null
          stripe_monthly_price_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      plan_tasks: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          completed_at: string | null
          complexity: string | null
          created_at: string
          dependencies: number[] | null
          description: string | null
          estimated_hours: number | null
          id: string
          metadata: Json | null
          notes: string | null
          phase: string | null
          plan_id: string
          started_at: string | null
          status: string
          task_number: number
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          complexity?: string | null
          created_at?: string
          dependencies?: number[] | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          phase?: string | null
          plan_id: string
          started_at?: string | null
          status?: string
          task_number: number
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          complexity?: string | null
          created_at?: string
          dependencies?: number[] | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          phase?: string | null
          plan_id?: string
          started_at?: string | null
          status?: string
          task_number?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "project_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      project_plans: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          metadata: Json | null
          name: string
          priority: string
          start_date: string | null
          status: string
          target_completion_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          metadata?: Json | null
          name: string
          priority?: string
          start_date?: string | null
          status?: string
          target_completion_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          metadata?: Json | null
          name?: string
          priority?: string
          start_date?: string | null
          status?: string
          target_completion_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      property_alerts: {
        Row: {
          bedrooms: number[]
          comments: string | null
          contacted_at: string | null
          created_at: string
          email: string
          id: string
          name: string
          organization_id: string
          phone: string
          status: string
          updated_at: string
        }
        Insert: {
          bedrooms: number[]
          comments?: string | null
          contacted_at?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          organization_id: string
          phone: string
          status?: string
          updated_at?: string
        }
        Update: {
          bedrooms?: number[]
          comments?: string | null
          contacted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          organization_id?: string
          phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_enquiries: {
        Row: {
          contacted_at: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          organization_id: string
          phone: string
          property_id: string
          property_title: string
          status: string | null
        }
        Insert: {
          contacted_at?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          organization_id: string
          phone: string
          property_id: string
          property_title: string
          status?: string | null
        }
        Update: {
          contacted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          organization_id?: string
          phone?: string
          property_id?: string
          property_title?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_enquiries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_caption_templates: {
        Row: {
          caption_text: string
          caption_type: string
          created_at: string | null
          id: string
          organization_id: string
          quiz_type_key: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          caption_text: string
          caption_type: string
          created_at?: string | null
          id?: string
          organization_id: string
          quiz_type_key: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          caption_text?: string
          caption_type?: string
          created_at?: string | null
          id?: string
          organization_id?: string
          quiz_type_key?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_caption_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_caption_templates_quiz_type_key_fkey"
            columns: ["quiz_type_key"]
            isOneToOne: false
            referencedRelation: "quiz_type_definitions"
            referencedColumns: ["type_key"]
          },
        ]
      }
      quiz_type_definitions: {
        Row: {
          created_at: string | null
          display_name: string
          id: string
          is_enabled_globally: boolean | null
          quiz_path: string
          type_key: string
        }
        Insert: {
          created_at?: string | null
          display_name: string
          id?: string
          is_enabled_globally?: boolean | null
          quiz_path: string
          type_key: string
        }
        Update: {
          created_at?: string | null
          display_name?: string
          id?: string
          is_enabled_globally?: boolean | null
          quiz_path?: string
          type_key?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          client_slug: string
          created_at: string
          id: string
          ip_address: string
          submission_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          client_slug: string
          created_at?: string
          id?: string
          ip_address: string
          submission_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          client_slug?: string
          created_at?: string
          id?: string
          ip_address?: string
          submission_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      recurring_schedule_templates: {
        Row: {
          banner_duration_weeks: number | null
          created_at: string | null
          current_phase: string | null
          days_of_week: number[]
          duration_weeks: number | null
          ends_at: string | null
          frequency: string
          id: string
          is_active: boolean | null
          launch_duration_weeks: number | null
          launch_frequency: string | null
          listing_created_at: string | null
          listing_id: string
          ongoing_duration_weeks: number | null
          ongoing_frequency: string | null
          show_new_banner: boolean | null
          started_at: string | null
          updated_at: string | null
        }
        Insert: {
          banner_duration_weeks?: number | null
          created_at?: string | null
          current_phase?: string | null
          days_of_week: number[]
          duration_weeks?: number | null
          ends_at?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          launch_duration_weeks?: number | null
          launch_frequency?: string | null
          listing_created_at?: string | null
          listing_id: string
          ongoing_duration_weeks?: number | null
          ongoing_frequency?: string | null
          show_new_banner?: boolean | null
          started_at?: string | null
          updated_at?: string | null
        }
        Update: {
          banner_duration_weeks?: number | null
          created_at?: string | null
          current_phase?: string | null
          days_of_week?: number[]
          duration_weeks?: number | null
          ends_at?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          launch_duration_weeks?: number | null
          launch_frequency?: string | null
          listing_created_at?: string | null
          listing_id?: string
          ongoing_duration_weeks?: number | null
          ongoing_frequency?: string | null
          show_new_banner?: boolean | null
          started_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_schedule_templates_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_schedule_templates_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unified_schedule_dashboard"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      recurring_scheduling_locks: {
        Row: {
          execution_id: string
          listing_id: string
          locked_at: string
          locked_by: string | null
          template_id: string | null
        }
        Insert: {
          execution_id: string
          listing_id: string
          locked_at?: string
          locked_by?: string | null
          template_id?: string | null
        }
        Update: {
          execution_id?: string
          listing_id?: string
          locked_at?: string
          locked_by?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_listing"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_listing"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unified_schedule_dashboard"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "fk_template"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recurring_schedule_summary"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "fk_template"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recurring_schedule_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_template"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "unified_schedule_dashboard"
            referencedColumns: ["template_id"]
          },
        ]
      }
      scheduled_post_processing_runs: {
        Row: {
          error_message: string | null
          http_status: number | null
          id: string
          posts_failed: number | null
          posts_found: number | null
          posts_processed: number | null
          response_body: string | null
          run_completed_at: string | null
          run_started_at: string
          status: string
        }
        Insert: {
          error_message?: string | null
          http_status?: number | null
          id?: string
          posts_failed?: number | null
          posts_found?: number | null
          posts_processed?: number | null
          response_body?: string | null
          run_completed_at?: string | null
          run_started_at?: string
          status?: string
        }
        Update: {
          error_message?: string | null
          http_status?: number | null
          id?: string
          posts_failed?: number | null
          posts_found?: number | null
          posts_processed?: number | null
          response_body?: string | null
          run_completed_at?: string | null
          run_started_at?: string
          status?: string
        }
        Relationships: []
      }
      seller_profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          last_contact_at: string | null
          listed_property_id: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string
          property_address: string | null
          source: string
          source_id: string | null
          stage: Database["public"]["Enums"]["seller_stage_enum"]
          updated_at: string
          valuation_request_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          last_contact_at?: string | null
          listed_property_id?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone: string
          property_address?: string | null
          source?: string
          source_id?: string | null
          stage?: Database["public"]["Enums"]["seller_stage_enum"]
          updated_at?: string
          valuation_request_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_contact_at?: string | null
          listed_property_id?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string
          property_address?: string | null
          source?: string
          source_id?: string | null
          stage?: Database["public"]["Enums"]["seller_stage_enum"]
          updated_at?: string
          valuation_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_profiles_valuation_request_id_fkey"
            columns: ["valuation_request_id"]
            isOneToOne: false
            referencedRelation: "valuation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_i18n_files: {
        Row: {
          content: string
          created_at: string | null
          description: string | null
          file_path: string
          file_type: string
          id: number
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          description?: string | null
          file_path: string
          file_type?: string
          id?: number
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          description?: string | null
          file_path?: string
          file_type?: string
          id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      signup_requests: {
        Row: {
          completed_at: string | null
          created_at: string | null
          email: string
          id: string
          landing_page: string | null
          organization_id: string | null
          plan_name: string | null
          referrer: string | null
          status: string | null
          stripe_checkout_session_id: string | null
          updated_at: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          landing_page?: string | null
          organization_id?: string | null
          plan_name?: string | null
          referrer?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          landing_page?: string | null
          organization_id?: string | null
          plan_name?: string | null
          referrer?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signup_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_links: {
        Row: {
          created_at: string | null
          display_order: number
          enabled: boolean
          id: string
          organization_id: string
          platform: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          enabled?: boolean
          id?: string
          organization_id: string
          platform: string
          updated_at?: string | null
          url?: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          enabled?: boolean
          id?: string
          organization_id?: string
          platform?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          author_name: string
          author_role: string | null
          content: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          organization_id: string
          rating: number | null
          updated_at: string | null
        }
        Insert: {
          author_name: string
          author_role?: string | null
          content: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          organization_id: string
          rating?: number | null
          updated_at?: string | null
        }
        Update: {
          author_name?: string
          author_role?: string | null
          content?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          organization_id?: string
          rating?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_post_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          organization_id: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          organization_id: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_post_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_post_results: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          is_async: boolean | null
          listing_id: string | null
          listing_schedule_id: string | null
          media_size_bytes: number | null
          media_type: string | null
          organization_id: string
          platform: string
          platform_post_id: string | null
          post_caption: string | null
          post_title: string | null
          post_url: string | null
          profile_username: string | null
          request_id: string
          request_total_platforms: number | null
          success: boolean
          updated_at: string
          upload_timestamp: string | null
          video_history_id: string | null
          video_was_transcoded: boolean | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          is_async?: boolean | null
          listing_id?: string | null
          listing_schedule_id?: string | null
          media_size_bytes?: number | null
          media_type?: string | null
          organization_id: string
          platform: string
          platform_post_id?: string | null
          post_caption?: string | null
          post_title?: string | null
          post_url?: string | null
          profile_username?: string | null
          request_id: string
          request_total_platforms?: number | null
          success?: boolean
          updated_at?: string
          upload_timestamp?: string | null
          video_history_id?: string | null
          video_was_transcoded?: boolean | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          is_async?: boolean | null
          listing_id?: string | null
          listing_schedule_id?: string | null
          media_size_bytes?: number | null
          media_type?: string | null
          organization_id?: string
          platform?: string
          platform_post_id?: string | null
          post_caption?: string | null
          post_title?: string | null
          post_url?: string | null
          profile_username?: string | null
          request_id?: string
          request_total_platforms?: number | null
          success?: boolean
          updated_at?: string
          upload_timestamp?: string | null
          video_history_id?: string | null
          video_was_transcoded?: boolean | null
        }
        Relationships: []
      }
      usage_rates: {
        Row: {
          created_at: string
          credits_per_use: number
          description: string | null
          effective_from: string
          effective_until: string | null
          feature_type: Database["public"]["Enums"]["feature_type"]
          id: string
          is_active: boolean
          metadata: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_per_use: number
          description?: string | null
          effective_from?: string
          effective_until?: string | null
          feature_type: Database["public"]["Enums"]["feature_type"]
          id?: string
          is_active?: boolean
          metadata?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_per_use?: number
          description?: string | null
          effective_from?: string
          effective_until?: string | null
          feature_type?: Database["public"]["Enums"]["feature_type"]
          id?: string
          is_active?: boolean
          metadata?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      user_organizations: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      valuation_requests: {
        Row: {
          contacted_at: string | null
          created_at: string | null
          email: string
          id: string
          message: string | null
          name: string
          organization_id: string
          phone: string
          property_address: string
          status: string | null
        }
        Insert: {
          contacted_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          message?: string | null
          name: string
          organization_id: string
          phone: string
          property_address: string
          status?: string | null
        }
        Update: {
          contacted_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          message?: string | null
          name?: string
          organization_id?: string
          phone?: string
          property_address?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "valuation_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_runs: {
        Row: {
          errors: string[] | null
          id: string
          run_completed_at: string | null
          run_started_at: string
          status: string
          verifications_cancelled: number | null
          verifications_confirmed: number | null
          verifications_failed: number | null
          verifications_found: number | null
          verifications_processed: number | null
        }
        Insert: {
          errors?: string[] | null
          id?: string
          run_completed_at?: string | null
          run_started_at?: string
          status?: string
          verifications_cancelled?: number | null
          verifications_confirmed?: number | null
          verifications_failed?: number | null
          verifications_found?: number | null
          verifications_processed?: number | null
        }
        Update: {
          errors?: string[] | null
          id?: string
          run_completed_at?: string | null
          run_started_at?: string
          status?: string
          verifications_cancelled?: number | null
          verifications_confirmed?: number | null
          verifications_failed?: number | null
          verifications_found?: number | null
          verifications_processed?: number | null
        }
        Relationships: []
      }
      video_history: {
        Row: {
          ai_generated_caption: string | null
          airtable_listing_id: string | null
          aspect_ratio: string | null
          captions: Json | null
          client_id: string | null
          content_type: string | null
          created_at: string
          execution_id: string | null
          id: string
          listing_id: string | null
          listing_status: string | null
          new_listing: boolean | null
          organization_id: string | null
          property_description: string | null
          render_id: string | null
          shotstack_thumbnail_url: string | null
          thumbnail_url: string | null
          video_status: string | null
          video_title: string | null
          video_url: string | null
          video_url_16_9: string | null
          video_url_9_16: string | null
        }
        Insert: {
          ai_generated_caption?: string | null
          airtable_listing_id?: string | null
          aspect_ratio?: string | null
          captions?: Json | null
          client_id?: string | null
          content_type?: string | null
          created_at?: string
          execution_id?: string | null
          id?: string
          listing_id?: string | null
          listing_status?: string | null
          new_listing?: boolean | null
          organization_id?: string | null
          property_description?: string | null
          render_id?: string | null
          shotstack_thumbnail_url?: string | null
          thumbnail_url?: string | null
          video_status?: string | null
          video_title?: string | null
          video_url?: string | null
          video_url_16_9?: string | null
          video_url_9_16?: string | null
        }
        Update: {
          ai_generated_caption?: string | null
          airtable_listing_id?: string | null
          aspect_ratio?: string | null
          captions?: Json | null
          client_id?: string | null
          content_type?: string | null
          created_at?: string
          execution_id?: string | null
          id?: string
          listing_id?: string | null
          listing_status?: string | null
          new_listing?: boolean | null
          organization_id?: string | null
          property_description?: string | null
          render_id?: string | null
          shotstack_thumbnail_url?: string | null
          thumbnail_url?: string | null
          video_status?: string | null
          video_title?: string | null
          video_url?: string | null
          video_url_16_9?: string | null
          video_url_9_16?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      video_music_tracks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          file_name: string
          file_size_bytes: number | null
          genre: string | null
          id: string
          is_active: boolean
          mood: string | null
          name: string
          storage_path: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          file_name: string
          file_size_bytes?: number | null
          genre?: string | null
          id?: string
          is_active?: boolean
          mood?: string | null
          name: string
          storage_path: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          file_name?: string
          file_size_bytes?: number | null
          genre?: string | null
          id?: string
          is_active?: boolean
          mood?: string | null
          name?: string
          storage_path?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      video_style_params: {
        Row: {
          created_at: string | null
          created_by: string | null
          environment: string | null
          id: string
          is_active: boolean | null
          params: Json
          provider: string | null
          style_key: string
          version: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          environment?: string | null
          id?: string
          is_active?: boolean | null
          params: Json
          provider?: string | null
          style_key: string
          version?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          environment?: string | null
          id?: string
          is_active?: boolean | null
          params?: Json
          provider?: string | null
          style_key?: string
          version?: number | null
        }
        Relationships: []
      }
      video_style_params_audit: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_params: Json | null
          old_params: Json | null
          style_key: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_params?: Json | null
          old_params?: Json | null
          style_key: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_params?: Json | null
          old_params?: Json | null
          style_key?: string
        }
        Relationships: []
      }
      video_style2_badge_defaults: {
        Row: {
          aspect_ratio: string
          created_at: string
          duration_seconds: number
          font_size: string
          id: string
          organization_id: string | null
          updated_at: string
          x: string
          y: string
        }
        Insert: {
          aspect_ratio?: string
          created_at?: string
          duration_seconds?: number
          font_size?: string
          id?: string
          organization_id?: string | null
          updated_at?: string
          x?: string
          y?: string
        }
        Update: {
          aspect_ratio?: string
          created_at?: string
          duration_seconds?: number
          font_size?: string
          id?: string
          organization_id?: string | null
          updated_at?: string
          x?: string
          y?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_style2_badge_defaults_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      video_style2_clips: {
        Row: {
          ai_clip_url: string | null
          ai_job_id: string | null
          ai_provider: string | null
          auto_selected: boolean | null
          created_at: string | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          last_error_code: string | null
          max_retries: number | null
          motion_prompt: string | null
          next_retry_at: string | null
          order_index: number
          retry_count: number | null
          session_id: string
          source_image_url: string
          status: string | null
          transition_type: string | null
          updated_at: string | null
          upscale_job_id: string | null
        }
        Insert: {
          ai_clip_url?: string | null
          ai_job_id?: string | null
          ai_provider?: string | null
          auto_selected?: boolean | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          last_error_code?: string | null
          max_retries?: number | null
          motion_prompt?: string | null
          next_retry_at?: string | null
          order_index: number
          retry_count?: number | null
          session_id: string
          source_image_url: string
          status?: string | null
          transition_type?: string | null
          updated_at?: string | null
          upscale_job_id?: string | null
        }
        Update: {
          ai_clip_url?: string | null
          ai_job_id?: string | null
          ai_provider?: string | null
          auto_selected?: boolean | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          last_error_code?: string | null
          max_retries?: number | null
          motion_prompt?: string | null
          next_retry_at?: string | null
          order_index?: number
          retry_count?: number | null
          session_id?: string
          source_image_url?: string
          status?: string | null
          transition_type?: string | null
          updated_at?: string | null
          upscale_job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_style2_clips_ai_provider_fkey"
            columns: ["ai_provider"]
            isOneToOne: false
            referencedRelation: "ai_video_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_style2_clips_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "video_style2_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_style2_renders: {
        Row: {
          captions_json: Json | null
          created_at: string | null
          creatomate_render_id: string | null
          creatomate_template_id: string | null
          error_message: string | null
          final_video_url: string | null
          id: string
          input_clips_json: Json | null
          music_track_url: string | null
          render_type: string
          session_id: string
          settings_json: Json | null
          status: string | null
          stitched_video_url: string | null
          updated_at: string | null
        }
        Insert: {
          captions_json?: Json | null
          created_at?: string | null
          creatomate_render_id?: string | null
          creatomate_template_id?: string | null
          error_message?: string | null
          final_video_url?: string | null
          id?: string
          input_clips_json?: Json | null
          music_track_url?: string | null
          render_type: string
          session_id: string
          settings_json?: Json | null
          status?: string | null
          stitched_video_url?: string | null
          updated_at?: string | null
        }
        Update: {
          captions_json?: Json | null
          created_at?: string | null
          creatomate_render_id?: string | null
          creatomate_template_id?: string | null
          error_message?: string | null
          final_video_url?: string | null
          id?: string
          input_clips_json?: Json | null
          music_track_url?: string | null
          render_type?: string
          session_id?: string
          settings_json?: Json | null
          status?: string | null
          stitched_video_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_style2_renders_creatomate_template_id_fkey"
            columns: ["creatomate_template_id"]
            isOneToOne: false
            referencedRelation: "creatomate_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_style2_renders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "video_style2_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_style2_sessions: {
        Row: {
          ai_provider: string | null
          aspect_ratio: string | null
          content_type_id: string | null
          created_at: string | null
          error_message: string | null
          final_video_url: string | null
          id: string
          is_test: boolean | null
          listing_id: string
          listing_status: string | null
          metadata: Json | null
          mode_step1: string | null
          mode_step2: string | null
          mode_step3: string | null
          organization_id: string
          production_settings: Json | null
          run_fully_automated: boolean | null
          schedule_id: string | null
          selected_image_urls: string[] | null
          status: string
          updated_at: string | null
          upscale_images: boolean | null
          upscale_jobs: Json | null
          workflow_id: string | null
        }
        Insert: {
          ai_provider?: string | null
          aspect_ratio?: string | null
          content_type_id?: string | null
          created_at?: string | null
          error_message?: string | null
          final_video_url?: string | null
          id?: string
          is_test?: boolean | null
          listing_id: string
          listing_status?: string | null
          metadata?: Json | null
          mode_step1?: string | null
          mode_step2?: string | null
          mode_step3?: string | null
          organization_id: string
          production_settings?: Json | null
          run_fully_automated?: boolean | null
          schedule_id?: string | null
          selected_image_urls?: string[] | null
          status?: string
          updated_at?: string | null
          upscale_images?: boolean | null
          upscale_jobs?: Json | null
          workflow_id?: string | null
        }
        Update: {
          ai_provider?: string | null
          aspect_ratio?: string | null
          content_type_id?: string | null
          created_at?: string | null
          error_message?: string | null
          final_video_url?: string | null
          id?: string
          is_test?: boolean | null
          listing_id?: string
          listing_status?: string | null
          metadata?: Json | null
          mode_step1?: string | null
          mode_step2?: string | null
          mode_step3?: string | null
          organization_id?: string
          production_settings?: Json | null
          run_fully_automated?: boolean | null
          schedule_id?: string | null
          selected_image_urls?: string[] | null
          status?: string
          updated_at?: string | null
          upscale_images?: boolean | null
          upscale_jobs?: Json | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_style2_sessions_ai_provider_fkey"
            columns: ["ai_provider"]
            isOneToOne: false
            referencedRelation: "ai_video_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_receipts: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string | null
          id: string
          listing_id: string | null
          organization_id: string | null
          payload: Json | null
          processed_at: string | null
          processing_status: string | null
          signature_valid: boolean | null
          source_app: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id: string
          listing_id?: string | null
          organization_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          processing_status?: string | null
          signature_valid?: boolean | null
          source_app?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          listing_id?: string | null
          organization_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          processing_status?: string | null
          signature_valid?: boolean | null
          source_app?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      recurring_schedule_summary: {
        Row: {
          client_name: string | null
          completed_posts: number | null
          days_of_week: number[] | null
          ends_at: string | null
          failed_posts: number | null
          frequency: string | null
          generating_videos: number | null
          is_active: boolean | null
          listing_status: string | null
          listing_title: string | null
          pending_posts: number | null
          pending_videos: number | null
          scheduled_posts_count: number | null
          show_new_banner: boolean | null
          started_at: string | null
          template_id: string | null
        }
        Relationships: []
      }
      unified_schedule_dashboard: {
        Row: {
          address_line_1: string | null
          address_town: string | null
          banner_duration_weeks: number | null
          client_id: string | null
          client_name: string | null
          county: string | null
          created_at: string | null
          current_phase: string | null
          days_of_week: number[] | null
          ends_at: string | null
          frequency: string | null
          hero_photo_url: string | null
          is_active: boolean | null
          launch_duration_weeks: number | null
          launch_frequency: string | null
          listing_id: string | null
          listing_title: string | null
          logo_url: string | null
          next_post_date: string | null
          ongoing_duration_weeks: number | null
          ongoing_frequency: string | null
          pending_count: number | null
          show_new_banner: boolean | null
          started_at: string | null
          status: string | null
          template_id: string | null
          upcoming_posts: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      acquire_gemini_vision_slot: {
        Args: {
          p_clip_index: number
          p_function_name?: string
          p_max_concurrent?: number
          p_session_id: string
          p_ttl_seconds?: number
        }
        Returns: string
      }
      cancel_pending_verifications_for_listing: {
        Args: { p_listing_id: string }
        Returns: number
      }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      end_impersonation_session: { Args: never; Returns: undefined }
      get_active_impersonation: {
        Args: never
        Returns: {
          organization_id: string
          organization_name: string
          organization_slug: string
          reason: string
          session_id: string
          started_at: string
        }[]
      }
      get_ai_instructions: {
        Args: {
          p_feature_type: Database["public"]["Enums"]["ai_feature_type"]
          p_locale?: string
          p_organization_id?: string
        }
        Returns: {
          banned_phrases: string[]
          freeform_instructions: string
          id: string
          locale: string
          name: string
          priority: number
          scope: Database["public"]["Enums"]["ai_instruction_scope"]
          tone_guidelines: string[]
        }[]
      }
      get_client_id_from_listing: {
        Args: { p_listing_id: string }
        Returns: string
      }
      get_effective_org_ids: {
        Args: { _user_id: string }
        Returns: {
          organization_id: string
        }[]
      }
      get_feature_cost: {
        Args: { p_feature_type: Database["public"]["Enums"]["feature_type"] }
        Returns: number
      }
      get_impersonatable_organizations: {
        Args: never
        Returns: {
          business_name: string
          id: string
          is_active: boolean
          slug: string
        }[]
      }
      get_user_organization_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_invite_code_usage: {
        Args: { code_value: string }
        Returns: boolean
      }
      insert_recurring_schedule_template: {
        Args: { template_data: Json }
        Returns: {
          banner_duration_weeks: number
          created_at: string
          current_phase: string
          days_of_week: number[]
          duration_weeks: number
          ends_at: string
          frequency: string
          id: string
          is_active: boolean
          launch_duration_weeks: number
          launch_frequency: string
          listing_created_at: string
          listing_id: string
          ongoing_duration_weeks: number
          ongoing_frequency: string
          show_new_banner: boolean
          started_at: string
          updated_at: string
        }[]
      }
      invoke_process_scheduled_posts: {
        Args: never
        Returns: {
          http_status: number
          message: string
          run_id: string
          success: boolean
        }[]
      }
      invoke_video_style2_recover_cron: { Args: never; Returns: undefined }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      process_due_status_verifications: {
        Args: never
        Returns: {
          message: string
          run_id: string
          success: boolean
          verifications_found: number
          verifications_processed: number
        }[]
      }
      release_gemini_vision_slot: {
        Args: { p_lock_id: string }
        Returns: undefined
      }
      sp_consume_credits:
        | {
            Args: {
              p_credits_amount: number
              p_description?: string
              p_feature_details?: Json
              p_feature_type: string
              p_organization_id: string
              p_source_app?: string
              p_user_id?: string
            }
            Returns: {
              credits_consumed: number
              new_balance: number
              success: boolean
              transaction_id: string
            }[]
          }
        | {
            Args: {
              p_feature_details?: Json
              p_feature_type: Database["public"]["Enums"]["feature_type"]
              p_organization_id: string
              p_quantity?: number
              p_request_id?: string
              p_source_app?: string
              p_user_id?: string
            }
            Returns: {
              credits_consumed: number
              error_message: string
              new_balance: number
              success: boolean
              transaction_id: string
            }[]
          }
      sp_get_credit_balance: {
        Args: { p_organization_id: string }
        Returns: number
      }
      sp_get_credit_history: {
        Args: { p_limit?: number; p_offset?: number; p_organization_id: string }
        Returns: {
          amount: number
          balance_after: number
          created_at: string
          description: string
          feature_type: string
          id: string
          source: string
          source_app: string
          transaction_type: string
        }[]
      }
      sp_grant_credits:
        | {
            Args: {
              p_amount: number
              p_created_by?: string
              p_description?: string
              p_metadata?: Json
              p_organization_id: string
              p_source: Database["public"]["Enums"]["credit_source"]
              p_source_app?: string
              p_stripe_checkout_session_id?: string
              p_stripe_event_id?: string
              p_stripe_payment_intent_id?: string
            }
            Returns: {
              error_message: string
              new_balance: number
              success: boolean
              transaction_id: string
            }[]
          }
        | {
            Args: {
              p_credits_amount: number
              p_description?: string
              p_metadata?: Json
              p_organization_id: string
              p_source: string
              p_stripe_event_id?: string
              p_stripe_payment_intent_id?: string
              p_user_id?: string
            }
            Returns: {
              credits_granted: number
              new_balance: number
              success: boolean
              transaction_id: string
            }[]
          }
    }
    Enums: {
      ai_feature_type:
        | "listing_enhance_description"
        | "listing_enhance_specs"
        | "property_extraction"
        | "chatbot_assistant"
        | "photo_captions"
        | "social_media_posts"
      ai_instruction_scope: "global" | "organization"
      app_role: "admin" | "user" | "super_admin" | "developer"
      buyer_stage_enum:
        | "lead"
        | "qualified"
        | "viewing_scheduled"
        | "viewed"
        | "offer_made"
        | "sale_agreed"
        | "purchased"
        | "lost"
      credit_source:
        | "purchase"
        | "subscription"
        | "welcome_bonus"
        | "admin_grant"
        | "refund"
        | "promotion"
      crm_activity_type_enum:
        | "note"
        | "email"
        | "call"
        | "meeting"
        | "stage_change"
        | "listing_sent"
        | "viewing_scheduled"
        | "offer_received"
      feature_type:
        | "post_generation"
        | "video_generation"
        | "image_enhancement"
        | "ai_assistant"
        | "property_extraction"
        | "email_send"
        | "ai_chat_message"
        | "ai_listing_extraction"
        | "social_post_facebook"
        | "social_post_instagram"
        | "social_post_tiktok"
        | "social_post_youtube"
        | "social_post_linkedin"
      seller_stage_enum:
        | "lead"
        | "valuation_scheduled"
        | "valuation_complete"
        | "listed"
        | "under_offer"
        | "sold"
        | "lost"
      transaction_type: "credit" | "debit"
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
      ai_feature_type: [
        "listing_enhance_description",
        "listing_enhance_specs",
        "property_extraction",
        "chatbot_assistant",
        "photo_captions",
        "social_media_posts",
      ],
      ai_instruction_scope: ["global", "organization"],
      app_role: ["admin", "user", "super_admin", "developer"],
      buyer_stage_enum: [
        "lead",
        "qualified",
        "viewing_scheduled",
        "viewed",
        "offer_made",
        "sale_agreed",
        "purchased",
        "lost",
      ],
      credit_source: [
        "purchase",
        "subscription",
        "welcome_bonus",
        "admin_grant",
        "refund",
        "promotion",
      ],
      crm_activity_type_enum: [
        "note",
        "email",
        "call",
        "meeting",
        "stage_change",
        "listing_sent",
        "viewing_scheduled",
        "offer_received",
      ],
      feature_type: [
        "post_generation",
        "video_generation",
        "image_enhancement",
        "ai_assistant",
        "property_extraction",
        "email_send",
        "ai_chat_message",
        "ai_listing_extraction",
        "social_post_facebook",
        "social_post_instagram",
        "social_post_tiktok",
        "social_post_youtube",
        "social_post_linkedin",
      ],
      seller_stage_enum: [
        "lead",
        "valuation_scheduled",
        "valuation_complete",
        "listed",
        "under_offer",
        "sold",
        "lost",
      ],
      transaction_type: ["credit", "debit"],
    },
  },
} as const
