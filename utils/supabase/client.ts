import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://rloifnaehpjudksebbmm.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_tUXVcvtASeyvN12aMEgaSg_7UU8wIjW";

export const createClient = () => {
  return createBrowserClient(supabaseUrl, supabaseKey);
};
