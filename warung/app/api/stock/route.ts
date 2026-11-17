import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";
import { readJson, RequestValidationError, validationError } from "@/lib/api-response";
import { beginTransaction, rollbackAndRelease } from "@/lib/db";

type ProductRow = RowDataPacket & {
  id: string;
  name: string;
  stock: number;
  unit: string;
  buy_price: number;
  sell_price: number;
};

export async function POST(request: Request) {
  let connection;
  try {
    const data = await readJson(request);
    if (typeof data !== "object" || data === null) throw new RequestValidationError("Data perubahan stok tidak valid.");
    const { productId, mode, amount, buyPrice, sellPrice } = data as Record<string, unknown>;
    if (
      typeof productId !== "string"
      || (mode !== "Masuk" && mode !== "Keluar")
      || typeof amount !== "number"
      || !Number.isInteger(amount)
      || (amount as number) <= 0
      || (mode === "Masuk" && (
        !Number.isSafeInteger(buyPrice) || (buyPrice as number) < 0
        || !Number.isSafeInteger(sellPrice) || (sellPrice as number) < 0
      ))
    ) {
      throw new RequestValidationError("Produk, jenis perubahan, dan jumlah stok harus valid.");
    }

    connection = await beginTransaction();
    const [rows] = await connection.query<ProductRow[]>(
      "SELECT id, name, stock, unit, buy_price, sell_price FROM products WHERE id = ? FOR UPDATE",
      [productId],
    );
    const product = rows[0];
    if (!product) {
      await connection.rollback();
      connection.release();
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    if (mode === "Keluar" && amount > product.stock) {
      await connection.rollback();
      connection.release();
      return NextResponse.json({ error: `Stok hanya tersisa ${product.stock} ${product.unit}.` }, { status: 409 });
    }

    const amountValue = amount as number;
    const newStock = product.stock + (mode === "Masuk" ? amountValue : -amountValue);
    const nextBuyPrice = mode === "Masuk" ? buyPrice as number : Number(product.buy_price);
    const nextSellPrice = mode === "Masuk" ? sellPrice as number : Number(product.sell_price);
    if (mode === "Masuk") {
      await connection.execute(
        "UPDATE products SET stock = ?, buy_price = ?, sell_price = ? WHERE id = ?",
        [newStock, nextBuyPrice, nextSellPrice, product.id],
      );
    } else {
      await connection.execute("UPDATE products SET stock = ? WHERE id = ?", [newStock, product.id]);
    }

    const activity = {
      id: randomUUID(),
      productName: product.name,
      type: mode,
      amount: amountValue,
      unit: product.unit,
      date: new Date().toISOString(),
      ...(mode === "Keluar" ? {
        revenue: amountValue * nextSellPrice,
        costOfGoods: amountValue * nextBuyPrice,
        profit: amountValue * (nextSellPrice - nextBuyPrice),
      } : {}),
    };
    await connection.execute(
      `INSERT INTO stock_activities
        (id, product_id, product_name, activity_type, amount, unit, revenue, cost_of_goods, profit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        activity.id,
        product.id,
        product.name,
        mode,
        amountValue,
        product.unit,
        activity.revenue ?? 0,
        activity.costOfGoods ?? 0,
        activity.profit ?? 0,
      ],
    );
    await connection.commit();
    connection.release();

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        stock: newStock,
        unit: product.unit,
        buyPrice: nextBuyPrice,
        sellPrice: nextSellPrice,
      },
      activity,
    });
  } catch (error) {
    if (connection) await rollbackAndRelease(connection);
    return validationError(error);
  }
}
