---
name: add-component
description: Add a new React component to the @forge/ui-kit package
user_invocable: true
---

# Add Component Skill

Create a new React component in the ui-kit package.

## Usage
The user will say "/add-component <ComponentName>" (e.g., "/add-component Drawer")

## Steps

1. Parse the component name from args
2. Create `packages/ui-kit/src/components/<ComponentName>.tsx` with:
   - Props interface exported
   - Functional component with Tailwind styling
   - Dark mode support
   - Proper TypeScript types
3. Update packages/ui-kit/src/index.ts to export the new component
4. Run `pnpm --filter @forge/ui-kit build` to verify
5. Report success
