import { NextResponse } from "next/server";

export function apiError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    if (code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Barcode sudah digunakan oleh produk lain." }, { status: 409 });
    }
  }

  console.error("API inventaris gagal:", error);
  const message = error instanceof Error ? error.message : "Terjadi kesalahan pada server.";
  if (message.startsWith("Konfigurasi MySQL") || message.startsWith("MYSQL_PORT")) {
    return NextResponse.json({ error: message }, { status: 503 });
  }
  return NextResponse.json({ error: "Terjadi kesalahan saat mengakses database." }, { status: 500 });
}

export async function readJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    throw new RequestValidationError("Body request harus berupa JSON yang valid.");
  }
}

export class RequestValidationError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export function validationError(error: unknown) {
  if (error instanceof RequestValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return apiError(error);
}
