const registerServiceWorker = async () => {
  if ("serviceWorker" in navigator) {
    try {
        const thisScript = document.currentScript;
        let buildTag = thisScript.getAttribute('data-buildTag');
        console.log("data-buildTag: " + buildTag);
        const registration = await navigator.serviceWorker.register("/sw.js?build-tag=" + buildTag, {
        scope: "/",
      });
      if (registration.installing) {
        console.log("Service worker installing");
      } else if (registration.waiting) {
        console.log("Service worker installed");
      } else if (registration.active) {
        console.log("Service worker active");
      }
    } catch (error) {
      console.error(`Registration failed with ${error}`);
    }
  }
};

registerServiceWorker();
