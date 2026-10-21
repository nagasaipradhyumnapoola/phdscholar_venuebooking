(() => {
  let saved;
  try {
    saved = localStorage.getItem("pretalk.theme");
  } catch {
    /* Use the device preference. */
  }
  document.documentElement.dataset.theme = ["light", "dark"].includes(saved)
    ? saved
    : "light";
})();
