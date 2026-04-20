import { Directive, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Abstract base class that provides a `destroy$` Subject and a default
 * `ngOnDestroy` implementation. Extend this instead of declaring the
 * boilerplate in every component.
 *
 * Usage:
 *   export class MyComponent extends DestroyComponent implements OnInit { ... }
 *
 * If the subclass needs additional cleanup, override ngOnDestroy and call super:
 *   ngOnDestroy(): void { super.ngOnDestroy(); this.otherSubject$.complete(); }
 */
@Directive()
export abstract class DestroyComponent implements OnDestroy {
  protected readonly destroy$ = new Subject<void>();

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
