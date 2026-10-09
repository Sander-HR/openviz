# Environment Variables

Copy the appropriate example before local development:

```bash
cp .env.example .env
# or for Docker:
cp .env.docker.example .env.docker
```

Environment files contain local secrets and are ignored by Git. Keep the example files updated when adding required configuration. Common settings include the PostgreSQL connection, authentication URL and secret, Redis URL, OAuth credentials, S3 storage, and ComfyUI endpoint.

Do not commit `.env`, `.env.*` files, private keys, or credentials. Deployment-specific values should be managed by the deployment environment.
