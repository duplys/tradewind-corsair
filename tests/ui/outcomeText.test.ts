// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { compareShips } from '../../src/ui/outcomeText';

describe('compareShips', () => {
  it('sums up the prize against your ship', () => {
    expect(compareShips('sloop', 'frigate')).toBe(
      'Frigate: 28 guns, 8 kn. Slower upwind than your sloop.',
    );
    expect(compareShips('galleon', 'sloop')).toBe(
      'Sloop: 8 guns, 9 kn. Better upwind than your galleon.',
    );
    expect(compareShips('fluyt', 'fluyt')).toBe(
      'Fluyt: 10 guns, 7 kn. As weatherly as your fluyt.',
    );
  });
});
