import { EmailSettings } from "@/components/staff/email-settings";
import { requireStaff } from "@/lib/auth/staff";
import { getEmailSettings } from "@/lib/gmail/server";

export const metadata = { title: "Email settings" };
export const runtime = "nodejs";

const notices: Record<string, { ok: boolean; message: string }> = {
  connected: { ok: true, message: "Gmail sender connected. Send a test email to check the connection." },
  cancelled: { ok: false, message: "Connection cancelled. The existing sender has not changed." },
  expired: { ok: false, message: "Your connection attempt expired. Please start again." },
  changed: { ok: false, message: "Another staff member changed the sender while you were connecting. Review the current sender before trying again." },
  permission_missing: { ok: false, message: "Google did not grant background email sending. Connect again and allow Gmail sending permission." },
  wrong_account: { ok: false, message: "Choose a verified ALX Google account to connect the sender." },
  wrong_sender: { ok: false, message: "Reconnect using the current sender's Google account. To choose a different mailbox, use Change sender." },
  connect_failed: { ok: false, message: "The sender could not be connected. Check the Gmail client settings and registered callback URL, then try again." },
};

export default async function EmailSettingsPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const { user } = await requireStaff();
  const [settings, params] = await Promise.all([getEmailSettings(), searchParams]);
  const notice = params.result && Object.hasOwn(notices, params.result) ? notices[params.result] : undefined;
  return (
    <main className="staff-page email-settings-page">
      <div className="staff-page__heading">
        <div>
          <p className="staff-kicker">Workspace settings</p>
          <h1>Email</h1>
          <p>Connect the team&apos;s sender mailbox and check that emails go through.</p>
        </div>
      </div>
      <EmailSettings {...settings} staffEmail={user.email ?? ""} notice={notice} />
    </main>
  );
}
