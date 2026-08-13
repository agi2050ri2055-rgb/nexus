import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// If the keys aren't set yet, `supabase` stays null and the app still runs —
// it just won't remember anything between page loads. This means a missing
// Supabase setup can't crash the demo; it just quietly disables memory.
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export async function loadMessages(limit = 100) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Supabase load error:", error.message);
    return [];
  }
  return data || [];
}

export async function saveMessage(role, content) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("messages")
    .insert([{ role, content }])
    .select();

  if (error) {
    console.error("Supabase save error:", error.message);
    return null;
  }
  return data?.[0] || null;
}
