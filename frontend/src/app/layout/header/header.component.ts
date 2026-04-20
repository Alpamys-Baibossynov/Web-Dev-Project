import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Params, Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  private static readonly validMediaTypes = ['movie', 'tv', 'anime'] as const;
  private router = inject(Router);
  readonly authService = inject(AuthService);

  get brandQueryParams(): Params | null {
    const mediaType = this.router.parseUrl(this.router.url).queryParams['media'];

    if (
      HeaderComponent.validMediaTypes.includes(
        mediaType as (typeof HeaderComponent.validMediaTypes)[number],
      ) &&
      mediaType !== 'movie'
    ) {
      return { media: mediaType };
    }

    return null;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
