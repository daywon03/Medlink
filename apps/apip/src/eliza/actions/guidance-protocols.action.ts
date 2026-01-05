/**
 * Guidance RCP Action
 * Guidance téléphonique pour Réanimation Cardio-Pulmonaire
 */

export interface GuidanceState {
  protocolActif: 'RCP' | 'Heimlich' | 'Hemostase' | 'PLS' | null;
  etapeActuelle: number;
  debutTimestamp: number;
  verificationExecution: boolean;
  feedbackDonne: string[];
}

const ETAPES_RCP = [
  "La personne est sur un sol dur, sur le dos ?",
  "Placez le talon de votre main au centre de la poitrine, entre les deux seins.",
  "Mettez votre autre main par-dessus. Bras tendus.",
  "Appuyez FORT et VITE. Comptez avec moi : 1, 2, 3... jusqu'à 30.",
  "Enfoncez de 5 cm à chaque compression. Rythme : 2 compressions PAR seconde.",
  "Vous faites un EXCELLENT travail ! Continuez exactement comme ça.",
  "[Toutes les 2 minutes] Parfait, vous gérez très bien. Continuez jusqu'à l'arrivée des secours !"
];

const ETAPES_HEIMLICH = [
  "La personne peut-elle parler ou tousser ?",
  "Penchez-la en avant. Donnez 5 claques FORTES entre les omoplates.",
  "Ça n'a pas marché ? Placez-vous derrière elle.",
  "Poing fermé sous les côtes, l'autre main par-dessus.",
  "Tirez FORT vers vous et vers le haut. 5 fois d'affilée.",
  "Alternez : 5 claques dos, puis 5 compressions Heimlich.",
  "Continuez jusqu'à ce que l'objet sorte ou que les secours arrivent."
];

const ETAPES_HEMOSTASE = [
  "Prenez un linge propre, une serviette ou un vêtement.",
  "Appuyez TRÈS FORT directement sur la plaie.",
  "Ne relâchez SURTOUT PAS la pression !",
  "Si possible, allongez la personne.",
  "Surélevez la partie qui saigne si vous pouvez.",
  "La personne vous parle-t-elle ? Vérifiez qu'elle reste consciente.",
  "Maintenez la pression forte jusqu'à l'arrivée des secours."
];

/**
 * Action de guidance RCP
 */
export const guidanceRCPAction = {
  name: 'GUIDANCE_RCP',
  description: 'Guide téléphonique pour réanimation cardio-pulmonaire',

  validate: async (collectedInfo: any, state: GuidanceState): Promise<boolean> => {
    return (
      collectedInfo.classification === 'P0' &&
      collectedInfo.etat_conscience === 'inconscient' &&
      collectedInfo.respiration === false &&
      collectedInfo.temoin_present === true
    );
  },

  handler: async (state: GuidanceState, userResponse?: string): Promise<{instruction: string; state: GuidanceState}> => {
    // Initialiser state si besoin
    if (!state.protocolActif) {
      state = {
        protocolActif: 'RCP',
        etapeActuelle: 0,
        debutTimestamp: Date.now(),
        verificationExecution: false,
        feedbackDonne: []
      };
    }

    const etapes = ETAPES_RCP;
    let etape = state.etapeActuelle;

    // Si réponse utilisateur, analyser pour progression
    if (userResponse) {
      const lowerResponse = userResponse.toLowerCase();

      // Mots-clés de confirmation
      if (lowerResponse.includes('oui') ||
          lowerResponse.includes('ok') ||
          lowerResponse.includes('fait') ||
          lowerResponse.includes('je le fais')) {
        etape++;
        state.feedbackDonne.push('Positif reçu');
      }

      // Mots-clés de difficulté
      if (lowerResponse.includes('comment') ||
          lowerResponse.includes('pas compris') ||
          lowerResponse.includes('aide')) {
        // Répéter étape actuelle avec plus de détails
        state.verificationExecution = true;
      }
    } else {
      // Première instruction
      etape = 0;
    }

    // Limiter progression
    if (etape >= etapes.length) {
      etape = etapes.length - 1; // Rester sur dernière étape (encouragement continu)
    }

    state.etapeActuelle = etape;

    // Ajouter encouragement toutes les 2 minutes (120s)
    const duree = Date.now() - state.debutTimestamp;
    let instruction = etapes[etape];

    if (duree > 120000 && duree % 120000 < 10000) { // Toutes les 2 min
      instruction = "Vous faites un EXCELLENT travail ! " + instruction;
    }

    return {
      instruction,
      state
    };
  },

  examples: [
    {
      input: { collectedInfo: { classification: 'P0', etat_conscience: 'inconscient', respiration: false }, userResponse: null },
      output: { instruction: ETAPES_RCP[0], state: { protocolActif: 'RCP', etapeActuelle: 0 } }
    },
    {
      input: { state: { etapeActuelle: 0 }, userResponse: "Oui" },
      output: { instruction: ETAPES_RCP[1], state: { etapeActif: 'RCP', etapeActuelle: 1 } }
    }
  ]
};

/**
 * Action de guidance Heimlich
 */
export const guidanceHeimlichAction = {
  name: 'GUIDANCE_HEIMLICH',
  description: 'Guide téléphonique pour obstruction voies aériennes',

  validate: async (collectedInfo: any): Promise<boolean> => {
    return (
      collectedInfo.symptomes?.includes('étouffement') ||
      collectedInfo.symptomes?.includes('obstruction')
    );
  },

  handler: async (state: GuidanceState, userResponse?: string): Promise<{instruction: string; state: GuidanceState}> => {
    if (!state.protocolActif) {
      state = {
        protocolActif: 'Heimlich',
        etapeActuelle: 0,
        debutTimestamp: Date.now(),
        verificationExecution: false,
        feedbackDonne: []
      };
    }

    const etapes = ETAPES_HEIMLICH;
    let etape = state.etapeActuelle;

    if (userResponse) {
      const lowerResponse = userResponse.toLowerCase();
      if (lowerResponse.includes('oui') || lowerResponse.includes('ok') || lowerResponse.includes('fait')) {
        etape++;
      }
    }

    if (etape >= etapes.length) {
      etape = etapes.length - 1;
    }

    state.etapeActuelle = etape;

    return {
      instruction: etapes[etape],
      state
    };
  },

  examples: []
};

/**
 * Action de guidance hémostase
 */
export const guidanceHemostaseAction = {
  name: 'GUIDANCE_HEMOSTASE',
  description: 'Guide téléphonique pour hémorragie externe',

  validate: async (collectedInfo: any): Promise<boolean> => {
    return (
      collectedInfo.symptomes?.includes('hémorragie') ||
      collectedInfo.symptomes?.includes('saignement')
    );
  },

  handler: async (state: GuidanceState, userResponse?: string): Promise<{instruction: string; state: GuidanceState}> => {
    if (!state.protocolActif) {
      state = {
        protocolActif: 'Hemostase',
        etapeActuelle: 0,
        debutTimestamp: Date.now(),
        verificationExecution: false,
        feedbackDonne: []
      };
    }

    const etapes = ETAPES_HEMOSTASE;
    let etape = state.etapeActuelle;

    if (userResponse) {
      const lowerResponse = userResponse.toLowerCase();
      if (lowerResponse.includes('oui') || lowerResponse.includes('ok') || lowerResponse.includes('fait')) {
        etape++;
      }
    }

    if (etape >= etapes.length) {
      etape = etapes.length - 1;
    }

    state.etapeActuelle = etape;

    return {
      instruction: etapes[etape],
      state
    };
  },

  examples: []
};
