# Signed frontend pre-push checks

The staging branch ruleset requires GitHub-verified commit signatures and blocks
force pushes. The production ruleset independently protects `master`.

Once per checkout, run `npm run hooks:install` at the repository root. This
sets the local Git `core.hooksPath` to the checked-in `.githooks` directory.
If the checkout already has another custom hooks path, installation stops
without replacing it; integrate this hook with the existing hooks manually.

Before pushing commits, the pre-push hook rejects commits missing a `gpgsig`
field. This is a structural check, **not cryptographic verification**: GitHub's
ruleset ultimately decides whether the signature is valid and verified.
Frontend-related changes also run the established frontend checks in this order:
Prettier, ESLint, TypeScript, Vitest and the Next.js build. Non-frontend changes
skip that expensive suite. This hook does not bypass GitHub Actions.

For SSH signing on the owner's Windows checkout, verify `gpg.format=ssh`,
`user.signingkey` points to the approved private key, and `commit.gpgsign=true`.
Keep the private signing key and passphrase out of the repository. Check GitHub's
**Verified** badge after pushing; the badge is not guaranteed merely because
the local commit contains a signature.

Manual check without installing the hook:

```powershell
npm --prefix frontend run check
node --test scripts/git-hooks/pre-push.test.mjs
```

No hook or CI process can guarantee that future releases will never fail. Review
the exact commit's GitHub checks and staging acceptance before any production
release. Do not merge a Draft PR as part of this setup.
