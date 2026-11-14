import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { ApiService } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class VideoNamesService {
  private readonly api = inject(ApiService);
  private readonly names = new Map<string, string>();

  nameOf(jobId: string): Observable<string> {
    const cached = this.names.get(jobId);

    if (cached !== undefined) {
      return of(cached);
    }

    return this.api.getVideoJob(jobId).pipe(
      map(job => job.originalFileName),
      tap(name => this.names.set(jobId, name))
    );
  }
}
