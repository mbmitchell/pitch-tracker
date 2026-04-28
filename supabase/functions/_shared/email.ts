// @ts-nocheck

type SendPitcherInviteEmailParams = {
  coachName: string | null;
  expiresAt: string;
  inviteLink: string;
  pitcherName: string;
  to: string;
};

type EmailDeliveryResult = {
  message: string | null;
  mode: 'email' | 'dev';
};

function formatExpirationLabel(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function getEmailSecrets() {
  return {
    appUrl: Deno.env.get('INVITE_APP_URL') ?? null,
    fromAddress: Deno.env.get('INVITE_EMAIL_FROM') ?? null,
    resendApiKey: Deno.env.get('RESEND_API_KEY') ?? null,
  };
}

export async function sendPitcherInviteEmail({
  coachName,
  expiresAt,
  inviteLink,
  pitcherName,
  to,
}: SendPitcherInviteEmailParams): Promise<EmailDeliveryResult> {
  const secrets = getEmailSecrets();

  if (!secrets.appUrl || !secrets.fromAddress || !secrets.resendApiKey) {
    return {
      mode: 'dev',
      message:
        'Invite was created, but email sending is not configured. Set INVITE_APP_URL, INVITE_EMAIL_FROM, and RESEND_API_KEY in Supabase Edge Function secrets to send real emails.',
    };
  }

  const inviterCopy = coachName ? `${coachName} invited you` : 'A coach invited you';
  const expirationLabel = formatExpirationLabel(expiresAt);
  const subject = 'You were invited to Bullpen Planner';
  const text = `${inviterCopy} to access Bullpen Planner for ${pitcherName}. Finish account setup here: ${inviteLink}\n\nThis invite link expires on ${expirationLabel}.`;
  const html = `
    <p>${inviterCopy} to access <strong>Bullpen Planner</strong> for <strong>${pitcherName}</strong>.</p>
    <p><a href="${inviteLink}">Open your Bullpen Planner invite</a></p>
    <p>This invite link expires on ${expirationLabel}.</p>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secrets.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: secrets.fromAddress,
      html,
      subject,
      text,
      to: [to],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email provider request failed: ${errorText}`);
  }

  return {
    mode: 'email',
    message: `Invite email sent to ${to}.`,
  };
}
