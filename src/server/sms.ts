// HAN — the SMS seam.
//
// The last prototype notice in the product ("the code shows on screen") exists
// only because no SMS provider is connected. This module is the socket that
// notice plugs into: configure a provider through environment variables and
// reset codes stop appearing on screen and go out as texts instead — no code
// change, the auth flow asks `smsConfigured()` and behaves accordingly.
//
//   HAN_SMS_PROVIDER=netgsm   HAN_NETGSM_USER · HAN_NETGSM_PASS · HAN_NETGSM_HEADER
//   HAN_SMS_PROVIDER=twilio   HAN_TWILIO_SID · HAN_TWILIO_TOKEN · HAN_TWILIO_FROM
//
// Unset (or "none") keeps today's behaviour: the screen shows the code under a
// PROTOTİP label.

const provider = () => (process.env.HAN_SMS_PROVIDER || "none").toLowerCase();

export function smsConfigured(): boolean {
  const p = provider();
  if (p === "netgsm") return !!(process.env.HAN_NETGSM_USER && process.env.HAN_NETGSM_PASS);
  if (p === "twilio") return !!(process.env.HAN_TWILIO_SID && process.env.HAN_TWILIO_TOKEN && process.env.HAN_TWILIO_FROM);
  return false;
}

/** Returns true only when the provider accepted the message. Callers treat
 *  false as "tell the person to try again" — never as "fall back to showing
 *  the code", which would quietly undo the whole point of SMS delivery. */
export async function sendSms(tel: string, text: string): Promise<boolean> {
  const t = String(tel || "").replace(/\D/g, "");
  if (!t) return false;

  try {
    if (provider() === "netgsm") {
      const q = new URLSearchParams({
        usercode: process.env.HAN_NETGSM_USER || "",
        password: process.env.HAN_NETGSM_PASS || "",
        gsmno: t,
        message: text,
        msgheader: process.env.HAN_NETGSM_HEADER || "",
        dil: "TR",
      });
      const res = await fetch("https://api.netgsm.com.tr/sms/send/get?" + q.toString());
      const body = (await res.text()).trim();
      // Netgsm answers "00 <bulkid>" (or 01/02 variants) on success.
      return res.ok && /^0[012]/.test(body);
    }

    if (provider() === "twilio") {
      const sid = process.env.HAN_TWILIO_SID || "";
      const res = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json", {
        method: "POST",
        headers: {
          authorization: "Basic " + Buffer.from(sid + ":" + (process.env.HAN_TWILIO_TOKEN || "")).toString("base64"),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: "+9" + (t.startsWith("0") ? t.slice(1) : t.length === 10 ? "0" + t : t),
          From: process.env.HAN_TWILIO_FROM || "",
          Body: text,
        }),
      });
      return res.ok;
    }
  } catch {
    // network failure — the caller reports "could not send", nothing leaks
  }
  return false;
}
