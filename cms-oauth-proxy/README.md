# Decap CMS GitHub OAuth proxy

This Cloudflare Worker completes the GitHub OAuth flow required by the static `/admin/` page. It does not store articles or user sessions; Decap CMS uses the returned GitHub token to commit Markdown to the repository.

## Configure

1. In `wrangler.toml`, set `CMS_ORIGIN` to the exact public origin of the Pages site and set `ALLOWED_GITHUB_LOGIN` to one or more comma-separated GitHub logins.
2. Create a GitHub OAuth App whose callback URL is `https://<worker-domain>/callback`.
3. Set the OAuth credentials as Cloudflare Worker secrets:

   ```bash
   npx wrangler secret put GITHUB_OAUTH_ID
   npx wrangler secret put GITHUB_OAUTH_SECRET
   ```

4. Deploy with `npx wrangler deploy`.
5. Put the resulting worker URL in `public/admin/config.yml` as `backend.base_url`.

For a private source repository set `GITHUB_REPO_PRIVATE = "1"` before deployment. Never add the OAuth client secret or a GitHub personal access token to this repository.
