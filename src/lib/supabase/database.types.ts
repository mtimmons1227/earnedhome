// Generated from the EarnedHome Supabase project (ref azfesppisxniclnntrmc).
// Regenerate after schema changes:
//   supabase gen types typescript --project-id azfesppisxniclnntrmc > src/lib/supabase/database.types.ts
export type Json =
  | string | number | boolean | null
  | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: { id: string; slug: string; name: string; type: Database["public"]["Enums"]["tenant_type"]; status: Database["public"]["Enums"]["tenant_status"]; branding: Json; lo_name: string | null; nmls: string | null; lo_phone: string | null; notify_email: string | null; lo_routing: string; apply_url: string | null; booking_url: string | null; custom_domain: string | null; created_at: string };
        Insert: { id?: string; slug: string; name: string; type?: Database["public"]["Enums"]["tenant_type"]; status?: Database["public"]["Enums"]["tenant_status"]; branding?: Json; lo_name?: string | null; nmls?: string | null; lo_phone?: string | null; notify_email?: string | null; lo_routing?: string; apply_url?: string | null; booking_url?: string | null; custom_domain?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
        Relationships: [];
      };
      communities: {
        Row: { id: string; tenant_id: string; name: string; location: string | null; active: boolean; lo_id: string | null; created_at: string };
        Insert: { id?: string; tenant_id: string; name: string; location?: string | null; active?: boolean; lo_id?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["communities"]["Insert"]>;
        Relationships: [];
      };
      app_users: {
        Row: { id: string; tenant_id: string; role: Database["public"]["Enums"]["user_role"]; full_name: string | null; email: string | null; nmls: string | null; phone: string | null; is_primary: boolean; active: boolean; invite_sent_at: string | null; created_at: string };
        Insert: { id: string; tenant_id: string; role?: Database["public"]["Enums"]["user_role"]; full_name?: string | null; email?: string | null; nmls?: string | null; phone?: string | null; is_primary?: boolean; active?: boolean; invite_sent_at?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["app_users"]["Insert"]>;
        Relationships: [];
      };
      quotes: {
        Row: { id: string; tenant_id: string; inputs: Json; outputs: Json; rates_as_of: string | null; created_at: string };
        Insert: { id?: string; tenant_id: string; inputs: Json; outputs: Json; rates_as_of?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["quotes"]["Insert"]>;
        Relationships: [];
      };
      leads: {
        Row: { id: string; tenant_id: string; community_id: string | null; quote_id: string | null; agent_id: string | null; assigned_lo_id: string | null; idempotency_key: string | null; full_name: string | null; email: string | null; phone: string | null; consent_tcpa: boolean; consent_text: string | null; consent_at: string | null; agent_status_consent: boolean; consent_token: string; agent_status_consent_at: string | null; agent_status_consent_source: string | null; source: string | null; routed_to: string | null; status: Database["public"]["Enums"]["lead_status"]; closed_at: string | null; created_at: string };
        Insert: { id?: string; tenant_id: string; community_id?: string | null; quote_id?: string | null; agent_id?: string | null; assigned_lo_id?: string | null; idempotency_key?: string | null; full_name?: string | null; email?: string | null; phone?: string | null; consent_tcpa?: boolean; consent_text?: string | null; consent_at?: string | null; agent_status_consent?: boolean; consent_token?: string; agent_status_consent_at?: string | null; agent_status_consent_source?: string | null; source?: string | null; routed_to?: string | null; status?: Database["public"]["Enums"]["lead_status"]; closed_at?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      events: {
        Row: { id: string; tenant_id: string; type: string; payload: Json; created_at: string };
        Insert: { id?: string; tenant_id: string; type: string; payload?: Json; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };
      agents: {
        Row: { id: string; tenant_id: string; lo_id: string | null; name: string; email: string | null; phone: string | null; slug: string; active: boolean; status_token: string; invite_sent_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; tenant_id: string; lo_id?: string | null; name: string; email?: string | null; phone?: string | null; slug: string; active?: boolean; status_token?: string; invite_sent_at?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["agents"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      lead_status: "new" | "contacted" | "working" | "closed" | "lost";
      tenant_status: "active" | "suspended" | "pending";
      tenant_type: "master" | "builder" | "agent" | "lo_company";
      user_role: "admin" | "lo" | "staff";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
