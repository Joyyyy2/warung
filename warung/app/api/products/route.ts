import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";
import { apiError, readJson, RequestValidationError, validationError } from "@/lib/api-response";
import { beginTransaction, getDatabase, rollbackAndRelease } from "@/lib/db";

type ProductRow = RowDataPacket & {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  min_stock: number;
  buy_price: number;
  sell_price: number;
  barcode: string;
};

function serializeProduct(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    stock: row.stock,
    unit: row.unit,
    minStock: row.min_stock,
    buyPrice: Number(row.buy_price),
    sellPrice: Number(row.sell_price),
    barcode: row.barcode,
  };
}

function parseProduct(value: unknown) {
  if (typeof value !== "object" || value === null) throw new RequestValidationError("Data produk tidak valid.");
  const data = value as Record<string, unknown>;
  const { name, category, stock, unit, minStock, buyPrice, sellPrice, barcode } = data;
  if (
    typeof name !== "string" || !name.trim() || name.trim().length > 150
    || typeof category !== "string" || !category.trim() || category.trim().length > 80
    || typeof unit !== "string" || !unit.trim() || unit.trim().length > 30
    || typeof barcode !== "string" || !barcode.trim() || barcode.trim().length > 80
    || !Number.isInteger(stock) || (stock as number) < 0
    || !Number.isInteger(minStock) || (minStock as number) < 0
    || !Number.isSafeInteger(buyPrice) || (buyPrice as number) < 0
    || !Number.isSafeInteger(sellPrice) || (sellPrice as number) < 0
  ) {
    throw new RequestValidationError("Lengkapi detail produk dengan nilai yang valid.");
  }

  return {
    id: randomUUID(),
    name: name.trim(),
    category: category.trim(),
    stock: stock as number,
    unit: unit.trim(),
    minStock: minStock as number,
    buyPrice: buyPrice as number,
    sellPrice: sellPrice as number,
    barcode: barcode.trim(),
  };
}

export async function GET() {
  try {
    const pool = await getDatabase();
    const [rows] = await pool.query<ProductRow[]>(
      "SELECT id, name, category, stock, unit, min_stock, buy_price, sell_price, barcode FROM products ORDER BY name ASC",
    );
    return NextResponse.json({ products: rows.map(serializeProduct) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  let connection;
  try {
    const product = parseProduct(await readJson(request));
    connection = await beginTransaction();
    await connection.execute(
      `INSERT INTO products
        (id, name, category, stock, unit, min_stock, buy_price, sell_price, barcode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [product.id, product.name, product.category, product.stock, product.unit, product.minStock, product.buyPrice, product.sellPrice, product.barcode],
    );
    const activity = {
      id: randomUUID(),
      productId: product.id,
      productName: product.name,
      type: "Produk baru",
      amount: product.stock,
      unit: product.unit,
      date: new Date().toISOString(),
    };
    await connection.execute(
      `INSERT INTO stock_activities (id, product_id, product_name, activity_type, amount, unit)
       VALUES (?, ?, ?, 'Produk baru', ?, ?)`,
      [activity.id, product.id, product.name, product.stock, product.unit],
    );
    await connection.commit();
    connection.release();
    return NextResponse.json({ product, activity }, { status: 201 });
  } catch (error) {
    if (connection) await rollbackAndRelease(connection);
    return validationError(error);
  }
}
