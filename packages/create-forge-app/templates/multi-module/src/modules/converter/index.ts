import { registerModule } from '../registry';
import { ConverterModule } from './ConverterModule';

registerModule({
  id: 'converter',
  label: 'Converter',
  description: 'Unit converter for length, weight, and temperature',
  component: ConverterModule,
  workerActions: ['convert'],
});
