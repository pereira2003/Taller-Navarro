// =============================================
// app.js — Lumina Inventory · Dashboard Logic
// =============================================

import {
  onProducts,
  onRecentActivity,
  logActivity,
  formatRelativeTime,
  activityIcon,
  activityColors
} from "./firebase.js";

// ─── DASHBOARD STATS ────────────────────────────────────────

let unsubscribeProducts = null;
let unsubscribeActivity = null;

function initDashboard() {
  // Listen to products → update stat cards
  unsubscribeProducts = onProducts((products) => {
    const total = products.reduce((sum, p) => sum + Number(p.quantity || 0), 0);
    const inTransit = products.filter(p => p.status === "IN_STOCK").length;
    const alerts = products.filter(p =>
      p.status === "LOW_STOCK" || p.status === "OUT_OF_STOCK"
    ).length;

    const elTotal    = document.getElementById("stat-total");
    const elTransit  = document.getElementById("stat-transit");
    const elAlerts   = document.getElementById("stat-alerts");

    if (elTotal)   elTotal.textContent   = total.toLocaleString();
    if (elTransit) elTransit.textContent = inTransit.toLocaleString();
    if (elAlerts)  elAlerts.textContent  = alerts.toLocaleString();
  });

  // Listen to recent activity → render feed
  unsubscribeActivity = onRecentActivity((activities) => {
    const feed = document.getElementById("activity-feed");
    if (!feed) return;

    if (activities.length === 0) {
      feed.innerHTML = `
        <p class="text-sm text-on-surface-variant opacity-60 text-center py-4">
          No hay actividad reciente.
        </p>`;
      return;
    }

    feed.innerHTML = activities.map(a => {
      const colors = activityColors(a.type);
      const icon   = activityIcon(a.type);
      const time   = formatRelativeTime(a.timestamp);
      return `
        <div class="flex gap-4">
          <div class="mt-1">
            <div class="w-8 h-8 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center shadow-inner border border-white/50">
              <span class="material-symbols-outlined text-[16px]">${icon}</span>
            </div>
          </div>
          <div>
            <p class="text-sm font-bold text-on-surface">${activityTitle(a.type)}</p>
            <p class="text-xs text-on-surface-variant mb-1">${a.message}</p>
            <span class="text-[10px] ${colors.text} font-bold uppercase tracking-widest">${time}</span>
          </div>
        </div>`;
    }).join('');
  });
}

function activityTitle(type) {
  const titles = {
    add:      "Nuevo stock registrado",
    transfer: "Transferencia completada",
    alert:    "Alerta de stock bajo",
    audit:    "Auditoría completada",
    delete:   "Elemento eliminado",
    edit:     "Elemento actualizado"
  };
  return titles[type] || "Actividad registrada";
}

// ─── INVENTORY PAGE: FILTER CHIPS ───────────────────────────

function initFilterChips() {
  const chips = document.querySelectorAll("[data-filter-chip]");
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      chips.forEach(c => {
        c.classList.remove("liquid-chip-active", "text-white", "shadow-lg");
        c.classList.add("liquid-chip", "text-on-surface-variant");
      });
      chip.classList.add("liquid-chip-active", "text-white", "shadow-lg");
      chip.classList.remove("liquid-chip", "text-on-surface-variant");
    });
  });
}

// ─── INIT ────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // Dashboard page
  if (document.getElementById("activity-feed")) {
    initDashboard();
  }
  // All pages: filter chips
  initFilterChips();
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (unsubscribeProducts) unsubscribeProducts();
  if (unsubscribeActivity) unsubscribeActivity();
});
