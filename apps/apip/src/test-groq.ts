import * as readline from 'readline';
import * as dotenv from 'dotenv';
import { ElizaArmService } from './eliza/eliza-arm.service';
import { Logger } from '@nestjs/common';

// Charger les variables d'environnement EN PREMIER
dotenv.config();

async function main() {
    const logger = new Logger('TestGroq');

    logger.log('🚀 Initialisation du service Eliza ARM avec Groq...\n');

    try {
        // Créer le service Eliza ARM
        const elizaArm = new ElizaArmService();

        // IMPORTANT: Appeler manuellement onModuleInit car on n'est pas dans NestJS
        await elizaArm.onModuleInit();

        logger.log('\n✅ Service initialisé');
        logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logger.log('💬 Test CLI avec Agent ARM (Groq)');
        logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logger.log('📝 Tapez vos messages');
        logger.log('💡 "exit" pour quitter');
        logger.log('💡 "clear" pour réinitialiser');
        logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Afficher le greeting
        console.log(`🤖 Agent ARM> ${elizaArm.getGreeting()}\n`);

        // Setup readline pour input utilisateur
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '👤 Vous> '
        });

        const callId = 'test-call-cli-' + Date.now();
        const citizenId = 'test-citizen-' + Date.now();

        rl.prompt();

        rl.on('line', async (input: string) => {
            const userInput = input.trim();

            if (!userInput) {
                rl.prompt();
                return;
            }

            // Commande exit
            if (userInput.toLowerCase() === 'exit') {
                logger.log('\n👋 Au revoir!\n');
                rl.close();
                process.exit(0);
            }

            // Commande clear
            if (userInput.toLowerCase() === 'clear') {
                elizaArm.clearContext(callId);
                console.log('\n🧹 Conversation réinitialisée\n');
                console.log(`🤖 Agent ARM> ${elizaArm.getGreeting()}\n`);
                rl.prompt();
                return;
            }

            try {
                console.log('\n⏳ L\'agent réfléchit...\n');

                // Appeler Groq via ElizaArmService
                const response = await elizaArm.getArmResponse(
                    userInput,
                    callId,
                    citizenId
                );

                console.log(`🤖 Agent ARM> ${response}\n`);

            } catch (error) {
                logger.error(`\n❌ Erreur: ${error.message}\n`);
            }

            rl.prompt();
        });

        rl.on('close', () => {
            logger.log('\n👋 Test terminé\n');
            process.exit(0);
        });

    } catch (error) {
        logger.error('❌ Erreur d\'initialisation:', error);
        logger.error(error.stack);
        process.exit(1);
    }
}

main();
