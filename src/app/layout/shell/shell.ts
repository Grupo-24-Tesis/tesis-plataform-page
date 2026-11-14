import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.css'
})
export class Shell implements OnInit {
  menuOpen = signal(false);
  guardName = signal('Vigilante');

  constructor(
    private session: SessionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const savedGuard = localStorage.getItem('facecluster-active-guard');

    if (!savedGuard) {
      return;
    }

    try {
      const guard = JSON.parse(savedGuard);
      this.guardName.set(guard.name ?? 'Vigilante');
    } catch {
      console.warn('No fue posible recuperar el vigilante activo.');
    }
  }

  toggleMenu() {
    this.menuOpen.update(open => !open);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  logout(): void {
    this.session.clearActiveGuard();
    this.router.navigateByUrl('/guards');
  }
}