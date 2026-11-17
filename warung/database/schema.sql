CREATE DATABASE IF NOT EXISTS warungkita
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE warungkita;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
