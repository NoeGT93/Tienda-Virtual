import seed from '../server/seed.json' with { type: 'json' };

/**
 * Bootstrap compatible con Vercel.
 *
 * La versión local usa SQLite, pero el escaparate publicado necesita datos
 * suficientes para que catálogo y probador funcionen sin ese proceso
 * persistente. Las posiciones de abajo son una calibración visual por
 * producto y maniquí; cuando el backend persistente se migre, los ajustes
 * guardados en garment_assets podrán sustituirlas sin cambiar el frontend.
 */

const FEMALE = 'female';
const MALE = 'male';

const FIT = {
  [FEMALE]: {
    TOP:       { x: 27, y: 21, width: 46, height: 28, rotation: 0, z: 20 },
    OUTERWEAR: { x: 16, y: 18, width: 68, height: 39, rotation: 0, z: 30 },
    PANTS:     { x: 21, y: 42, width: 58, height: 51, rotation: 0, z: 10 },
    SKIRT:     { x: 22, y: 43, width: 56, height: 41, rotation: 0, z: 10 },
    BAG:       { x: 62, y: 45, width: 27, height: 23, rotation: -2, z: 50 },
  },
  [MALE]: {
    OUTERWEAR: { x: 14, y: 18, width: 72, height: 39, rotation: 0, z: 30 },
    PANTS:     { x: 19, y: 42, width: 62, height: 51, rotation: 0, z: 10 },
    BAG:       { x: 64, y: 45, width: 26, height: 22, rotation: -2, z: 50 },
  },
};

const skirtIds = new Set(['falda-cacao', 'falda-perla']);

function fitFor(product, mannequinId) {
  const group = FIT[mannequinId];
  if (!group) return null;
  if (product.category === 'BOTTOM') return group[skirtIds.has(product.id) ? 'SKIRT' : 'PANTS'] ?? null;
  return group[product.category] ?? null;
}

function supports(product, mannequinId) {
  if (mannequinId === FEMALE) return product.gender === 'Damas' || product.gender === 'Unisex';
  if (mannequinId === MALE) return product.gender === 'Caballeros' || product.gender === 'Unisex';
  return false;
}

const assets = [];
for (const product of seed) {
  for (const mannequinId of [FEMALE, MALE]) {
    if (!supports(product, mannequinId)) continue;
    const fit = fitFor(product, mannequinId);
    if (!fit) continue;
    assets.push({
      product_id: product.id,
      mannequin_id: mannequinId,
      ...fit,
      image: null,
    });
  }
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const products = seed.map((product) => ({
    ...product,
    oldPrice: product.oldPrice ?? null,
    active: 1,
    image: product.image ?? null,
    variants: (product.sizes ?? []).map((size) => ({
      id: `${product.id}-${size}`,
      product_id: product.id,
      size,
      sku: `${product.id}-${size}`,
      // En el escaparate serverless se usa un stock demostrativo para que
      // seleccionar talla y agregar a la bolsa sí funcione. No representa
      // inventario comercial real.
      stock: 6,
    })),
  }));

  return res.status(200).json({
    csrf: '',
    user: null,
    setupAllowed: false,
    products,
    mannequins: [
      {
        id: FEMALE,
        name: 'Dama · estándar',
        gender: 'Damas',
        image: '/assets/mannequin-female.png',
        active: 1,
        sort: 0,
      },
      {
        id: MALE,
        name: 'Caballero · estándar',
        gender: 'Caballeros',
        image: '/assets/mannequin-male.png',
        active: 1,
        sort: 1,
      },
    ],
    assets,
    settings: {
      id: 1,
      shipping: 3500,
      free_over: 0,
      bank_instructions: '',
      cod: 0,
      store_name: 'Lulos Fashion Xela',
      address: '',
      phone: '',
      checkout_enabled: 0,
    },
    orders: [],
    favorites: [],
    outfits: [],
    addresses: [],
  });
}
