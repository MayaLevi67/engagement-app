import { Resend } from 'resend';

// Constructed lazily (not at module scope) because the Resend constructor
// throws synchronously when the API key is missing/empty (e.g. local dev
// without Resend configured). Callers (see requestPasswordReset) already
// swallow send failures to preserve the no-enumeration guarantee, but that
// only works if the throw happens inside the async call, not at import time.
function getResendClient(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: 'Reset your password',
    html: `<p>Reset your password by clicking <a href="${resetUrl}">here</a>. This link expires in 1 hour.</p>`,
  });
  if (error) {
    throw new Error(`Resend failed to send reset email: ${error.message}`);
  }
}
