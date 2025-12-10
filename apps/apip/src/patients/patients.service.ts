import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

@Injectable()
export class PatientsService {
  async createPatient(payload: any) {
    const { data, error } = await supabase
      .from('patients')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getPatients(limit = 20, offset = 0, order = 'last_name') {
    const from = offset;
    const to = offset + limit - 1;
    const { data, count, error } = await supabase
      .from('patients')
      .select('*', { count: 'exact' })
      .order(order, { ascending: true })
      .range(from, to);
    if (error) throw error;
    return { data, meta: { total: count ?? 0, limit, offset } };
  }

  async getPatientById(id: string) {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updatePatient(id: string, payload: any) {
    const { data, error } = await supabase
      .from('patients')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async deletePatient(id: string) {
    const { data, error } = await supabase
      .from('patients')
      .delete()
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}
