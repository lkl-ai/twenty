import { removeUndefinedFromRecord } from 'src/engine/core-modules/record-crud/utils/remove-undefined-from-record.util';

describe('removeUndefinedFromRecord', () => {
  it('removes undefined values while preserving explicit null values', () => {
    expect(
      removeUndefinedFromRecord({
        wonAt: null,
        lostAt: undefined,
        address: {
          addressCity: null,
          addressCountry: undefined,
        },
        emptyComposite: {
          value: undefined,
        },
      }),
    ).toEqual({
      wonAt: null,
      address: {
        addressCity: null,
      },
    });
  });
});
