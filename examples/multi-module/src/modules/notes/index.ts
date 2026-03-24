import { registerModule } from '../registry';
import { NotesModule } from './NotesModule';

registerModule({
  id: 'notes',
  label: 'Notes',
  description: 'Quick notes and scratchpad',
  component: NotesModule,
});
