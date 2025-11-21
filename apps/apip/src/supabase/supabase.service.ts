// apps/api/src/supabase/supabase.service.ts
import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

@Injectable()
export class SupabaseService {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // Crée un citoyen anonyme pour chaque appel
  async createAnonymousCitizen() {
    const citizenId = randomUUID();
    
    const { data, error } = await this.supabase
      .from('citizens')
      .insert([{
        citizen_id: citizenId,
        token_pseudo: `anonymous-${Date.now()}`,
        date_consention: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur createAnonymousCitizen:', error);
      throw error;
    }
    
    return data;
  }

  // Crée l'appel d'urgence
  async createCall({ 
    citizen_id, 
    location_input_text 
  }: { 
    citizen_id: string; 
    location_input_text?: string | null; 
  }) {
    const { data, error } = await this.supabase
      .from('emergency_calls')
      .insert([{ 
        citizen_id, 
        location_input_text: location_input_text || null,
        date_heure: new Date().toISOString(),
        status: 'en_cours' 
      }])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erreur createCall:', error);
      throw error;
    }
    
    return data;
  }

  // Met à jour l'adresse après extraction
  async updateCallAddress(call_id: string, address: string) {
    const { error } = await this.supabase
      .from('emergency_calls')
      .update({ location_input_text: address })
      .eq('call_id', call_id);
    
    if (error) {
      console.error('❌ Erreur updateCallAddress:', error);
      throw error;
    }
  }

  // Enregistre une transcription partielle
  async insertTranscription(call_id: string, texte_transcrit: string) {
    const { error } = await this.supabase
      .from('call_transcriptions')
      .insert([{ call_id, texte_transcrit }]);
    
    if (error) {
      console.error('❌ Erreur insertTranscription:', error);
      throw error;
    }
  }

  // Termine l'appel
  async finishCall(call_id: string) {
    const { error } = await this.supabase
      .from('emergency_calls')
      .update({ status: 'terminé' })
      .eq('call_id', call_id);
    
    if (error) {
      console.error('❌ Erreur finishCall:', error);
      throw error;
    }
  }
}
