import { Component,OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { ApiService, Guard } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-guards',
  imports: [[CommonModule]],
  templateUrl: './guards.html',
  styleUrl: './guards.css',
})
export class Guards implements OnInit {
  guards: Guard[] = [];

  constructor(
    private api: ApiService,
    private session: SessionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.api.getGuards().subscribe({
      next: data => this.guards = data,
      error: err => console.error('Error loading guards', err)
    });
  }

  select(guard: Guard) {
    this.session.setActiveGuard(guard.id!);
    this.router.navigateByUrl('/monitor');
  }
}