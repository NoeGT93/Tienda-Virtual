import seed from '../server/seed.json' with { type: 'json' };
import outfitSeed from '../server/outfit-seed.json' with { type: 'json' };

/**
 * Bootstrap compatible con Vercel.
 *
 * Mantiene la tienda pública operativa sin depender del servidor SQLite
 * local. La calibración visual del probador vive únicamente en el frontend
 * para no alterar composiciones editoriales como la portada.
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const products = [...seed, ...outfitSeed].map((product) => ({
    ...product,
    oldPrice: product.oldPrice ?? null,
    active: 1,
    image: product.image ?? null,
    variants: (product.sizes ?? []).map((size) => ({
      id: `${product.id}-${size}`,
      product_id: product.id,
      size,
      sku: `${product.id}-${size}`,
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
    // Importante: la portada y las vistas guardadas usan las posiciones
    // editoriales originales. El ajuste fino del probador se aplica solo
    // cuando la prenda es interactiva dentro del escenario.
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
