import seed from '../server/seed.json' with { type: 'json' };

/**
 * Bootstrap compatible con Vercel.
 *
 * El proyecto original usa un servidor Node persistente + SQLite local.
 * En Vercel ese proceso no permanece vivo, por lo que /api/bootstrap
 * terminaba devolviendo HTML de error y el navegador fallaba al parsearlo
 * como JSON. Esta función serverless permite que la tienda pública cargue
 * correctamente mientras la persistencia completa se migra a una base
 * externa.
 */
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
      stock: 0,
    })),
  }));

  return res.status(200).json({
    csrf: '',
    user: null,
    setupAllowed: false,
    products,
    mannequins: [
      {
        id: 'female',
        name: 'Dama · estándar',
        gender: 'Damas',
        image: '/assets/mannequin-female.png',
        active: 1,
        sort: 0,
      },
      {
        id: 'male',
        name: 'Caballero · estándar',
        gender: 'Caballeros',
        image: '/assets/mannequin-male.png',
        active: 1,
        sort: 1,
      },
    ],
    assets: [],
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
