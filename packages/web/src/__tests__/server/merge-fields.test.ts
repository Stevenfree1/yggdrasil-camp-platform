import { renderMergeFields, buildRecipientContext } from '../../server/lib/mergeFields';

describe('mergeFields — renderMergeFields', () => {
  it('substitutes a known field', () => {
    expect(renderMergeFields('Hi {{firstName}}!', { firstName: 'Jane' })).toBe('Hi Jane!');
  });

  it('substitutes repeated and multiple fields', () => {
    expect(
      renderMergeFields('{{firstName}}, dues are {{duesAmount}}. Thanks {{firstName}}.', {
        firstName: 'Sara',
        duesAmount: '$1,200',
      }),
    ).toBe('Sara, dues are $1,200. Thanks Sara.');
  });

  it('tolerates whitespace inside the braces', () => {
    expect(renderMergeFields('Hi {{ firstName }}', { firstName: 'Jane' })).toBe('Hi Jane');
  });

  it('strips unknown placeholders rather than leaving literal braces', () => {
    expect(renderMergeFields('Hi {{firstName}}, {{bogus}} ok', { firstName: 'Jane' })).toBe('Hi Jane,  ok');
    expect(renderMergeFields('a {{bogus}} b', {})).not.toContain('{{');
  });

  it('strips a known-but-empty field', () => {
    expect(renderMergeFields('x{{firstName}}y', { firstName: '' })).toBe('xy');
  });
});

describe('mergeFields — buildRecipientContext', () => {
  const shared = { seasonName: 'Burn 2026' };

  it('uses the first whitespace token of the name as firstName', () => {
    const ctx = buildRecipientContext({ email: 'a@b.c', name: 'Jane Doe', duesOverrideCents: null }, shared, 120000);
    expect(ctx.firstName).toBe('Jane');
    expect(ctx.seasonName).toBe('Burn 2026');
    expect(ctx.duesAmount).toBe('$1,200');
  });

  it('falls back to "there" when the name is missing', () => {
    const ctx = buildRecipientContext({ email: 'a@b.c', name: null, duesOverrideCents: null }, shared, 120000);
    expect(ctx.firstName).toBe('there');
  });

  it('formats a custom override amount instead of the season default', () => {
    const ctx = buildRecipientContext({ email: 'a@b.c', name: 'Sam', duesOverrideCents: 60000 }, shared, 120000);
    expect(ctx.duesAmount).toBe('$600');
  });

  it('formats non-whole amounts with cents', () => {
    const ctx = buildRecipientContext({ email: 'a@b.c', name: 'Sam', duesOverrideCents: 125050 }, shared, 120000);
    expect(ctx.duesAmount).toBe('$1,250.50');
  });
});
