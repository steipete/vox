export function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function twimlForStream(wsUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(wsUrl)}" />
  </Connect>
</Response>`;
}

export function wsUrlFromPublicBase(publicBaseUrl: URL, pathname: string): string {
  const u = new URL(publicBaseUrl.toString());
  // Append pathname to whatever path the base already has, so a path-prefixed
  // reverse proxy (e.g. https://host/vox + /twilio) is not collapsed to /twilio.
  u.pathname = u.pathname.replace(/\/$/, "") + pathname;
  if (u.protocol === "https:") u.protocol = "wss:";
  else if (u.protocol === "http:") u.protocol = "ws:";
  return u.toString();
}
