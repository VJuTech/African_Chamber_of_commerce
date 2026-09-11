(() => {
  const page = document.querySelector("[data-analytics-page]");
  if (!page) return;
  const refreshUrl = page.dataset.refreshUrl;
  const status = page.querySelector("[data-refresh-status]");
  const chart = page.querySelector("[data-trend-chart]");
  const maxBars = 31;

  function render(data) {
    Object.entries(data.kpis || {}).forEach(([key, value]) => {
      const target = page.querySelector(`[data-kpi="${key}"]`);
      if (target) target.textContent = value == null ? "0" : value;
    });
    if (chart && Array.isArray(data.daily)) {
      chart.replaceChildren(...data.daily.slice(-maxBars).map((point) => {
        const level = Math.min(8, Math.max(1, Number(point.transactions_count) || 1));
        const item = document.createElement("div");
        item.className = `analytics-bar analytics-bar--${level}`;
        item.title = `${point.day}: ${point.transactions_count} transactions`;
        item.innerHTML = `<span>${point.transactions_count}</span><small>${point.day}</small>`;
        return item;
      }));
    }
    if (status) status.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  }

  async function refresh() {
    try {
      const response = await fetch(refreshUrl, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Analytics refresh failed");
      render(await response.json());
    } catch (error) {
      if (status) status.textContent = "Refresh unavailable";
    }
  }

  window.setInterval(refresh, 30000);
})();
