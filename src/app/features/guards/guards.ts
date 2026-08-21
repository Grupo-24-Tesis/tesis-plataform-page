import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService, Guard } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-guards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './guards.html',
  styleUrl: './guards.css',
})
export class Guards implements OnInit {
  guards = signal<Guard[]>([]);
  loading = true;
  errorMsg = '';

  constructor(
    private api: ApiService,
    private session: SessionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.api.getGuards().subscribe({
      next: (data) => {
        console.log('GUARDS API =>', data);

        this.guards.set(data);
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.errorMsg = 'No se pudieron cargar vigilantes';
        this.loading = false;
      }
    });
  }

  select(id: string) {
    this.session.setActiveGuard(id);
    this.router.navigateByUrl('/monitor');
  }
}