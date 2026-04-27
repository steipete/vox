export async function dialTwilioCall(opts: {
  to: string;
  from: string;
  url: string;
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
}): Promise<{ sid: string; status: string; to: string; from: string }> {
  if (!opts.twilioAccountSid || !opts.twilioAuthToken) {
    throw new Error("Missing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN");
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(opts.twilioAccountSid)}/Calls.json`;
  const body = new URLSearchParams({
    To: opts.to,
    From: opts.from,
    Url: opts.url,
  });

  const auth = Buffer.from(`${opts.twilioAccountSid}:${opts.twilioAuthToken}`).toString("base64");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    throw new Error(`Twilio ${res.status}: ${JSON.stringify(json)}`);
  }

  const record = (json ?? {}) as Record<string, unknown>;
  const getString = (key: string) => {
    const v = record[key];
    if (typeof v !== "string") throw new Error(`Twilio response missing string ${key}`);
    return v;
  };

  return {
    sid: getString("sid"),
    status: getString("status"),
    to: getString("to"),
    from: getString("from"),
  };
}
