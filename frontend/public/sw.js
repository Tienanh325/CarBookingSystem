self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "GoRide", body: event.data?.text() ?? "Bạn có thông báo mới" };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "GoRide", {
      body: payload.body ?? "Bạn có thông báo mới",
      data: payload.data ?? {}
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        existing.navigate(target);
        return existing.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
