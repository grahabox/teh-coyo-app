import { describe, expect, it } from 'vitest';
import { entityFormSchema, locationFormSchema } from './location.schemas';

const id = 'd1c7d877-ec61-46b4-8cf5-b9d68c3fb6ff';
describe('Location dialog rules', () => {
  it('requires a parent for DC/stand and a selected owner for partner', () => {
    const base = {
      name: 'Stand Example',
      code: 'STAND-01',
      type: 'STAND',
      ownership: 'OWNED',
      entityId: id,
      parentId: null,
    };
    const missingParent = locationFormSchema.safeParse(base);
    expect(missingParent.success).toBe(false);
    expect(locationFormSchema.safeParse({ ...base, parentId: id }).success).toBe(true);
    expect(
      locationFormSchema.safeParse({ ...base, parentId: id, ownership: 'PARTNER', entityId: '' })
        .success,
    ).toBe(false);
  });
  it('requires a center owner and validates owner names/codes', () => {
    expect(
      locationFormSchema.safeParse({
        name: 'Pusat',
        code: 'PUSAT',
        type: 'CENTER',
        ownership: 'OWNED',
        parentId: null,
        entityId: '',
      }).success,
    ).toBe(false);
    expect(entityFormSchema.safeParse({ name: '', code: 'invalid code' }).success).toBe(false);
  });
});
