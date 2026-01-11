import { Injectable } from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

@Injectable()
export class AppService {
  getHello(): string {
    return "Hello type";
  }

  async testSupabase(): Promise<any> {
    const { data, error } = await supabase
      .from("incidents")
      .select("*")
      .limit(1);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data };
  }
}
