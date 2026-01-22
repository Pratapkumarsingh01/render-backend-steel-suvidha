// models/Product.js

class Product {
  constructor(data = {}) {
    this._id = data._id || null; // Added to handle database IDs
    this.name = data.name || "";
    this.category = data.category || "";
    this.metalType = data.metalType || "Steel";
    this.brand = data.brand || "";
    this.grade = data.grade || "";
    this.finish = data.finish || "";
    this.size = data.size || "";
    this.description = data.description || "";
    this.imageUrl = data.imageUrl || "";

    // Pricing and quantity
    this.price = data.price ?? null;
    this.quantity = data.quantity ?? null;
    this.unit = data.unit || "kg";

    // --- MASTER CATALOG FIELDS (FIXED) ---
    // isMaster: true if this is an entry created by Admin for the global list
    this.isMaster = data.isMaster ?? false; 
    
    // masterProductId: Link the seller's product to the Admin's master product
    this.masterProductId = data.masterProductId || null;

    // Product status (Active = Seller is selling it, Inactive = Seller stopped selling it)
    this.status = data.status || "Active";

    // Seller information
    this.sellerId = data.sellerId || null;     // null for Master Products
    this.sellerName = data.sellerName || "";

    // Timestamps
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      category: this.category,
      metalType: this.metalType,
      brand: this.brand,
      grade: this.grade,
      finish: this.finish,
      size: this.size,
      description: this.description,
      imageUrl: this.imageUrl,
      price: this.price,
      quantity: this.quantity,
      unit: this.unit,
      isMaster: this.isMaster,
      masterProductId: this.masterProductId,
      status: this.status,
      sellerId: this.sellerId,
      sellerName: this.sellerName,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Product;