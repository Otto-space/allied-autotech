# Allie: private local provider setup

This prepares isolated evaluation credentials. It does not enable public Allie,
change production settings, make a provider request or apply database migrations.
The application remains `HELP_LEARN_AI_ENABLED=false`; reviewed help keeps working.

## OpenAI project

1. Sign in to the [API platform](https://platform.openai.com/). Create a dedicated
   project, for example **Allied Allie Evaluation**, rather than sharing a production
   key. Project creation requires the appropriate organization permissions.
2. In project settings, open **Limits**. Select the model you can access. The initial
   suggestion is **`gpt-6-luna`**, a cost-conscious candidate supporting Responses
   and structured output. This is a candidate for testing, not an established
   Allie quality result; account access must be confirmed. Do not buy access or
   change billing solely because a model is suggested here.
3. Under **Limits → Spend → Edit spend limit**, set a small test amount you approve
   and select **Enforce a hard limit**. Add an earlier alert if useful. Alerts alone
   do not stop traffic; hard-limit enforcement can slightly overshoot during
   propagation. This provider control is separate from the app's token reservations.
4. In **API Keys**, create a project-scoped restricted secret key with permission
   to create Responses. Exclude other resources this evaluation does not use.
   Keep the key out of chat, screenshots, Git, frontend files and command arguments.

Official documentation checked 27 October 2026:
[projects and keys](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform),
[spend controls](https://developers.openai.com/api/docs/guides/spend-limits),
[candidate model](https://developers.openai.com/api/docs/models/gpt-6-luna).
Prices, available models and account permissions can change; recheck before use.

## Store the key locally

Run this **one command** in your own PowerShell terminal:

```powershell
powershell -NoProfile -File "C:\Users\PC\.codex\worktrees\allied-home-restoration-20261025\backend\scripts\configure-allie-evaluation.ps1"
```

Enter the project name, model ID, maximum evaluation spend in USD and confirmation
that you enabled the project hard limit. Paste the key only at the hidden prompt.
The helper stores it encrypted using Windows current-user DPAPI, outside the repo:
`%LOCALAPPDATA%\AlliedAutoTech\allie-evaluation\provider.local.json`.
It refuses to overwrite existing configuration. Do not send that file to anyone.
Windows-user encryption protects the stored key from other identities; it is not
protection from malicious software already running as your Windows user.

If your terminal does not paste into masked input, start this command **before**
copying the key:

```powershell
powershell -NoProfile -File "C:\Users\PC\.codex\worktrees\allied-home-restoration-20261025\backend\scripts\configure-allie-evaluation.ps1" -KeyFromClipboard
```

Answer the ordinary prompts. At the explicit clipboard pause, switch to OpenAI and
use Copy for the full secret key. Return to the terminal and press Enter without
pasting or copying any other text. The clipboard is read only after this pause,
never displayed, and left unchanged. Do not copy a masked key-list entry. If the
full key is no longer available, create a replacement in the dedicated project.
The helper accepts `Yes` or `YES`; neither mode sends an API request.

The credit purchase, project spending cap and evaluation allowance are separate.
The owner's payment screen required a US$5 minimum initial credit purchase; that
does not require spending the full balance on evaluation. A configured allowance
does not override the provider project's enforced cap.

The recorded approval is restricted to isolated evaluation, at most 120 provider
requests and the USD amount you entered. It does not approve app enablement,
production deployment or real customer content. A bounded evaluation runner must
enforce those settings and verify current pricing before making requests. Saving
configuration is not evidence that evaluation has run or passed.

After saving, tell Codex only **“Configured”**, the model and approved USD amount.
Never paste the key. If project/model access is unavailable, report the non-secret
error text; independent implementation can continue.

## Deployment and data assumptions

The owner could not confirm hosting topology. Treat the site as internet-facing
and potentially multi-instance: ownership, quotas, cancellation and retention
must use shared server state. This is an implementation assumption, not a verified
claim about the deployed instance count.

Only screened questions deliberately typed into Allie, a bounded eligible reviewed
help excerpt and eligible recent help context may be sent to the provider. Private
records, support threads, form fields, uploads and full URLs are excluded. Screening
cannot guarantee every sensitive input is detected. The adapter requests
`store:false`; that does not establish zero data retention or special account
controls. Verify the account's applicable terms before exposure, using the
[official data-controls guide](https://developers.openai.com/api/docs/guides/your-data).
The final UI still needs its accurate privacy notice and explicit reviewed handoff.
