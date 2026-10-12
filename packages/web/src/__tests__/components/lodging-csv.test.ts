import { parseLodgingCsv } from '../../components/lodging/csv';

describe('parseLodgingCsv', () => {
  it('parses valid lodging units', () => {
    const parsed = parseLodgingCsv(`memberName,kind,label,w,h,x,y,rotation,partnerCamp
Jamie Rivera,RV,Kodiak-1,8,25,12,12,0,
,STRUCTURE,Kitchen,16,16,40,12,0,`);

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      memberName: 'Jamie Rivera',
      kind: 'RV',
      label: 'Kodiak-1',
      w: 8,
      h: 25,
      x: 12,
      y: 12,
      rotation: 0,
    });
  });

  it('handles quoted commas and escaped quotes', () => {
    const parsed = parseLodgingCsv(`memberName,kind,label,w,h,x,y,rotation,partnerCamp
"Rivera, Jamie",STREET_LABEL,"9:00 & ""F""",12,4,30,0,0,"Neighbor, Camp"`);

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      memberName: 'Rivera, Jamie',
      label: '9:00 & "F"',
      partnerCamp: 'Neighbor, Camp',
    });
  });

  it('reports missing required columns', () => {
    const parsed = parseLodgingCsv('memberName,kind,label\nJamie,TENT,Tent');

    expect(parsed.rows).toEqual([]);
    expect(parsed.errors).toEqual([
      'Missing required column: "w"',
      'Missing required column: "h"',
      'Missing required column: "x"',
      'Missing required column: "y"',
    ]);
  });

  it('skips invalid rows and keeps valid rows', () => {
    const parsed = parseLodgingCsv(`memberName,kind,label,w,h,x,y
Bad,CASTLE,Nope,10,10,0,0
Good,TENT,Tent,10,12,4,5`);

    expect(parsed.errors).toEqual(['Line 2: invalid kind "CASTLE"']);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].memberName).toBe('Good');
  });
});
