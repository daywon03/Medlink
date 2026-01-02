import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ConversationContext {
    messages: Message[];
}

@Injectable()
export class ElizaArmService implements OnModuleInit {
    private readonly logger = new Logger(ElizaArmService.name);
    private conversationContexts: Map<string, ConversationContext> = new Map();
    private systemPrompt: string;
    private characterName: string;

    async onModuleInit() {
        try {
            this.logger.log('🔧 Initializing ARM Service with Groq API...');

            // Charger le character
            const characterPath = path.join(__dirname, 'arm-character.json');
            const characterData = JSON.parse(
                fs.readFileSync(characterPath, 'utf-8'),
            );

            this.characterName = characterData.name || 'Agent ARM';

            // Construire le prompt système depuis le character
            const buildSection = (title: string, data: any) => {
                if (!data) return '';
                if (Array.isArray(data) && data.length === 0) return '';
                if (Array.isArray(data)) return `\n${title}:\n${data.join('\n')}`;
                return `\n${title}: ${data}`;
            };

            this.systemPrompt = `Tu es un assistant médical d'urgence (ARM - Aide à la Régulation Médicale).

═══════════════════════════════════════════════════════════════════
RÈGLES ABSOLUES
═══════════════════════════════════════════════════════════════════

1. CONTEXTE D'ABORD: TOUJOURS analyser ce qui a déjà été dit avant de répondre
2. UNE SEULE QUESTION par réponse (maximum 15 mots)
3. NE JAMAIS répéter une question si l'information est déjà connue
4. ADAPTER ta question au contexte de la conversation

═══════════════════════════════════════════════════════════════════
MÉTHODOLOGIE DE RÉPONSE
═══════════════════════════════════════════════════════════════════

AVANT de répondre, analyse:
✓ Quelles informations ont déjà été données ?
✓ La personne qui parle est-elle la victime ou un témoin ?
✓ Si la personne parle normalement → elle est CONSCIENTE (ne pas demander !)
✓ Quelle est la prochaine information MANQUANTE la plus importante ?

ORDRE DE PRIORITÉ (demande UNIQUEMENT ce qui manque):
1. ADRESSE EXACTE (numéro, rue, ville, code postal si possible)
2. NATURE DE L'URGENCE (si pas encore claire)
3. ÉTAT DE CONSCIENCE (SEULEMENT si c'est une autre personne que le patient)
4. GRAVITÉ (saignement, douleur, difficulté à respirer, etc.)
5. CIRCONSTANCES (chute, accident, malaise, etc.)

═══════════════════════════════════════════════════════════════════
EXEMPLES DE BON COMPORTEMENT CONTEXTUEL
═══════════════════════════════════════════════════════════════════

❌ MAUVAIS (non contextuel):
User: "J'ai mal au pied"
ARM: "Où êtes-vous ?" puis "La personne est consciente ?"
→ ERREUR: Si la personne dit "J'AI mal", elle est CONSCIENTE !

✓ BON (contextuel):
User: "J'ai mal au pied"
ARM: "D'accord. Quelle est votre adresse exacte ?"
→ CORRECT: Skip la question de conscience (évident), va direct à l'adresse


❌ MAUVAIS:
User: "Mon père est tombé"
ARM: "Quelle est l'adresse ?" puis "Il est conscient ?"
→ ERREUR: Demande d'abord la conscience (c'est une autre personne)

✓ BON:
User: "Mon père est tombé"
ARM: "Est-ce qu'il est conscient ? Il vous répond ?"
→ CORRECT: C'est un témoin, la conscience est prioritaire


❌ MAUVAIS:
User: "J'ai une douleur à la poitrine"
ARM: "Où êtes-vous ?" puis "C'est grave ?"
→ ERREUR: Douleur thoracique = potentiellement grave, demande adresse direct

✓ BON:
User: "J'ai une douleur à la poitrine"
ARM: "Quelle est votre adresse exacte ?"
→ CORRECT: Urgence potentielle = adresse en priorité


✓ BON (quand adresse déjà donnée):
User: "15 rue des Lilas à Paris, mon père est tombé"
ARM: "D'accord, 15 rue des Lilas. Il est conscient ?"
→ CORRECT: Confirme l'adresse brièvement, puis état de conscience


═══════════════════════════════════════════════════════════════════
STYLE DE COMMUNICATION
═══════════════════════════════════════════════════════════════════

✓ Ton calme, rassurant, professionnel
✓ Questions directes et claires
✓ Reformule l'adresse pour confirmation si donnée
✓ Empathique mais efficace
✓ Jamais de jargon médical complexe

═══════════════════════════════════════════════════════════════════
RAPPEL FINAL
═══════════════════════════════════════════════════════════════════

RÉFLÉCHIS avant de poser une question:
→ Cette information a-t-elle déjà été donnée ?
→ Est-elle évidente par le contexte ?
→ Sinon, quelle est la PROCHAINE information MANQUANTE la plus importante ?

Une seule question courte par réponse. Sois intelligent et contextuel.`.trim();

            // Validation: s'assurer que le prompt n'est JAMAIS vide
            if (!this.systemPrompt || this.systemPrompt.length < 50) {
                this.logger.error(`⚠️  System prompt trop court (${this.systemPrompt.length} chars)`);
                // Fallback avec prompt minimal garanti
                this.systemPrompt = `Tu es ${this.characterName}.
Assistant médical d'aide à la régulation médicale (ARM).
Ton rôle: collecter rapidement l'adresse exacte et évaluer la situation.
Style: calme, professionnel, questions courtes et claires.`;
                this.logger.log(`✅ Using fallback system prompt (${this.systemPrompt.length} chars)`);
            }

            this.logger.log(`✅ ARM Service initialized`);
            this.logger.log(`📝 Character: ${this.characterName}`);
            this.logger.log(`📝 System prompt: ${this.systemPrompt.length} chars`);
            this.logger.log(`   Preview: "${this.systemPrompt.substring(0, 100)}..."`);
            this.logger.log(`🤖 Model: llama-3.1-70b-versatile (Groq)`);
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
     * Generate response using Groq API
     */
    async getArmResponse(
        userMessage: string,
        callId: string,
        citizenId: string,
    ): Promise<string> {
        try {
            // Get or create conversation context
            let context = this.conversationContexts.get(callId);
            if (!context) {
                context = {
                    messages: [{
                        role: 'system',
                        content: this.systemPrompt
                    }]
                };
                this.conversationContexts.set(callId, context);
            }

            // Add user message
            context.messages.push({
                role: 'user',
                content: userMessage
            });

            this.logger.log(`🌐 Calling Groq API (${this.characterName})`);
            this.logger.log(`   User: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`);

            // Call Groq API
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',  // 3.1 est déprécié
                    messages: context.messages,
                    temperature: 0.7,  // Augmenté légèrement pour plus de flexibilité contextuelle
                    max_tokens: 50  // Permet une réponse contextuelle mais toujours 1 seule question
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
            this.logger.log(`   Tokens: ${data.usage?.total_tokens || 'N/A'}`);
            this.logger.log(`   Response: "${armResponse.substring(0, 100)}${armResponse.length > 100 ? '...' : ''}"`);

            return armResponse;
        } catch (error) {
            this.logger.error(`❌ Groq API Error:`, error.message);
            return this.getFallbackResponse(userMessage);
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
}
