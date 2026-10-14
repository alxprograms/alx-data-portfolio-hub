"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { connectGmailAction, disconnectGmailAction, sendGmailTestAction } from "@/app/actions/gmail";
import type { GmailActionResult, GmailConnection, GmailEvent } from "@/types/gmail";

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not yet";
}

function ConnectButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button className="staff-primary-action" disabled={disabled || pending} type="submit">{pending ? "Opening Google…" : label}<span aria-hidden="true">↗</span></button>;
}

function eventText(event: GmailEvent) {
  if (event.action === "test") return `Test to ${event.recipient_email}: ${event.result === "pending" ? "Awaiting confirmation" : event.result === "unknown" ? "Confirmation unavailable" : event.result}`;
  if (event.action === "disconnected") return `Disconnected ${event.previous_sender_email}`;
  if (event.action === "replaced") return `Changed sender from ${event.previous_sender_email} to ${event.sender_email}`;
  return `Connected ${event.sender_email}`;
}

export function EmailSettings({ connection, events, problem, staffEmail, notice }: {
  connection: GmailConnection | null; events: GmailEvent[]; problem: string | null; staffEmail: string;
  notice?: { ok: boolean; message: string };
}) {
  const router = useRouter();
  const [mode, setMode] = useState("me");
  const [recipient, setRecipient] = useState("");
  const [confirmation, setConfirmation] = useState<"change" | "disconnect" | null>(null);
  const [result, setResult] = useState<GmailActionResult | null>(notice ?? null);
  const [pending, startTransition] = useTransition();
  const connected = connection?.status === "connected";
  const hasSender = Boolean(connection?.sender_email);
  const status = problem ? "Setup needed" : connected ? "Connected" : connection?.status === "needs_reconnection" ? "Reconnect needed" : "Not connected";

  function sendTest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connection) return;
    setResult(null);
    startTransition(async () => {
      try { setResult(await sendGmailTestAction({ mode, recipient, version: connection.version })); }
      catch { setResult({ ok: false, message: "The request could not be completed. Refresh the page and check the test history before trying again." }); }
      router.refresh();
    });
  }

  function disconnect() {
    if (!connection) return;
    startTransition(async () => {
      try {
        const response = await disconnectGmailAction(connection.version);
        setResult(response);
        if (response.ok) setConfirmation(null);
      } catch { setResult({ ok: false, message: "The sender could not be disconnected. Please try again." }); }
      router.refresh();
    });
  }

  return (
    <div className="email-settings">
      {problem && <p className="email-notice" role="status">{problem}</p>}
      {result && <div className={`email-notice ${result.ok ? "email-notice--success" : "email-notice--error"}`} role={result.ok ? "status" : "alert"}>
        <p>{result.message}</p>{result.messageId && <small>Gmail message ID: {result.messageId}</small>}
      </div>}

      <section className="email-section" aria-labelledby="sender-heading">
        <div className="email-section__heading"><h2 id="sender-heading">Sender mailbox</h2><span className={`email-status ${connected ? "email-status--connected" : ""}`}>{status}</span></div>
        <p className="email-sender">{connection?.sender_email ?? "Connect a Gmail mailbox"}</p>
        <p className="email-description">{hasSender ? "This mailbox is shared by the workspace." : "Choose the ALX Google mailbox the team will use to send email."}</p>
        {hasSender && <dl className="email-facts">
          <div><dt>Connected by</dt><dd>{connection?.connected_by_email}</dd></div>
          <div><dt>Connected on</dt><dd>{date(connection?.connected_at ?? null)}</dd></div>
          <div><dt>Last successful send</dt><dd>{date(connection?.last_successful_send_at ?? null)}</dd></div>
        </dl>}
        {connection?.status === "needs_reconnection" && <p className="email-notice email-notice--error">Google authorization needs attention. Reconnect the mailbox before sending another test.</p>}

        <div className="email-actions">
          <form action={connectGmailAction}>
            <input type="hidden" name="version" value={connection?.version ?? ""} />
            <input type="hidden" name="intent" value={hasSender ? "reconnect" : "connect"} />
            <ConnectButton disabled={Boolean(problem) || pending} label={hasSender ? "Reconnect Gmail" : "Connect Gmail"} />
          </form>
          {hasSender && <>
            <button type="button" className="email-button" disabled={pending} onClick={() => setConfirmation(confirmation === "change" ? null : "change")}>Change sender</button>
            <button type="button" className="email-button email-button--quiet" disabled={pending} onClick={() => setConfirmation(confirmation === "disconnect" ? null : "disconnect")}>Disconnect</button>
          </>}
        </div>
        {confirmation && <div className="email-confirmation">
          <h3>{confirmation === "change" ? "Replace the shared sender?" : "Disconnect the sender?"}</h3>
          <p>{confirmation === "change" ? "The mailbox you select in Google will replace the current sender for the whole team." : "Email sending will stop for the whole team. The saved credential will be removed. You can connect a mailbox again at any time."}</p>
          <div className="email-actions">
            {confirmation === "change" ? <form action={connectGmailAction}><input type="hidden" name="version" value={connection?.version ?? ""} /><input type="hidden" name="intent" value="replace" /><ConnectButton disabled={pending} label="Choose new sender" /></form> : <button type="button" className="email-button" disabled={pending} onClick={disconnect}>{pending ? "Disconnecting…" : "Confirm disconnect"}</button>}
            <button type="button" className="email-button email-button--quiet" disabled={pending} onClick={() => setConfirmation(null)}>Cancel</button>
          </div>
        </div>}
      </section>

      <section className="email-section" aria-labelledby="test-heading">
        <h2 id="test-heading">Send a test email</h2>
        <p className="email-description">Check delivery to your inbox or another address, including outside ALX.</p>
        <form onSubmit={sendTest} className="email-test-form">
          <fieldset disabled={!connected || pending}>
            <legend className="sr-only">Test email recipient</legend>
            <label className={`email-recipient ${mode === "me" ? "is-selected" : ""}`}>
              <input type="radio" name="recipient-mode" value="me" checked={mode === "me"} onChange={() => setMode("me")} />
              <span><strong>Send to me</strong><small>{staffEmail}</small></span>
            </label>
            <label className={`email-recipient ${mode === "other" ? "is-selected" : ""}`}>
              <input type="radio" name="recipient-mode" value="other" checked={mode === "other"} onChange={() => setMode("other")} />
              <span><strong>Send to another address</strong><small>Use any email address to check delivery.</small></span>
            </label>
            {mode === "other" && <div className="email-recipient-input"><label htmlFor="test-recipient">Recipient email</label><input id="test-recipient" type="email" autoComplete="email" required maxLength={254} value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="name@example.com" /></div>}
          </fieldset>
          <button type="submit" className="staff-primary-action" disabled={!connected || pending}>{pending ? "Sending…" : "Send test email"}<span aria-hidden="true">→</span></button>
          {!connected && <p className="email-description">Connect the sender mailbox to send a test.</p>}
        </form>
        {connection?.last_test_at && <div className="email-last-test">
          <strong>Last test: {connection.last_test_status === "sent" ? "Sent" : connection.last_test_status === "failed" ? "Failed" : connection.last_test_status === "unknown" ? "Confirmation unavailable" : "Awaiting confirmation"}</strong>
          <p>{connection.last_test_recipient} · {date(connection.last_test_at)}</p>
          {connection.last_test_message_id && <small>Gmail message ID: {connection.last_test_message_id}</small>}
          {connection.last_safe_error && <p>{connection.last_safe_error}</p>}
        </div>}
      </section>

      <section className="email-section" aria-labelledby="history-heading">
        <h2 id="history-heading">Recent activity</h2>
        {events.length === 0 ? <p className="email-description">Connections and test results will appear here.</p> : <ol className="email-history">{events.map((event) => <li key={event.id}>
          <div><strong>{eventText(event)}</strong><p>{event.performed_by_email}</p>{event.safe_error && <p>{event.safe_error}</p>}</div>
          <time dateTime={event.created_at}>{date(event.created_at)}</time>
        </li>)}</ol>}
      </section>
    </div>
  );
}
