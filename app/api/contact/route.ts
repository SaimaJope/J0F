import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  topic?: string;
  message?: string;
  callback?: boolean;
};

const contactRecipient = process.env.CONTACT_TO_EMAIL?.trim() || "info@jobfuture.fi";
const resendApiKey = process.env.RESEND_API_KEY?.trim();
const contactSender = process.env.CONTACT_FROM_EMAIL?.trim();

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
  const topic = body.topic?.trim() || "Ei valittu";

  if (!name || !message || (!email && !phone)) {
    return NextResponse.json(
      { error: "Nimi, viesti ja sähköposti tai puhelin vaaditaan." },
      { status: 400 }
    );
  }

  if (!resendApiKey || !contactSender) {
    console.error("[contact] Email delivery is not configured.", {
      hasResendApiKey: Boolean(resendApiKey),
      hasContactSender: Boolean(contactSender),
      contactRecipient
    });

    return NextResponse.json(
      { error: "Viestin lähetys ei ole vielä käytössä." },
      { status: 503 }
    );
  }

  const callbackText = body.callback ? "Kyllä" : "Ei";
  const submittedAt = new Date().toLocaleString("fi-FI", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Helsinki"
  });

  const text = [
    "Uusi yhteydenotto Job Future-sivustolta",
    "",
    `Nimi: ${name}`,
    `Sähköposti: ${email || "-"}`,
    `Puhelin: ${phone || "-"}`,
    `Aihe: ${topic}`,
    `Soittopyyntö: ${callbackText}`,
    `Aika: ${submittedAt}`,
    "",
    "Viesti:",
    message
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "Job Future contact form"
    },
    body: JSON.stringify({
      from: contactSender,
      to: [contactRecipient],
      reply_to: email || undefined,
      subject: `Uusi yhteydenotto: ${topic}`,
      text,
      html: buildContactEmailHtml({
        name,
        email,
        phone,
        topic,
        callbackText,
        submittedAt,
        message
      })
    })
  });

  if (!response.ok) {
    console.error("[contact] Email delivery failed.", {
      status: response.status,
      body: await response.text()
    });

    return NextResponse.json(
      {
        error:
          "Sähköpostipalvelu hylkäsi lähetyksen. Tarkista Resend API-avain ja lähettävä domain."
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}

function buildContactEmailHtml({
  name,
  email,
  phone,
  topic,
  callbackText,
  submittedAt,
  message
}: {
  name: string;
  email?: string;
  phone?: string;
  topic: string;
  callbackText: string;
  submittedAt: string;
  message: string;
}) {
  const rows = [
    ["Nimi", name],
    ["Sähköposti", email || "-"],
    ["Puhelin", phone || "-"],
    ["Aihe", topic],
    ["Soittopyyntö", callbackText],
    ["Aika", submittedAt]
  ];

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#101517">
      <h1 style="font-size:20px;margin:0 0 18px">Uusi yhteydenotto Job Future-sivustolta</h1>
      <table style="border-collapse:collapse;margin-bottom:22px">
        <tbody>
          ${rows
            .map(
              ([label, value]) => `
                <tr>
                  <th style="text-align:left;padding:6px 18px 6px 0;color:#176f7d">${escapeHtml(label)}</th>
                  <td style="padding:6px 0">${escapeHtml(value)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
      <h2 style="font-size:15px;margin:0 0 8px">Viesti</h2>
      <div style="white-space:pre-wrap;border-left:3px solid #176f7d;padding-left:14px">
        ${escapeHtml(message)}
      </div>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
