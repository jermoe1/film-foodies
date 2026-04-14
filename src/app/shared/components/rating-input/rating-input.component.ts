import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';

/**
 * RatingInputComponent
 *
 * Shared rating entry widget used in:
 *   - Rate flow
 *   - History expanded detail
 *   - My Profile
 *   - Stats
 *   - Bulk Import CSV mapping
 *
 * Active scale: numeric 0.0–10.0 (one decimal place).
 * Star modes are stubbed and intentionally not exposed in the UI.
 */
@Component({
  selector: 'app-rating-input',
  templateUrl: './rating-input.component.html',
  styleUrls: ['./rating-input.component.scss'],
})
export class RatingInputComponent implements OnInit, OnChanges {
  /** Determines which rating UX to render. Only 'numeric' is functional in v1. */
  @Input() mode: 'numeric' | 'stars-whole' | 'stars-half' = 'numeric';

  /** Current rating value (0.0–10.0, one decimal). Null = not yet rated. */
  @Input() value: number | null = null;

  /** Emits the new value whenever the user changes the rating. */
  @Output() valueChange = new EventEmitter<number | null>();

  /** Whether the control should be read-only (e.g. in History detail view). */
  @Input() readonly = false;

  control = new FormControl<number | null>(null, [
    Validators.min(0),
    Validators.max(10),
  ]);

  ngOnInit(): void {
    this.control.setValue(this.value);
    if (this.readonly) this.control.disable();

    this.control.valueChanges.subscribe((v) => {
      // Clamp to one decimal place on emit
      const clamped = v !== null ? Math.round(v * 10) / 10 : null;
      this.valueChange.emit(clamped);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !changes['value'].firstChange) {
      this.control.setValue(this.value, { emitEvent: false });
    }
  }
}
