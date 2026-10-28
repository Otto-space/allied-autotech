// Render the exact proposed non-catalogue notice without application providers or secrets.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");
const filename = path.join(root, "app/privacy/page.tsx");
const source = fs.readFileSync(filename, "utf8");
const dependencies = {
  "react/jsx-runtime": require("react/jsx-runtime"),
  "next/link": (props) => React.createElement("a", props, props.children),
  "@/lib/business": {
    business: {
      email: "support@alliedautotech.com",
      phone: "08136075567",
      internationalPhone: "+2348136075567",
      address:
        "133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria",
    },
  },
  "@/lib/seo": { publicMetadata: () => ({}) },
  "@/lib/public-launch": { catalogueOnly: () => false },
  "../components/site-header": { SiteHeader: () => null },
  "../components/site-footer": { SiteFooter: () => null },
  "./privacy.css": {},
};
const output = ts.transpileModule(source, {
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
  },
}).outputText;
const exportsObject = {};
vm.runInNewContext(output, {
  exports: exportsObject,
  require(name) {
    if (!(name in dependencies)) throw new Error(`Unreviewed import: ${name}`);
    return dependencies[name];
  },
});
const rendered = renderToStaticMarkup(React.createElement(exportsObject.default));
const destination = path.resolve(
  root,
  "../backend/docs/accounts-and-enquiries-privacy-review.html",
);
const hash = crypto.createHash("sha256").update(source).digest("hex");
fs.writeFileSync(
  destination,
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Proposed accounts and enquiries privacy notice</title><style>body{font:17px/1.7 system-ui,sans-serif;max-width:850px;margin:40px auto;padding:0 24px;color:#172b38}h1,h2{line-height:1.3}h2{margin-top:32px}.review{padding:18px;background:#fff5d6;border-left:4px solid #a46a00}a{color:#0a526c}</style></head><body><aside class="review"><strong>Proposed notice for owner review — not yet published.</strong><p>Generated from the actual accounts-and-enquiries page. Approval of the wording is separate from outstanding provider/privacy evidence. The effective date must match publication.</p></aside>${rendered}<footer><small>Source SHA-256: ${hash}</small></footer></body></html>`,
  "utf8",
);
process.stdout.write("Privacy review rendered from the proposed page.\n");
