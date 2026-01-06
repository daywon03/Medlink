import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, message } = await req.json();

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { error: "phoneNumber et message requis" },
        { status: 400 }
      );
    }

    // Log l'SMS (pour développement)
    console.log(`📱 SMS -> ${phoneNumber}: ${message}`);

    // TODO: Intégrer votre service SMS (Twilio, AWS SNS, etc.)
    // Exemple Twilio:
    // const twilio = require('twilio');
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phoneNumber,
    // });

    return NextResponse.json(
      { success: true, message: "SMS envoyé" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur SMS:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du SMS" },
      { status: 500 }
    );
  }
}
