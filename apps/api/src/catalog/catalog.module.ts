import { Body, Controller, Get, Inject, Module, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags, ApiQuery } from '@nestjs/swagger';
import type { Actor } from '../access/access';
import { CurrentActor } from '../auth/auth.decorators';
import { CatalogService } from './catalog.service';

@ApiTags('Catalog')
@ApiBearerAuth()
@Controller('catalog')
class CatalogController {
  constructor(@Inject(CatalogService) private readonly service: CatalogService) {}
  @Get() list() {
    return this.service.list();
  }
  @Get('units') units() {
    return this.service.units();
  }
  @Get('items/page')
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  items(@Query() query: unknown) {
    return this.service.options('items', query);
  }
  @Get('variants/page')
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  variants(@Query() query: unknown) {
    return this.service.options('variants', query);
  }
  @Post('items')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['code', 'name', 'baseUnitId'],
      properties: {
        code: { type: 'string' },
        name: { type: 'string' },
        baseUnitId: { type: 'string', format: 'uuid' },
      },
    },
  })
  item(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.service.createItem(actor, body);
  }
  @Post('menus')
  @ApiBody({
    schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
  })
  menu(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.service.createMenu(actor, body);
  }
  @Post('variants')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['code', 'name', 'menuId'],
      properties: {
        code: { type: 'string' },
        name: { type: 'string' },
        menuId: { type: 'string', format: 'uuid' },
      },
    },
  })
  variant(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.service.createVariant(actor, body);
  }
}

@Module({ providers: [CatalogService], controllers: [CatalogController] })
export class CatalogModule {}
