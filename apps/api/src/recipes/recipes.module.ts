import { Body, Controller, Get, Inject, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags, ApiQuery } from '@nestjs/swagger';
import type { Actor } from '../access/access';
import { CurrentActor } from '../auth/auth.decorators';
import { RecipesService } from './recipes.service';

@ApiTags('Recipe drafts')
@ApiBearerAuth()
@Controller('recipes')
class RecipesController {
  constructor(@Inject(RecipesService) private readonly service: RecipesService) {}
  @Get() list(@CurrentActor() actor: Actor) {
    return this.service.list(actor);
  }
  @Get('page')
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'kind', required: false, enum: ['PRODUCTION', 'SERVING'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  page(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.service.page(actor, query);
  }
  @Get(':id/detail')
  detail(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.service.detail(actor, id);
  }
  @Post()
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'kind', 'outputQuantity', 'outputUnitCode', 'components'],
      properties: {
        name: { type: 'string' },
        kind: { type: 'string', enum: ['PRODUCTION', 'SERVING'] },
        scopeLocationId: { type: 'string', format: 'uuid', nullable: true },
        outputItemId: { type: 'string', format: 'uuid', nullable: true },
        menuVariantId: { type: 'string', format: 'uuid', nullable: true },
        outputQuantity: { type: 'string', example: '10' },
        outputUnitCode: { type: 'string', example: 'L' },
        components: {
          type: 'array',
          items: {
            type: 'object',
            required: ['stockItemId', 'quantity', 'unitCode'],
            properties: {
              stockItemId: { type: 'string', format: 'uuid' },
              quantity: { type: 'string', example: '100' },
              unitCode: { type: 'string', example: 'g' },
            },
          },
        },
      },
    },
  })
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.service.create(actor, body);
  }
  @Post(':id/preview')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['targetQuantity', 'targetUnitCode'],
      properties: {
        targetQuantity: { type: 'string', example: '25' },
        targetUnitCode: { type: 'string', example: 'L' },
      },
    },
  })
  preview(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: unknown) {
    return this.service.preview(actor, id, body);
  }
}

@Module({ controllers: [RecipesController], providers: [RecipesService] })
export class RecipesModule {}
