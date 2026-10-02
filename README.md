# æme

## Getting started

1. Install dependencies:

   ```bash
   yarn
   ```

2. Copy the example env file:

   ```bash
   cp .dev.vars.example .dev.vars
   ```

3. Start the local database:

   ```bash
   docker compose up -d
   ```

4. Push the schema to the local database:

   ```bash
   yarn db:push
   ```

5. Start the dev server:

   ```bash
   yarn dev
   ```

Or all in one go:

```bash
yarn && cp .dev.vars.example .dev.vars && docker compose up -d && yarn db:push && yarn dev
```

> **Note:** The example `.dev.vars` has placeholder Slack credentials, so any
> requests to Slack (posting booking announcements, looking up names, etc.)
> will fail locally. That's expected and fine — failures are logged, not
> thrown, so the rest of the app works without them. Log in with the DEV
> login tool shown in the app instead of going through Slack.

Browse/edit the local database with Drizzle Studio:

```bash
yarn db:studio
```
