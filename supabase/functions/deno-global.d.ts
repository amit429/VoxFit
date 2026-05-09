/** Minimal globals for Supabase Edge Functions (Deno). Used only for editor / `tsc -p supabase/functions`. */
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
