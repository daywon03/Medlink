/**
 * Collect Info Action
 * Collecte structurée des informations critiques lors du triage
 */

export interface ActionResult {
  success: boolean;
  data?: any;
  message?: string;
}

export interface CollectInfoAction {
  name: string;
  description: string;
  validate: (userMessage: string, context: any) => Promise<boolean>;
  handler: (userMessage: string, context: any) => Promise<ActionResult>;
  examples: Array<{
    input: string;
    output: ActionResult;
  }>;
}

/**
 * Détection d'urgence vitale P0
 */
const P0_KEYWORDS = [
  'ne respire plus',
  'pas de respiration',
  'inconscient',
  'ne bouge plus',
  'ne répond plus',
  'hémorragie massive',
  'sang partout',
  'arrêt cardiaque',
  'bleu',
  'cy anos',
  'violet',
  'convulsions',
];

const detectP0 = (message: string): boolean => {
  const lowerMessage = message.toLowerCase();
  return P0_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
};

/**
 * Extraction d'adresse (FR)
 */
const STOP_WORDS = /\b(?:j['’]ai|je\s+suis|j['’]habite|il\s+|elle\s+|on\s+|nous\s+|vous\s+|c['’]est|oui|non|accident|douleur|fracture|saigne|malaise|chute)\b/i;
const ADDRESS_REGEX =
  /\b(\d{1,4}\s?(?:bis|ter|quater)?\s+(?:rue|avenue|av\.?|boulevard|bd\.?|place|pl\.?|chemin|impasse|all[ée]e|route|rte\.?|quai|cours|passage|square|voie)\s+[A-Za-zÀ-ÿ0-9'’\-\s]+?)(?:\s*,?\s*[A-Za-zÀ-ÿ-]+(?:\s+\d{1,2}(?:e|ème|er)?)?\s*(?:\d{5})?)?(?=(?:[.,;:!?]|\n|\b(?:j['’]ai|je|il|elle|on|nous|vous|c['’]est|oui|non|accident|douleur|fracture|saigne|malaise|chute)\b)|$)/i;

const normalizeAddress = (value: string): string => {
  let text = value.replace(/\s+/g, ' ').trim();
  text = text.replace(/[.,;:!?]+$/g, '').trim();
  const stopIndex = text.search(STOP_WORDS);
  if (stopIndex > 0) {
    text = text.slice(0, stopIndex).trim();
  }
  return text;
};

const extractAddress = (message: string): string | null => {
  const match = message.match(ADDRESS_REGEX);
  if (!match) return null;
  const addr = normalizeAddress(match[0]);
  return addr.length >= 8 ? addr : null;
};

/**
 * Extraction ville et code postal
 */
const extractLocation = (message: string): { ville?: string; codePostal?: string } | null => {
  const villePattern = /(Paris|Lyon|Marseille|Toulouse|Nice|Nantes|Montpellier|Strasbourg|Bordeaux|Lille)\s*(\d{1,2}(e|ème|er)?)?/i;
  const codePostalPattern = /\b\d{5}\b/;

  const villeMatch = message.match(villePattern);
  const codeMatch = message.match(codePostalPattern);

  if (!villeMatch && !codeMatch) return null;

  return {
    ville: villeMatch ? villeMatch[0] : undefined,
    codePostal: codeMatch ? codeMatch[0] : undefined
  };
};

const buildFullAddress = (
  adresse: string,
  ville?: string,
  codePostal?: string,
): string => {
  const normalized = adresse.replace(/\s+/g, ' ').trim();
  const hasPostal = /\b\d{5}\b/.test(normalized);
  const hasCity = ville ? new RegExp(`\\b${ville.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized) : false;

  const parts = [normalized];
  if (codePostal && !hasPostal) parts.push(codePostal);
  if (ville && !hasCity) parts.push(ville);

  return parts.join(', ').replace(/\s+,/g, ',').trim();
};

/**
 * Action de collecte d'informations
 */
export const collectInfoAction: CollectInfoAction = {
  name: 'COLLECT_INFO',
  description: 'Collecte et structure les informations critiques du triage',

  validate: async (userMessage: string, context: any): Promise<boolean> => {
    // Toujours actif pendant le triage
    return true;
  },

  handler: async (userMessage: string, context: any): Promise<ActionResult> => {
    const result: any = {
      success: true,
      data: {}
    };

    // Détection urgence vitale P0
    if (detectP0(userMessage)) {
      result.data.urgence_vitale = true;
      result.data.classification_preliminaire = 'P0';
      result.message = 'URGENCE VITALE DÉTECTÉE';
    }

    // Extraction localisation
    const location = extractLocation(userMessage);
    if (location) {
      result.data.ville = location.ville;
      result.data.code_postal = location.codePostal;
    }

    // Extraction adresse
    const adresse = extractAddress(userMessage);
    if (adresse) {
      const mergedVille = location?.ville ?? context?.ville;
      const mergedPostal = location?.codePostal ?? context?.code_postal;
      const fullAddress = buildFullAddress(adresse, mergedVille, mergedPostal);
      if (context?.adresse !== fullAddress) {
        result.data.adresse = fullAddress;
        result.data.adresse_confirmee = false;
        result.data.adresse_confirmation_sent = false;
      }
    } else if (context?.adresse && !context?.adresse_confirmee) {
      const confirmPattern = /\b(oui|exact|c['’]est\s*(?:bien|ça|ca)|correct|d['’]accord|ok)\b/i;
      if (confirmPattern.test(userMessage)) {
        result.data.adresse_confirmee = true;
      }
    }

    // Détection état de conscience (si mentionné)
    const conscienceKeywords = {
      conscient: ['conscient', 'éveillé', 'parle', 'répond'],
      inconscient: ['inconscient', 'ne répond pas', 'ne bouge plus', 'inerte'],
      confus: ['confus', 'désorienté', 'bizarre']
    };

    const lowerMessage = userMessage.toLowerCase();
    for (const [etat, keywords] of Object.entries(conscienceKeywords)) {
      if (keywords.some(kw => lowerMessage.includes(kw))) {
        result.data.etat_conscience = etat;
        break;
      }
    }

    // Extraction âge si mentionné
    const agePattern = /\b(\d{1,3})\s*(ans?|années?)\b/i;
    const ageMatch = userMessage.match(agePattern);
    if (ageMatch) {
      result.data.age = parseInt(ageMatch[1]);
    }

    return result;
  },

  examples: [
    {
      input: "Mon père ne respire plus, 25 rue Victor Hugo Paris 15ème",
      output: {
        success: true,
        message: 'URGENCE VITALE DÉTECTÉE',
        data: {
          urgence_vitale: true,
          classification_preliminaire: 'P0',
          adresse: '25 rue Victor Hugo',
          ville: 'Paris 15ème',
          etat_conscience: 'inconscient'
        }
      }
    },
    {
      input: "J'ai mal au pied, je suis au 10 avenue des Champs",
      output: {
        success: true,
        data: {
          adresse: '10 avenue des Champs',
          etat_conscience: 'conscient' // implicite (patient parle)
        }
      }
    }
  ]
};
