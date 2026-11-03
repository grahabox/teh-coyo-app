import {
  applyDecorators,
  Body,
  Controller,
  Get,
  Inject,
  Module,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../access/access';
import { CurrentActor } from '../auth/auth.decorators';
import { InventoryModule } from '../inventory/inventory.module';
import { ProcurementService } from './procurement.service';

const property = (description: string) => ({ type: 'string' as const, description });
const uuid = { type: 'string' as const, format: 'uuid' };
const date = { type: 'string' as const, format: 'date' };
const CommonPage = () =>
  applyDecorators(
    ApiQuery({ name: 'q', required: false, type: String }),
    ApiQuery({ name: 'page', required: false, type: Number }),
    ApiQuery({ name: 'perPage', required: false, type: Number }),
  );
@ApiTags('Purchasing — supplier invoices, actual stock receipts, declared payments')
@ApiBearerAuth()
@Controller('purchasing')
class ProcurementController {
  constructor(@Inject(ProcurementService) private readonly service: ProcurementService) {}
  @Get('suppliers')
  @CommonPage()
  suppliers(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.service.suppliers(actor, query);
  }
  @Post('suppliers')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id', 'code', 'name'],
      properties: { id: uuid, code: property('Unique code'), name: property('Supplier name') },
    },
  })
  createSupplier(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.service.createSupplier(actor, body);
  }
  @Get('invoices')
  @CommonPage()
  @ApiQuery({ name: 'locationId', type: String })
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.service.list(actor, query);
  }
  @Get('invoices/:id')
  detail(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.service.detail(actor, id);
  }
  @Get('invoices/:id/receipt-options')
  @CommonPage()
  receiptOptions(@CurrentActor() actor: Actor, @Param('id') id: string, @Query() query: unknown) {
    return this.service.receiptOptions(actor, id, query);
  }
  @Post('invoices')
  @ApiOperation({
    summary:
      'Create invoice draft; no stock or payment effects. Prices in whole IDR per item base unit; HALF_UP per line.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'id',
        'locationId',
        'supplierId',
        'invoiceReference',
        'businessDate',
        'note',
        'lines',
      ],
      properties: {
        id: uuid,
        locationId: uuid,
        supplierId: uuid,
        invoiceReference: property('Supplier invoice number'),
        businessDate: date,
        dueDate: { ...date, nullable: true },
        note: property('Invoice note'),
        lines: {
          type: 'array',
          items: {
            type: 'object',
            required: ['stockItemId', 'quantity', 'unitPrice'],
            properties: {
              stockItemId: uuid,
              quantity: property('Positive decimal string in item base unit'),
              unitPrice: property('Whole IDR string per base unit'),
            },
          },
        },
      },
    },
  })
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.service.create(actor, body);
  }
  @Post('invoices/:id/confirm')
  confirm(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.service.confirm(actor, id);
  }
  @Post('invoices/:id/receive')
  @ApiOperation({
    summary:
      'Receive actual quantities atomically with shared inventory ledger; stock opening required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id', 'businessDate', 'reference', 'note', 'lines'],
      properties: {
        id: uuid,
        businessDate: date,
        reference: property('Delivery reference'),
        note: property('Actual receiving note'),
        lines: {
          type: 'array',
          items: {
            type: 'object',
            required: ['lineId', 'quantity'],
            properties: {
              lineId: uuid,
              quantity: property('Additional actual quantity, positive decimal string'),
            },
          },
        },
      },
    },
  })
  receive(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: unknown) {
    return this.service.receive(actor, id, body);
  }
  @Post('invoices/:id/link-receipt')
  @ApiOperation({
    summary: 'Link an existing posted supplier receipt without another inventory movement.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id', 'stockDocumentId', 'note'],
      properties: {
        id: uuid,
        stockDocumentId: uuid,
        note: property('Evidence linking receipt to invoice'),
      },
    },
  })
  link(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: unknown) {
    return this.service.linkReceipt(actor, id, body);
  }
  @Post('invoices/:id/payments')
  @ApiOperation({
    summary:
      'Record a declared payment and outstanding balance; does not post cash/bank ledger or contact a payment provider.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id', 'businessDate', 'amount', 'method', 'fundingSource', 'reference', 'note'],
      properties: {
        id: uuid,
        businessDate: date,
        amount: property('Positive whole IDR string'),
        method: { type: 'string', enum: ['CASH', 'BANK_TRANSFER'] },
        fundingSource: property('Declared source of funds'),
        reference: property('Payment proof reference, unique per invoice'),
        note: property('Payment note'),
      },
    },
  })
  pay(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: unknown) {
    return this.service.pay(actor, id, body);
  }
}
@Module({
  imports: [InventoryModule],
  controllers: [ProcurementController],
  providers: [ProcurementService],
})
export class ProcurementModule {}
