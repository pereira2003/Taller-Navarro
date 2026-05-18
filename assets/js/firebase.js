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
    const products = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const nameCompare = (a.name || "").localeCompare(b.name || "", "es", {
          sensitivity: "base",
          numeric: true
        });
        if (nameCompare !== 0) return nameCompare;
        return (a.sku || "").localeCompare(b.sku || "", "es", {
          sensitivity: "base",
          numeric: true
        });
      });
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
 * Seed the database with the complete 2024 workshop inventory (71 tools).
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
    { name: "Cinta de enmascarar", sku: "2024-09", category: "pintura", quantity: 8, unitCost: 0.3125, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Protectora para delimitar zonas de pintura" },
    { name: "Cortadora de cinta", sku: "2024-10", category: "enderezado", quantity: 1, unitCost: 6.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Cortadora de cinta" },
    { name: "Cargadores de baterias", sku: "2024-11", category: "general", quantity: 2, unitCost: 17.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Convierte corriente casa a DC" },
    { name: "Colador de pintura", sku: "2024-12", category: "pintura", quantity: 10, unitCost: 0.04, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Filtro para eliminar impurezas" },
    { name: "Compresor Pequeño", sku: "2024-13", category: "pintura", quantity: 0, unitCost: 80.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Fuente de aire comprimido" },
    { name: "Compresor Grande", sku: "2024-14", category: "pintura", quantity: 1, unitCost: 500.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Fuente de aire comprimido" },
    { name: "Corta alambres", sku: "2024-15", category: "general", quantity: 3, unitCost: 1.6667, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Cortador para cables y alambres" },
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
    { name: "Extractores de Aire", sku: "2024-27", category: "pintura", quantity: 2, unitCost: 17.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Cadenas resistentes para aplicar fuerza" },
    { name: "Gato elevador hidráulico", sku: "2024-28", category: "general", quantity: 2, unitCost: 22.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Gato portátil para levantar partes" },
    { name: "Desmontaje guarnecidos", sku: "2024-29", category: "general", quantity: 2, unitCost: 6.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Kit para quitar plásticos sin dañar" },
    { name: "Herramientas hidráulicas", sku: "2024-30", category: "enderezado", quantity: 2, unitCost: 25.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Set de herramientas hidráulicas" },
    { name: "Limado y cepillado", sku: "2024-31", category: "enderezado", quantity: 1, unitCost: 20.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Limas de chapa y cepillos metálicos" },
    { name: "Impacto de Aire", sku: "2024-32", category: "enderezado", quantity: 2, unitCost: 22.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Herramientas de aire de impacto" },
    { name: "Hidrolavadora", sku: "2024-33", category: "general", quantity: 1, unitCost: 65.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Limpiar con agua a alta presión" },
    { name: "Llaves combinadas", sku: "2024-34", category: "general", quantity: 4, unitCost: 5.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Llaves fijas y de estrella" },
    { name: "Juego de martillos", sku: "2024-35", category: "enderezado", quantity: 5, unitCost: 4.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Diferentes formas + patos apoyo" },
    { name: "Ventosas con tirantas", sku: "2024-36", category: "general", quantity: 1, unitCost: 25.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Manejar cristales y paneles grandes" },
    { name: "Lijadora acción dual (DA)", sku: "2024-37", category: "pintura", quantity: 2, unitCost: 22.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Neumática para lijado fino/grueso" },
    { name: "Lijadora orbital", sku: "2024-38", category: "pintura", quantity: 4, unitCost: 6.25, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Lijadora para superficies planas" },
    { name: "Lima para carrocería", sku: "2024-39", category: "enderezado", quantity: 2, unitCost: 5.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para alisar bordes de chapa" },
    { name: "Martillo de bola", sku: "2024-40", category: "general", quantity: 3, unitCost: 2.6667, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Martillo multiuso" },
    { name: "Martillo deslizante", sku: "2024-41", category: "enderezado", quantity: 2, unitCost: 12.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Tracción para abolladuras profundas" },
    { name: "Mordazas y prensas", sku: "2024-42", category: "general", quantity: 4, unitCost: 2.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Herramientas de sujeción" },
    { name: "Mica Hidraulica", sku: "2024-43", category: "enderezado", quantity: 1, unitCost: 50.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Sirve para levantar vehículos" },
    { name: "Mangera de Pintar", sku: "2024-44", category: "pintura", quantity: 2, unitCost: 5.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Usada en pintura automotriz" },
    { name: "Palancas desabollado", sku: "2024-45", category: "enderezado", quantity: 5, unitCost: 2.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Separar y apalancar paneles" },
    { name: "Pulidoras de corte", sku: "2024-46", category: "enderezado", quantity: 2, unitCost: 22.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para desbastar pintura" },
    { name: "Pinzas de presión", sku: "2024-47", category: "general", quantity: 4, unitCost: 3.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Locking y de punta fina" },
    { name: "Pistola de calor", sku: "2024-48", category: "general", quantity: 1, unitCost: 30.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para ablandar adhesivos y plásticos" },
    { name: "Pistola pintura HVLP", sku: "2024-49", category: "pintura", quantity: 6, unitCost: 3.3333, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Profesionales fondo, color, laca" },
    { name: "Pistola para uretano", sku: "2024-50", category: "general", quantity: 2, unitCost: 10.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Pistola neumática para masillas" },
    { name: "Pulidoras acabado", sku: "2024-51", category: "pintura", quantity: 2, unitCost: 22.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Pulidora para acabado final de pintura" },
    { name: "Prensa Hidráulica", sku: "2024-52", category: "enderezado", quantity: 1, unitCost: 85.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Funciona con aceite a presión" },
    { name: "Pistola impacto eléctrica", sku: "2024-53", category: "enderezado", quantity: 2, unitCost: 27.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Herramienta de mecánica" },
    { name: "Quita-grapas plástico", sku: "2024-54", category: "general", quantity: 2, unitCost: 3.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Remover grapas sin rayar" },
    { name: "Regulador de presión", sku: "2024-55", category: "general", quantity: 2, unitCost: 6.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Control preciso para herramientas" },
    { name: "Remachadoras", sku: "2024-56", category: "general", quantity: 2, unitCost: 5.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Coloca un remache" },
    { name: "Rach hidraulico", sku: "2024-57", category: "general", quantity: 3, unitCost: 6.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Apretado de piezas" },
    { name: "Rach Electrico", sku: "2024-58", category: "general", quantity: 1, unitCost: 50.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Apretado de piezas" },
    { name: "Sacagolpes", sku: "2024-59", category: "enderezado", quantity: 3, unitCost: 5.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para extraer abolladuras" },
    { name: "Soldadora de alambre", sku: "2024-60", category: "enderezado", quantity: 1, unitCost: 300.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Soldadora de acero" },
    { name: "Limpieza de pistolas", sku: "2024-61", category: "pintura", quantity: 1, unitCost: 15.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Limpiador automático para pistolas" },
    { name: "Serrucho Electrico", sku: "2024-62", category: "enderezado", quantity: 2, unitCost: 17.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para cortar materiales" },
    { name: "Tecle", sku: "2024-63", category: "enderezado", quantity: 1, unitCost: 55.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Izaje y tracción mecánica" },
    { name: "Tenazas de Presión", sku: "2024-64", category: "enderezado", quantity: 5, unitCost: 2.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Sujetar piezas mecánicas" },
    { name: "Tenazas normales", sku: "2024-65", category: "enderezado", quantity: 3, unitCost: 2.6667, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Básicas para agarrar" },
    { name: "Taladro (elec/neum)", sku: "2024-66", category: "general", quantity: 4, unitCost: 7.50, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Taladro con juego de brocas" },
    { name: "Taladro de banco", sku: "2024-67", category: "enderezado", quantity: 1, unitCost: 80.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Montado en una base" },
    { name: "Trozadora", sku: "2024-68", category: "enderezado", quantity: 1, unitCost: 65.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Cortar materiales de forma recta" },
    { name: "Tibaderas", sku: "2024-69", category: "enderezado", quantity: 5, unitCost: 2.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Metal pesado debajo de la lámina" },
    { name: "Tijera para chapa", sku: "2024-70", category: "enderezado", quantity: 2, unitCost: 6.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Cortar láminas" },
    { name: "Yac hidráulico", sku: "2024-71", category: "enderezado", quantity: 1, unitCost: 70.00, year: 2024, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Gato de botella para chasis" }
  ];

  console.log("🌱 Sembrando inventario de 2024...");
  for (const t of tools2024) {
    await addProduct(t);
    console.log(`  ✅ Agregado: ${t.name} (Año ${t.year})`);
  }
  await logActivity("audit", "Se cargó el inventario completo de herramientas de 2024 (71 items).");
  console.log("✅ ¡Inventario de 2024 sembrado exitosamente!");
}

/**
 * Seed the database with the complete 2025 workshop inventory (71 tools).
 * Usage: import { seed2025Data } from './firebase.js'; seed2025Data();
 */
export async function seed2025Data() {
  const tools2025 = [
    { name: "Alicates variados", sku: "2025-01", category: "general", quantity: 3, unitCost: 2.67, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Alicates de diferentes formas y tamaños" },
    { name: "Amoladora", sku: "2025-02", category: "enderezado", quantity: 4, unitCost: 6.25, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Eléctrica portátil con motor giratorio" },
    { name: "Autogena", sku: "2025-03", category: "enderezado", quantity: 1, unitCost: 110.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Equipo de soldadura y corte a gas" },
    { name: "Barra de uña", sku: "2025-04", category: "enderezado", quantity: 2, unitCost: 6.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Barra de acero resistente" },
    { name: "Botadores", sku: "2025-05", category: "enderezado", quantity: 2, unitCost: 4.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para empujar y alinear paneles" },
    { name: "Brocas para taladro", sku: "2025-06", category: "general", quantity: 2, unitCost: 5.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Juego completo de brocas métricas" },
    { name: "Caballetes", sku: "2025-07", category: "general", quantity: 4, unitCost: 5.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Soportes estables para elevar el vehículo" },
    { name: "Carro portaherramientas", sku: "2025-08", category: "general", quantity: 2, unitCost: 27.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Carro móvil para organizar herramientas" },
    { name: "Cinta de enmascarar", sku: "2025-09", category: "pintura", quantity: 8, unitCost: 0.44, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Protectora para delimitar zonas de pintura" },
    { name: "Cortadora de cinta", sku: "2025-10", category: "enderezado", quantity: 1, unitCost: 8.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Cortadora de cinta" },
    { name: "Cargadores de baterias", sku: "2025-11", category: "general", quantity: 2, unitCost: 22.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Convierte corriente casa a DC" },
    { name: "Colador de pintura", sku: "2025-12", category: "pintura", quantity: 10, unitCost: 0.06, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Filtro para eliminar impurezas" },
    { name: "Compresor Pequeño", sku: "2025-13", category: "pintura", quantity: 1, unitCost: 80.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Fuente de aire comprimido" },
    { name: "Compresor Grande", sku: "2025-14", category: "pintura", quantity: 1, unitCost: 500.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Fuente de aire comprimido" },
    { name: "Corta alambres", sku: "2025-15", category: "general", quantity: 3, unitCost: 2.17, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Cortador para cables y alambres" },
    { name: "Cadenas mecánicas", sku: "2025-16", category: "enderezado", quantity: 2, unitCost: 9.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para jalar y estirar carrocería" },
    { name: "Destornilladores", sku: "2025-17", category: "general", quantity: 2, unitCost: 7.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Juego completo (Phillips, planos, etc)" },
    { name: "Dremel", sku: "2025-18", category: "general", quantity: 4, unitCost: 8.75, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para desbastar diferentes tamaños" },
    { name: "Equipo soldadura MIG", sku: "2025-19", category: "enderezado", quantity: 2, unitCost: 150.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Soldadora para unir metales" },
    { name: "Equipo (spotter)", sku: "2025-20", category: "enderezado", quantity: 1, unitCost: 500.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Reparaciones rápidas sin perforar" },
    { name: "Extanzores", sku: "2025-21", category: "enderezado", quantity: 2, unitCost: 22.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Expander para enderezar piezas" },
    { name: "Extilzon", sku: "2025-22", category: "enderezado", quantity: 2, unitCost: 8.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para aflojar o apretar tubos" },
    { name: "Engrapadora plastico", sku: "2025-23", category: "general", quantity: 1, unitCost: 65.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Unir o sujetar materiales plásticos" },
    { name: "Ele de enderezado", sku: "2025-24", category: "enderezado", quantity: 1, unitCost: 115.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Herramienta hidráulica de carrocería" },
    { name: "Espátulas para masilla", sku: "2025-25", category: "general", quantity: 1, unitCost: 6.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Acero y plástico para masilla" },
    { name: "Extensiones Electricas", sku: "2025-26", category: "general", quantity: 4, unitCost: 3.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Extensión de energía eléctrica" },
    { name: "Extractores de Aire", sku: "2025-27", category: "pintura", quantity: 2, unitCost: 22.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Cadenas resistentes para aplicar fuerza" },
    { name: "Gato elevador hidráulico", sku: "2025-28", category: "general", quantity: 2, unitCost: 27.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Gato portátil para levantar partes" },
    { name: "Desmontaje guarnecidos", sku: "2025-29", category: "general", quantity: 2, unitCost: 7.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Kit para quitar plásticos sin dañar" },
    { name: "Herramientas hidráulicas", sku: "2025-30", category: "enderezado", quantity: 2, unitCost: 32.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Set de herramientas hidráulicas" },
    { name: "Limado y cepillado", sku: "2025-31", category: "enderezado", quantity: 1, unitCost: 25.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Limas de chapa y cepillos metálicos" },
    { name: "Impacto de Aire", sku: "2025-32", category: "enderezado", quantity: 2, unitCost: 30.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Herramientas de aire de impacto" },
    { name: "Hidrolavadora", sku: "2025-33", category: "general", quantity: 1, unitCost: 95.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Limpiar con agua a alta presión" },
    { name: "Llaves combinadas", sku: "2025-34", category: "general", quantity: 4, unitCost: 7.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Llaves fijas y de estrella" },
    { name: "Juego de martillos", sku: "2025-35", category: "enderezado", quantity: 5, unitCost: 5.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Diferentes formas + patos apoyo" },
    { name: "Ventosas con tirantas", sku: "2025-36", category: "general", quantity: 1, unitCost: 35.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Manejar cristales y paneles grandes" },
    { name: "Lijadora acción dual DA", sku: "2025-37", category: "pintura", quantity: 2, unitCost: 27.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Neumática para lijado fino/grueso" },
    { name: "Lijadora orbital", sku: "2025-38", category: "pintura", quantity: 4, unitCost: 8.75, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Lijadora para superficies planas" },
    { name: "Lima para carrocería", sku: "2025-39", category: "enderezado", quantity: 2, unitCost: 7.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para alisar bordes de chapa" },
    { name: "Martillo de bola", sku: "2025-40", category: "general", quantity: 3, unitCost: 4.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Martillo multiuso" },
    { name: "Martillo deslizante", sku: "2025-41", category: "enderezado", quantity: 2, unitCost: 17.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Tracción para abolladuras profundas" },
    { name: "Mordazas y prensas", sku: "2025-42", category: "general", quantity: 4, unitCost: 3.75, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Herramientas de sujeción" },
    { name: "Mica Hidraulica", sku: "2025-43", category: "enderezado", quantity: 1, unitCost: 65.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Sirve para levantar vehículos" },
    { name: "Mangera de Pintar", sku: "2025-44", category: "pintura", quantity: 2, unitCost: 7.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Usada en pintura automotriz" },
    { name: "Palancas desabollado", sku: "2025-45", category: "enderezado", quantity: 5, unitCost: 2.40, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Separar y apalancar paneles" },
    { name: "Pulidoras de corte", sku: "2025-46", category: "enderezado", quantity: 2, unitCost: 30.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para desbastar pintura" },
    { name: "Pinzas de presión", sku: "2025-47", category: "general", quantity: 4, unitCost: 3.75, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Locking y de punta fina" },
    { name: "Pistola de calor", sku: "2025-48", category: "general", quantity: 1, unitCost: 40.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para ablandar adhesivos y plásticos" },
    { name: "Pistola pintura HVLP", sku: "2025-49", category: "pintura", quantity: 6, unitCost: 5.83, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Profesionales fondo, color, laca" },
    { name: "Pistola para uretano", sku: "2025-50", category: "general", quantity: 2, unitCost: 12.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Pistola neumática para masillas" },
    { name: "Pulidoras acabado", sku: "2025-51", category: "pintura", quantity: 2, unitCost: 30.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Pulidora para acabado final de pintura" },
    { name: "Prensa Hidráulica", sku: "2025-52", category: "enderezado", quantity: 1, unitCost: 110.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Funciona con aceite a presión" },
    { name: "Pistola impacto eléctrica", sku: "2025-53", category: "enderezado", quantity: 2, unitCost: 37.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Herramienta de mecánica" },
    { name: "Quita-grapas plástico", sku: "2025-54", category: "general", quantity: 2, unitCost: 4.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Remover grapas sin rayar" },
    { name: "Regulador de presión", sku: "2025-55", category: "general", quantity: 2, unitCost: 7.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Control preciso para herramientas" },
    { name: "Remachadoras", sku: "2025-56", category: "general", quantity: 2, unitCost: 6.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Coloca un remache" },
    { name: "Rach hidraulico", sku: "2025-57", category: "general", quantity: 3, unitCost: 8.33, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Apretado de piezas" },
    { name: "Rach Electrico", sku: "2025-58", category: "general", quantity: 1, unitCost: 70.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Apretado de piezas" },
    { name: "Sacagolpes", sku: "2025-59", category: "enderezado", quantity: 3, unitCost: 6.67, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para extraer abolladuras" },
    { name: "Soldadora de alambre", sku: "2025-60", category: "enderezado", quantity: 1, unitCost: 300.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Soldadora de acero" },
    { name: "Limpieza de pistolas", sku: "2025-61", category: "pintura", quantity: 1, unitCost: 25.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Limpiador automático para pistolas" },
    { name: "Serrucho Electrico", sku: "2025-62", category: "enderezado", quantity: 2, unitCost: 22.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Para cortar materiales" },
    { name: "Tecle", sku: "2025-63", category: "enderezado", quantity: 1, unitCost: 75.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Izaje y tracción mecánica" },
    { name: "Tenazas de Presión", sku: "2025-64", category: "enderezado", quantity: 5, unitCost: 2.40, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Sujetar piezas mecánicas" },
    { name: "Tenazas normales", sku: "2025-65", category: "enderezado", quantity: 3, unitCost: 3.33, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Básicas para agarrar" },
    { name: "Taladro (elec/neum)", sku: "2025-66", category: "general", quantity: 4, unitCost: 10.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Taladro con juego de brocas" },
    { name: "Taladro de banco", sku: "2025-67", category: "enderezado", quantity: 1, unitCost: 105.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Montado en una base" },
    { name: "Trozadora", sku: "2025-68", category: "enderezado", quantity: 1, unitCost: 85.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Cortar materiales de forma recta" },
    { name: "Tibaderas", sku: "2025-69", category: "enderezado", quantity: 5, unitCost: 2.40, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Metal pesado debajo de la lámina" },
    { name: "Tijera para chapa", sku: "2025-70", category: "enderezado", quantity: 2, unitCost: 7.50, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Cortar láminas" },
    { name: "Yac hidráulico", sku: "2025-71", category: "enderezado", quantity: 1, unitCost: 70.00, year: 2025, warehouseLocation: "", supplier: "", imageUrl: "", reorderThreshold: 0, description: "Gato de botella para chasis" }
  ];

  console.log("🌱 Sembrando inventario de 2025...");
  for (const t of tools2025) {
    await addProduct(t);
    console.log(`  ✅ Agregado: ${t.name} (Año ${t.year})`);
  }
  await logActivity("audit", "Se cargó el inventario completo de herramientas de 2025 (71 items).");
  console.log("✅ ¡Inventario de 2025 sembrado exitosamente!");
}

/**
 * Delete all products from the inventory.
 */
export async function clearDatabase() {
  console.log("🧹 Vaciando base de datos...");
  const snap = await getDocs(productsCol);
  for (const d of snap.docs) {
    await deleteDoc(doc(db, "products", d.id));
  }
  await logActivity("delete", "Se vació todo el inventario de herramientas para reiniciar.");
  console.log("✅ ¡Base de datos vaciada exitosamente!");
}
