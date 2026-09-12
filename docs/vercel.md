# Deploy to Vercel

Import `jovantomic/ocp-demo` with the repository root (`.`) as Root Directory. The checked-in `vercel.json` selects the Other framework preset, runs `npm ci` and `npm run build`, and publishes `dist/`. Do not select `public/`: it contains geography assets, not the application. `npm start` is only the local Python development server and is not a deployment command. No environment variables are needed for the frontend. Gatherers run separately; their credentials and downloaded data are not deployed.

After pulling a configuration change, deploy the latest `main` commit. Configuration reference: https://vercel.com/docs/project-configuration/vercel-json.
