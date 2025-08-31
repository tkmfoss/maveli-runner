    document.addEventListener("DOMContentLoaded", () => {
      const modal = document.getElementById("authModal");
      const openBtn = document.getElementById("openModal");
      const closeBtn = document.getElementById("closeModal");

      const loginForm = document.getElementById("loginForm");
      const signupForm = document.getElementById("signupForm");
      const toSignup = document.getElementById("toSignup");
      const toLogin = document.getElementById("toLogin");

      openBtn.addEventListener("click", () => modal.classList.add("active"));
      closeBtn.addEventListener("click", () => modal.classList.remove("active"));

      toSignup.addEventListener("click", () => {
        loginForm.style.display = "none";
        signupForm.style.display = "block";
      });

      toLogin.addEventListener("click", () => {
        signupForm.style.display = "none";
        loginForm.style.display = "block";
      });
    });