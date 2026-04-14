import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { BulkImportRoutingModule } from './bulk-import-routing.module';
import { BulkImportComponent } from './bulk-import.component';

@NgModule({
  declarations: [BulkImportComponent],
  imports: [SharedModule, BulkImportRoutingModule],
})
export class BulkImportModule {}
