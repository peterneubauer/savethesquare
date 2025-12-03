# Configuration Setup

## Environment-Based Test Mode

The Stripe test mode is now controlled via the `STRIPE_TEST_MODE` environment variable.

### How It Works

1. **config.template.js** - Template file with placeholder `__STRIPE_TEST_MODE__`
2. **build.js** - Build script that replaces the placeholder with the environment variable value
3. **config.js** - Generated file (not committed to Git)

### Default Behavior

- **Production (default)**: `testMode: false` - Real Stripe payments
- **Test Mode**: `testMode: true` - Simulated payments with alerts

### Netlify Setup

To enable test mode in Netlify:

1. Go to **Site settings** → **Environment variables**
2. Add a new variable:
   - **Variable Name**: `STRIPE_TEST_MODE`
   - **Value**: `true`
3. Redeploy your site

To disable test mode (production), either:
- Remove the `STRIPE_TEST_MODE` variable, OR
- Set it to `false`

### Local Development

```bash
# Production mode (default)
npm run build

# Test mode
STRIPE_TEST_MODE=true npm run build

# Run local server
npm start
```

### Files

- `config.template.js` - Template (committed to Git)
- `config.js` - Generated output (in .gitignore, not committed)
- `build.js` - Build script (committed to Git)

### Important Notes

- `config.js` is generated during build and should NOT be committed to Git
- Netlify will run `npm run build` automatically on deployment
- The build script reads the `STRIPE_TEST_MODE` environment variable
- Defaults to `false` (production) if the variable is not set
