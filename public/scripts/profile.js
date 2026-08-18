// Profile-specific behavior is isolated here so the template stays declarative.
document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.querySelector("[data-profile-photo-input]");
  if (!fileInput) return;

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    const existingImage = document.getElementById("profilePhotoPreview");
    const fallback = document.getElementById("profilePhotoPreviewFallback");
    const previewUrl = URL.createObjectURL(file);

    if (existingImage) {
      existingImage.src = previewUrl;
      return;
    }

    if (fallback) {
      const image = document.createElement("img");
      image.id = "profilePhotoPreview";
      image.className = "profile-avatar";
      image.alt = "Selected profile preview";
      image.src = previewUrl;
      fallback.replaceWith(image);
    }
  });
});
