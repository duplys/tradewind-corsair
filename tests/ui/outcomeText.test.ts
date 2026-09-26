// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { compareShips } from '../../src/ui/outcomeText';

describe('compareShips', () => {
  it('sums up the prize against your ship', () => {
    expect(compareShips('galleon', 'sloop')).toBe(
      'Sloop: 8 guns, 9 kn (your galleon 6.5 kn). Better upwind than your galleon.',
    );
    expect(compareShips('fluyt', 'fluyt')).toBe(
      'Fluyt: 10 guns, 7 kn (your fluyt 7 kn). As weatherly as your fluyt.',
    );
  });

  it('warns when the prize would be harder to escape in', () => {
    expect(compareShips('sloop', 'fluyt')).toBe(
      'Fluyt: 10 guns, 7 kn (your sloop 9 kn). Slower upwind than your sloop. ' +
        'Warships will be hard to outrun in her.',
    );
    expect(compareShips('sloop', 'frigate')).toContain('hard to outrun');
  });

  it('gives no warning for a faster or equal ship', () => {
    expect(compareShips('fluyt', 'frigate')).not.toContain('hard to outrun');
    expect(compareShips('sloop', 'sloop')).not.toContain('hard to outrun');
  });
});
