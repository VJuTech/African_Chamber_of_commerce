const bcrypt = require("bcryptjs");
const { validatePassword } = require("../utility/account-validation");
const profileModel = require("../models/profileModel");

function profilePage(req, res) {
  const user = req.session.user;
  const profile = {
    firstName: user && user.firstName ? user.firstName : "",
    lastName: user && user.lastName ? user.lastName : "",
    middleName: user && user.middleName ? user.middleName : "",
    preferredDisplayName: user && user.preferredDisplayName ? user.preferredDisplayName : "",
    email: user && user.email ? user.email : "",
    phone: user && user.phone ? user.phone : "",
    country: user && user.country ? user.country : "",
    preferredLanguage: user && user.preferredLanguage ? user.preferredLanguage : "",
    timeZone: user && user.timeZone ? user.timeZone : "",
    address: user && user.address ? user.address : "",
    preferences: user && user.preferences ? user.preferences : {
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
      marketingCommunications: false,
      newsletterSubscription: false,
      eventReminders: true,
      procurementNotifications: true,
      marketplaceUpdates: true,
    },
  };

  res.render("profile", {
    title: "My Profile",
    user,
    profile,
    error: "",
    success: req.query.success || "",
    sessions: [
      { device: "Chrome on Windows", location: "Lagos, NG", lastActivity: new Date().toLocaleString() },
    ],
    activity: [
      { eventType: "Login", timestamp: new Date().toLocaleString(), outcome: "success" },
      { eventType: "Profile viewed", timestamp: new Date().toLocaleString(), outcome: "success" },
    ],
  });
}

async function updateProfile(req, res, next) {
  try {
    const { firstName, lastName, middleName, preferredDisplayName, email, phone, country, preferredLanguage, timeZone, address } = req.body;
    const currentUser = req.session.user;

    if (!currentUser) {
      return res.redirect("/login?message=Please sign in to continue.");
    }

    if (!firstName || !lastName || !email) {
      return res.render("profile", {
        title: "My Profile",
        user: currentUser,
        profile: req.body,
        error: "First name, last name, and email are required.",
        success: "",
        sessions: [],
        activity: [],
      });
    }

    req.session.user = {
      ...currentUser,
      firstName,
      lastName,
      middleName,
      preferredDisplayName,
      email,
      phone,
      country,
      preferredLanguage,
      timeZone,
      address,
      name: `${firstName} ${lastName}`.trim(),
    };

    await profileModel.updateProfileData(currentUser.id, { email, phone, firstName, lastName, middleName, preferredDisplayName, country, preferredLanguage, timeZone, address });

    return res.redirect("/profile?success=Profile updated successfully.");
  } catch (error) {
    return next(error);
  }
}

async function updatePassword(req, res, next) {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const currentUser = req.session.user;

    if (!currentUser) {
      return res.redirect("/login?message=Please sign in to continue.");
    }

    const passwordErrors = validatePassword(newPassword, confirmNewPassword);
    if (!currentPassword || passwordErrors.length > 0) {
      return res.render("profile", {
        title: "My Profile",
        user: currentUser,
        profile: currentUser,
        error: passwordErrors.length > 0 ? passwordErrors.join(" ") : "Current password is required.",
        success: "",
        sessions: [],
        activity: [],
      });
    }

    const storedPassword = currentUser.passwordHash || "";
    const validCurrentPassword = storedPassword ? bcrypt.compareSync(currentPassword, storedPassword) : false;
    if (!validCurrentPassword) {
      return res.render("profile", {
        title: "My Profile",
        user: currentUser,
        profile: currentUser,
        error: "Current password is incorrect.",
        success: "",
        sessions: [],
        activity: [],
      });
    }

    const passwordResult = await profileModel.updatePasswordData(currentUser.id, currentPassword, newPassword, confirmNewPassword, storedPassword);

    if (!passwordResult.success) {
      return res.render("profile", {
        title: "My Profile",
        user: currentUser,
        profile: currentUser,
        error: passwordResult.message,
        success: "",
        sessions: [],
        activity: [],
      });
    }

    req.session.user.passwordHash = passwordResult.passwordHash;
    return res.redirect("/profile?success=Password updated successfully.");
  } catch (error) {
    return next(error);
  }
}

async function updatePreferences(req, res, next) {
  try {
    const currentUser = req.session.user;
    if (!currentUser) {
      return res.redirect("/login?message=Please sign in to continue.");
    }

    const preferences = {
      emailNotifications: req.body.emailNotifications === "true",
      smsNotifications: req.body.smsNotifications === "true",
      pushNotifications: req.body.pushNotifications === "true",
      marketingCommunications: req.body.marketingCommunications === "true",
      newsletterSubscription: req.body.newsletterSubscription === "true",
      eventReminders: req.body.eventReminders === "true",
      procurementNotifications: req.body.procurementNotifications === "true",
      marketplaceUpdates: req.body.marketplaceUpdates === "true",
    };

    req.session.user.preferences = preferences;
    await profileModel.updatePreferencesData(currentUser.id, preferences);

    return res.redirect("/profile?success=Communication preferences updated.");
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  profilePage,
  updateProfile,
  updatePassword,
  updatePreferences,
};
