# Friendship Ended AI Worker

This Worker generates the two meme images with Cloudflare Workers AI using
`@cf/black-forest-labs/flux-1-schnell`.

## Deploy

```sh
npx wrangler deploy
```

The frontend calls:

```text
https://friendship-ended-ai.dsantos-individual-account.workers.dev/portrait
```

The Cloudflare account currently protects all Workers with Access. After the
first deployment, open **Workers & Pages → friendship-ended-ai → Access** and
choose **Make this Worker public**. The Worker still restricts browser requests
to the site and local development origins listed in `worker/index.js`.

For local development with the remote Workers AI binding:

```sh
npx wrangler dev --remote --port 8787
```
