import { registerModule } from '../registry';
import { CalculatorModule } from './CalculatorModule';

registerModule({
  id: 'calculator',
  label: 'Calculator',
  description: 'Math expression evaluator via Python worker',
  component: CalculatorModule,
  workerActions: ['calculate'],
});
