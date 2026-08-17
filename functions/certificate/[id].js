// Cloudflare Pages Function: intercepts /certificate/:id specifically to
// inject per-record Open Graph / Twitter Card tags into the SPA shell
// before it's served, so sharing a certificate link on LinkedIn/Twitter/etc.
// shows that person's actual name and role instead of the generic
// site-wide preview (index.html has no way to do this on its own -- it's a
// plain client-rendered SPA, no server rendering).
//
// The human-facing behavior is unchanged: this still returns the same SPA
// shell, which still hydrates into the normal React app and fetches the
// same client-side data. Only the <head> tags differ, and only for social
// media crawlers (and anyone viewing page source) that read them before JS
// ever runs.
export async function onRequestGet(context) {
  const { params, request, env } = context;
  const url = new URL(request.url);
  const id = String(params.id || "").trim();

  let record = null;
  try {
    const dataRes = await env.ASSETS.fetch(new URL("/data/certificates.json", url));
    if (dataRes.ok) {
      const records = await dataRes.json();
      const q = id.toLowerCase();
      record = records.find((r) => r.certificate_id.toLowerCase() === q) || null;
    }
  } catch {
    record = null;
  }

  const shellRes = await env.ASSETS.fetch(new URL("/index.html", url));
  if (!record || !shellRes.ok) return shellRes;

  const title = `${record.display_name} - ${record.role}, ${record.journal}`;
  const description = `Panorama Scholarly Group credential ${record.certificate_id}. Verify its status and download it at this link.`;
  const pageUrl = url.toString();

  class SetContent {
    element(element) {
      element.setInnerContent(title);
    }
  }
  class SetAttr {
    constructor(attr, value) {
      this.attr = attr;
      this.value = value;
    }
    element(element) {
      element.setAttribute(this.attr, this.value);
    }
  }

  return new HTMLRewriter()
    .on("title", new SetContent())
    .on('meta[name="description"]', new SetAttr("content", description))
    .on('meta[property="og:title"]', new SetAttr("content", title))
    .on('meta[property="og:description"]', new SetAttr("content", description))
    .on('meta[property="og:url"]', new SetAttr("content", pageUrl))
    .on('meta[name="twitter:title"]', new SetAttr("content", title))
    .on('meta[name="twitter:description"]', new SetAttr("content", description))
    .transform(shellRes);
}
