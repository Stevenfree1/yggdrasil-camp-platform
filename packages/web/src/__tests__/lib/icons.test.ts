import { getIcon } from '../../lib/icons';
import { Star, Users, Calendar, Heart, Flame, Mountain, Music } from 'lucide-react';

describe('getIcon', () => {
  it('should return the correct icon for known names', () => {
    expect(getIcon('users')).toBe(Users);
    expect(getIcon('calendar')).toBe(Calendar);
    expect(getIcon('heart')).toBe(Heart);
    expect(getIcon('flame')).toBe(Flame);
    expect(getIcon('mountain')).toBe(Mountain);
    expect(getIcon('music')).toBe(Music);
  });

  it('should be case-insensitive', () => {
    expect(getIcon('Users')).toBe(Users);
    expect(getIcon('CALENDAR')).toBe(Calendar);
    expect(getIcon('Heart')).toBe(Heart);
  });

  it('should return Star as default for unknown icon names', () => {
    expect(getIcon('unknown')).toBe(Star);
    expect(getIcon('')).toBe(Star);
    expect(getIcon('nonexistent-icon')).toBe(Star);
  });

  it('should handle hyphenated icon names', () => {
    const dollarSign = getIcon('dollar-sign');
    expect(dollarSign).toBeDefined();
    expect(dollarSign).not.toBe(Star); // Should find the actual icon, not fallback

    const arrowRight = getIcon('arrow-right');
    expect(arrowRight).toBeDefined();
    expect(arrowRight).not.toBe(Star);
  });
});
