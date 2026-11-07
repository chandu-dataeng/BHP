/**
 * Dummy images (free Unsplash photos). Replace with your own photo URLs later —
 * if any URL fails to load, the [appImgFallback] directive shows a local illustration.
 */
const u = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

export const IMG = {
  towers: [
    u('1545324418-cc1a3fa10c00'),
    u('1460317442991-0ec209397118'),
    u('1574362848149-11496d93a7c7'),
    u('1515263487990-61b07816b324'),
    u('1567496898669-ee935f5f647a'),
    u('1493809842364-78817add7ffb'),
  ],
  living: [
    u('1502672260266-1c1ef2d93688'),
    u('1522708323590-d24dbb6b0267'),
    u('1586023492125-27b2c045efd7'),
    u('1554995207-c18c203602cb'),
    u('1600607687939-ce8a6c25118c'),
    u('1560448204-e02f11c3d0e2'),
    u('1600210492486-724fe5c67fb0'),
  ],
  kitchen: [
    u('1484154218962-a197022b5858'),
    u('1556909114-f6e7ad7d3136'),
    u('1600566753190-17f0baa2a6c3'),
  ],
  bedroom: [
    u('1505693416388-ac5ce068fe85'),
    u('1540518614846-7eded433c457'),
    u('1522771739844-6a9f6d5f14af'),
  ],
  bathroom: [
    u('1552321554-5fefe8c9ef14'),
    u('1584622650111-993a426fbf0a'),
  ],
  amenity: [
    u('1576013551627-0cc20b96c2a7'),  // pool
    u('1571902943202-507ec2618e8f'),  // gym
    u('1534438327276-14e5300c3a48'),  // gym 2
  ],
  land: [
    u('1500382017468-9049fed747ef'),
    u('1500076656116-558758c991c1'),
    u('1501785888041-af3ef285b470'),
    u('1470071459604-3b5ec3a7fe05'),
    u('1464146072230-91cabc968266'),
    u('1426604966848-d7adac402bff'),
  ],
  villa: [
    u('1600596542815-ffad4c1539a9'),
    u('1512917774080-9991f1c4c750'),
    u('1564013799919-ab600027ffc6'),
    u('1570129477492-45c003edd2be'),
    u('1580587771525-78b9dba3b914'),
    u('1613490493576-7fde63acd811'),
  ],
  hero: {
    rent: u('1545324418-cc1a3fa10c00', 1400),
    sale: u('1500382017468-9049fed747ef', 1400),
  },
};

/** Pick n items from a list starting at an offset (wraps around). */
export function pick<T>(list: T[], start: number, n: number): T[] {
  return Array.from({ length: n }, (_, i) => list[(start + i) % list.length]);
}
