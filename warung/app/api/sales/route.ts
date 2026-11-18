import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";
import { readJson, RequestValidationError, validationError } from "@/lib/api-response";
import { beginTransaction, rollbackAndRelease } from "@/lib/db";

type SaleProductRow = RowDataPacket & {
  id: string;
  name: string;
  stock: number;
  unit: string;
  buy_price: number;
  sell_price: number;
};

type SaleItem = {
  productId: string;
  quantity: number;
};

function parseSaleItems(value: unknown): SaleItem[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new RequestValidationError("Struk harus berisi 1 sampai 100 produk.");
  }

  const items = new Map<string, number>();
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      throw new RequestValidationError("Format barang pada struk tidak valid.");
    }

    const item = entry as Record<string, unknown>;
    if (
      typeof item.productId !== "string"
      || !item.productId
      || typeof item.quantity !== "number"
      || !Number.isSafeInteger(item.quantity)
      || item.quantity <= 0
    ) {
      throw new RequestValidationError("Produk dan jumlah pada struk harus valid.");
    }

    const quantity = (items.get(item.productId) ?? 0) + item.quantity;
    if (!Number.isSafeInteger(quantity)) {
      throw new RequestValidationError("Jumlah barang pada struk terlalu besar.");
    }
    items.set(item.productId, quantity);
  }

  return Array.from(items, ([productId, quantity]) => ({ productId, quantity }));
}

export async function POST(request: Request) {
  let connection;
  try {
    const data = await readJson(request);
    if (typeof data !== "object" || data === null) {
      throw new RequestValidationError("Data struk belanja tidak valid.");
    }

    const items = parseSaleItems((data as Record<string, unknown>).items);
    const orderedItems = [...items].sort((a, b) => a.productId.localeCompare(b.productId));
    connection = await beginTransaction();

    const placeholders = orderedItems.map(() => "?").join(", ");
    const [rows] = await connection.query<SaleProductRow[]>(
      `SELECT id, name, stock, unit, buy_price, sell_price
       FROM products WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
      orderedItems.map((item) => item.productId),
    );
    const productsById = new Map(rows.map((product) => [product.id, product]));
    const missingProduct = orderedItems.find((item) => !productsById.has(item.productId));
    if (missingProduct) {
      await connection.rollback();
      connection.release();
      return NextResponse.json({ error: "Ada produk pada struk yang tidak lagi tersedia." }, { status: 404 });
    }

    for (const item of orderedItems) {
      const product = productsById.get(item.productId)!;
      if (item.quantity > product.stock) {
        await connection.rollback();
        connection.release();
        return NextResponse.json(
          { error: `Stok ${product.name} hanya tersisa ${product.stock} ${product.unit}.` },
          { status: 409 },
        );
      }
    }

    const activities = [];
    const updatedProducts = [];
    for (const item of orderedItems) {
      const product = productsById.get(item.productId)!;
      const buyPrice = Number(product.buy_price);
      const sellPrice = Number(product.sell_price);
      const revenue = item.quantity * sellPrice;
      const costOfGoods = item.quantity * buyPrice;
      const profit = revenue - costOfGoods;
      const activity = {
        id: randomUUID(),
        productName: product.name,
        type: "Keluar" as const,
        amount: item.quantity,
        unit: product.unit,
        date: new Date().toISOString(),
        revenue,
        costOfGoods,
        profit,
      };

      await connection.execute("UPDATE products SET stock = stock - ? WHERE id = ?", [item.quantity, product.id]);
      await connection.execute(
        `INSERT INTO stock_activities
          (id, product_id, product_name, activity_type, amount, unit, revenue, cost_of_goods, profit)
         VALUES (?, ?, ?, 'Keluar', ?, ?, ?, ?, ?)`,
        [activity.id, product.id, product.name, item.quantity, product.unit, revenue, costOfGoods, profit],
      );

      activities.push(activity);
      updatedProducts.push({
        id: product.id,
        stock: product.stock - item.quantity,
      });
    }

    await connection.commit();
    connection.release();
    return NextResponse.json({ products: updatedProducts, activities });
  } catch (error) {
    if (connection) await rollbackAndRelease(connection);
    return validationError(error);
  }
}
