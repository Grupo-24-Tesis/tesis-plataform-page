export interface Guard {
  id: string;
  name: string;
  shift: 'mañana' | 'tarde' | 'noche';
  schedule: string;
}