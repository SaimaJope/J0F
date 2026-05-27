import { NextResponse } from "next/server";

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  topic?: string;
  message?: string;
  callback?: boolean;
};

export async function POST(request: Request) {
  let body: ContactPayload;
  try {
    body = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const message = body.message?.trim();
  const email = body.email?.trim();
  const phone = body.phone?.trim();

  if (!name || !message || (!email && !phone)) {
    return NextResponse.json(
      { error: "Nimi, viesti ja sähköposti tai puhelin vaaditaan." },
      { status: 400 }
    );
  }

  // TODO: integrate email delivery (Resend / SMTP) to info@jobfuture.fi
  console.log("[contact]", {
    name,
    email,
    phone,
    topic: body.topic,
    callback: body.callback,
    message
  });

  return NextResponse.json({ ok: true });
}
