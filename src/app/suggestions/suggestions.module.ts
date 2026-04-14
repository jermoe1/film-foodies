import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { SuggestionsRoutingModule } from './suggestions-routing.module';
import { SuggestionsComponent } from './suggestions.component';
import { SuggestNewComponent } from './suggest-new.component';

@NgModule({
  declarations: [SuggestionsComponent, SuggestNewComponent],
  imports: [SharedModule, SuggestionsRoutingModule],
})
export class SuggestionsModule {}
