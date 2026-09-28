export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type Database = {
    public: {
        Tables: {
            bookings: {
                Row: {
                    cabinId: number | null;
                    cabinPrice: number | null;
                    created_at: string;
                    endDate: string | null;
                    extrasPrice: number | null;
                    guestId: number | null;
                    hasBreakfast: boolean | null;
                    id: number;
                    isPaid: boolean | null;
                    numGuests: number | null;
                    numNights: number | null;
                    observations: string | null;
                    startDate: string | null;
                    status: string | null;
                    totalPrice: number | null;
                };
                Insert: {
                    cabinId?: number | null;
                    cabinPrice?: number | null;
                    created_at?: string;
                    endDate?: string | null;
                    extrasPrice?: number | null;
                    guestId?: number | null;
                    hasBreakfast?: boolean | null;
                    id?: number;
                    isPaid?: boolean | null;
                    numGuests?: number | null;
                    numNights?: number | null;
                    observations?: string | null;
                    startDate?: string | null;
                    status?: string | null;
                    totalPrice?: number | null;
                };
                Update: {
                    cabinId?: number | null;
                    cabinPrice?: number | null;
                    created_at?: string;
                    endDate?: string | null;
                    extrasPrice?: number | null;
                    guestId?: number | null;
                    hasBreakfast?: boolean | null;
                    id?: number;
                    isPaid?: boolean | null;
                    numGuests?: number | null;
                    numNights?: number | null;
                    observations?: string | null;
                    startDate?: string | null;
                    status?: string | null;
                    totalPrice?: number | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "bookings_cabinId_fkey";
                        columns: ["cabinId"];
                        isOneToOne: false;
                        referencedRelation: "cabins";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "bookings_guestId_fkey";
                        columns: ["guestId"];
                        isOneToOne: false;
                        referencedRelation: "guests";
                        referencedColumns: ["id"];
                    }
                ];
            };
            cabins: {
                Row: {
                    created_at: string;
                    description: string | null;
                    discount: number | null;
                    id: number;
                    image: string | null;
                    maxCapacity: number | null;
                    name: string | null;
                    regularPrice: number | null;
                };
                Insert: {
                    created_at?: string;
                    description?: string | null;
                    discount?: number | null;
                    id?: number;
                    image?: string | null;
                    maxCapacity?: number | null;
                    name?: string | null;
                    regularPrice?: number | null;
                };
                Update: {
                    created_at?: string;
                    description?: string | null;
                    discount?: number | null;
                    id?: number;
                    image?: string | null;
                    maxCapacity?: number | null;
                    name?: string | null;
                    regularPrice?: number | null;
                };
                Relationships: [];
            };
            guests: {
                Row: {
                    countryFlag: string | null;
                    created_at: string;
                    email: string | null;
                    fullName: string | null;
                    id: number;
                    nationalID: string | null;
                    nationality: string | null;
                };
                Insert: {
                    countryFlag?: string | null;
                    created_at?: string;
                    email?: string | null;
                    fullName?: string | null;
                    id?: number;
                    nationalID?: string | null;
                    nationality?: string | null;
                };
                Update: {
                    countryFlag?: string | null;
                    created_at?: string;
                    email?: string | null;
                    fullName?: string | null;
                    id?: number;
                    nationalID?: string | null;
                    nationality?: string | null;
                };
                Relationships: [];
            };
            settings: {
                Row: {
                    breakfastPrice: number | null;
                    created_at: string;
                    id: number;
                    maxBookingLength: number | null;
                    maxNumberGuestsPerBooking: number | null;
                    minBookingLength: number | null;
                };
                Insert: {
                    breakfastPrice?: number | null;
                    created_at?: string;
                    id?: number;
                    maxBookingLength?: number | null;
                    maxNumberGuestsPerBooking?: number | null;
                    minBookingLength?: number | null;
                };
                Update: {
                    breakfastPrice?: number | null;
                    created_at?: string;
                    id?: number;
                    maxBookingLength?: number | null;
                    maxNumberGuestsPerBooking?: number | null;
                    minBookingLength?: number | null;
                };
                Relationships: [];
            };
            // --- Seaspace catalog (source of truth: ADMIN-PANEL-CONTEXT.md § "Kontrak data") ---
            stays: {
                Row: {
                    id: number;
                    created_at: string;
                    slug: string;
                    name: string;
                    location: string;
                    price_per_night: number;
                    discount: number;
                    capacity: number;
                    beds: number;
                    area: number;
                    is_new: boolean;
                    is_featured: boolean;
                    description: string;
                    lat: number;
                    lng: number;
                };
                Insert: {
                    id?: number;
                    created_at?: string;
                    slug: string;
                    name: string;
                    location: string;
                    price_per_night: number;
                    discount?: number;
                    capacity: number;
                    beds: number;
                    area: number;
                    is_new?: boolean;
                    is_featured?: boolean;
                    description: string;
                    lat: number;
                    lng: number;
                };
                Update: {
                    id?: number;
                    created_at?: string;
                    slug?: string;
                    name?: string;
                    location?: string;
                    price_per_night?: number;
                    discount?: number;
                    capacity?: number;
                    beds?: number;
                    area?: number;
                    is_new?: boolean;
                    is_featured?: boolean;
                    description?: string;
                    lat?: number;
                    lng?: number;
                };
                Relationships: [];
            };
            stay_images: {
                Row: {
                    stay_id: number;
                    storage_path: string;
                    alt: string;
                    blur_data_url: string | null;
                    width: number | null;
                    height: number | null;
                    sort_order: number;
                };
                Insert: {
                    stay_id: number;
                    storage_path: string;
                    alt: string;
                    blur_data_url?: string | null;
                    width?: number | null;
                    height?: number | null;
                    sort_order: number;
                };
                Update: {
                    stay_id?: number;
                    storage_path?: string;
                    alt?: string;
                    blur_data_url?: string | null;
                    width?: number | null;
                    height?: number | null;
                    sort_order?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "stay_images_stay_id_fkey";
                        columns: ["stay_id"];
                        isOneToOne: false;
                        referencedRelation: "stays";
                        referencedColumns: ["id"];
                    }
                ];
            };
            amenities: {
                Row: {
                    id: number;
                    slug: string;
                    label: string;
                    detail: string;
                    is_shared: boolean;
                };
                Insert: {
                    id?: number;
                    slug: string;
                    label: string;
                    detail: string;
                    is_shared?: boolean;
                };
                Update: {
                    id?: number;
                    slug?: string;
                    label?: string;
                    detail?: string;
                    is_shared?: boolean;
                };
                Relationships: [];
            };
            stay_amenities: {
                Row: {
                    stay_id: number;
                    amenity_id: number;
                    sort_order: number;
                };
                Insert: {
                    stay_id: number;
                    amenity_id: number;
                    sort_order: number;
                };
                Update: {
                    stay_id?: number;
                    amenity_id?: number;
                    sort_order?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "stay_amenities_stay_id_fkey";
                        columns: ["stay_id"];
                        isOneToOne: false;
                        referencedRelation: "stays";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "stay_amenities_amenity_id_fkey";
                        columns: ["amenity_id"];
                        isOneToOne: false;
                        referencedRelation: "amenities";
                        referencedColumns: ["id"];
                    }
                ];
            };
            // --- Staff identity (source of truth: 0014_admin_staff_access.sql, owned by the
            // customer-site repo — mirrored here read-only because `public.staff` is what
            // admin_booking_roster() checks against `auth.uid()`). Membership is the whole
            // permission model: 0018_drop_manager_role.sql dropped the `role` column. ---
            staff: {
                Row: {
                    id: string;
                    display_name: string;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    display_name: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    display_name?: string;
                    created_at?: string;
                };
                Relationships: [];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            // Returns front-desk roster rows for bookings overlapping [p_from, p_to].
            // Deliberately omits total_price/num_nights/nationality/avatar_path and
            // access_code — see ADMIN-PANEL-CONTEXT.md § "Akses baca staf ke data guest"
            // and 0020_admin_booking_access_code.sql for why the code is fetched one row
            // at a time instead. Guest-supplied detail (num_guests, guest_notes) and the
            // lifecycle timestamps arrived in 0019.
            admin_booking_roster: {
                Args: { p_from: string; p_to: string };
                Returns: {
                    booking_id: number;
                    stay_name: string;
                    guest_name: string;
                    phone_country_code: string | null;
                    phone: string | null;
                    start_date: string;
                    end_date: string;
                    status: string;
                    num_guests: number | null;
                    guest_notes: string | null;
                    created_at: string;
                    paid_at: string | null;
                    cancelled_at: string | null;
                }[];
            };
            // Filtered by created_at (not start/end date overlap) — a "Last N days"
            // financial/occupancy read, not an arrivals/departures roster. Never touches
            // public.guests. See 0015_admin_staff_booking_financials.sql.
            admin_booking_financials: {
                Args: { p_from: string; p_to: string };
                Returns: {
                    booking_id: number;
                    stay_id: number;
                    stay_name: string;
                    start_date: string;
                    end_date: string;
                    num_nights: number;
                    total_price: number;
                    status: string;
                    created_at: string;
                }[];
            };
            // Count-only, PII-free — no guest row ever leaves Postgres. See
            // 0017_admin_new_guests_count.sql.
            admin_new_guests_count: {
                Args: { p_from: string; p_to: string };
                Returns: number;
            };
            // One booking's self check-in code, and every call is written to
            // public.admin_access_code_log. Kept out of admin_booking_roster on purpose:
            // that one returns whole date ranges, so a code column there would cache every
            // code in range in the browser. Returns null for a non-staff caller (and logs
            // nothing). See 0020_admin_booking_access_code.sql.
            admin_booking_access_code: {
                Args: { p_booking_id: number };
                Returns: string | null;
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
              Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
        : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
          Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
          Row: infer R;
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
          DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
          DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
          Row: infer R;
      }
        ? R
        : never
    : never;

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema["Tables"]
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
          Insert: infer I;
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
          Insert: infer I;
      }
        ? I
        : never
    : never;

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema["Tables"]
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
          Update: infer U;
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
          Update: infer U;
      }
        ? U
        : never
    : never;

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
        | keyof DefaultSchema["Enums"]
        | { schema: keyof Database },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
        : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema["CompositeTypes"]
        | { schema: keyof Database },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
        : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
    ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
    public: {
        Enums: {},
    },
} as const;
