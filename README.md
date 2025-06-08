# trapnz-dashboard

A static dashboard for Trap.NZ projects, suitable for Netlify or any static hosting.

## How it Works

- On each build, a script fetches live trap data from the Trap.NZ API (using your API token) and writes it to `public/data/traps.json`.
- The frontend (HTML/JS) reads from this static JSON file and provides project filtering and summary stats—all in the browser.
- No backend server is needed at runtime.

## Local Development

1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Set your Trap.NZ API token:**
   ```sh
   export TRAPNZ_WFS_TOKEN=your-token-here
   ```
3. **Build the static site (fetches data):**
   ```sh
   npm run build
   ```
4. **Preview locally:**
   ```sh
   npx serve public
   # or use VS Code Live Server, or any static server
   ```

## Deploying to Netlify

- Set the build command to `npm run build`.
- Set the publish directory to `public`.
- Add `TRAPNZ_WFS_TOKEN` as an environment variable in your Netlify site settings.
- Netlify will fetch the latest data and build the static site on each deploy.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
