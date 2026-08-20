# Project Export, Zip & GitHub Deployment Workflow

Always strictly follow these mandatory steps whenever finalizing work, exporting, or pushing changes:

1. **Create .Zip Archive in Downloads Folder**:
   - Before pushing to GitHub, ALWAYS create a clean `.zip` archive of the project codebase.
   - The `.zip` file MUST always be saved directly in the user's Downloads directory: `/Users/sumit.kumawat/Downloads/<project-name>.zip`.
   - Exclude `node_modules/*`, `.git/*`, and `.DS_Store` from the zip file.

2. **Update .gitignore**:
   - Maintain `*.zip` in `.gitignore` so project zip archives are excluded from repository commits.

3. **Push to GitHub**:
   - Stage changes (`git add .`).
   - Create a clean commit with a detailed summary.
   - Push to `origin main` (or the active remote branch).

4. **Host / Run for Testing**:
   - Host the server locally in the background (e.g. `node server.js` or `npm run dev`) so the application is ready for instant browser testing.
