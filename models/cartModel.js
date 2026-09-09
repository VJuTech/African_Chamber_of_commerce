const pool = require("../database/connection");

function normalizeItem(row = {}) {
  const quantity = Number(row.quantity || 1);
  const unitPrice = Number(row.unitPrice || 0);
  return {
    id: Number(row.id),
    cartId: Number(row.cartId),
    listingId: Number(row.listingId),
    quantity,
    unitPrice,
    totalPrice: quantity * unitPrice,
    currency: row.currency || "USD",
    title: row.title || "Listing",
    description: row.description || "",
    listingType: row.listingType || "product",
    availability: row.availability || "available",
    inventory: Number(row.inventory || 0),
    sellerId: Number(row.sellerId || 0),
    media: Array.isArray(row.media) ? row.media : [],
  };
}

async function ensureCart(userId, client = pool) {
  const result = await client.query(
    `INSERT INTO shopping_carts (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [Number(userId)]
  );
  return Number(result.rows[0].id);
}

async function getCart(userId) {
  if (!userId) return { id: null, items: [], total: 0, currency: "USD" };
  const result = await pool.query(
    `SELECT c.id AS "cartId", ci.id, ci.listing_id AS "listingId", ci.quantity,
            ci.unit_price AS "unitPrice", ci.currency,
            ml.title, ml.description, ml.listing_type AS "listingType",
            ml.availability, ml.inventory, ml.media,
            ba.owner_id AS "sellerId"
     FROM shopping_carts c
     LEFT JOIN cart_items ci ON ci.cart_id = c.id
     LEFT JOIN marketplace_listings ml ON ml.id = ci.listing_id AND ml.status <> 'deleted'
     LEFT JOIN business_accounts ba ON ba.id = ml.business_id
     WHERE c.user_id = $1
     ORDER BY ci.created_at DESC`,
    [Number(userId)]
  );
  const items = result.rows.filter((row) => row.listingId).map(normalizeItem);
  return {
    id: result.rows[0] ? Number(result.rows[0].cartId) : null,
    items,
    total: items.reduce((sum, item) => sum + item.totalPrice, 0),
    currency: items[0] ? items[0].currency : "USD",
  };
}

async function addItem(userId, listingId, quantity = 1) {
  const safeQuantity = Number(quantity);
  if (!userId || !listingId || !Number.isInteger(safeQuantity) || safeQuantity < 1) {
    return { success: false, message: "Choose a valid quantity before adding the item." };
  }
  const listing = await pool.query(
    `SELECT ml.id, ml.price, ml.currency, ml.listing_type, ml.inventory, ml.availability
     FROM marketplace_listings ml
     WHERE ml.id = $1 AND ml.status = 'active' AND ml.visibility = 'public'`,
    [Number(listingId)]
  );
  if (!listing.rows[0]) return { success: false, message: "This listing is no longer available." };
  const record = listing.rows[0];
  if (record.listing_type === "product" && Number(record.inventory) < safeQuantity) {
    return { success: false, message: "The requested quantity is not currently available." };
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cartId = await ensureCart(userId, client);
    await client.query(
      `INSERT INTO cart_items (cart_id, listing_id, quantity, unit_price, currency)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (cart_id, listing_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity,
                     unit_price = EXCLUDED.unit_price,
                     currency = EXCLUDED.currency,
                     updated_at = CURRENT_TIMESTAMP`,
      [cartId, Number(listingId), safeQuantity, Number(record.price || 0), record.currency || "USD"]
    );
    await client.query("UPDATE shopping_carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", [cartId]);
    await client.query("COMMIT");
    return { success: true, message: "Item added to your cart." };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateItem(userId, listingId, quantity) {
  const safeQuantity = Number(quantity);
  if (!Number.isInteger(safeQuantity) || safeQuantity < 1) {
    return removeItem(userId, listingId);
  }
  const result = await pool.query(
    `UPDATE cart_items ci SET quantity = $1, updated_at = CURRENT_TIMESTAMP
     FROM shopping_carts c
     WHERE ci.cart_id = c.id AND c.user_id = $2 AND ci.listing_id = $3
     RETURNING ci.id`,
    [safeQuantity, Number(userId), Number(listingId)]
  );
  return result.rowCount ? { success: true, message: "Cart updated." } : { success: false, message: "Cart item not found." };
}

async function removeItem(userId, listingId) {
  const result = await pool.query(
    `DELETE FROM cart_items ci USING shopping_carts c
     WHERE ci.cart_id = c.id AND c.user_id = $1 AND ci.listing_id = $2
     RETURNING ci.id`,
    [Number(userId), Number(listingId)]
  );
  return result.rowCount ? { success: true, message: "Item removed from your cart." } : { success: false, message: "Cart item not found." };
}

async function clearCart(userId, client = pool) {
  await client.query(
    `DELETE FROM cart_items ci USING shopping_carts c
     WHERE ci.cart_id = c.id AND c.user_id = $1`,
    [Number(userId)]
  );
}

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
