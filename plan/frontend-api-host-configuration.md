# Frontend API Host Configuration

## Goal

Allow the frontend explorer to call a deployed backend API by taking its API
host from Vite environment configuration.

## Scope

- Add `VITE_API_BASE_URL` to an example frontend environment file.
- Use the configured host for explorer API requests.
- Preserve the relative `/api` path fallback for local Vite proxy development.
- Test configured-host and fallback request URLs.

## Approach

1. Define the environment variable type for the frontend build.
2. Centralize API URL construction in the explorer API client.
3. Add `.env.template` with the local backend host.
4. Add unit coverage for configured and default URL behavior.
5. Run frontend and repository checks.

## Assumptions

- `VITE_API_BASE_URL` contains the API base URL, including the `/api` prefix,
  such as `https://api.example.com/api`, without a trailing slash.
- The backend route prefix remains `/api/v1`.
- An unset value falls back to `/api` so the existing Vite development proxy
  remains useful.

## Success Criteria

- Production builds can point the frontend to a separately hosted backend.
- Local development continues to work with the Vite proxy.
- API URL behavior is covered by automated tests.
