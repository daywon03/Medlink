// apps/api/src/triage/eliza.service.ts
import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch';

@Injectable()
export class ElizaService {
  async triageFromText(fullText: string) {
    const res = await fetch(process.env.ELIZA_TRIAGE_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: fullText,
        // on peut fournir un schema attendu si l'agent le supporte
      })
    });
    if (!res.ok) throw new Error("Eliza triage failed");
    return res.json(); // { triageLevel, keyFacts, questions, sources, confidence }
  }
}
