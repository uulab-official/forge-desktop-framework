import * as p from '@clack/prompts';
import pc from 'picocolors';
import { inspectEnvironment } from '../environment.js';

export async function doctorCommand() {
  const report = inspectEnvironment();

  p.intro(pc.bgWhite(pc.black(' forge doctor ')));

  p.log.info(`Node.js: ${report.node.output ?? 'unknown'}`);
  p.log.info(`Package manager: ${report.packageManager}`);

  if (report.python) {
    p.log.success(`Python: ${report.python.output ?? report.python.command}`);
  } else {
    p.log.error('Python: not found (expected `python3` or `python`)');
  }

  if (report.pip?.ok) {
    p.log.success(`pip: ${report.pip.output ?? 'available'}`);
  } else if (report.python) {
    p.log.warning(`pip: unavailable via ${report.python.command} -m pip`);
  } else {
    p.log.warning('pip: skipped because Python was not detected');
  }

  const issues: string[] = [];

  if (!report.python) {
    issues.push('Install Python 3.12+ before running worker-backed Forge apps.');
  }

  if (report.python && !report.pip?.ok) {
    issues.push(`Ensure ${report.python.command} can run \`-m pip\` so worker dependencies can be installed.`);
  }

  if (issues.length > 0) {
    p.note(issues.join('\n'), 'Recommended fixes');
    p.outro(pc.yellow('Doctor found setup issues.'));
    process.exitCode = 1;
    return;
  }

  p.outro(pc.green('Environment looks ready for Forge.'));
}
