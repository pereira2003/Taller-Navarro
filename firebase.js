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
  await updateDoc(ref, { ...data, status, updatedAt: serverTimestamp() });
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
