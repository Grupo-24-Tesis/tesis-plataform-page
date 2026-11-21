import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { Camera } from '../../../core/services/api.service';
import { FaceAppearance } from '../../../core/models/face.model';
import { DetectionMatchesComponent } from '../detection-matches/detection-matches';
import { ImageFallbackDirective } from '../../directives/image-fallback.directive';
import { MarkOutcome, MarksService } from '../../services/marks.service';
import { VideoNamesService } from '../../services/video-names.service';
import { Subscription } from 'rxjs';

export function jobIdOf(appearance: FaceAppearance): string {
  if (appearance.jobId) {
    return appearance.jobId;
  }

  const separator = appearance.faceId.lastIndexOf('_');
  return separator > 0 ? appearance.faceId.substring(0, separator) : '';
}

@Component({
  selector: 'app-detection-detail',
  standalone: true,
  imports: [DatePipe, FormsModule, ImageFallbackDirective, DetectionMatchesComponent],
  templateUrl: './detection-detail.html',
  styleUrl: './detection-detail.css'
})
export class DetectionDetailComponent {
  private readonly videoNames = inject(VideoNamesService);
  private readonly router = inject(Router);
  private readonly marksService = inject(MarksService);

  readonly appearance = input.required<FaceAppearance>();
  readonly cameras = input<Camera[]>([]);
  readonly openDetection = output<string>();
  readonly matchesChanged = output<void>();

  readonly marks = this.marksService.marks;
  readonly markBusy = this.marksService.busy;
  readonly marksLoadError = this.marksService.loadError;

  readonly reason = signal('');
  readonly message = signal('');
  readonly messageIsError = signal(false);
  readonly videoName = signal('');
  readonly videoState = signal<'loading' | 'ready' | 'error' | 'unknown'>('loading');

  readonly cameraLabel = computed(() => {
    const cameraId = this.appearance().cameraId;
    return this.cameras().find(camera => camera.id === cameraId)?.name ?? cameraId;
  });

  readonly currentMark = computed(() =>
    this.marks().find(mark => mark.faceId === this.appearance().faceId)
  );

  private readonly faceId = computed(() => this.appearance().faceId);

  private videoToken = 0;
  private videoRequest: Subscription | undefined;

  constructor() {
    effect(() => {
      this.faceId();
      untracked(() => {
        this.reason.set('');
        this.message.set('');
        this.messageIsError.set(false);
        this.loadVideo(jobIdOf(this.appearance()));
      });
    });
  }

  retryVideo(): void {
    this.loadVideo(jobIdOf(this.appearance()));
  }

  toggleMark(): void {
    if (this.markBusy()) {
      return;
    }

    const faceId = this.appearance().faceId;

    this.message.set('');
    this.marksService.toggle(faceId, this.reason(), outcome =>
      this.finishMark(faceId, outcome)
    );
  }

  createReport(): void {
    void this.router.navigate(['/reports'], {
      queryParams: { faceId: this.appearance().faceId }
    });
  }

  private finishMark(faceId: string, outcome: MarkOutcome): void {
    if (faceId !== this.appearance().faceId) {
      return;
    }

    if (!outcome.error && outcome.marked) {
      this.reason.set('');
    }

    this.message.set(outcome.message);
    this.messageIsError.set(outcome.error);
  }

  private loadVideo(jobId: string): void {
    const token = ++this.videoToken;
    this.videoRequest?.unsubscribe();
    this.videoName.set('');

    if (!jobId) {
      this.videoState.set('unknown');
      return;
    }

    this.videoState.set('loading');

    this.videoRequest = this.videoNames.nameOf(jobId).subscribe({
      next: name => {
        if (token !== this.videoToken) {
          return;
        }

        this.videoName.set(name);
        this.videoState.set('ready');
      },
      error: () => {
        if (token !== this.videoToken) {
          return;
        }

        this.videoState.set('error');
      }
    });
  }
}
