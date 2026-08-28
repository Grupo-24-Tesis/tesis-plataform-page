export interface ReportItem {
  id: string;
  title: string;
  status: 'investigacion' | 'solucionado';
  priority: 'alta' | 'media' | 'baja';
  description: string;

  incidentDate: string;
  createdAt: string;

  resolutionDescription?: string;
  resolvedAt?: string;

  faceIds: string[];
}