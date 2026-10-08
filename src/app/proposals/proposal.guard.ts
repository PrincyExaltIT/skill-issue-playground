import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

const CFP_CLOSES_AT = new Date('2026-11-30T23:59:59');

@Injectable({ providedIn: 'root' })
export class ProposalGuard implements CanActivate {
  private router = inject(Router);

  canActivate(): boolean | UrlTree {
    if (Date.now() > CFP_CLOSES_AT.getTime()) {
      return this.router.parseUrl('/');
    }
    return true;
  }
}
