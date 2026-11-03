-- Defense in depth for same-row domain invariants; cross-row hierarchy/access
-- is validated by application services. No historical operational data yet.
ALTER TABLE "Location" ADD CONSTRAINT "location_partner_stand_only"
  CHECK ("ownership" <> 'PARTNER' OR "type" = 'STAND');
ALTER TABLE "Location" ADD CONSTRAINT "location_parent_shape"
  CHECK (("type" = 'CENTER' AND "parentId" IS NULL) OR ("type" <> 'CENTER' AND "parentId" IS NOT NULL));
ALTER TABLE "User" ADD CONSTRAINT "user_scope_shape"
  CHECK (("role" = 'CENTRAL_ADMIN' AND "locationId" IS NULL) OR ("role" <> 'CENTRAL_ADMIN' AND "locationId" IS NOT NULL));
ALTER TABLE "Unit" ADD CONSTRAINT "unit_positive_factor" CHECK ("factor" > 0);
ALTER TABLE "Recipe" ADD CONSTRAINT "recipe_positive_output" CHECK ("outputQuantity" > 0 AND "outputBaseQuantity" > 0 AND "version" > 0);
ALTER TABLE "Recipe" ADD CONSTRAINT "recipe_output_shape" CHECK (
  ("kind" = 'PRODUCTION' AND "outputItemId" IS NOT NULL AND "menuVariantId" IS NULL)
  OR ("kind" = 'SERVING' AND "outputItemId" IS NULL AND "menuVariantId" IS NOT NULL AND "outputQuantity" = 1 AND "outputUnitCode" = 'pcs')
);
ALTER TABLE "RecipeComponent" ADD CONSTRAINT "recipe_component_positive_quantity" CHECK ("quantity" > 0 AND "baseQuantity" > 0);