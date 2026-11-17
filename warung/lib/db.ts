import mysql, { type Pool, type PoolConnection } from "mysql2/promise";

type DatabaseGlobal = typeof globalThis & {
  warungPool?: Pool;
  warungSchemaReady?: Promise<void>;
};

const databaseGlobal = globalThis as DatabaseGlobal;

function getPool() {
  if (databaseGlobal.warungPool) return databaseGlobal.warungPool;

  const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;
  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_DATABASE) {
    throw new Error("Konfigurasi MySQL belum lengkap. Atur MYSQL_HOST, MYSQL_USER, dan MYSQL_DATABASE.");
  }

  const port = Number(MYSQL_PORT ?? "3306");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("MYSQL_PORT harus berupa nomor port yang valid.");
  }

  databaseGlobal.warungPool = mysql.createPool({
    host: MYSQL_HOST,
    port,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD ?? "",
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
    charset: "utf8mb4",
    ssl: {
      minVersion: "TLSv1.2",
    },
  });

  return databaseGlobal.warungPool;
}

async function ensureSchema(pool: Pool) {
  if (!databaseGlobal.warungSchemaReady) {
    databaseGlobal.warungSchemaReady = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS products (
          id CHAR(36) NOT NULL PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          category VARCHAR(80) NOT NULL,
          stock INT UNSIGNED NOT NULL DEFAULT 0,
          unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
          min_stock INT UNSIGNED NOT NULL DEFAULT 0,
          buy_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
          sell_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
          barcode VARCHAR(80) NOT NULL,
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          UNIQUE KEY products_barcode_unique (barcode)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS stock_activities (
          id CHAR(36) NOT NULL PRIMARY KEY,
          product_id CHAR(36) NULL,
          product_name VARCHAR(150) NOT NULL,
          activity_type ENUM('Masuk', 'Keluar', 'Produk baru') NOT NULL,
          amount INT UNSIGNED NOT NULL DEFAULT 0,
          unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
          revenue DECIMAL(15, 2) NULL,
          cost_of_goods DECIMAL(15, 2) NULL,
          profit DECIMAL(15, 2) NULL,
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          KEY stock_activities_created_at_idx (created_at),
          KEY stock_activities_product_id_idx (product_id),
          CONSTRAINT stock_activities_product_fk FOREIGN KEY (product_id)
            REFERENCES products (id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })().catch((error: unknown) => {
      databaseGlobal.warungSchemaReady = undefined;
      throw error;
    });
  }

  await databaseGlobal.warungSchemaReady;
}

export async function getDatabase() {
  const pool = getPool();
  await ensureSchema(pool);
  return pool;
}

export async function beginTransaction() {
  const pool = await getDatabase();
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  return connection;
}

export async function rollbackAndRelease(connection: PoolConnection) {
  try {
    await connection.rollback();
  } finally {
    connection.release();
  }
}
