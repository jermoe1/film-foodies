import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { RatingInputComponent } from './components/rating-input/rating-input.component';

@NgModule({
  declarations: [RatingInputComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  exports: [
    // Re-export Angular common modules so feature modules only need to import SharedModule
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    // Shared components
    RatingInputComponent,
  ],
})
export class SharedModule {}
