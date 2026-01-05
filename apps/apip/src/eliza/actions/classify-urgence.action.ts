/**
 * Classify Urgence Action
 * Classification P0/P1/P2/P3 selon protocoles SAMU français
 */

export interface ClassificationResult {
  classification: 'P0' | 'P1' | 'P2' | 'P3';
  scoreGravite: number; // 0-100
  criteresDetectes: string[];
  recommandationMoyens: 'SMUR+VSAV' | 'SMUR' | 'VSAV' | 'Ambulance' | 'Conseil';
  delaiMaxMinutes: number;
  confiance: number; // 0-1
  escaladeMedecin: boolean; // true si confiance < 0.8
}

/**
 * Critères de classification
 */
const CRITERES_P0 = {
  keywords: [
    'arrêt cardiaque', 'ne respire', 'inconscient', 'hémorragie massive',
    'convulsions', 'cyanose', 'bleu', 'glasgow', 'détresse respiratoire'
  ],
  conditions: {
    arretCardiaque: (data: any) =>
      data.etat_conscience === 'inconscient' && data.respiration === false,
    hemorragieMassive: (data: any) =>
      data.symptomes?.includes('hémorragie') && data.gravite === 'massive',
    detresseRespiratoire: (data: any) =>
      data.symptomes?.includes('dyspnée') || data.symptomes?.includes('asphyxie')
  }
};

const CRITERES_P1 = {
  keywords: [
    'douleur thoracique', 'avc', 'traumatisme', 'intoxication',
    'dyspnée', 'hémorragie', 'malaise'
  ],
  conditions: {
    douleurThoraciqueRecente: (data: any) =>
      data.symptomes?.includes('douleur thoracique') && data.duree_heures < 12,
    avcSuspecte: (data: any) =>
      data.symptomes?.some((s: string) =>
        s.includes('paralysie') || s.includes('parole') || s.includes('visage')
      ),
    traumatismeGrave: (data: any) =>
      data.symptomes?.includes('traumatisme') && (
        data.circonstances?.includes('AVP') ||
        data.chute_metres > 3
      )
  }
};

/**
 * Action de classification
 */
export const classifyUrgenceAction = {
  name: 'CLASSIFY_URGENCE',
  description: 'Classification P0/P1/P2/P3 selon protocoles SAMU',

  validate: async (collectedInfo: any): Promise<boolean> => {
    // Vérifier qu'on a assez d'infos pour classifier
    return !!(collectedInfo.symptomes || collectedInfo.motif || collectedInfo.etat_conscience);
  },

  handler: async (collectedInfo: any): Promise<ClassificationResult> => {
    const criteresDetectes: string[] = [];
    let classification: 'P0' | 'P1' | 'P2' | 'P3' = 'P3';
    let scoreGravite = 0;
    let confiance = 1.0;

    // === DÉTECTION P0 ===
    if (collectedInfo.urgence_vitale || collectedInfo.classification_preliminaire === 'P0') {
      classification = 'P0';
      scoreGravite = 95;
      criteresDetectes.push('Urgence vitale détectée automatiquement');
    } else if (CRITERES_P0.conditions.arretCardiaque(collectedInfo)) {
      classification = 'P0';
      scoreGravite = 100;
      criteresDetectes.push('Arrêt cardiaque (inconscient + pas de respiration)');
    } else if (collectedInfo.etat_conscience === 'inconscient' && !collectedInfo.respiration) {
      classification = 'P0';
      scoreGravite = 100;
      criteresDetectes.push('Inconscience + absence respiration');
    } else if (collectedInfo.convulsions === true) {
      classification = 'P0';
      scoreGravite = 90;
      criteresDetectes.push('Convulsions en cours');
    } else if (CRITERES_P0.conditions.hemorragieMassive(collectedInfo)) {
      classification = 'P0';
      scoreGravite = 95;
      criteresDetectes.push('Hémorragie massive non contrôlée');
    }

    // === DÉTECTION P1 ===
    else if (CRITERES_P1.conditions.douleurThoraciqueRecente(collectedInfo)) {
      classification = 'P1';
      scoreGravite = 80;
      criteresDetectes.push('Douleur thoracique < 12h');

      // Si signes de choc → P0
      if (collectedInfo.signes_choc === true ||
          collectedInfo.symptomes?.some((s: string) => s.includes('pâle') || s.includes('sueurs'))) {
        classification = 'P0';
        scoreGravite = 95;
        criteresDetectes.push('+ Signes de choc');
      }
    } else if (CRITERES_P1.conditions.avcSuspecte(collectedInfo)) {
      classification = 'P1';
      scoreGravite = 85;
      criteresDetectes.push('Suspicion AVC (FAST positif)');
    } else if (CRITERES_P1.conditions.traumatismeGrave(collectedInfo)) {
      classification = 'P1';
      scoreGravite = 75;
      criteresDetectes.push('Traumatisme grave');
    }

    // === DÉTECTION P2 ===
    else if (collectedInfo.symptomes?.includes('douleur abdominale')) {
      classification = 'P2';
      scoreGravite = 60;
      criteresDetectes.push('Douleur abdominale aiguë');
    } else if (collectedInfo.fievre && (collectedInfo.age < 1 || collectedInfo.age > 75)) {
      classification = 'P2';
      scoreGravite = 55;
      criteresDetectes.push('Fièvre chez personne vulnérable');
    }

    // === P3 par défaut ===
    else {
      classification = 'P3';
      scoreGravite = 30;
      criteresDetectes.push('Pas de critère urgence vitale détecté');
      confiance = 0.6; // Basse confiance → escalade médecin
    }

    // Ajuster confiance selon complétude des informations
    if (!collectedInfo.adresse) {
      confiance -= 0.1;
    }
    if (!collectedInfo.etat_conscience && collectedInfo.lien_patient === 'témoin') {
      confiance -= 0.15;
    }

    // Recommandation moyens
    let recommandationMoyens: ClassificationResult['recommandationMoyens'];
    let delaiMaxMinutes: number;

    switch (classification) {
      case 'P0':
        recommandationMoyens = 'SMUR+VSAV';
        delaiMaxMinutes = 0;
        break;
      case 'P1':
        recommandationMoyens = 'SMUR';
        delaiMaxMinutes = 20;
        break;
      case 'P2':
        recommandationMoyens = 'Ambulance';
        delaiMaxMinutes = 60;
        break;
      default:
        recommandationMoyens = 'Conseil';
        delaiMaxMinutes = 999;
    }

    return {
      classification,
      scoreGravite,
      criteresDetectes,
      recommandationMoyens,
      delaiMaxMinutes,
      confiance: Math.max(0, Math.min(1, confiance)),
      escaladeMedecin: confiance < 0.8 || classification === 'P0' || classification === 'P1'
    };
  },

  examples: [
    {
      input: {
        urgence_vitale: true,
        etat_conscience: 'inconscient',
        respiration: false,
        age: 65
      },
      output: {
        classification: 'P0',
        scoreGravite: 100,
        criteresDetectes: ['Arrêt cardiaque (inconscient + pas de respiration)'],
        recommandationMoyens: 'SMUR+VSAV',
        delaiMaxMinutes: 0,
        confiance: 1.0,
        escaladeMedecin: true
      }
    },
    {
      input: {
        symptomes: ['douleur thoracique', 'pâle', 'sueurs'],
        duree_heures: 1,
        age: 58
      },
      output: {
        classification: 'P0',
        scoreGravite: 95,
        criteresDetectes: ['Douleur thoracique < 12h', '+ Signes de choc'],
        recommandationMoyens: 'SMUR+VSAV',
        delaiMaxMinutes: 0,
        confiance: 0.95,
        escaladeMedecin: true
      }
    }
  ]
};
