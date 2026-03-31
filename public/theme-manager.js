var darkClass = "dark-mode";

function enforceDarkMode() {
  document.body.classList.add(darkClass);
  document.documentElement.style.colorScheme = "dark";
  localStorage.setItem("sr-theme-preference", "dark");
}

window.Theme = {
  toggle: function () {
    enforceDarkMode();
  },
  isDarkMode: function () {
    return true;
  },
};

if (document.body) {
  enforceDarkMode();
}

document.addEventListener("DOMContentLoaded", function () {
  enforceDarkMode();
});
