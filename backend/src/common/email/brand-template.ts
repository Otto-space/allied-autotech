export function escapeEmailHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
export type BrandEmail = {
  title: string;
  message: string;
  eyebrow?: string;
  action?: { label: string; url: string };
  note?: string;
};
export function renderBrandEmail(input: BrandEmail) {
  if (input.action) {
    const url = new URL(input.action.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
      throw new Error("Invalid email action URL");
  }
  const e = escapeEmailHtml;
  const paragraphs = input.message
    .split(/\n\n+/)
    .map(
      (p) =>
        `<p style="margin:0 0 20px;line-height:1.7;color:#34464e">${e(p).replaceAll("\n", "<br>")}</p>`,
    )
    .join("");
  const action = input.action
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0"><tr><td bgcolor="#d91521" style="border-radius:6px"><a href="${e(input.action.url)}" style="display:inline-block;padding:15px 24px;color:#ffffff;font-weight:700;text-decoration:none;line-height:1.5">${e(input.action.label)}</a></td></tr></table><p style="font-size:12px;line-height:1.6;color:#53666f;overflow-wrap:anywhere;word-break:break-word">If the button does not open, copy this link into your browser:<br><a style="color:#9f1520" href="${e(input.action.url)}">${e(input.action.url)}</a></p>`
    : "";
  return {
    subject: input.title,
    text: `${input.title}\n\n${input.message}${input.action ? `\n\n${input.action.label}: ${input.action.url}` : ""}${input.note ? `\n\n${input.note}` : ""}\n\nAllied AutoTech\nBuilt on trust driven by quality\n133 Stadium Road, beside Kilimanjaro Pizza Jungle Restaurant, Port Harcourt, Rivers State, Nigeria.\nhttps://alliedautotech.com`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(input.title)}</title></head><body style="margin:0;padding:0;background:#f1f4f5;font-family:Arial,Helvetica,sans-serif;font-size:16px"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(input.message.slice(0, 140))}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f1f4f5"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border-top:4px solid #ed1c24"><tr><td style="padding:28px 28px 20px"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td width="48"><img src="https://alliedautotech.com/brand/allied-mark-red.png" width="40" height="35" alt="" style="display:block;border:0"></td><td style="color:#06181f;font-size:25px;font-weight:800;letter-spacing:-1px">Allied<span style="display:block;font-size:10px;letter-spacing:4px;font-weight:400;margin-top:3px">AUTOTECH</span></td></tr></table></td></tr><tr><td style="padding:12px 28px 28px"><p style="color:#a71520;font-size:11px;letter-spacing:2px;font-weight:700;margin:0 0 14px;text-transform:uppercase">${e(input.eyebrow ?? "Allied AutoTech · Account update")}</p><h1 style="font-size:26px;line-height:1.3;letter-spacing:-0.5px;margin:0 0 24px;color:#06181f">${e(input.title)}</h1>${paragraphs}${action}${input.note ? `<p style="padding:16px;background:#f4f6f7;border-left:3px solid #ed1c24;font-size:13px;line-height:1.7;color:#435760">${e(input.note)}</p>` : ""}</td></tr><tr><td bgcolor="#06181f" style="padding:24px 28px;color:#fff"><p style="margin:0;font-size:16px;font-weight:bold">Built on trust driven by quality</p><p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#c6d3d8">Professional care for every mile ahead.</p></td></tr></table><table role="presentation" width="600" style="width:100%;max-width:600px"><tr><td style="padding:20px 12px;text-align:center;color:#53666f;font-size:12px;line-height:1.7">Allied AutoTech<br>133 Stadium Road, beside Kilimanjaro Pizza Jungle Restaurant,<br>Port Harcourt, Rivers State, Nigeria.<br><a href="https://alliedautotech.com/help" style="color:#435760">Help centre</a> &nbsp;·&nbsp; <a href="https://alliedautotech.com/privacy" style="color:#435760">Privacy</a></td></tr></table></td></tr></table></body></html>`,
  };
}
