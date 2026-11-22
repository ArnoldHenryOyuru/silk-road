import 'server-only'

export interface SendEmailResult {
  sent: boolean
  skipped?: boolean
  error?: string
}

export function getPublicAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || 'http://localhost:3000'
  return raw.replace(/\/+$/, '')
}

export async function sendTransactionalEmail({
  to,
  subject,
  text,
}: {
  to: string
  subject: string
  text: string
}): Promise<SendEmailResult> {
  const cleanTo = to.trim().toLowerCase()
  if (!cleanTo) {
    return { sent: false, skipped: true }
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.DELETION_EMAIL_FROM

  if (!apiKey || !from) {
    // Safe sandbox/demo fallback when Resend credentials are not configured
    return { sent: false, skipped: true }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: cleanTo,
        subject,
        text,
      }),
    })

    if (!res.ok) {
      return { sent: false, error: `Email service returned HTTP ${res.status}` }
    }
    return { sent: true }
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : 'Could not reach email service',
    }
  }
}

export async function sendOtpEmail(to: string, code: string): Promise<SendEmailResult> {
  return sendTransactionalEmail({
    to,
    subject: 'Your Silk Road verification code',
    text: [
      `Your 6-digit Silk Road verification code is: ${code}`,
      '',
      'Enter this code to verify your email and submit your profile or start a plan.',
      'This code expires in 15 minutes.',
    ].join('\n'),
  })
}

export async function sendMemberDecisionEmail({
  to,
  displayName,
  approved,
  rejectionReason,
}: {
  to: string
  displayName: string
  approved: boolean
  rejectionReason?: string | null
}): Promise<SendEmailResult> {
  const baseUrl = getPublicAppUrl()
  const greetingName = displayName.trim() || 'there'

  if (approved) {
    return sendTransactionalEmail({
      to,
      subject: 'Your Silk Road profile is approved',
      text: [
        `Hi ${greetingName},`,
        '',
        'Great news — your Silk Road profile has been approved.',
        'If your profile is set to Discoverable, other members can now find you, and any paused subscription time has been resumed automatically.',
        '',
        `Open Silk Road: ${baseUrl}/discover`,
      ].join('\n'),
    })
  }

  const reasonBlock = rejectionReason?.trim()
    ? `Reason shared by our review team:\n${rejectionReason.trim()}\n\n`
    : ''

  return sendTransactionalEmail({
    to,
    subject: 'Update needed on your Silk Road profile',
    text: [
      `Hi ${greetingName},`,
      '',
      'Your Silk Road profile was not approved in its current form, so your profile is paused from Discover and any active plan has been held to preserve your days.',
      '',
      reasonBlock +
        'You have 14 days to update your details and resubmit for review — or request a refund if you started a paid plan.',
      '',
      `Review & update your profile: ${baseUrl}/pending-review`,
    ].join('\n'),
  })
}

export async function sendDraftReminderEmail({
  to,
  displayName,
}: {
  to: string
  displayName: string
}): Promise<SendEmailResult> {
  const baseUrl = getPublicAppUrl()
  const greetingName = displayName.trim() || 'there'

  return sendTransactionalEmail({
    to,
    subject: 'Finish your Silk Road profile checklist',
    text: [
      `Hi ${greetingName},`,
      '',
      'Your Silk Road account is ready, and you only have a few quick checklist items left before your profile enters review.',
      'Once submitted, you can subscribe, unlock WhatsApp numbers, and get listed on Discover upon approval.',
      '',
      `Complete your profile: ${baseUrl}/onboarding/profile`,
    ].join('\n'),
  })
}

export async function sendRecoveryExpiredEmail({
  to,
  displayName,
  planType,
}: {
  to: string
  displayName: string
  planType: string
}): Promise<SendEmailResult> {
  const baseUrl = getPublicAppUrl()
  const greetingName = displayName.trim() || 'there'

  return sendTransactionalEmail({
    to,
    subject: 'Your 14-day Silk Road profile recovery window has closed',
    text: [
      `Hi ${greetingName},`,
      '',
      `Your 14-day recovery window after profile rejection has ended, so your paused ${planType} subscription has now expired.`,
      'You can still sign in to review your account details or update your profile anytime.',
      '',
      `Open Silk Road: ${baseUrl}/pending-review`,
    ].join('\n'),
  })
}
