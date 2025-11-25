import { Component } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

interface NavLink {
  label: string;
  icon: string;
  path: string;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent {
  readonly navLinks: NavLink[] = [
    { label: 'Panel', icon: 'dashboard', path: '/dashboard' },
    { label: 'Cosechas', icon: 'compost', path: '/cosechas' },
    { label: 'Inventario', icon: 'inventory_2', path: '/inventario' },
    { label: 'Alertas', icon: 'warning', path: '/alertas' },
    { label: 'Mermas', icon: 'delete_sweep', path: '/mermas' },
    { label: 'Reportes', icon: 'insights', path: '/reportes' }
  ];

  readonly userState$ = this.authService.state$;
  readonly todayLabel = this.capitalize(
    new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date())
  );

  constructor(private readonly authService: AuthService, private readonly router: Router) {}

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }

  private capitalize(value: string): string {
    if (!value) {
      return value;
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
