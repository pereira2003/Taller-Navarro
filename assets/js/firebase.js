// firebase.js — Lumina Inventory · Firebase Firestore Module
// Proyecto: inventario-aecca
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── FIREBASE CONFIG ────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBuiNiBxQ2TebvH8MOZq_8qOYMdgMVtCxY",
  authDomain: "inventario-aecca.firebaseapp.com",
  projectId: "inventario-aecca",
  storageBucket: "inventario-aecca.firebasestorage.app",
  messagingSenderId: "730789454094",
  appId: "1:730789454094:web:cb03bbb3c535d17944f75f",
  measurementId: "G-N9B0QTH9SC"
};
// ────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Analytics — opcional, puede fallar en file:// o sin HTTPS
try {
  getAnalytics(app);
} catch(e) {
  // Analytics no disponible en este entorno (normal en desarrollo local)
}

// ─── COLLECTION REFERENCES ──────────────────────────────────
export const productsCol = collection(db, "products");
export const activityCol = collection(db, "activity");

// ─── PRODUCT FUNCTIONS ──────────────────────────────────────

/**
 * Add a new product to Firestore.
 * @param {object} data - Product fields
 * @returns {Promise<DocumentReference>}
 */
export async function addProduct(data) {
  const status = computeStatus(data.quantity, data.reorderThreshold);
  return await addDoc(productsCol, {
    ...data,
    year: Number(data.year) || 2026,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

/**
 * Update an existing product.
 * @param {string} id - Firestore document ID
 * @param {object} data - Fields to update
 */
export async function updateProduct(id, data) {
  const status = computeStatus(data.quantity, data.reorderThreshold);
  const ref = doc(db, "products", id);
  await updateDoc(ref, {
    ...data,
    year: Number(data.year) || 2026,
    status,
    updatedAt: serverTimestamp()
  });
}

/**
 * Delete a product by ID.
 * @param {string} id - Firestore document ID
 */
export async function deleteProduct(id) {
  await deleteDoc(doc(db, "products", id));
}

/**
 * Get a single product by ID.
 * @param {string} id - Firestore document ID
 * @returns {Promise<{id: string, ...data}>|null}
 */
export async function getProduct(id) {
  const snap = await getDoc(doc(db, "products", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Listen to all products in real time.
 * @param {function} callback - Called with array of products on each change
 * @returns {function} Unsubscribe function
 */
export function onProducts(callback) {
  const q = query(productsCol, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(products);
  });
}

/**
 * Listen to low-stock products only.
 * @param {function} callback
 * @returns {function} Unsubscribe
 */
export function onLowStockProducts(callback) {
  const q = query(productsCol, where("status", "==", "LOW_STOCK"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ─── ACTIVITY FUNCTIONS ─────────────────────────────────────

/**
 * Log an activity event.
 * @param {"add"|"transfer"|"alert"|"audit"} type
 * @param {string} message - Human-readable description
 */
export async function logActivity(type, message) {
  await addDoc(activityCol, {
    type,
    message,
    timestamp: serverTimestamp()
  });
}

/**
 * Listen to recent activity (last 10 events).
 * @param {function} callback
 * @returns {function} Unsubscribe
 */
export function onRecentActivity(callback) {
  const q = query(activityCol, orderBy("timestamp", "desc"), limit(10));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ─── HELPERS ────────────────────────────────────────────────

/**
 * Compute stock status based on quantity vs threshold.
 */
function computeStatus(quantity, threshold) {
  const qty = Number(quantity);
  const thr = Number(threshold);
  if (qty <= 0) return "OUT_OF_STOCK";
  if (qty <= thr) return "LOW_STOCK";
  return "IN_STOCK";
}

/**
 * Format a Firestore Timestamp or Date to a relative time string.
 * @param {Timestamp|Date|null} ts
 * @returns {string}
 */
export function formatRelativeTime(ts) {
  if (!ts) return "Hace un momento";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `Hace ${diff}s`;
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return "Ayer";
  return date.toLocaleDateString();
}

/**
 * Get the icon name for an activity type.
 */
export function activityIcon(type) {
  const icons = {
    add: "add_box",
    transfer: "sync_alt",
    alert: "warning",
    audit: "check_circle",
    delete: "delete",
    edit: "edit"
  };
  return icons[type] || "history";
}

/**
 * Get Tailwind color classes for an activity type.
 */
export function activityColors(type) {
  const colors = {
    add:      { bg: "bg-primary-container",   text: "text-primary" },
    transfer: { bg: "bg-tertiary-container",  text: "text-tertiary" },
    alert:    { bg: "bg-error-container",     text: "text-error" },
    audit:    { bg: "bg-secondary-container", text: "text-secondary" },
    delete:   { bg: "bg-error-container",     text: "text-error" },
    edit:     { bg: "bg-primary-container",   text: "text-primary" }
  };
  return colors[type] || { bg: "bg-surface-variant", text: "text-on-surface-variant" };
}

/**
 * Seed the database with sample data (run once from console).
 * Usage: import { seedData } from './firebase.js'; seedData();
 */
export async function seedData() {
  const sampleProducts = [
    {
      name: "AeroStep Pro X",
      sku: "SKU-9921",
      category: "Footwear",
      quantity: 1240,
      reorderThreshold: 200,
      warehouseLocation: "Aisle 3, Rack A1",
      supplier: "Nexus Logistics Co.",
      unitCost: 89.99,
      imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBV6d87zzcUIZFmk-YHhp_3fWWiBxCEp88hsAxNNF3Ldeed0_-gmHhQQu7oi2qubmTZp70HUqe2r94GX6SYzUVbX6prBkfsEy06xU2mPTG9XylfTE46-9QQJPG9heitqqle2MJdsvSyFYZdCy3nC3URSfRHS0AjELysUgGyUrkoCg1u2IdxOe2fyyRBguuwTkoLvjeEv0NNXAV6QvEwiskXmrKqLpxBp_TCYZHPkk-SrnQQRTr6ffS4BtTUyPsjSLxdDyqXbOwpd_ex"
    },
    {
      name: "Chronos S2 Watch",
      sku: "SKU-4410",
      category: "Electronics",
      quantity: 12,
      reorderThreshold: 50,
      warehouseLocation: "Aisle 7, Rack B2",
      supplier: "TechCore Supplies",
      unitCost: 299.00,
      imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBHh122zD4YZtkX2OZd9z5r341AUPkVDKN1Jr5e219uaBeTdlSdyxqxfWwHdRS-6O--LiNjszJsmhlAHpykDQKxeF197salx7vngDAEE1kAbaI4tK8OXIRrr1YV-iEU624BFscrCWp4EK18I6F2c1uIPQm3hFYczMihzSD17mby5zx3yxyP2ddbkiE6huR2idYsTyVDv1sbAH3cY9HG_ko1RwyX0P3-K0fD9hxDEwE210WCKImfQxkGRWgX1GOz651QXKIv39MutZ2K"
    },
    {
      name: "Hyper-Sprint v2.0",
      sku: "SKU-8829",
      category: "Footwear",
      quantity: 1402,
      reorderThreshold: 250,
      warehouseLocation: "Aisle 12, Rack B4",
      supplier: "Nexus Logistics Co.",
      unitCost: 142.50,
      imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuD_-_uNNEwK6NBxdOscgyKLtCi0CJofa4L2y8Pbj1wtwdqtkkWfM4rqoxqvp6yYMqTtV2b3GvriDFGEAGnccrF0moQwh8EuVKNJYNGxLXdhKkZziSLfv61VI0mw82Gr1AdZHXF47KwhlR8S5yuJwQkp7eVMORTN7NJzQZXtwvPYCR7wDZohGeJgTafRPorGQaftLL6K9lUJz21OLc_gw6himhYf8bX_4GcuMXVAgO3v34dC7tZOZe8eZ9SU_CM2l1RY7WPQjComPrX8"
    }
  ];

  const sampleActivity = [
    { type: "add",      message: "50 units of Hyper-Sprint v2.0 added to Warehouse A." },
    { type: "transfer", message: "Batch #892 moved to dispatch center." },
    { type: "alert",    message: "Chronos S2 Watch fell below threshold (12 units)." },
    { type: "audit",    message: "Monthly count verified for Section B-7." }
  ];

  console.log("🌱 Seeding database...");
  for (const p of sampleProducts) {
    await addProduct(p);
    console.log(`  ✅ Added: ${p.name}`);
  }
  for (const a of sampleActivity) {
    await logActivity(a.type, a.message);
  }
  console.log("✅ Database seeded successfully!");
}

/**
 * Seed the database with the complete 2024 workshop inventory (49 tools).
 * Usage: import { seed2024Data } from './firebase.js'; seed2024Data();
 */
export async function seed2024Data() {
  const tools2024 = [
    { name: "Alicates variados", sku: "2024-01", category: "general", quantity: 3, unitCost: 2.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Alicates de diferentes formas y tamaños" },
    { name: "Amoladora", sku: "2024-02", category: "enderezado", quantity: 4, unitCost: 4.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Eléctrica portátil con motor giratorio" },
    { name: "Autogena", sku: "2024-03", category: "enderezado", quantity: 1, unitCost: 65.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Equipo de soldadura y corte a gas" },
    { name: "Barra de uña", sku: "2024-04", category: "enderezado", quantity: 2, unitCost: 4.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Barra de acero resistente" },
    { name: "Botadores", sku: "2024-05", category: "enderezado", quantity: 2, unitCost: 3.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para empujar y alinear paneles" },
    { name: "Brocas para taladro", sku: "2024-06", category: "general", quantity: 2, unitCost: 4.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Juego completo de brocas métricas" },
    { name: "Caballetes", sku: "2024-07", category: "general", quantity: 4, unitCost: 3.75, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Soportes estables para elevar el vehículo" },
    { name: "Carro portaherramientas", sku: "2024-08", category: "general", quantity: 2, unitCost: 17.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Carro móvil para organizar herramientas" },
    { name: "Cinta de enmascarar", sku: "2024-09", category: "pintura", quantity: 8, unitCost: 0.31, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Protectora para delimitar zonas de pintura" },
    { name: "Cortadora de cinta", sku: "2024-10", category: "enderezado", quantity: 1, unitCost: 6.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Cortadora de cinta" },
    { name: "Cargadores de baterias", sku: "2024-11", category: "general", quantity: 2, unitCost: 17.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Convierte corriente casa a DC" },
    { name: "Colador de pintura", sku: "2024-12", category: "pintura", quantity: 10, unitCost: 0.04, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Filtro para eliminar impurezas" },
    { name: "Compresor Pequeño", sku: "2024-13", category: "pintura", quantity: 0, unitCost: 80.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Fuente de aire comprimido" },
    { name: "Compresor Grande", sku: "2024-14", category: "pintura", quantity: 1, unitCost: 500.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Fuente de aire comprimido" },
    { name: "Corta alambres", sku: "2024-15", category: "general", quantity: 3, unitCost: 1.67, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Cortador para cables y alambres" },
    { name: "Cadenas mecánicas", sku: "2024-16", category: "enderezado", quantity: 2, unitCost: 6.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para jalar y estirar carrocería" },
    { name: "Destornilladores", sku: "2024-17", category: "general", quantity: 2, unitCost: 5.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Juego completo (Phillips, planos, etc)" },
    { name: "Dremel", sku: "2024-18", category: "general", quantity: 4, unitCost: 6.25, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para desbastar diferentes tamaños" },
    { name: "Equipo soldadura MIG", sku: "2024-19", category: "enderezado", quantity: 2, unitCost: 150.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Soldadora para unir metales" },
    { name: "Equipo (spotter)", sku: "2024-20", category: "enderezado", quantity: 1, unitCost: 500.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Reparaciones rápidas sin perforar" },
    { name: "Extanzores", sku: "2024-21", category: "enderezado", quantity: 2, unitCost: 15.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Expander para enderezar piezas" },
    { name: "Extilzon", sku: "2024-22", category: "enderezado", quantity: 2, unitCost: 6.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para aflojar o apretar tubos" },
    { name: "Engrapadora plastico", sku: "2024-23", category: "general", quantity: 1, unitCost: 45.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Unir o sujetar materiales plásticos" },
    { name: "Ele de enderezado", sku: "2024-24", category: "enderezado", quantity: 1, unitCost: 75.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Herramienta hidráulica de carrocería" },
    { name: "Espátulas para masilla", sku: "2024-25", category: "general", quantity: 1, unitCost: 5.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Acero y plástico para masilla" },
    { name: "Extensiones Electricas", sku: "2024-26", category: "general", quantity: 4, unitCost: 2.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Extensión de energía eléctrica" },
    { name: "Extractores de Aire", sku: "2024-27", category: "pintura", quantity: 2, unitCost: 17.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Extractores de aire para ventilación de cabina" },
    { name: "Gato elevador hidráulico", sku: "2024-28", category: "general", quantity: 2, unitCost: 22.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Gato portátil para levantar partes" },
    { name: "Desmontaje guarnecidos", sku: "2024-29", category: "general", quantity: 2, unitCost: 6.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Kit para quitar plásticos sin dañar" },
    { name: "Herramientas hidráulicas", sku: "2024-30", category: "enderezado", quantity: 2, unitCost: 25.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Set de herramientas hidráulicas de fuerza" },
    { name: "Limado y cepillado", sku: "2024-31", category: "enderezado", quantity: 1, unitCost: 20.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Limas de chapa y cepillos metálicos" },
    { name: "Impacto de Aire", sku: "2024-32", category: "enderezado", quantity: 2, unitCost: 22.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Herramientas de aire de impacto neumático" },
    { name: "Hidrolavadora", sku: "2024-33", category: "general", quantity: 1, unitCost: 65.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Limpiar con agua a alta presión" },
    { name: "Llaves combinadas", sku: "2024-34", category: "general", quantity: 4, unitCost: 5.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Llaves fijas y de estrella de taller" },
    { name: "Juego de martillos", sku: "2024-35", category: "enderezado", quantity: 5, unitCost: 4.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Diferentes formas + patos apoyo" },
    { name: "Ventosas con tirantas", sku: "2024-36", category: "general", quantity: 1, unitCost: 25.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Manejar cristales y paneles grandes" },
    { name: "Lijadora acción dual (DA)", sku: "2024-37", category: "pintura", quantity: 2, unitCost: 22.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Neumática para lijado fino/grueso" },
    { name: "Lijadora orbital", sku: "2024-38", category: "pintura", quantity: 4, unitCost: 6.25, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Lijadora para superficies planas" },
    { name: "Lima para carrocería", sku: "2024-39", category: "enderezado", quantity: 2, unitCost: 5.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para alisar bordes de chapa" },
    { name: "Martillo de bola", sku: "2024-40", category: "general", quantity: 3, unitCost: 2.67, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Martillo multiuso de golpe seco" },
    { name: "Martillo deslizante", sku: "2024-41", category: "enderezado", quantity: 2, unitCost: 12.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Tracción para abolladuras profundas" },
    { name: "Mordazas y prensas", sku: "2024-42", category: "general", quantity: 4, unitCost: 2.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Herramientas de sujeción para chasis" },
    { name: "Mica Hidraulica", sku: "2024-43", category: "enderezado", quantity: 1, unitCost: 50.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Sirve para levantar vehículos pesados" },
    { name: "Mangera de Pintar", sku: "2024-44", category: "pintura", quantity: 2, unitCost: 5.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Usada en pintura automotriz" },
    { name: "Palancas desabollado", sku: "2024-45", category: "enderezado", quantity: 5, unitCost: 2.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Separar y apalancar paneles metálicos" },
    { name: "Pulidoras de corte", sku: "2024-46", category: "enderezado", quantity: 2, unitCost: 22.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para desbastar pintura" },
    { name: "Pinzas de presión", sku: "2024-47", category: "general", quantity: 4, unitCost: 3.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Locking y de punta fina de taller" },
    { name: "Pistola de calor", sku: "2024-48", category: "general", quantity: 1, unitCost: 30.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para ablandar adhesivos y plásticos" },
    { name: "Pistola pintura HVLP", sku: "2024-49", category: "pintura", quantity: 6, unitCost: 3.33, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Profesionales fondo, color, laca" }
  ];

  console.log("🌱 Sembrando inventario de 2024...");
  for (const t of tools2024) {
    await addProduct(t);
    console.log(`  ✅ Agregado: ${t.name} (Año ${t.year})`);
  }
  await logActivity("audit", "Se cargó el inventario completo de herramientas de 2024 (49 items).");
  console.log("✅ ¡Inventario de 2024 sembrado exitosamente!");
}
