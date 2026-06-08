import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Раздел «Приглашения» (сид; наполняется в F3.4). */
@Component({
  selector: 'app-invites',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invites.component.html',
})
export class InvitesComponent {}
