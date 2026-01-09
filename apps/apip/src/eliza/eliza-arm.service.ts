import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { triageCharacter, type Character } from './characters';
import { collectInfoAction } from './actions';
import { GeocodingService } from '../services/geocoding.service';

interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ConversationContext {
    messages: Message[];
    collectedInfo: any; // Données collectées par collectInfoAction
}

@Injectable()
export class ElizaArmService implements OnModuleInit {
    private readonly logger = new Logger(ElizaArmService.name);
    private conversationContexts: Map<string, ConversationContext> = new Map();
    private character: Character;

    constructor(private readonly geocoding: GeocodingService) {}

    async onModuleInit() {
        try {
            this.logger.log('🔧 Initializing ARM Service with Eliza Architecture...');

            // Load Triage Character
            this.character = triageCharacter;

            this.logger.log(`✅ ARM Service initialized`);
            this.logger.log(`📝 Character: ${this.character.name}`);
            this.logger.log(`📝 System prompt: ${this.character.system.length} chars`);
            this.logger.log(`   Bio: ${this.character.bio.join(', ')}`);
            this.logger.log(`🤖 Model: ${this.character.settings.model}`);
            this.logger.log(`🔑 Groq API Key: ${process.env.GROQ_API_KEY ? '✅ SET' : '❌ NOT SET'}`);

            if (!process.env.GROQ_API_KEY) {
                this.logger.error('⚠️  GROQ_API_KEY not found in .env!');
            }
        } catch (error) {
            this.logger.error('❌ Failed to initialize ARM Service:', error);
            throw error;
        }
    }

    /**
     * Returns the greeting message
     */
    getGreeting(): string {
        return "Bonjour, vous êtes bien au service d'aide médicale urgente. Quelle est votre urgence ?";
    }

    /**
     * 🆕 Génère résumé progressif selon avancement conversation
     * Permet affichage dashboard ARM dès le premier échange
     */
    private async generateProgressiveSummary(context: ConversationContext): Promise<string> {
        const messageCount = context.messages.filter(m => m.role !== 'system').length;

        // 1 échange : résumé minimaliste
        if (messageCount === 2) {
            const firstUserMsg = context.messages.find(m => m.role === 'user')?.content || '';
            return `Appel démarré - ${firstUserMsg.substring(0, 80)}...`;
        }

        // 2-3 échanges : concaténation messages utilisateur
        if (messageCount < 4) {
            const userMessages = context.messages
                .filter(m => m.role === 'user')
                .map(m => m.content)
                .join(' | ');

            return `En cours: ${userMessages.substring(0, 150)}...`;
        }

        // 4+ échanges : résumé complet (ne devrait pas arriver ici normalement)
        return await this.generateCallSummary(context);
    }

    /**
     * Generate response using Groq API with Triage Character
     * Now returns both response and triage summary for database save
     */
    async getArmResponse(
        userMessage: string,
        callId: string,
        citizenId: string,
    ): Promise<{
        response: string;
        triageData?: {
            priority: 'P0' | 'P1' | 'P2' | 'P3';
            summary: string;
            confidence: number;
            symptoms: string[];
            vitalEmergency: boolean;
            isPartial?: boolean; // 🆕 Flag résumé partiel
        };
    }> {
        try {
            // Get or create conversation context
            let context = this.conversationContexts.get(callId);
            if (!context) {
                context = {
                    messages: [{
                        role: 'system',
                        content: this.character.system
                    }],
                    collectedInfo: {}
                };
                this.conversationContexts.set(callId, context);
            }

            // Run collectInfoAction to extract information
            const infoResult = await collectInfoAction.handler(userMessage, context.collectedInfo);
            if (infoResult.success && infoResult.data) {
                // Merge collected info
                context.collectedInfo = { ...context.collectedInfo, ...infoResult.data };

                if (infoResult.message) {
                    this.logger.warn(`⚠️  ${infoResult.message}`);
                }
            }

            // Add user message
            context.messages.push({
                role: 'user',
                content: userMessage
            });

            this.logger.log(`🌐 Calling Groq API (${this.character.name})`);
            this.logger.log(`   User: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`);
            this.logger.log(`   Collected info: ${JSON.stringify(context.collectedInfo)}`);

            // Call Groq API
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.character.settings.model,
                    messages: context.messages,
                    temperature: this.character.settings.temperature,
                    max_tokens: this.character.settings.max_tokens
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Groq API error ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            if (!data.choices?.[0]?.message?.content) {
                throw new Error('Invalid Groq API response format');
            }

            const armResponse = data.choices[0].message.content;

            // Add assistant response to context
            context.messages.push({
                role: 'assistant',
                content: armResponse
            });

            this.logger.log(`✅ Groq API Success`);
            this.logger.log(`   Tokens: ${data.usage?.total_tokens || 'N/A'}`)
;
            this.logger.log(`   Response: "${armResponse.substring(0, 100)}${armResponse.length > 100 ? '...' : ''}"`);

            // Générer résumé + classification après quelques échanges
            // ✅ NOUVEAU : Dès 2 messages (1 échange) au lieu de 4
            let triageData;
            const messageCount = context.messages.filter(m => m.role !== 'system').length;

            if (messageCount >= 2) { // ✅ Dès le premier échange
                try {
                    this.logger.log(`🔄 Génération résumé progressif (${messageCount} messages)...`);

                    // ✅ Résumé progressif selon avancement
                    const summary = messageCount >= 4
                        ? await this.generateCallSummary(context)
                        : await this.generateProgressiveSummary(context);

                    const priority = this.detectPriority(context.collectedInfo);

                    triageData = {
                        priority,
                        summary,
                        confidence: messageCount >= 4 ? 0.85 : 0.5, // ✅ Confiance progressive
                        symptoms: this.extractSymptoms(context),
                        vitalEmergency: context.collectedInfo.urgence_vitale || false,
                        isPartial: messageCount < 4 // 🆕 Flag résumé partiel
                    };

                    this.logger.log(`📋 Triage ${triageData.isPartial ? 'partiel' : 'complet'}: ${priority} - "${summary.substring(0, 60)}..."`);

                    // 🆕 GEOCODING: Si adresse collectée, chercher hôpital + pompiers
                    if (context.collectedInfo.adresse) {
                        try {
                            this.logger.log(`🌍 Geocoding adresse: "${context.collectedInfo.adresse}"`);

                            const location = await this.geocoding.geocodeAddress(context.collectedInfo.adresse);

                            if (location) {
                                this.logger.log(`📍 Coordonnées: ${location.lat}, ${location.lng}`);

                                // Recherche parallèle hôpitaux + pompiers
                                const [hospitals, fireStations] = await Promise.all([
                                    this.geocoding.findNearestHospitals(location, 15),
                                    this.geocoding.findNearestFireStations(location, 15)
                                ]);

                                if (hospitals.length > 0) {
                                    triageData.nearestHospital = hospitals[0];
                                    triageData.patientLocation = location;
                                    triageData.eta = this.geocoding.calculateETA(hospitals[0].distance, priority);

                                    this.logger.log(`🏥 Hôpital: ${hospitals[0].name} (${hospitals[0].distance}km, ETA: ${triageData.eta}min)`);
                                }

                                if (fireStations.length > 0) {
                                    triageData.nearestFireStation = fireStations[0];
                                    this.logger.log(`🚒 Pompiers: ${fireStations[0].name} (${fireStations[0].distance}km)`);
                                }
                            } else {
                                this.logger.warn(`⚠️ Geocoding échoué pour: "${context.collectedInfo.adresse}"`);
                            }
                        } catch (geoError) {
                            this.logger.warn(`⚠️ Geocoding error: ${geoError.message}`);
                        }
                    }
                } catch (error) {
                    this.logger.warn(`⚠️  Failed to generate triage summary: ${error.message}`);
                }
            } else {
                this.logger.debug(`⏩ Skip résumé (seulement ${messageCount} messages, besoin 2+)`);
            }

            return { response: armResponse, triageData };
        } catch (error) {
            this.logger.error(`❌ Groq API Error:`, error.message);
            return { response: this.getFallbackResponse(userMessage) };
        }
    }

    /**
     * Fallback when Groq fails
     */
    private getFallbackResponse(userMessage: string): string {
        const lowerMessage = userMessage.toLowerCase();

        if (this.containsAddress(lowerMessage)) {
            return "D'accord, j'ai bien noté l'adresse. Les secours sont en route. Pouvez-vous me décrire la situation ?";
        }

        return "Pouvez-vous me décrire la situation ? Et surtout, quelle est votre adresse exacte ?";
    }

    /**
     * Check if message contains address
     */
    private containsAddress(message: string): boolean {
        return /\d+\s+(rue|avenue|boulevard|place|chemin)/.test(message);
    }

    /**
     * Clear conversation context
     */
    clearContext(callId: string): void {
        this.conversationContexts.delete(callId);
        this.logger.log(`🧹 Cleared context for call: ${callId}`);
    }

    /**
     * Génère un résumé concis de l'appel via LLM
     */
    private async generateCallSummary(context: ConversationContext): Promise<string> {
        const conversation = context.messages
            .filter(m => m.role !== 'system')
            .map(m => `${m.role === 'user' ? 'Patient' : 'ARM'}: ${m.content}`)
            .join('\n');

        const prompt = `Résume cet appel d'urgence médical en UNE SEULE phrase concise (max 100 caractères).
Format: "Patient [âge/sexe si connu], [symptômes principaux], [contexte important]"

Conversation:
${conversation}

Résumé concis:`;

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'compound',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 100
                })
            });

            const data = await response.json();
            return data.choices?.[0]?.message?.content?.trim() || 'Résumé indisponible';
        } catch (error) {
            this.logger.error('Failed to generate summary:', error);
            return 'Résumé indisponible';
        }
    }

    /**
     * Détecte la priorité P0-P3 basé sur les infos collectées
     */
    private detectPriority(info: any): 'P0' | 'P1' | 'P2' | 'P3' {
        // P0 : Urgence vitale immédiate
        if (info.urgence_vitale === true ||
            info.inconscient === true ||
            info.arret_cardiaque === true ||
            info.ne_respire_plus === true) {
            return 'P0';
        }

        // P1 : Urgence grave
        if (info.douleur_thoracique === true ||
            info.difficulte_respiration === true ||
            info.hemorragie === true ||
            info.douleur_intense === true) {
            return 'P1';
        }

        // P2 : Urgence relative
        if (info.chute === true ||
            info.fracture === true ||
            info.douleur === true) {
            return 'P2';
        }

        // P3 : Urgence moindre (default)
        return 'P3';
    }

    /**
     * Extrait les symptômes mentionnés
     */
    private extractSymptoms(context: ConversationContext): string[] {
        const symptoms: string[] = [];
        const info = context.collectedInfo;

        if (info.chute) symptoms.push('chute');
        if (info.douleur) symptoms.push('douleur');
        if (info.inconscient) symptoms.push('inconscient');
        if (info.ne_respire_plus) symptoms.push('arrêt respiratoire');
        if (info.difficulte_respiration) symptoms.push('dyspnée');
        if (info.douleur_thoracique) symptoms.push('douleur thoracique');
        if (info.hemorragie) symptoms.push('hémorragie');

        return symptoms;
    }
    /**
     * Get collected information for a call
     */
    getCollectedInfo(callId: string): any {
        const context = this.conversationContexts.get(callId);
        return context?.collectedInfo || {};
    }
}
