# Architecture

Cofound sets up your project architecture as follows:

Backend:

- `+/index.ts` is where your server routes are defined, including your RPC router endpoint. It's where your backend begins.
- `+/lib/` is where architecture helpers are generally defined.
- `+/schema.ts` is where your app's database schema is defined.
- `+/models/` is where your model files are defined.
  - `+/models/base-model` is the model class that all your models inherit from.
- `+/actions/` is where your action files are defined.
  - `+/actions/base-action` is the action class that all your actions inherit from.
- `+/rpcs/` is where your rpcs are defined.
- `+/model-views/` is where your model views are defined (helpers to prep data for the frontend).
- `+/jobs/` is where your job files are defined.
- `+/pods/` is where your pods are configured.

Frontend:

- `index.tsx` is where your frontend begins.
- `frontend/` is where your frontend source files live.
- `frontend/lib/frontend-env.ts` is where you define constants that come from `process.env.UNSAFE_*`