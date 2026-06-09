import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth-store.service';
import { InvitesApiService } from '../services/invites-api.service';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import type { InviteeNode } from '../invites.types';

/** Строка дерева: узел + состояние раскрытия (плоский список с глубиной). */
interface TreeRow extends InviteeNode {
  /** Уровень вложенности (0 = прямой приглашённый). */
  depth: number;
  /** Раскрыт ли узел. */
  expanded: boolean;
  /** Идёт подгрузка детей. */
  loading: boolean;
  /** Раскрыт и детей нет. */
  emptyChildren: boolean;
}

/**
 * Дерево приглашений (вкладка «Дерево»). Корень — мои прямые приглашённые
 * (`GET /invites/of/:myId`); каждый узел разворачивается **по клику** (лениво,
 * `GET /invites/of/:accountId`) — грузим только открытую ветку (масштабируется на
 * большие деревья). `accountId` уникален во всём дереве (1 родитель), поэтому
 * операции идут по нему. Бейдж «забанен вами»; бан/разбан — на карточке узла.
 */
@Component({
  selector: 'app-invite-tree',
  imports: [DatePipe, RouterLink, SpinnerComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invite-tree.component.html',
  styleUrl: './invite-tree.component.scss',
})
export class InviteTreeComponent {
  private readonly _api = inject(InvitesApiService);
  private readonly _authStore = inject(AuthStore);

  /** Видимые строки дерева (плоско, с глубиной). */
  protected readonly rows = signal<TreeRow[]>([]);
  /** Идёт первичная загрузка корня. */
  protected readonly loading = signal(true);

  public constructor() {
    const me = this._authStore.account();
    if (me === null) {
      this.loading.set(false);
      return;
    }
    this._api.listOf(me.id).subscribe({
      next: (children) => {
        this.rows.set(children.map((node) => this._toRow(node, 0)));
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.loading.set(false);
      },
    });
  }

  /** Разворачивает/сворачивает узел. */
  protected toggle(row: TreeRow): void {
    if (row.expanded) {
      this._collapse(row);
    } else {
      this._expand(row);
    }
  }

  /** Подгружает детей узла и вставляет их под ним. */
  private _expand(row: TreeRow): void {
    this._patch(row.accountId, { loading: true });
    this._api.listOf(row.accountId).subscribe({
      next: (children) => {
        this.rows.update((list) => {
          const index = list.findIndex((r) => r.accountId === row.accountId);
          if (index === -1) {
            return list;
          }
          const copy = [...list];
          copy[index] = {
            ...copy[index],
            loading: false,
            expanded: true,
            emptyChildren: children.length === 0,
          } as TreeRow;
          copy.splice(index + 1, 0, ...children.map((node) => this._toRow(node, row.depth + 1)));
          return copy;
        });
      },
      error: () => this._patch(row.accountId, { loading: false }),
    });
  }

  /** Скрывает потомков узла (удаляет строки глубже до возврата на уровень). */
  private _collapse(row: TreeRow): void {
    this.rows.update((list) => {
      const index = list.findIndex((r) => r.accountId === row.accountId);
      if (index === -1) {
        return list;
      }
      let end = index + 1;
      while (end < list.length && list[end]!.depth > row.depth) {
        end += 1;
      }
      const copy = [...list];
      copy[index] = { ...copy[index], expanded: false, emptyChildren: false } as TreeRow;
      copy.splice(index + 1, end - (index + 1));
      return copy;
    });
  }

  /** Точечно меняет поля строки по accountId. */
  private _patch(accountId: string, patch: Partial<TreeRow>): void {
    this.rows.update((list) =>
      list.map((r) => (r.accountId === accountId ? ({ ...r, ...patch } as TreeRow) : r)),
    );
  }

  /** Узел → строку дерева. */
  private _toRow(node: InviteeNode, depth: number): TreeRow {
    return { ...node, depth, expanded: false, loading: false, emptyChildren: false };
  }
}
