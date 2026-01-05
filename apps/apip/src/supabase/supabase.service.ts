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

  // ============================================================================
  // NOUVEAU : Gestion Triage Reports (Résumé IA + Classification)
  // ============================================================================

  /**
   * Crée ou met à jour le rapport de triage pour un appel
   * Sauvegarde le résumé IA et la classification P0-P3
   */
  async createOrUpdateTriageReport(call_id: string, triageData: {
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    summary: string;
    confidence: number;
    symptoms?: string[];
    vitalEmergency?: boolean;
  }) {
    // Vérifier si un report existe déjà
    const { data: existing } = await this.supabase
      .from('triage_reports')
      .select('report_id')
      .eq('call_id', call_id)
      .single();

    if (existing) {
      // Mettre à jour le report existant
      const { data, error } = await this.supabase
        .from('triage_reports')
        .update({
          priority_classification: triageData.priority,
          ai_explanation: triageData.summary,
          classification_confidence: triageData.confidence,
          ai_model_version: 'groq/compound',
          updated_at: new Date().toISOString()
        })
        .eq('call_id', call_id)
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur updateTriageReport:', error);
        throw error;
      }

      return data;
    } else {
      // Créer nouveau report
      const { data, error } = await this.supabase
        .from('triage_reports')
        .insert([{
          call_id,
          priority_classification: triageData.priority,
          ai_explanation: triageData.summary,
          classification_confidence: triageData.confidence,
          classification_source: 'ai_agent',
          ai_model_version: 'groq/compound',
          validated_by_doctor: false
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur createTriageReport:', error);
        throw error;
      }

      return data;
    }
  }

  /**
   * Récupère le résumé actuel pour un appel (pour dashboard)
   */
  async getTriageReport(call_id: string) {
    const { data, error } = await this.supabase
      .from('triage_reports')
      .select('*')
      .eq('call_id', call_id)
      .single();

    if (error && error.code !== 'PGRST116') { // Ignore "not found"
      console.error('❌ Erreur getTriageReport:', error);
    }

    return data;
  }
}
