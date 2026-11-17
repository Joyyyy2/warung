import type { ResultSetHeader } from "mysql2";
import { NextResponse } from "next/server";
import { readJson, RequestValidationError, validationError } from "@/lib/api-response";
import { getDatabase } from "@/lib/db";

export async function PATCH(request: Request, context: RouteContext<"/api/products/[id]">) {
  try {
    const { id } = await context.params;
    const data = await readJson(request);
    if (typeof data !== "object" || data === null) throw new RequestValidationError("Data harga tidak valid.");
    const { buyPrice, sellPrice } = data as Record<string, unknown>;
    if (!Number.isSafeInteger(buyPrice) || (buyPrice as number) < 0 || !Number.isSafeInteger(sellPrice) || (sellPrice as number) < 0) {
      throw new RequestValidationError("Harga beli dan harga jual harus berupa angka nol atau lebih.");
    }

    const pool = await getDatabase();
    const [result] = await pool.query<ResultSetHeader>(
      "UPDATE products SET buy_price = ?, sell_price = ? WHERE id = ?",
      [buyPrice, sellPrice, id],
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });

    return NextResponse.json({
      product: { id, buyPrice, sellPrice },
    });
  } catch (error) {
    return validationError(error);
  }
}
