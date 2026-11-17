import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getDatabase } from "@/lib/db";

type ActivityRow = RowDataPacket & {
  id: string;
  product_name: string;
  activity_type: "Masuk" | "Keluar" | "Produk baru";
  amount: number;
  unit: string;
  revenue: number | null;
  cost_of_goods: number | null;
  profit: number | null;
  created_at: Date;
};

export async function GET() {
  try {
    const pool = await getDatabase();
    const [rows] = await pool.query<ActivityRow[]>(
      `SELECT id, product_name, activity_type, amount, unit, revenue, cost_of_goods, profit, created_at
       FROM stock_activities ORDER BY created_at DESC, id DESC`,
    );
    const activities = rows.map((row) => ({
      id: row.id,
      productName: row.product_name,
      type: row.activity_type,
      amount: row.amount,
      unit: row.unit,
      date: row.created_at.toISOString(),
      ...(row.revenue === null ? {} : { revenue: Number(row.revenue) }),
      ...(row.cost_of_goods === null ? {} : { costOfGoods: Number(row.cost_of_goods) }),
      ...(row.profit === null ? {} : { profit: Number(row.profit) }),
    }));
    return NextResponse.json({ activities });
  } catch (error) {
    return apiError(error);
  }
}
