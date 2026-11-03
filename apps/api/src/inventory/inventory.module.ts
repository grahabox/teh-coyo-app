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
import { InventoryService } from './inventory.service';

const line = {
  type: 'object' as const,
  required: ['stockItemId', 'quantity'],
  properties: {
    stockItemId: { type: 'string' as const, format: 'uuid' },
    quantity: { type: 'string' as const, example: '100' },
  },
};
const InventoryPage = () =>
  applyDecorators(
    ApiQuery({ name: 'locationId', type: String }),
    ApiQuery({ name: 'stockItemId', type: String, required: false }),
    ApiQuery({ name: 'q', type: String, required: false }),
    ApiQuery({ name: 'page', type: Number, required: false }),
    ApiQuery({ name: 'perPage', type: Number, required: false, description: '1–100, default 25' }),
  );
@ApiTags('Inventory — quantity only')
@ApiBearerAuth()
@Controller('inventory')
class InventoryController {
  constructor(@Inject(InventoryService) private readonly service: InventoryService) {}
  @Get('balances')
  @InventoryPage()
  balances(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.service.balances(actor, query);
  }
  @Get('movements')
  @InventoryPage()
  movements(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.service.movements(actor, query);
  }
  @Get('documents')
  @InventoryPage()
  documents(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.service.documents(actor, query);
  }
  @Get('documents/:id')
  detail(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.service.detail(actor, id);
  }
  @Post('documents')
  @ApiOperation({
    summary: 'Create immutable draft; client UUID binds retries to the same content.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id', 'kind', 'locationId', 'businessDate', 'reference', 'reason', 'lines'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        kind: { type: 'string', enum: ['OPENING', 'RECEIPT', 'ADJUSTMENT', 'TRANSFER'] },
        locationId: { type: 'string', format: 'uuid' },
        destinationId: { type: 'string', format: 'uuid', nullable: true },
        businessDate: { type: 'string', format: 'date' },
        reference: { type: 'string' },
        reason: { type: 'string' },
        supplierName: { type: 'string', nullable: true },
        lines: { type: 'array', items: line },
      },
    },
  })
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.service.create(actor, body);
  }
  @Post('documents/:id/post')
  @ApiOperation({
    summary: 'Post opening/receipt/adjustment once; repetition returns existing document.',
  })
  post(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.service.post(actor, id, 'post');
  }
  @Post('documents/:id/ship')
  ship(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.service.post(actor, id, 'ship');
  }
  @Post('documents/:id/receive')
  @ApiOperation({
    summary:
      'Add actual received quantities; remaining goods stay in transit. Reuse receipt UUID only for an identical retry.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id', 'businessDate', 'note', 'lines'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        businessDate: { type: 'string', format: 'date' },
        note: { type: 'string' },
        lines: {
          type: 'array',
          items: {
            type: 'object',
            required: ['lineId', 'quantity'],
            properties: {
              lineId: { type: 'string', format: 'uuid' },
              quantity: { type: 'string', example: '18' },
            },
          },
        },
      },
    },
  })
  receive(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: unknown) {
    return this.service.receive(actor, id, body);
  }
}

@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
