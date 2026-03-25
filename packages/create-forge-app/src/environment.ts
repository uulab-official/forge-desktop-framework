import { spawnSync } from 'node:child_process';

export interface CommandCheck {
  command: string;
  ok: boolean;
  output?: string;
}

export interface EnvironmentReport {
  node: CommandCheck;
  packageManager: 'pnpm' | 'npm' | 'yarn';
  python?: CommandCheck;
  pip?: CommandCheck;
}

function trimOutput(value: string | null | undefined): string | undefined {
  return value?.trim() || undefined;
}

export function detectPackageManager(): 'pnpm' | 'npm' | 'yarn' {
  const ua = process.env['npm_config_user_agent'] ?? '';
  if (ua.startsWith('pnpm')) return 'pnpm';
  if (ua.startsWith('yarn')) return 'yarn';
  return 'npm';
}

export function checkCommand(command: string, args: string[]): CommandCheck {
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    command,
    ok: result.status === 0,
    output: trimOutput(result.stdout) ?? trimOutput(result.stderr),
  };
}

export function detectPythonCommand(): CommandCheck | undefined {
  for (const command of ['python3', 'python']) {
    const check = checkCommand(command, ['--version']);
    if (check.ok) {
      return check;
    }
  }

  return undefined;
}

export function inspectEnvironment(): EnvironmentReport {
  const python = detectPythonCommand();
  const pip = python ? checkCommand(python.command, ['-m', 'pip', '--version']) : undefined;

  return {
    node: {
      command: 'node',
      ok: true,
      output: process.version,
    },
    packageManager: detectPackageManager(),
    python,
    pip,
  };
}
