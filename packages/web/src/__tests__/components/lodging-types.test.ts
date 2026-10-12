import { defaultsForMember, isAssignableLodgingKind, snap } from '../../components/lodging/types';

describe('lodging map helpers', () => {
  describe('snap', () => {
    it('rounds values to the nearest grid increment', () => {
      expect(snap(10.24, 0.5)).toBe(10);
      expect(snap(10.26, 0.5)).toBe(10.5);
      expect(snap(11.75, 1)).toBe(12);
    });

    it('leaves values unchanged when the grid size is invalid', () => {
      expect(snap(12.34, 0)).toBe(12.34);
      expect(snap(12.34, -1)).toBe(12.34);
    });
  });

  describe('defaultsForMember', () => {
    it('uses tent defaults when housing data is missing', () => {
      expect(defaultsForMember(null, null)).toEqual({ kind: 'TENT', w: 10, h: 14 });
    });

    it('parses width-by-height housing sizes', () => {
      expect(defaultsForMember('TENT', '10x14')).toEqual({ kind: 'TENT', w: 10, h: 14 });
      expect(defaultsForMember('SHIFTPOD', '8×8')).toEqual({ kind: 'SHIFTPOD', w: 8, h: 8 });
    });

    it('treats RV and trailer ft sizes as length', () => {
      expect(defaultsForMember('RV', '30ft')).toEqual({ kind: 'RV', w: 8, h: 30 });
      expect(defaultsForMember('TRAILER', '20ft trailer')).toEqual({ kind: 'TRAILER', w: 8, h: 20 });
    });

    it('uses square dimensions for non-vehicle ft sizes', () => {
      expect(defaultsForMember('TENT', '12ft bell tent')).toEqual({ kind: 'TENT', w: 12, h: 12 });
    });
  });

  describe('isAssignableLodgingKind', () => {
    it('allows sleeping units to have occupants', () => {
      expect(isAssignableLodgingKind('TENT')).toBe(true);
      expect(isAssignableLodgingKind('RV')).toBe(true);
      expect(isAssignableLodgingKind('DORM')).toBe(true);
    });

    it('blocks labels, boundaries, power boxes, and structures from occupant assignment', () => {
      expect(isAssignableLodgingKind('STREET_LABEL')).toBe(false);
      expect(isAssignableLodgingKind('BOUNDARY')).toBe(false);
      expect(isAssignableLodgingKind('POWER_BOX')).toBe(false);
      expect(isAssignableLodgingKind('STRUCTURE')).toBe(false);
    });
  });
});
