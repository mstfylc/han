// HAN — getting a message to a person.
//
// The password-reset code is deliberately never returned over the wire in
// production: without a delivery channel, handing it to whoever asked would
// mean anyone who knows a phone number can take the account.
//
// That was correct and also a dead end — a real deployment could not create its
// second user, because nobody could ever receive their code. This is the seam
// that finishes the flow: one interface, a driver chosen by configuration, and
// a default that is honest about doing nothing useful.
//
// Adding a provider means writing one function and setting HAN_NOTIFY. No
// screen and no endpoint changes, which is the whole point of putting it here
// rather than inline in the auth route.

export interface Message {
  /** E.164-ish; digits only is fine, the driver formats for its provider */
  to: string;
  /** what this is, so a driver can pick a template or a sender id */
  kind: "reset-code";
  text: string;
}

export interface Notifier {
  name: string;
  /** Resolves when handed off. Never throws: a delivery failure must not turn
   *  into a 500 that tells the caller whether the number exists. */
  send(msg: Message): Promise<{ ok: boolean; detail?: string }>;
}

/**
 * The default. It writes to the server log and says plainly that nothing was
 * delivered.
 *
 * This is the honest shape for "no provider configured": the operator running
 * the deployment can read the code out of their own logs to get started, and
 * the log line tells them why they had to. What it must NOT do is quietly
 * succeed, because then a missing provider looks like a working one.
 */
const logNotifier: Notifier = {
  name: "log",
  async send(msg) {
    console.warn(
      `[notify] NO PROVIDER CONFIGURED — not delivered to ${mask(msg.to)}.\n` +
      `[notify] ${msg.kind}: ${msg.text}\n` +
      `[notify] Set HAN_NOTIFY=webhook and HAN_NOTIFY_URL to deliver for real.`,
    );
    return { ok: false, detail: "no provider configured" };
  },
};

/**
 * Hand the message to an HTTP endpoint and let that side own the provider.
 *
 * Deliberately generic rather than a specific SMS vendor: every Turkish
 * operator, and every aggregator, has its own payload, and baking one in would
 * be a guess about a decision that has not been made. A webhook can be pointed
 * at whatever gets chosen — including a queue — without touching this code.
 */
function webhookNotifier(url: string, secret?: string): Notifier {
  return {
    name: "webhook",
    async send(msg) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(secret ? { authorization: "Bearer " + secret } : {}),
          },
          body: JSON.stringify(msg),
          // A slow provider must not hold the sign-in request open.
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return { ok: false, detail: "provider returned " + res.status };
        return { ok: true };
      } catch (e) {
        // Logged, not thrown: the caller answers the same way either way, so a
        // provider outage cannot be used to probe which numbers are registered.
        console.error("[notify] delivery failed:", (e as Error).message);
        return { ok: false, detail: "delivery failed" };
      }
    },
  };
}

let cached: Notifier | null = null;

export function notifier(): Notifier {
  if (cached) return cached;
  const kind = (process.env.HAN_NOTIFY || "log").toLowerCase();
  if (kind === "webhook") {
    const url = process.env.HAN_NOTIFY_URL;
    if (!url) {
      console.error("[notify] HAN_NOTIFY=webhook but HAN_NOTIFY_URL is not set — falling back to the log driver.");
      cached = logNotifier;
      return cached;
    }
    cached = webhookNotifier(url, process.env.HAN_NOTIFY_SECRET);
    return cached;
  }
  cached = logNotifier;
  return cached;
}

/** Never log a full number: the log is the one place a code and a number would
 *  otherwise sit side by side. */
function mask(tel: string): string {
  const t = String(tel || "").replace(/\D/g, "");
  return t.length < 6 ? "•••" : t.slice(0, 3) + "•••" + t.slice(-2);
}

/** Whether a real channel is configured. The sign-in screen uses this to say
 *  something true about what just happened. */
export function canDeliver(): boolean {
  return notifier().name !== "log";
}
