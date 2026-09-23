document.addEventListener("click", async (event) => {
  const feedback = event.target.closest("[data-ai-feedback]");
  if (feedback) {
    feedback.disabled = true;
    await fetch(`/api/ai/recommendations/${feedback.dataset.id}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feedback: feedback.dataset.feedback }) });
    feedback.textContent = "Saved";
  }
  const interaction = event.target.closest("[data-ai-interaction]");
  if (interaction) {
    await fetch("/api/ai/interactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType: interaction.dataset.eventType, resourceType: interaction.dataset.resourceType, resourceId: interaction.dataset.resourceId }) });
    interaction.textContent = "Recorded";
    interaction.disabled = true;
  }
});
