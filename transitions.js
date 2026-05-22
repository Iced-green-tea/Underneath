const transitionLinks = document.querySelectorAll("a[href]");

window.fadeTo = (href) => {
  document.body.classList.add("page-exit");
  window.setTimeout(() => {
    window.location.href = href;
  }, 220);
};

for (const link of transitionLinks) {
  link.addEventListener("click", (event) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || link.target) return;

    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;

    event.preventDefault();
    window.fadeTo(url.href);
  });
}
