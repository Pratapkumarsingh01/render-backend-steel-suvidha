// models/User.js

class User {
  constructor(data = {}) {
    this.name = data.name || "";
    this.email = data.email || "";
    this.gstin = data.gstin || ""; // NEW: Added GSTIN field
    this.username = data.username || "";
    this.password = data.password || "";  // Should be hashed later
    this.role = data.role || "Buyer";     // Buyer | Seller | Admin
    this.status = data.status || "Active";
    this.activity = data.activity || "Offline";
    this.lastLogin = data.lastLogin || null;
    this.description = data.description || "";
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Update password separately (useful when hashing later)
  setPassword(hashedPassword) {
    this.password = hashedPassword;
    this.updatedAt = new Date();
  }

  // Update any user fields with data
  update(data = {}) {
    Object.assign(this, data);
    this.updatedAt = new Date();
  }

  // Remove password before returning JSON
  toJSON() {
    const { password, ...safeUser } = this;
    return safeUser;
  }
}

module.exports = User;