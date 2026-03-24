# Multi-Module Example

Demonstrates the **module/plugin pattern** — multiple features registered into a single Forge Desktop app with a shared sidebar, each module optionally backed by Python worker actions.

## Architecture

```
src/modules/
  registry.ts          # Central module registry
  notes/               # Pure frontend module (localStorage)
  calculator/          # Python-backed math evaluator
  converter/           # Python-backed unit converter
```

### How the Registry Works

The module registry (`src/modules/registry.ts`) is a simple array-backed store. Each module registers itself by calling `registerModule()` with a `ModuleDefinition`:

```ts
interface ModuleDefinition {
  id: string;              // Unique identifier
  label: string;           // Display name in sidebar
  description?: string;    // Optional tooltip/description
  component: ComponentType; // React component to render
  workerActions?: string[]; // Python worker actions this module uses
}
```

Modules self-register via side-effect imports in `src/main.tsx`:

```ts
import './modules/notes';
import './modules/calculator';
import './modules/converter';
```

The `App` component reads the registry and dynamically builds the sidebar and content area.

### How to Add a New Module

1. Create a directory under `src/modules/your-module/`
2. Create your React component (`YourModule.tsx`)
3. Create an `index.ts` that registers it:
   ```ts
   import { registerModule } from '../registry';
   import { YourModule } from './YourModule';

   registerModule({
     id: 'your-module',
     label: 'Your Module',
     component: YourModule,
   });
   ```
4. Import it in `src/main.tsx`:
   ```ts
   import './modules/your-module';
   ```

If your module needs a Python worker action, add the action file under `python/worker/actions/`, import it in `actions/__init__.py`, and list the action name in `workerActions`.

### Modules and Python Workers

- **Notes** — Pure frontend. Uses `localStorage` for persistence. No Python worker needed.
- **Calculator** — Sends expressions to the `calculate` Python action, which uses AST-based safe evaluation.
- **Converter** — Sends conversion requests to the `convert` Python action, supporting length, weight, and temperature.

### Scaling This Pattern

This registry pattern works well for small-to-medium apps. For larger applications:

- Add lazy loading with `React.lazy()` for module components
- Extend `ModuleDefinition` with permissions, dependencies, or lifecycle hooks
- Consider dynamic discovery (scanning a directory or loading from config)
- See `packages/plugin-system` (upcoming) for the formal plugin architecture

## Running

```bash
pnpm install
pnpm --filter @forge-example/multi-module dev
```
