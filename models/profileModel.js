const bcrypt = require("bcryptjs");
const authModel = require("./authModel");

async function updateProfileData(userId, profileData) {
  const result = {
    success: true,
    message: "Profile updated successfully.",
    data: profileData,
  };

  if (userId) {
    await authModel.logEvent("profile_updated", { userId, outcome: "success", profile: profileData });
  }

  return result;
}

async function updatePasswordData(userId, currentPassword, newPassword, confirmNewPassword, currentHash) {
  if (!currentPassword) {
    return { success: false, message: "Current password is required." };
  }

  if (!bcrypt.compareSync(currentPassword, currentHash)) {
    return { success: false, message: "Current password is incorrect." };
  }

  if (!newPassword || newPassword !== confirmNewPassword) {
    return { success: false, message: "New password and confirmation must match." };
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  await authModel.logEvent("password_changed", { userId, outcome: "success" });

  return {
    success: true,
    message: "Password updated successfully.",
    passwordHash: newHash,
  };
}

async function updatePreferencesData(userId, preferences) {
  await authModel.logEvent("communication_preferences_updated", { userId, outcome: "success" });
  return {
    success: true,
    message: "Communication preferences updated.",
    data: preferences,
  };
}

module.exports = {
  updateProfileData,
  updatePasswordData,
  updatePreferencesData,
};
