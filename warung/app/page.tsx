"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";

type Product = {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  minStock: number;
  buyPrice: number;
  sellPrice: number;
  barcode: string;
};

type Activity = {
  id: string;
  productName: string;
  type: "Masuk" | "Keluar" | "Produk baru";
  amount: number;
  unit: string;
  date: string;
  revenue?: number;
  costOfGoods?: number;
  profit?: number;
};

type CartLine = {
  productId: string;
  quantity: number;
};

type ProductForm = {
  name: string;
  barcode: string;
  category: string;
  stock: string;
  unit: string;
  minStock: string;
  buyPrice: string;
  sellPrice: string;
};

type IconName =
  | "grid" | "box" | "clock" | "alert" | "scan" | "plus" | "search"
  | "arrow-down" | "arrow-up" | "package" | "wallet" | "chevron"
  | "close" | "check" | "camera" | "barcode";

const emptyForm: ProductForm = {
  name: "",
  barcode: "",
  category: "Makanan",
  stock: "",
  unit: "pcs",
  minStock: "5",
  buyPrice: "",
  sellPrice: "",
};

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
      ? body.error
      : `Permintaan gagal (${response.status}).`;
    throw new Error(message);
  }
  return body as T;
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<IconName, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    box: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="m4 7 8 4 8-4M4 7v10l8 4 8-4V7M12 11v10" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    alert: <><path d="m10.3 4.3-7 12.1A2 2 0 0 0 5 19.5h14a2 2 0 0 0 1.7-3.1l-7-12.1a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 3h.01" /></>,
    scan: <><path d="M4 7V5a1 1 0 0 1 1-1h2m10 0h2a1 1 0 0 1 1 1v2M4 17v2a1 1 0 0 0 1 1h2m10 0h2a1 1 0 0 0 1-1v-2M7 12h10M9 9v6m6-6v6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    "arrow-down": <><path d="M12 4v15m-6-6 6 6 6-6" /></>,
    "arrow-up": <><path d="M12 20V5m-6 6 6-6 6 6" /></>,
    package: <><path d="m4 7 8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7" /><path d="M8 5l8 4" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18m-5 5h2M6 5V3h12v2" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    camera: <><path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="3.5" /></>,
    barcode: <><path d="M4 5v14M7 5v14m3-14v14m4-14v14m3-14v14m3-14v14" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function getStockStatus(product: Product) {
  if (product.stock === 0) return { label: "Habis", className: "status-empty" };
  if (product.stock <= product.minStock) return { label: "Menipis", className: "status-low" };
  return { label: "Aman", className: "status-safe" };
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activePage, setActivePage] = useState("Ringkasan");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Semua kategori");
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustMode, setAdjustMode] = useState<"Masuk" | "Keluar">("Masuk");
  const [adjustAmount, setAdjustAmount] = useState("1");
  const [adjustBuyPrice, setAdjustBuyPrice] = useState("");
  const [adjustSellPrice, setAdjustSellPrice] = useState("");
  const [adjustError, setAdjustError] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<"Masuk" | "Keluar">("Masuk");
  const [saleCart, setSaleCart] = useState<CartLine[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [saleError, setSaleError] = useState("");
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [manualSaleSearch, setManualSaleSearch] = useState("");
  const [scannerError, setScannerError] = useState("");
  const [cameraMessage, setCameraMessage] = useState("");
  const [cameraRetryable, setCameraRetryable] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scannerModeRef = useRef<"Masuk" | "Keluar">("Masuk");
  const addProductToSale = useCallback((product: Product) => {
    setSaleCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) => line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [...current, { productId: product.id, quantity: 1 }];
    });
    setSaleError("");
    setManualSaleSearch("");
    setScannerOpen(false);
    setReceiptOpen(true);
    setNotice(`${product.name} ditambahkan ke struk.`);
  }, []);

  const resolveBarcode = useCallback((code: string) => {
    const cleanedCode = code.trim();
    if (!cleanedCode) {
      setScannerError("Masukkan barcode terlebih dahulu.");
      return;
    }
    const product = products.find((item) => item.barcode === cleanedCode);
    setScannerOpen(false);
    setScannerError("");
    setBarcodeInput("");
    setCameraMessage("");
    if (product) {
      if (scannerModeRef.current === "Keluar") {
        addProductToSale(product);
      } else {
        setAdjustProduct(product);
        setAdjustMode("Masuk");
        setAdjustAmount("1");
        setAdjustBuyPrice(String(product.buyPrice));
        setAdjustSellPrice(String(product.sellPrice));
        setAdjustError("");
        setNotice(`Produk ditemukan: ${product.name}`);
      }
    } else {
      openNewProduct(cleanedCode);
      setNotice("Barcode belum terdaftar. Lengkapi form untuk membuat produk baru.");
    }
  }, [products, addProductToSale]);

  function openScanner(mode: "Masuk" | "Keluar" = "Masuk") {
    scannerModeRef.current = mode;
    setScannerMode(mode);
    setScannerError("");
    setBarcodeInput("");
    setManualSaleSearch("");
    setCameraMessage("");
    setCameraRetryable(false);
    setCameraAttempt(0);
    setScannerOpen(true);
  }

  function retryCamera() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setCameraRetryable(false);
    setCameraMessage("Mencoba membuka kamera kembali…");
    setCameraAttempt((attempt) => attempt + 1);
  }

  function changeScannerMode(mode: "Masuk" | "Keluar") {
    scannerModeRef.current = mode;
    setScannerMode(mode);
    setScannerError("");
    setManualSaleSearch("");
  }

  function setSaleQuantity(productId: string, value: string) {
    const quantity = Number(value);
    if (value !== "" && (!Number.isSafeInteger(quantity) || quantity < 0)) {
      return;
    }
    setSaleCart((current) => current.map((line) => line.productId === productId ? { ...line, quantity: value === "" ? 0 : quantity } : line));
    setSaleError(value === "" || quantity === 0 ? "Jumlah setiap barang pada struk harus minimal 1." : "");
  }

  const receiptLines = useMemo(() => saleCart.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId);
    return product ? [{ product, quantity: line.quantity }] : [];
  }), [saleCart, products]);
  const receiptTotal = useMemo(() => receiptLines.reduce((sum, line) => sum + line.quantity * line.product.sellPrice, 0), [receiptLines]);
  const receiptCost = useMemo(() => receiptLines.reduce((sum, line) => sum + line.quantity * line.product.buyPrice, 0), [receiptLines]);
  const receiptHasInsufficientStock = receiptLines.some((line) => line.quantity <= 0 || line.quantity > line.product.stock);

  async function submitSale() {
    if (saleSubmitting || !receiptLines.length) return;
    if (receiptHasInsufficientStock) {
      setSaleError("Jumlah pada struk melebihi stok tersedia. Sesuaikan jumlah barang terlebih dahulu.");
      return;
    }
    setSaleSubmitting(true);
    setSaleError("");
    try {
      const result = await apiRequest<{ products: Array<{ id: string; stock: number }>; activities: Activity[] }>("/api/sales", {
        method: "POST",
        body: JSON.stringify({ items: saleCart }),
      });
      setProducts((current) => current.map((product) => {
        const updated = result.products.find((item) => item.id === product.id);
        return updated ? { ...product, stock: updated.stock } : product;
      }));
      setActivities((current) => [...result.activities].reverse().concat(current));
      setSaleCart([]);
      setReceiptOpen(false);
      setStorageError("");
      setNotice("Transaksi struk berhasil disimpan.");
    } catch (error) {
      console.error("Gagal menyimpan transaksi struk.", error);
      setSaleError(error instanceof Error ? error.message : "Transaksi gagal disimpan.");
    } finally {
      setSaleSubmitting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInventory() {
      try {
        const [productData, activityData] = await Promise.all([
          apiRequest<{ products: Product[] }>("/api/products"),
          apiRequest<{ activities: Activity[] }>("/api/activities"),
        ]);
        if (!cancelled) {
          setProducts(productData.products);
          setActivities(activityData.activities);
          setStorageError("");
        }
      } catch (error) {
        console.error("Gagal memuat data inventaris dari API.", error);
        if (!cancelled) setStorageError(error instanceof Error ? error.message : "Data inventaris gagal dimuat.");
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void loadInventory();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!scannerOpen) return;
    let active = true;
    let barcodeResolved = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraMessage(window.isSecureContext
          ? "Browser tidak menyediakan akses kamera. Masukkan barcode secara manual."
          : "Kamera membutuhkan localhost atau koneksi HTTPS. Masukkan barcode secara manual.");
        return;
      }

      try {
        setCameraMessage("Meminta izin kamera…");
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (!active) return;
        const reader = new BrowserMultiFormatReader();
        const handleResult = (result: { getText: () => string } | undefined) => {
          if (!active || barcodeResolved || !result) return;
          barcodeResolved = true;
          const code = result.getText();
          setBarcodeInput(code);
          resolveBarcode(code);
        };
        let controls: IScannerControls;
        try {
          controls = await reader.decodeFromConstraints(
            {
              audio: false,
              video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            },
            videoRef.current ?? undefined,
            handleResult,
          );
        } catch (preferredCameraError) {
          if (!active) return;
          console.warn("Kamera utama tidak dapat dibuka; mencoba kamera default.", preferredCameraError);
          controls = await reader.decodeFromConstraints(
            { audio: false, video: true },
            videoRef.current ?? undefined,
            handleResult,
          );
        }
        if (!active) {
          controls.stop();
          return;
        }
        scannerControlsRef.current = controls;
        setCameraRetryable(false);
        setCameraMessage("Kamera aktif. Arahkan barcode ke dalam bingkai.");
      } catch (error) {
        console.warn("Kamera tidak dapat dibuka.", error);
        const errorName = error instanceof Error ? error.name : "";
        if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
          setCameraMessage("Izin kamera ditolak. Izinkan kamera untuk localhost di pengaturan browser.");
        } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
          setCameraMessage("Kamera tidak ditemukan. Sambungkan kamera atau masukkan barcode secara manual.");
        } else if (errorName === "NotReadableError" || errorName === "TrackStartError") {
          setCameraRetryable(true);
          setCameraMessage("Kamera terdeteksi tetapi tidak bisa dimulai. Tutup aplikasi lain atau tab browser yang sedang memakai kamera, lalu coba lagi.");
        } else {
          setCameraRetryable(true);
          setCameraMessage("Kamera gagal dibuka. Pastikan izin kamera aktif dan kamera tidak sedang dipakai aplikasi lain.");
        }
      }
    }

    void startCamera();
    return () => {
      active = false;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, [scannerOpen, cameraAttempt, resolveBarcode]);

  const lowStock = useMemo(() => products.filter((product) => product.stock <= product.minStock), [products]);
  const totalUnits = useMemo(() => products.reduce((sum, product) => sum + product.stock, 0), [products]);
  const stockValue = useMemo(() => products.reduce((sum, product) => sum + product.stock * product.buyPrice, 0), [products]);
  const recordedSales = useMemo(() => activities.filter((activity) => activity.type === "Keluar" && activity.profit !== undefined), [activities]);
  const legacySalesCount = useMemo(() => activities.filter((activity) => activity.type === "Keluar" && activity.profit === undefined).length, [activities]);
  const totalRevenue = useMemo(() => recordedSales.reduce((sum, activity) => sum + (activity.revenue ?? 0), 0), [recordedSales]);
  const totalCostOfGoods = useMemo(() => recordedSales.reduce((sum, activity) => sum + (activity.costOfGoods ?? 0), 0), [recordedSales]);
  const totalProfit = useMemo(() => recordedSales.reduce((sum, activity) => sum + (activity.profit ?? 0), 0), [recordedSales]);
  const categories = useMemo(() => ["Semua kategori", ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !normalizedQuery || [product.name, product.category, product.barcode].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesCategory = categoryFilter === "Semua kategori" || product.category === categoryFilter;
      const matchesAlert = activePage !== "Peringatan" || product.stock <= product.minStock;
      return matchesQuery && matchesCategory && matchesAlert;
    });
  }, [products, query, categoryFilter, activePage]);
  const manualSaleResults = useMemo(() => {
    const search = manualSaleSearch.trim().toLowerCase();
    if (!search) return [];
    return products.filter((product) =>
      [product.name, product.category, product.barcode].some((value) => value.toLowerCase().includes(search)),
    ).slice(0, 8);
  }, [products, manualSaleSearch]);

  function openNewProduct(barcode = "") {
    setForm({ ...emptyForm, barcode });
    setFormError("");
    setFormOpen(true);
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const stock = Number(form.stock);
    const minStock = Number(form.minStock);
    const buyPrice = Number(form.buyPrice);
    const sellPrice = Number(form.sellPrice);
    if (!form.name.trim() || !form.barcode.trim() || !Number.isFinite(stock) || stock < 0 || !Number.isFinite(minStock) || minStock < 0 || !Number.isFinite(buyPrice) || buyPrice < 0 || !Number.isFinite(sellPrice) || sellPrice < 0) {
      setFormError("Lengkapi nama, barcode, stok, batas minimum, harga beli, dan harga jual dengan nilai yang valid.");
      return;
    }
    const duplicate = products.find((product) => product.barcode === form.barcode.trim());
    if (duplicate) {
      setFormError(`Barcode ini sudah digunakan oleh ${duplicate.name}. Cari produk tersebut untuk memperbarui stoknya.`);
      return;
    }
    const newProduct = {
      name: form.name.trim(),
      category: form.category,
      stock,
      unit: form.unit.trim() || "pcs",
      minStock,
      buyPrice,
      sellPrice,
      barcode: form.barcode.trim(),
    };
    try {
      const result = await apiRequest<{ product: Product; activity: Activity }>("/api/products", {
        method: "POST",
        body: JSON.stringify(newProduct),
      });
      setProducts((current) => [result.product, ...current]);
      setActivities((current) => [result.activity, ...current]);
      setFormOpen(false);
      setForm(emptyForm);
      setStorageError("");
      setNotice(`${result.product.name} berhasil ditambahkan.`);
    } catch (error) {
      console.error("Gagal menyimpan produk ke database.", error);
      setFormError(error instanceof Error ? error.message : "Produk gagal disimpan ke database.");
    }
  }

  async function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjustProduct) return;
    const amount = Number(adjustAmount);
    const buyPrice = Number(adjustBuyPrice);
    const sellPrice = Number(adjustSellPrice);
    if (!Number.isInteger(amount) || amount <= 0) {
      setAdjustError("Masukkan jumlah minimal 1.");
      return;
    }
    if (adjustMode === "Masuk" && (
      !Number.isSafeInteger(buyPrice) || buyPrice < 0
      || !Number.isSafeInteger(sellPrice) || sellPrice < 0
    )) {
      setAdjustError("Masukkan harga beli dan harga jual yang valid.");
      return;
    }
    const currentProduct = products.find((product) => product.id === adjustProduct.id);
    if (!currentProduct) {
      setAdjustError("Produk tidak ditemukan. Muat ulang halaman lalu coba lagi.");
      return;
    }
    if (adjustMode === "Keluar" && amount > currentProduct.stock) {
      setAdjustError(`Stok hanya tersisa ${currentProduct.stock} ${currentProduct.unit}.`);
      return;
    }
    try {
      const result = await apiRequest<{ product: Partial<Product> & Pick<Product, "id" | "stock">; activity: Activity }>("/api/stock", {
        method: "POST",
        body: JSON.stringify({
          productId: currentProduct.id,
          mode: adjustMode,
          amount,
          ...(adjustMode === "Masuk" ? { buyPrice, sellPrice } : {}),
        }),
      });
      setProducts((current) => current.map((product) => product.id === result.product.id ? { ...product, ...result.product } : product));
      setActivities((current) => [result.activity, ...current]);
      setAdjustProduct(null);
      setAdjustError("");
      setStorageError("");
      setNotice(`Stok ${currentProduct.name} berhasil diperbarui.`);
    } catch (error) {
      console.error("Gagal menyimpan perubahan stok ke database.", error);
      setAdjustError(error instanceof Error ? error.message : "Perubahan stok gagal disimpan.");
    }
  }

  function navigateTo(page: string) {
    setActivePage(page);
    setQuery("");
    setCategoryFilter("Semua kategori");
  }

  const pageTitle = activePage === "Ringkasan" ? "Ringkasan" : activePage === "Stok barang" ? "Stok barang" : activePage;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); navigateTo("Ringkasan"); }}>
          <span className="brand-mark"><Icon name="box" size={22} /></span>
          <span className="brand-copy"><strong>Warung<span>Kita</span></strong><small>STOK &amp; INVENTARIS</small></span>
        </a>

        <div className="shop-switcher">
          <div className="shop-avatar">WK</div>
          <div className="shop-copy"><strong>Warung </strong><small>Cabang utama</small></div>
          <Icon name="chevron" size={15} />
        </div>

        <p className="nav-label">MENU UTAMA</p>
        <nav className="main-nav" aria-label="Navigasi utama">
          {([
            ["Ringkasan", "grid"],
            ["Stok barang", "box"],
            ["Riwayat", "clock"],
            ["Peringatan", "alert"],
            ["Laporan keuangan", "wallet"],
          ] as [string, IconName][]).map(([label, icon]) => (
            <button key={label} className={`nav-item ${activePage === label ? "active" : ""}`} onClick={() => navigateTo(label)}>
              <Icon name={icon} />
              <span>{label}</span>
              {label === "Peringatan" && lowStock.length > 0 && <span className="nav-count">{lowStock.length}</span>}
            </button>
          ))}
        </nav>

        <p className="nav-label nav-label-tools">ALAT BANTU</p>
        <button className="nav-item" onClick={() => openScanner()}>
          <Icon name="scan" /><span>Scan barang masuk/keluar</span>
        </button>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><Icon name="package" size={20} /></div>
            <strong>Stok tertata, warung lancar.</strong>
            <p>Catat barang masuk dan keluar dengan mudah.</p>
            <button onClick={() => setNotice("Tips: gunakan scan barcode untuk mencari produk lebih cepat.")}>Lihat tips <span>→</span></button>
          </div>
          <div className="profile">
            <div className="profile-avatar">S</div>
            <div className="profile-copy"><strong>Sari Wulandari</strong><small>Pemilik warung</small></div>
            <span className="profile-dots">···</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Warung Kita</span><Icon name="chevron" size={14} /><strong>{pageTitle}</strong></div>
          <div className="topbar-right">
            <label className="global-search">
              <Icon name="search" size={17} />
              <input aria-label="Cari produk atau barcode" placeholder="Cari produk atau barcode..." value={query} onChange={(event) => setQuery(event.target.value)} />
              <kbd>⌘ K</kbd>
            </label>
            <button className="top-scan" aria-label="Buka menu scan barang masuk atau keluar" onClick={() => openScanner()}><Icon name="scan" size={18} /></button>
            <button className="notification-button" aria-label={`${lowStock.length} peringatan stok`} onClick={() => navigateTo("Peringatan")}>
              <Icon name="alert" size={18} />
              {lowStock.length > 0 && <span className="notification-dot" />}
            </button>
            <div className="top-avatar">S</div>
          </div>
        </header>

        <div className="page-content">
          {!ready && !storageError && <div className="storage-warning">Menghubungkan ke database MySQL…</div>}
          {storageError && <div className="storage-warning" role="alert">{storageError}<button className="retry-load" onClick={() => window.location.reload()}>Coba lagi</button></div>}
          {activePage === "Laporan keuangan" ? (
            <section className="finance-page">
              <div className="page-heading">
                <div><p className="eyebrow">RINGKASAN PENJUALAN</p><h1>Laporan keuangan</h1><p className="heading-subtitle">Omzet dan keuntungan dari barang keluar yang tercatat sebagai penjualan.</p></div>
                <span className="finance-period">Semua riwayat</span>
              </div>
              <div className="finance-note"><Icon name="alert" size={16} /><span>Setiap stok keluar dihitung sebagai penjualan dengan harga jual produk yang berlaku saat transaksi.</span></div>
              <div className="stats-grid finance-stats">
                <article className="stat-card"><div className="stat-top"><span>Total omzet</span><span className="stat-icon icon-blue"><Icon name="wallet" size={19} /></span></div><strong className="stat-value value-currency">{currency.format(totalRevenue)}</strong><span className="stat-caption">{recordedSales.length} transaksi penjualan tercatat</span></article>
                <article className="stat-card"><div className="stat-top"><span>Modal barang terjual</span><span className="stat-icon icon-orange"><Icon name="package" size={19} /></span></div><strong className="stat-value value-currency">{currency.format(totalCostOfGoods)}</strong><span className="stat-caption">Dihitung dari harga beli</span></article>
                <article className="stat-card profit-stat"><div className="stat-top"><span>Keuntungan kotor</span><span className="stat-icon icon-green"><Icon name="arrow-up" size={19} /></span></div><strong className={`stat-value value-currency ${totalProfit < 0 ? "negative-profit" : "positive-profit"}`}>{currency.format(totalProfit)}</strong><span className="stat-caption">Omzet dikurangi modal barang</span></article>
              </div>
              <div className="history-card finance-transactions">
                <div className="section-title-row"><div><h2>Rincian penjualan</h2><p>{recordedSales.length} transaksi dengan harga tercatat</p></div></div>
                {recordedSales.length ? <div className="table-wrap"><table className="finance-table"><thead><tr><th>PRODUK</th><th>WAKTU</th><th>JUMLAH</th><th>OMZET</th><th>MODAL</th><th>KEUNTUNGAN</th></tr></thead><tbody>
                  {recordedSales.map((sale) => <tr key={sale.id}><td><strong>{sale.productName}</strong></td><td>{formatDate(sale.date)}</td><td>{sale.amount} {sale.unit}</td><td>{currency.format(sale.revenue ?? 0)}</td><td>{currency.format(sale.costOfGoods ?? 0)}</td><td className={(sale.profit ?? 0) < 0 ? "negative-profit" : "positive-profit"}>{currency.format(sale.profit ?? 0)}</td></tr>)}
                </tbody></table></div> : <div className="empty-state">Belum ada penjualan baru. Catat stok keluar untuk mulai menghitung omzet dan keuntungan.</div>}
                {legacySalesCount > 0 && <p className="legacy-sales-note">{legacySalesCount} catatan stok keluar lama tidak memiliki harga transaksi, sehingga tidak dimasukkan ke laporan.</p>}
              </div>
            </section>
          ) : activePage === "Riwayat" ? (
            <section className="history-page">
              <div className="page-heading">
                <div><p className="eyebrow">CATATAN AKTIVITAS</p><h1>Riwayat stok</h1><p className="heading-subtitle">Semua perubahan stok barang tercatat di sini.</p></div>
                <button className="secondary-button" onClick={() => setNotice("Data riwayat tersimpan otomatis di database MySQL.")}><Icon name="clock" size={16} /> Tersimpan otomatis</button>
              </div>
              <div className="history-card">
                <div className="section-title-row"><div><h2>Aktivitas terbaru</h2><p>{activities.length} catatan perubahan stok</p></div></div>
                {activities.length ? (
                  <div className="history-list">
                    {activities.map((activity) => (
                      <div className="history-row" key={activity.id}>
                        <div className={`activity-icon ${activity.type === "Masuk" ? "incoming" : activity.type === "Keluar" ? "outgoing" : "new-item"}`}><Icon name={activity.type === "Masuk" ? "arrow-down" : activity.type === "Keluar" ? "arrow-up" : "package"} size={17} /></div>
                        <div className="activity-description"><strong>{activity.productName}</strong><span>{activity.type === "Produk baru" ? "Produk baru ditambahkan" : activity.type === "Keluar" ? "Stok keluar (penjualan)" : "Stok masuk"}</span></div>
                        <span className={`activity-amount ${activity.type === "Keluar" ? "amount-out" : ""}`}>{activity.type === "Keluar" ? "−" : activity.type === "Masuk" ? "+" : ""}{activity.amount} {activity.unit}</span>
                        <time>{formatDate(activity.date)}</time>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-state">Belum ada aktivitas. Perubahan stok akan muncul di sini.</div>}
              </div>
            </section>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">{activePage === "Peringatan" ? "PANTAU STOK MENIPIS" : "INVENTARIS WARUNG"}</p>
                  <h1>{activePage === "Peringatan" ? "Perlu restock, nih." : "Selamat pagi 👋"}</h1>
                  <p className="heading-subtitle">{activePage === "Peringatan" ? "Cek barang yang sudah menyentuh batas minimum stok." : "Yuk, cek kondisi stok warung hari ini."}</p>
                </div>
                <div className="heading-actions">
                  <button className="secondary-button" onClick={() => openScanner()}><Icon name="scan" size={16} /> Scan barang</button>
                  <button className="primary-button" onClick={() => openNewProduct()}><Icon name="plus" size={17} /> Tambah barang</button>
                </div>
              </div>

              {activePage === "Ringkasan" && (
                <section className="stats-grid" aria-label="Ringkasan stok">
                  <article className="stat-card">
                    <div className="stat-top"><span>Total produk</span><span className="stat-icon icon-lilac"><Icon name="package" size={19} /></span></div>
                    <strong className="stat-value">{products.length}<small> item</small></strong>
                    <span className="stat-caption"><span className="caption-dot green-dot" /> Semua produk terdaftar</span>
                  </article>
                  <article className="stat-card">
                    <div className="stat-top"><span>Total stok tersedia</span><span className="stat-icon icon-green"><Icon name="box" size={19} /></span></div>
                    <strong className="stat-value">{totalUnits.toLocaleString("id-ID")}<small> unit</small></strong>
                    <span className="stat-caption"><span className="caption-dot green-dot" /> Dari seluruh produk</span>
                  </article>
                  <article className="stat-card">
                    <div className="stat-top"><span>Stok menipis</span><span className="stat-icon icon-orange"><Icon name="alert" size={19} /></span></div>
                    <strong className="stat-value">{lowStock.length}<small> produk</small></strong>
                    <button className="stat-link" onClick={() => navigateTo("Peringatan")}>Lihat yang perlu restock <span>→</span></button>
                  </article>
                  <article className="stat-card">
                    <div className="stat-top"><span>Nilai persediaan</span><span className="stat-icon icon-blue"><Icon name="wallet" size={19} /></span></div>
                    <strong className="stat-value value-currency">{currency.format(stockValue)}</strong>
                    <span className="stat-caption"><span className="caption-dot green-dot" /> Berdasarkan harga beli</span>
                  </article>
                </section>
              )}

              {activePage === "Ringkasan" && (
                <section className="restock-banner">
                  <div className="banner-art"><div className="banner-bubble bubble-one" /><div className="banner-bubble bubble-two" /><div className="banner-box"><Icon name="box" size={29} /></div></div>
                  <div className="banner-copy"><span className="banner-tag"><span /> PERHATIAN STOK</span><h2>{lowStock.length ? `${lowStock.length} barang butuh perhatian` : "Semua stok dalam kondisi aman"}</h2><p>{lowStock.length ? "Beberapa barang sudah hampir habis. Jangan sampai pelanggan kecewa, ya!" : "Kerja bagus! Tidak ada barang yang menyentuh batas minimum."}</p></div>
                  <button onClick={() => navigateTo("Peringatan")}>Cek stok menipis <span>→</span></button>
                </section>
              )}

              <section className="catalog-section">
                <div className="catalog-heading">
                  <div><h2>{activePage === "Peringatan" ? "Daftar stok menipis" : activePage === "Stok barang" ? "Semua barang" : "Daftar barang"}</h2><p>{activePage === "Peringatan" ? `${lowStock.length} produk perlu segera dicek` : "Pantau dan kelola stok barang warungmu."}</p></div>
                  {activePage !== "Peringatan" && <button className="view-all" onClick={() => navigateTo("Stok barang")}>Lihat semua <Icon name="chevron" size={15} /></button>}
                </div>
                <div className="catalog-toolbar">
                  <label className="table-search"><Icon name="search" size={16} /><input placeholder="Cari nama barang..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
                  <label className="category-select-label"><span>Kategori:</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter kategori">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>NAMA BARANG</th><th>KATEGORI</th><th>STOK SAAT INI</th><th>BATAS MINIMUM</th><th>STATUS</th><th>HARGA BELI</th><th>HARGA JUAL</th><th aria-label="Aksi" /></tr></thead>
                    <tbody>
                      {filteredProducts.slice(0, activePage === "Ringkasan" ? 6 : undefined).map((product, index) => {
                        const status = getStockStatus(product);
                        return <tr key={product.id}>
                          <td><div className="product-cell"><span className={`product-thumb thumb-${index % 6}`}>{product.category === "Minuman" ? "🥤" : product.category === "Sembako" ? "🌾" : product.category === "Kebutuhan" ? "🧼" : "🍜"}</span><span><strong>{product.name}</strong><small><Icon name="barcode" size={12} /> {product.barcode}</small></span></div></td>
                          <td><span className="category-pill">{product.category}</span></td>
                          <td><strong className={status.className === "status-low" || status.className === "status-empty" ? "stock-alert" : "stock-number"}>{product.stock}</strong><span className="stock-unit"> {product.unit}</span></td>
                          <td><span className="min-stock">{product.minStock} {product.unit}</span></td>
                          <td><span className={`status-pill ${status.className}`}><span />{status.label}</span></td>
                          <td className="price-cell">{currency.format(product.buyPrice)}</td>
                          <td className="price-cell">{currency.format(product.sellPrice)}</td>
                          <td><div className="row-actions"><button className="row-action" aria-label={`Tambah stok dan perbarui harga ${product.name}`} title="Tambah stok dan perbarui harga" onClick={() => { setAdjustProduct(product); setAdjustMode("Masuk"); setAdjustAmount("1"); setAdjustBuyPrice(String(product.buyPrice)); setAdjustSellPrice(String(product.sellPrice)); setAdjustError(""); }}><Icon name="plus" size={16} /></button></div></td>
                        </tr>;
                      })}
                      {!filteredProducts.length && <tr><td colSpan={8}><div className="empty-state">Tidak ada barang yang cocok dengan pencarian ini.</div></td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer"><span>Menampilkan <strong>{Math.min(filteredProducts.length, activePage === "Ringkasan" ? 6 : filteredProducts.length)}</strong> dari <strong>{filteredProducts.length}</strong> barang</span><button onClick={() => navigateTo("Stok barang")}>Kelola semua stok <span>→</span></button></div>
              </section>

              {activePage === "Ringkasan" && (
                <section className="recent-section">
                  <div className="catalog-heading"><div><h2>Aktivitas terbaru</h2><p>Perubahan stok terakhir di warungmu.</p></div><button className="view-all" onClick={() => navigateTo("Riwayat")}>Lihat riwayat <Icon name="chevron" size={15} /></button></div>
                  <div className="recent-activities">
                    {activities.slice(0, 3).map((activity) => <div className="recent-activity" key={activity.id}><span className={`activity-icon ${activity.type === "Masuk" ? "incoming" : activity.type === "Keluar" ? "outgoing" : "new-item"}`}><Icon name={activity.type === "Masuk" ? "arrow-down" : activity.type === "Keluar" ? "arrow-up" : "package"} size={16} /></span><span className="recent-name"><strong>{activity.productName}</strong><small>{activity.type === "Produk baru" ? "Produk baru ditambahkan" : `Stok ${activity.type.toLowerCase()}`}</small></span><span className={`recent-amount ${activity.type === "Keluar" ? "amount-out" : ""}`}>{activity.type === "Keluar" ? "−" : activity.type === "Masuk" ? "+" : ""}{activity.amount} {activity.unit}</span><time>{formatTime(activity.date)}</time></div>)}
                    {!activities.length && <div className="empty-state">Belum ada aktivitas.</div>}
                  </div>
                </section>
              )}
            </>
          )}
          <footer className="page-footer"><span>© 2026 WarungKita</span><span>Data tersimpan otomatis di database MySQL</span></footer>
        </div>
      </main>

      {notice && <div className="toast" role="status"><span><Icon name="check" size={16} /></span>{notice}<button aria-label="Tutup notifikasi" onClick={() => setNotice("")}><Icon name="close" size={15} /></button></div>}

      {formOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
        <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
          <div className="modal-heading"><div><p className="eyebrow">INVENTARIS WARUNG</p><h2 id="product-modal-title">Tambah barang</h2><p>Masukkan detail barang yang ingin dicatat.</p></div><button className="modal-close" aria-label="Tutup" onClick={() => setFormOpen(false)}><Icon name="close" /></button></div>
          <form onSubmit={submitProduct} className="modal-form">
            <label>Nama barang<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Contoh: Mi instan goreng" required /></label>
            <label>Barcode<div className="input-with-action"><input value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} placeholder="Scan atau ketik nomor barcode" required /><button type="button" aria-label="Scan barcode" onClick={() => { setFormOpen(false); openScanner("Masuk"); }}><Icon name="scan" size={17} /></button></div></label>
            <div className="form-grid"><label>Kategori<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Makanan</option><option>Minuman</option><option>Sembako</option><option>Kebutuhan</option><option>Lainnya</option></select></label><label>Satuan<input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="pcs" required /></label></div>
            <div className="form-grid"><label>Stok awal<input type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} placeholder="0" required /></label><label>Batas minimum<input type="number" min="0" step="1" value={form.minStock} onChange={(event) => setForm({ ...form, minStock: event.target.value })} placeholder="5" required /></label></div>
            <div className="form-grid"><label>Harga beli<input type="number" min="0" step="1" value={form.buyPrice} onChange={(event) => setForm({ ...form, buyPrice: event.target.value })} placeholder="Contoh: 2800" required /></label><label>Harga jual<input type="number" min="0" step="1" value={form.sellPrice} onChange={(event) => setForm({ ...form, sellPrice: event.target.value })} placeholder="Contoh: 3500" required /></label></div>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Batal</button><button type="submit" className="primary-button"><Icon name="plus" size={16} /> Simpan barang</button></div>
          </form>
        </section>
      </div>}

      {adjustProduct && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAdjustProduct(null); }}>
        <section className="modal-card adjustment-modal" role="dialog" aria-modal="true" aria-labelledby="adjust-modal-title">
          <div className="modal-heading"><div><p className="eyebrow">PERBARUI INVENTARIS</p><h2 id="adjust-modal-title">{adjustMode === "Masuk" ? "Catat barang masuk" : "Catat barang keluar"}</h2><p>{adjustProduct.name} · stok saat ini <strong>{adjustProduct.stock} {adjustProduct.unit}</strong></p></div><button className="modal-close" aria-label="Tutup" onClick={() => setAdjustProduct(null)}><Icon name="close" /></button></div>
          <div className="adjust-toggle"><button className={adjustMode === "Masuk" ? "selected" : ""} onClick={() => { setAdjustMode("Masuk"); setAdjustError(""); }}>Barang masuk</button><button className={adjustMode === "Keluar" ? "selected" : ""} onClick={() => { setAdjustMode("Keluar"); setAdjustError(""); }}>Keluar / terjual</button></div>
          {adjustMode === "Keluar" && <p className="sales-calc-hint">Stok keluar dicatat sebagai penjualan pada harga jual {currency.format(adjustProduct.sellPrice)} per {adjustProduct.unit}.</p>}
          <form onSubmit={submitAdjustment} className="modal-form">
            <label>Jumlah ({adjustProduct.unit})<input autoFocus type="number" min="1" step="1" value={adjustAmount} onChange={(event) => setAdjustAmount(event.target.value)} /></label>
            {adjustMode === "Masuk" && <>
              <div className="form-grid">
                <label>Harga beli baru<input type="number" min="0" step="1" value={adjustBuyPrice} onChange={(event) => setAdjustBuyPrice(event.target.value)} required /></label>
                <label>Harga jual baru<input type="number" min="0" step="1" value={adjustSellPrice} onChange={(event) => setAdjustSellPrice(event.target.value)} required /></label>
              </div>
              <p className="sales-calc-hint">Harga baru dan stok masuk akan disimpan bersamaan. Riwayat penjualan sebelumnya tetap menggunakan harga saat transaksi.</p>
            </>}
            {adjustError && <p className="form-error" role="alert">{adjustError}</p>}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setAdjustProduct(null)}>Batal</button><button type="submit" className="primary-button"><Icon name="check" size={16} /> Simpan perubahan</button></div>
          </form>
        </section>
      </div>}

      {receiptOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saleSubmitting) setReceiptOpen(false); }}>
        <section className="modal-card receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-modal-title">
          <div className="modal-heading">
            <div><p className="eyebrow">TRANSAKSI BARU</p><h2 id="receipt-modal-title">Struk belanja</h2><p>{receiptLines.length} jenis barang · jumlah bisa diubah sebelum disimpan.</p></div>
            <button className="modal-close" aria-label="Tutup struk" onClick={() => setReceiptOpen(false)} disabled={saleSubmitting}><Icon name="close" /></button>
          </div>
          <div className="manual-sale-search receipt-product-search">
            <label htmlFor="receipt-product-query">Cari dan tambah barang</label>
            <div className="table-search manual-sale-input"><Icon name="search" size={16} /><input id="receipt-product-query" value={manualSaleSearch} onChange={(event) => setManualSaleSearch(event.target.value)} placeholder="Cari nama atau barcode produk..." autoComplete="off" disabled={saleSubmitting} /></div>
            {manualSaleSearch.trim() && <div className="manual-sale-results">
              {manualSaleResults.length ? manualSaleResults.map((product) => <button key={product.id} type="button" className="manual-sale-result" onClick={() => addProductToSale(product)} disabled={product.stock < 1 || saleSubmitting}>
                <span><strong>{product.name}</strong><small>{product.barcode} · stok {product.stock} {product.unit}</small></span>
                <span className="manual-sale-result-price">{product.stock < 1 ? "Stok habis" : currency.format(product.sellPrice)}</span>
              </button>) : <p className="manual-sale-empty">Produk tidak ditemukan.</p>}
            </div>}
          </div>
          {receiptLines.length ? <>
            <div className="receipt-lines">
              {receiptLines.map(({ product, quantity }) => <div className="receipt-line" key={product.id}>
                <span className="receipt-product"><strong>{product.name}</strong><small>{currency.format(product.sellPrice)} / {product.unit} · stok {product.stock}</small></span>
                <label className="receipt-quantity"><span className="sr-only">Jumlah {product.name}</span><input type="number" min="1" max={product.stock} step="1" value={quantity || ""} onChange={(event) => setSaleQuantity(product.id, event.target.value)} /></label>
                <strong className="receipt-line-total">{currency.format(quantity * product.sellPrice)}</strong>
                <button className="receipt-remove" type="button" aria-label={`Hapus ${product.name} dari struk`} onClick={() => { setSaleCart((current) => current.filter((line) => line.productId !== product.id)); setSaleError(""); }} disabled={saleSubmitting}><Icon name="close" size={15} /></button>
              </div>)}
            </div>
            {receiptHasInsufficientStock && <p className="form-error receipt-error" role="alert">Jumlah barang tidak valid atau melebihi stok tersedia. Ubah jumlah sebelum menyimpan.</p>}
            {saleError && <p className="form-error receipt-error" role="alert">{saleError}</p>}
            <div className="receipt-totals">
              <div><span>Jumlah barang</span><strong>{receiptLines.reduce((sum, line) => sum + line.quantity, 0)} unit</strong></div>
              <div><span>Total belanja</span><strong>{currency.format(receiptTotal)}</strong></div>
              <div className="receipt-profit"><span>Perkiraan keuntungan kotor</span><strong>{currency.format(receiptTotal - receiptCost)}</strong></div>
            </div>
          </> : <div className="empty-state receipt-empty">Struk masih kosong. Cari produk di atas atau scan barcode untuk menambahkannya.</div>}
          <div className="modal-actions receipt-actions">
            <button type="button" className="secondary-button" onClick={() => { setSaleCart([]); setSaleError(""); setReceiptOpen(false); }} disabled={saleSubmitting}>Batalkan struk</button>
            <button type="button" className="secondary-button" onClick={() => { setReceiptOpen(false); openScanner("Keluar"); }} disabled={saleSubmitting}><Icon name="scan" size={16} /> Scan barang lain</button>
            <button type="button" className="primary-button" onClick={submitSale} disabled={!receiptLines.length || receiptHasInsufficientStock || saleSubmitting}>{saleSubmitting ? "Menyimpan…" : <><Icon name="check" size={16} /> Simpan penjualan</>}</button>
          </div>
        </section>
      </div>}

      {scannerOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setScannerOpen(false); }}>
        <section className="modal-card scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-modal-title">
          <div className="modal-heading"><div><p className="eyebrow">PEMINDAI PRODUK</p><h2 id="scanner-modal-title">Scan barang masuk / keluar</h2><p>Pilih tindakan, lalu arahkan barcode ke kamera atau masukkan kodenya.</p></div><button className="modal-close" aria-label="Tutup" onClick={() => setScannerOpen(false)}><Icon name="close" /></button></div>
          <div className="adjust-toggle scanner-mode-toggle" role="group" aria-label="Tindakan barcode">
            <button type="button" className={scannerMode === "Masuk" ? "selected" : ""} aria-pressed={scannerMode === "Masuk"} onClick={() => changeScannerMode("Masuk")}>Barang masuk</button>
            <button type="button" className={scannerMode === "Keluar" ? "selected" : ""} aria-pressed={scannerMode === "Keluar"} onClick={() => changeScannerMode("Keluar")}>Barang keluar</button>
          </div>
          <div className="camera-frame"><video ref={videoRef} muted playsInline aria-label="Pratinjau kamera untuk scan barcode" /><div className="scan-frame"><span /><span /><span /><span /><i /></div><div className="camera-label"><Icon name="camera" size={15} /> <span>{cameraMessage || "Menyiapkan kamera..."}</span>{cameraRetryable && <button type="button" onClick={retryCamera}>Coba lagi</button>}</div></div>
          {scannerMode === "Keluar" && <div className="manual-sale-search">
            <label htmlFor="manual-sale-query">Cari produk untuk struk</label>
            <div className="table-search manual-sale-input"><Icon name="search" size={16} /><input id="manual-sale-query" value={manualSaleSearch} onChange={(event) => setManualSaleSearch(event.target.value)} placeholder="Cari nama atau barcode produk..." autoComplete="off" /></div>
            {manualSaleSearch.trim() && <div className="manual-sale-results">
              {manualSaleResults.length ? manualSaleResults.map((product) => <button key={product.id} type="button" className="manual-sale-result" onClick={() => addProductToSale(product)} disabled={product.stock < 1}>
                <span><strong>{product.name}</strong><small>{product.barcode} · stok {product.stock} {product.unit}</small></span>
                <span className="manual-sale-result-price">{product.stock < 1 ? "Stok habis" : currency.format(product.sellPrice)}</span>
              </button>) : <p className="manual-sale-empty">Produk tidak ditemukan.</p>}
            </div>}
          </div>}
          <form onSubmit={(event) => { event.preventDefault(); resolveBarcode(barcodeInput); }} className="modal-form scanner-form"><label>Nomor barcode<div className="input-with-action"><input autoFocus value={barcodeInput} onChange={(event) => { setBarcodeInput(event.target.value); setScannerError(""); }} placeholder="Ketik barcode produk..." /><button type="submit" aria-label="Cari barcode"><Icon name="search" size={17} /></button></div></label>{scannerError && <p className="form-error" role="alert">{scannerError}</p>}<p className="scanner-hint"><Icon name="barcode" size={15} />{scannerMode === "Masuk" ? "Barcode baru akan membuka form tambah produk." : "Barcode baru akan membuka form produk; barcode terdaftar ditambahkan ke struk."}</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setScannerOpen(false)}>Batal</button><button type="submit" className="primary-button"><Icon name="scan" size={16} /> Cari produk</button></div></form>
        </section>
      </div>}
    </div>
  );
}
