import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    _resend = new Resend(key);
  }
  return _resend;
}

export async function sendTeamInviteEmail({
  toEmail,
  inviterName,
  orgName,
  role,
  token,
  appUrl,
}: {
  toEmail: string;
  inviterName: string;
  orgName: string;
  role: string;
  token: string;
  appUrl: string;
}) {
  const acceptUrl = `${appUrl}/accept-invite?token=${token}`;
  await getResend().emails.send({
    from: "onboarding@resend.dev",
    to: toEmail,
    subject: `You've been invited to join ${orgName} on Travel Lab`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 560px;
        margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
        <h1 style="font-size: 24px; font-weight: normal;
          margin-bottom: 8px;">
          You're invited to Travel Lab
        </h1>
        <p style="color: #555; margin-bottom: 24px;">
          ${inviterName} has invited you to join
          <strong>${orgName}</strong> as ${role === "advisor"
            ? "an advisor" : "an assistant"}.
        </p>
        <a href="${acceptUrl}"
          style="display: inline-block; background: #1a1a1a;
            color: #fff; padding: 12px 24px; text-decoration: none;
            border-radius: 6px; font-size: 14px;">
          Accept Invitation
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">
          This link expires in 7 days.
          If you didn't expect this invitation, you can ignore
          this email.
        </p>
      </div>
    `,
  });
}

export async function sendSelectionSubmittedEmail({
  toEmail,
  clientName,
  tripTitle,
  selections,
  submitted,
  pending,
}: {
  toEmail: string;
  clientName: string;
  tripTitle: string;
  selections: { segmentTitle: string; variantLabel: string; price?: string }[];
  submitted: number;
  pending: number;
}) {
  const selectionHtml = selections.map(s =>
    `<li style="margin-bottom: 8px;">
      <strong>${s.segmentTitle}</strong>: ${s.variantLabel}${s.price ? ` (${s.price})` : ""}
    </li>`
  ).join("");

  await getResend().emails.send({
    from: "onboarding@resend.dev",
    to: toEmail,
    subject: `${clientName} submitted their selections for ${tripTitle}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 560px;
        margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
        <h1 style="font-size: 24px; font-weight: normal;
          margin-bottom: 8px;">
          Client Selections Received
        </h1>
        <p style="color: #555; margin-bottom: 24px;">
          <strong>${clientName}</strong> has submitted their
          selections for <strong>${tripTitle}</strong>.
        </p>
        <ul style="color: #333; padding-left: 20px; margin-bottom: 24px;">
          ${selectionHtml}
        </ul>
        <p style="color: #999; font-size: 13px; border-top: 1px solid #eee; padding-top: 16px;">
          ${submitted} of ${submitted + pending} options selected.
          ${pending > 0 ? `${pending} option${pending > 1 ? "s" : ""} still pending.` : "All options selected."}
        </p>
      </div>
    `,
  });
}

export async function sendItineraryApprovedEmail({
  toEmail,
  clientName,
  tripTitle,
  versionLabel,
}: {
  toEmail: string;
  clientName: string;
  tripTitle: string;
  versionLabel: string;
}) {
  await getResend().emails.send({
    from: "onboarding@resend.dev",
    to: toEmail,
    subject: `${clientName} approved the itinerary for ${tripTitle}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 560px;
        margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
        <h1 style="font-size: 24px; font-weight: normal;
          margin-bottom: 8px;">
          Itinerary Approved
        </h1>
        <p style="color: #555; margin-bottom: 24px;">
          <strong>${clientName}</strong> has approved
          <strong>${versionLabel}</strong> of
          <strong>${tripTitle}</strong>.
        </p>
        <p style="color: #333; margin-bottom: 24px;">
          The trip status has been updated to <strong>Confirmed</strong>.
          You can now proceed with finalising bookings and arrangements.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;
          border-top: 1px solid #eee; padding-top: 16px;">
          Travel Lab · Itinerary Management
        </p>
      </div>
    `,
  });
}

export async function sendClientPortalInviteEmail({
  toEmail,
  clientName,
  advisorName,
  orgName,
  appUrl,
}: {
  toEmail: string;
  clientName: string;
  advisorName: string;
  orgName: string;
  appUrl: string;
}) {
  await getResend().emails.send({
    from: "onboarding@resend.dev",
    to: toEmail,
    subject: `Your travel itinerary from ${orgName}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 560px;
        margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
        <h1 style="font-size: 24px; font-weight: normal;
          margin-bottom: 8px;">
          Your travel portal is ready
        </h1>
        <p style="color: #555; margin-bottom: 24px;">
          ${advisorName} from ${orgName} has shared your
          travel itinerary with you, ${clientName}.
        </p>
        <a href="${appUrl}"
          style="display: inline-block; background: #1a1a1a;
            color: #fff; padding: 12px 24px; text-decoration: none;
            border-radius: 6px; font-size: 14px;">
          View My Itinerary
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">
          Shared by ${advisorName} · ${orgName}
        </p>
      </div>
    `,
  });
}
