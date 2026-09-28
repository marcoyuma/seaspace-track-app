/// <reference types="vite/client" />
// custom interface for readability on supabase env
interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_KEY: string;
    /** Optional: without it the map still renders, but CARTO watermarks every tile. */
    readonly VITE_CARTO_API_KEY?: string;
}
interface ImportMeta {
    readonly env: ImportMetaEnv;
}
