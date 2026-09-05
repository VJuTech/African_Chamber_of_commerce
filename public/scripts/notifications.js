/* Chapter 25 client behavior: subscribe to the authenticated live notification stream. */
document.addEventListener("DOMContentLoaded", () => {
  // Open an authenticated SSE connection so new alerts arrive without a page refresh.
  const stream = new EventSource("/notifications/stream");
  const indicator = document.querySelector("[data-notification-live]");
  const list = document.querySelector("[data-notification-list]");

  // Reflect connection health in the small status indicator.
  stream.onopen = () => {
    if (indicator) {
      indicator.dataset.state = "online";
      indicator.textContent = "Live connection";
    }
  };

  // Add an arriving alert at the top of the inbox without replacing existing forms.
  stream.addEventListener("notification", (event) => {
    const notification = JSON.parse(event.data);
    if (!list) return;
    const emptyState = list.querySelector(".notification-empty");
    if (emptyState) emptyState.remove();
    const item = document.createElement("article");
    item.className = "notification-item notification-item--unread";
    item.dataset.notificationId = notification.id;
    item.innerHTML = `<div class="notification-item__content"><span class="notification-type"></span><h3></h3><p></p><time></time></div><span class="notification-read-state">New</span>`;
    item.querySelector(".notification-type").textContent = notification.type;
    item.querySelector("h3").textContent = notification.title;
    item.querySelector("p").textContent = notification.message;
    item.querySelector("time").textContent = new Date(notification.createdAt).toLocaleString();
    list.prepend(item);
  });

  // Mark the stream offline when the browser cannot maintain the connection.
  stream.onerror = () => {
    if (indicator) {
      indicator.dataset.state = "offline";
      indicator.textContent = "Live connection unavailable";
    }
  };
});
