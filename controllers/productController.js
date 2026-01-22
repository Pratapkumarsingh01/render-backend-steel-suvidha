// controllers/productController.js
const { ObjectId } = require('mongodb');
const database = require('../services/database');
const Product = require('../models/Product');

class ProductController {
  /**
   * Create a new product. 
   * Used by Admin (isMaster: true) or Sellers (isMaster: false)
   */
  async createProduct(req, res) {
    try {
      const { 
        name, category, metalType, brand, grade, finish, size, 
        description, imageUrl, price, quantity, unit, status,
        sellerId, sellerName, isMaster, masterProductId 
      } = req.body;

      // Validation
      if (!name || !category) {
        return res.status(400).json({ 
          error: 'Name and category are required' 
        });
      }

      const productsCollection = database.getProductsCollection();

      // Create product object
      const now = new Date();
      const productData = {
        name,
        category,
        metalType: metalType || 'Steel',
        brand: brand || '',
        grade: grade || '',
        finish: finish || '',
        size: size || '',
        description: description || '',
        imageUrl: imageUrl || '',
        price: price || null,
        quantity: quantity || null,
        unit: unit || 'kg',
        isMaster: isMaster === true || isMaster === 'true', 
        masterProductId: masterProductId || null,
        status: status || 'Active',
        sellerId: sellerId || null, 
        sellerName: sellerName || '',
        createdAt: now,
        updatedAt: now
      };

      const result = await productsCollection.insertOne(productData);
      productData._id = result.insertedId;

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        product: productData
      });
    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({ error: 'Failed to create product' });
    }
  }

  /**
   * Toggle a Master Product for a specific Seller.
   * If record doesn't exist, it clones the Master item for the Seller.
   */
  async toggleMasterProduct(req, res) {
    try {
      const { masterProductId, sellerId, sellerName, status } = req.body;
      
      if (!masterProductId || !sellerId) {
        return res.status(400).json({ error: 'masterProductId and sellerId are required' });
      }

      const productsCollection = database.getProductsCollection();

      // 1. Check if seller already has a record for this master product
      const existingEntry = await productsCollection.findOne({
        masterProductId: masterProductId.toString(),
        sellerId: sellerId.toString()
      });

      if (existingEntry) {
        // Update existing status
        await productsCollection.updateOne(
          { _id: existingEntry._id },
          { $set: { status: status, updatedAt: new Date() } }
        );
        return res.json({ success: true, message: `Product marked as ${status}` });
      } else {
        // 2. Fetch master details to create seller's personal entry
        // Ensure we use ObjectId for the lookup
        const masterProduct = await productsCollection.findOne({ _id: new ObjectId(masterProductId) });
        
        if (!masterProduct) {
          return res.status(404).json({ error: "Master product not found" });
        }

        // Clone the master product but change ownership and status
        const sellerProduct = {
          ...masterProduct,
          _id: new ObjectId(), // Generate a new ID for the seller's specific entry
          isMaster: false,
          masterProductId: masterProductId.toString(),
          sellerId: sellerId.toString(),
          sellerName: sellerName || '',
          status: status || 'Active',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await productsCollection.insertOne(sellerProduct);
        res.json({ success: true, message: "Product added to your inventory" });
      }
    } catch (error) {
      console.error('Toggle product error:', error);
      res.status(500).json({ error: 'Internal server error during toggle' });
    }
  }

  /**
   * Fetch only the products owned by a specific seller
   */
  async getProductsBySeller(req, res) {
    try {
      const { sellerId } = req.params;
      const productsCollection = database.getProductsCollection();
      
      const products = await productsCollection
        .find({ sellerId: sellerId, isMaster: false })
        .sort({ createdAt: -1 })
        .toArray();

      res.json(products);
    } catch (error) {
      console.error('Get products by seller error:', error);
      res.status(500).json({ error: 'Failed to get products' });
    }
  }

  /**
   * Get all products. 
   */
  async getAllProducts(req, res) {
    try {
      const { category, metalType, status, isMaster, sellerId } = req.query;
      const productsCollection = database.getProductsCollection();
      
      if (isMaster === 'true' && sellerId) {
        const pipeline = [
          { $match: { isMaster: true } },
          {
            $lookup: {
              from: "products",
              let: { masterId: { $toString: "$_id" } },
              pipeline: [
                { 
                  $match: { 
                    $expr: { 
                      $and: [
                        { $eq: ["$masterProductId", "$$masterId"] },
                        { $eq: ["$sellerId", sellerId] }
                      ]
                    } 
                  } 
                }
              ],
              as: "seller_link"
            }
          },
          {
            $addFields: {
              status: { 
                $ifNull: [{ $arrayElemAt: ["$seller_link.status", 0] }, "Inactive"] 
              }
            }
          },
          { $project: { seller_link: 0 } },
          { $sort: { createdAt: -1 } }
        ];

        if (category) pipeline[0].$match.category = category;
        if (metalType) pipeline[0].$match.metalType = metalType;

        const results = await productsCollection.aggregate(pipeline).toArray();
        return res.json(results);
      }

      const query = {};
      if (category) query.category = category;
      if (metalType) query.metalType = metalType;
      if (status) query.status = status;
      if (isMaster !== undefined) query.isMaster = isMaster === 'true';

      const products = await productsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      res.json(products);
    } catch (error) {
      console.error('Get all products error:', error);
      res.status(500).json({ error: 'Failed to get products' });
    }
  }

  async getProductById(req, res) {
    try {
      const { id } = req.params;
      const productsCollection = database.getProductsCollection();
      const product = await productsCollection.findOne({ _id: new ObjectId(id) });

      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get product' });
    }
  }

  async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const productsCollection = database.getProductsCollection();
      
      updateData.updatedAt = new Date();

      const result = await productsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      if (result.matchedCount === 0) return res.status(404).json({ error: 'Product not found' });

      const updatedProduct = await productsCollection.findOne({ _id: new ObjectId(id) });
      res.json({ success: true, product: updatedProduct });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update product' });
    }
  }

  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const productsCollection = database.getProductsCollection();
      const result = await productsCollection.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 0) return res.status(404).json({ error: 'Product not found' });
      res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete product' });
    }
  }

  /**
   * Seed Master Catalog with all possible product combinations
   * This ensures 100% product availability for all filter combinations
   */
  async seedMasterCatalog(req, res) {
    try {
      const productsCollection = database.getProductsCollection();
      const now = new Date();
      let totalAdded = 0;
      let totalSkipped = 0;

      // Helper function to check for duplicates
      const checkDuplicate = async (category, brand, size, grade, finish, variety, type) => {
        const query = {
          isMaster: true,
          category: category,
          brand: brand || '',
          size: size || '',
          grade: grade || '',
          finish: finish || '',
          variety: variety || '',
          type: type || ''
        };
        // Remove empty string fields for proper matching
        Object.keys(query).forEach(key => {
          if (query[key] === '' || query[key] === null) {
            delete query[key];
          }
        });
        const existing = await productsCollection.findOne(query);
        return existing !== null;
      };

      // Helper function to create product
      const createProduct = async (productData) => {
        const isDuplicate = await checkDuplicate(
          productData.category,
          productData.brand,
          productData.size,
          productData.grade,
          productData.finish,
          productData.variety,
          productData.type
        );

        if (isDuplicate) {
          totalSkipped++;
          return false;
        }

        const product = {
          name: productData.name,
          category: productData.category,
          metalType: productData.metalType || 'Steel',
          brand: productData.brand || '',
          grade: productData.grade || '',
          finish: productData.finish || '',
          size: productData.size || '',
          variety: productData.variety || '',
          type: productData.type || '',
          description: productData.description || '',
          imageUrl: productData.imageUrl || '',
          price: 0,
          quantity: 0,
          unit: productData.unit || 'kg',
          isMaster: true,
          masterProductId: null,
          status: 'Active',
          sellerId: null,
          sellerName: '',
          createdAt: now,
          updatedAt: now
        };

        await productsCollection.insertOne(product);
        totalAdded++;
        return true;
      };

      // ===== TMT REBARS =====
      const tmtBrands = ['TATA Tiscon', 'SAIL', 'Jindal', 'JSW', 'Shyam Steel', 'Rungta', 'Others'];
      const tmtGrades = ['500 D', '550 D', '600 D'];
      const tmtSizes = ['6 mm', '8 mm', '10 mm', '12 mm', '16 mm', '20 mm', '25 mm', '32 mm'];

      for (const brand of tmtBrands) {
        for (const grade of tmtGrades) {
          for (const size of tmtSizes) {
            await createProduct({
              name: `TMT ${grade} ${size}`,
              category: 'TMT Rebars',
              brand: brand,
              grade: grade,
              size: size,
              unit: 'kg'
            });
          }
        }
      }

      // ===== ANGLES =====
      const angleBrands = ['Patna Iron', 'Kamdhenu', 'JKSPL', 'Sel Tiger', 'SAIL', 'SUL', 'Others'];
      const angleFinishes = ['MS - Mild Steel (Black)', 'GI - Galvanised'];
      const angleSizes = [
        'A 20×3', 'A 25×3', 'A 25×5', 'A 30×3', 'A 32×3', 'A 35×5', 'A 35×6',
        'A 40×3', 'A 40×5', 'A 40×6', 'A 50×3', 'A 50×5', 'A 50×6',
        'A 65×5', 'A 65×6', 'A 75×5', 'A 75×6', 'A 75×8', 'A 75×10'
      ];

      for (const size of angleSizes) {
        for (const finish of angleFinishes) {
          for (const brand of angleBrands) {
            await createProduct({
              name: `Angle ${size}`,
              category: 'Angles',
              brand: brand,
              finish: finish,
              size: size,
              unit: 'kg'
            });
          }
        }
      }

      // ===== FLATS =====
      const flatBrands = ['Patna Iron', 'Kamdhenu', 'JKSPL', 'Sel Tiger', 'SAIL', 'SUL', 'Others'];
      const flatFinishes = ['MS - Mild Steel (Black)', 'GI - Galvanised'];
      const flatSizes = [
        'F 20×3', 'F 20×5', 'F 20×6', 'F 25×3', 'F 25×5', 'F 25×6', 'F 25×10', 'F 25×12',
        'F 32×5', 'F 32×6', 'F 32×8', 'F 32×10', 'F 40×5', 'F 40×6', 'F 40×8', 'F 40×10', 'F 40×12',
        'F 50×5', 'F 50×6', 'F 50×8', 'F 50×10', 'F 50×12', 'F 65×6', 'F 65×8', 'F 65×10', 'F 65×12',
        'F 75×6', 'F 75×8', 'F 75×10', 'F 75×12', 'F 75×16', 'F 100×8', 'F 100×12'
      ];

      for (const size of flatSizes) {
        for (const finish of flatFinishes) {
          for (const brand of flatBrands) {
            await createProduct({
              name: `Flat ${size}`,
              category: 'Flats',
              brand: brand,
              finish: finish,
              size: size,
              unit: 'kg'
            });
          }
        }
      }

      // ===== SQUARE BARS =====
      const squareBarBrands = ['Patna Iron', 'Kamdhenu', 'JKSPL', 'Sel Tiger', 'SAIL', 'SUL', 'Others'];
      const squareBarFinishes = ['MS - Mild Steel (Black)', 'GI - Galvanised'];
      const squareBarSizes = ['8 mm', '10 mm', '12 mm', '16 mm', '20 mm', '25 mm', '32 mm', '40 mm'];

      for (const size of squareBarSizes) {
        for (const finish of squareBarFinishes) {
          for (const brand of squareBarBrands) {
            await createProduct({
              name: `Square Bar ${size}`,
              category: 'Square Bars',
              brand: brand,
              finish: finish,
              size: size,
              unit: 'kg'
            });
          }
        }
      }

      // ===== ROUND BARS =====
      const roundBarSizes = ['8 mm', '10 mm', '12 mm', '16 mm', '20 mm', '25 mm', '32 mm', '40 mm'];
      const roundBarFinishes = ['MS - Mild Steel (Black)', 'GI - Galvanised'];
      const roundBarBrands = ['Patna Iron', 'Kamdhenu', 'JKSPL', 'Sel Tiger', 'SAIL', 'SUL', 'Others'];

      for (const size of roundBarSizes) {
        for (const finish of roundBarFinishes) {
          for (const brand of roundBarBrands) {
            await createProduct({
              name: `Round Bar ${size}`,
              category: 'Round Bars',
              brand: brand,
              finish: finish,
              size: size,
              unit: 'kg'
            });
          }
        }
      }

      // ===== CHANNELS (ISMC) =====
      const channelBrands = ['Patna Iron', 'Kamdhenu', 'JKSPL', 'Sel Tiger', 'SAIL', 'SUL', 'Others'];
      const channelFinishes = ['MS - Mild Steel (Black)', 'GI - Galvanised'];
      const channelSizes = [
        'ISMC 70×40', 'ISMC 75×40 (ULC)', 'ISMC 75×40 (LC)', 'ISMC 75×40 (MC)', 'ISMC 75×40 (H)',
        'ISMC 100×50 (LC)', 'ISMC 100×50 (MC)', 'ISMC 100×50 (H)',
        'ISMC 125×65', 'ISMC 150×75', 'ISMC 200×75', 'ISMC 250×75'
      ];

      for (const size of channelSizes) {
        for (const finish of channelFinishes) {
          for (const brand of channelBrands) {
            await createProduct({
              name: `Channel ${size}`,
              category: 'Channels',
              brand: brand,
              finish: finish,
              size: size,
              unit: 'kg'
            });
          }
        }
      }

      // ===== JOIST / ISMB =====
      const joistBrands = ['Patna Iron', 'Kamdhenu', 'JKSPL', 'Sel Tiger', 'SAIL', 'SUL', 'Others'];
      const joistFinishes = ['MS - Mild Steel (Black)', 'GI - Galvanised'];
      const joistSizes = ['ISMB 100', 'ISMB 125', 'ISMB 150', 'ISMB 200', 'ISMB 250', 'ISMB 300', 'ISMB 350', 'ISMB 400'];

      for (const size of joistSizes) {
        for (const finish of joistFinishes) {
          for (const brand of joistBrands) {
            await createProduct({
              name: `Joist ${size}`,
              category: 'Joist / ISMB',
              brand: brand,
              finish: finish,
              size: size,
              unit: 'kg'
            });
          }
        }
      }

      // ===== Z-ANGLES =====
      const zAngleBrands = ['Patna Iron', 'Kamdhenu', 'JKSPL', 'Sel Tiger', 'SAIL', 'SUL', 'Others'];
      const zAngleFinishes = ['MS - Mild Steel (Black)', 'GI - Galvanised'];
      const zAngleSizes = ['Z - Angle (L)', 'Z - Angle (H)'];

      for (const size of zAngleSizes) {
        for (const finish of zAngleFinishes) {
          for (const brand of zAngleBrands) {
            await createProduct({
              name: `Z-Angle ${size}`,
              category: 'Z-Angles',
              brand: brand,
              finish: finish,
              size: size,
              unit: 'kg'
            });
          }
        }
      }

      // ===== GATE CHANNEL =====
      const gateChannelBrands = ['Patna Iron', 'Kamdhenu', 'JKSPL', 'Sel Tiger', 'SAIL', 'SUL', 'Others'];
      const gateChannelFinishes = ['MS - Mild Steel (Black)', 'GI - Galvanised'];
      const gateChannelSizes = ['Gt. Chn. 13 ft', 'Gt. Chn. 14 ft', 'Gt. Chn. 15 ft', 'Gt. Chn. 16 ft', 'Gt. Chn. 17 ft', 'Gt. Chn. 18 ft'];

      for (const size of gateChannelSizes) {
        for (const finish of gateChannelFinishes) {
          for (const brand of gateChannelBrands) {
            await createProduct({
              name: `Gate Channel ${size}`,
              category: 'Gate Channel',
              brand: brand,
              finish: finish,
              size: size,
              unit: 'pcs'
            });
          }
        }
      }

      // ===== TAK SQ. / FLAT =====
      const takBrands = ['Jagdamba', 'Kamdhenu', 'Manokaamna', 'Others'];
      const takFinishes = ['MS - Mild Steel (Black)', 'GI - Galvanised'];
      const takSizes = [
        'Tak Sq. 8 mm', 'Tak Sq. 10 mm', 'Tak Sq. 12 mm', 'Tak Flat 20×5', 'Tak Flat 25×5',
        'Round Pipe 66', 'Square Pipe 66', 'Rectangular Pipes 28', 'Fancy Pipes 3',
        'Shutter Guide', 'Guide 13 ft', 'Guide 14 ft', 'Guide 15 ft', 'Guide 16 ft',
        'Guide 17 ft', 'Guide 18 ft', 'Guide 19 ft', 'Guide 20 ft'
      ];
      const takVarieties = ['Heavy', 'Light'];

      for (const size of takSizes) {
        for (const finish of takFinishes) {
          for (const brand of takBrands) {
            for (const variety of takVarieties) {
              await createProduct({
                name: `Tak ${size}`,
                category: 'Tak Sq. / Flat',
                brand: brand,
                finish: finish,
                size: size,
                variety: variety,
                unit: 'pcs'
              });
            }
          }
        }
      }

      // ===== SHUTTER PROFILES =====
      const shutterProfileBrands = ['Jagdamba', 'Kamdhenu', 'Manokaamna', 'Others'];
      const shutterProfileFinishes = ['MS - Mild Steel (Black)', 'GI - Galvanised'];
      const shutterProfileSizes = [
        'Profile 13 ft', 'Profile 14 ft', 'Profile 15 ft', 'Profile 16 ft', 'Profile 17 ft',
        'Profile 18 ft', 'Profile 19 ft', 'Profile 20 ft', 'Profile 21 ft', 'Profile 22 ft', 'Profile 23 ft'
      ];
      const shutterProfileVarieties = ['Heavy', 'Light'];

      for (const size of shutterProfileSizes) {
        for (const finish of shutterProfileFinishes) {
          for (const brand of shutterProfileBrands) {
            for (const variety of shutterProfileVarieties) {
              await createProduct({
                name: `Shutter Profile ${size}`,
                category: 'Shutter Profiles',
                brand: brand,
                finish: finish,
                size: size,
                variety: variety,
                unit: 'pcs'
              });
            }
          }
        }
      }

      // ===== LOCK PLATES / BRACKET =====
      const lockPlateBrands = ['Jagdamba', 'Kamdhenu', 'Manokaamna', 'Others'];
      const lockPlateFinishes = ['MS - Mild Steel (Black)', 'GI - Galvanised'];
      const lockPlateItems = ['Straight Lock Plate 8 ft', 'Straight Lock Plate 10 ft', 'Lock Plate (Roll Coil)', 'Bracket 14"×14"'];
      const lockPlateVarieties = ['Heavy', 'Light'];

      for (const size of lockPlateItems) {
        for (const finish of lockPlateFinishes) {
          for (const brand of lockPlateBrands) {
            for (const variety of lockPlateVarieties) {
              await createProduct({
                name: `Lock Plate ${size}`,
                category: 'Lock Plates / Bracket',
                brand: brand,
                finish: finish,
                size: size,
                variety: variety,
                unit: 'pcs'
              });
            }
          }
        }
      }

      // ===== PLATES =====
      const plateBrands = ['Patna Iron', 'Kamdhenu', 'Satyam', 'Others', 'Tata Structura', 'APL Apollo'];
      const plateFinishes = ['MS - Mild Steel (Black)', 'GI - Galvanised'];
      const plateItems = [
        'Chequered Plate', 'MS Plate', '2.5 mm - 10×6', '3 mm - 10×6', '3.5 mm - 10×6',
        '4 mm - 10×6', '4.5 mm - 10×6', '5 mm - 10×5', '5 mm - 21×5', '6 mm - 10×5', '6 mm - 21×5'
      ];

      for (const size of plateItems) {
        for (const finish of plateFinishes) {
          for (const brand of plateBrands) {
            await createProduct({
              name: `Plate ${size}`,
              category: 'Plates',
              brand: brand,
              finish: finish,
              size: size,
              unit: 'kg'
            });
          }
        }
      }

      // ===== HR SHEETS =====
      const hrSheetBrands = ['TATA Astrum', 'SAIL', 'Secondary (Other)'];
      const hrSheetGauges = ['8 G', '9 G', '10 G', '12 G', '14 G', '16 G'];
      const hrSheetSizes = ['6×3', '6×4', '6×Meter', '7×3', '7×4', '7×Meter', '8×3', '8×4', '8×5', '8×Meter', '10×3'];

      for (const gauge of hrSheetGauges) {
        for (const size of hrSheetSizes) {
          for (const brand of hrSheetBrands) {
            await createProduct({
              name: `HR Sheet ${gauge} ${size}`,
              category: 'HR Sheets',
              brand: brand,
              size: `${gauge} ${size}`,
              unit: 'kg'
            });
          }
        }
      }

      // ===== GP SHEETS =====
      const gpSheetBrands = ['TATA', 'SAIL', 'JSW', 'AM/NS INDIA', 'Secondary (Other)'];
      const gpSheetThicknesses = ['0.40 mm', '0.50 mm - 26 G', '0.60 mm - 24 G', '22 G - 0.80 mm', '20 G - 1.00 mm', '18 G - 1.20 mm', '16 G - 1.60 mm', '14 G - 2 mm', '12 G - 2.50 mm', '10 G - 3.00 mm'];
      const gpSheetSizes = ['6×3', '6×4', '6×Meter', '7×3', '7×4', '7×Meter', '8×3', '8×4', '8×5', '8×Meter'];
      const gpSheetFinishes = ['Galvanised', 'Galvannealed'];

      for (const thickness of gpSheetThicknesses) {
        for (const size of gpSheetSizes) {
          for (const finish of gpSheetFinishes) {
            for (const brand of gpSheetBrands) {
              await createProduct({
                name: `GP Sheet ${thickness} ${size}`,
                category: 'GP Sheets',
                brand: brand,
                finish: finish,
                size: `${thickness} ${size}`,
                unit: 'kg'
              });
            }
          }
        }
      }

      // ===== CR SHEETS =====
      const crSheetBrands = ['TATA Steelium Super', 'SAIL', 'Secondary (Other)'];
      const crSheetGauges = ['14 G', '16 G', '18 G', '20 G', '22 G', '24 G', '26 G', '0.40 mm', '0.35 mm', '0.30 mm'];
      const crSheetSizes = ['6×3', '6×4', '6×Meter', '8×3', '8×4', '8×Meter'];

      for (const gauge of crSheetGauges) {
        for (const size of crSheetSizes) {
          for (const brand of crSheetBrands) {
            await createProduct({
              name: `CR Sheet ${gauge} ${size}`,
              category: 'CR Sheets',
              brand: brand,
              size: `${gauge} ${size}`,
              unit: 'kg'
            });
          }
        }
      }

      // ===== ROOFING SHEET =====
      const roofingSheetBrands = ['Tata Shaktee', 'Aarti', '5 Star', 'Others'];
      const roofingSheetThicknesses = ['0.15 mm', '0.18 mm', '0.20 mm', '0.22 mm', '0.25 mm', '0.30 mm', '0.35 mm', '0.40 mm', '0.45 mm', '0.50 mm', '0.60 mm', '0.80 mm'];
      const roofingSheetSizes = ['6×3', '6×4', '8×3', '8×4', '10×3', '10×4', '12×3', '12×4', '14×3', '14×4', '16×4'];

      for (const thickness of roofingSheetThicknesses) {
        for (const size of roofingSheetSizes) {
          for (const brand of roofingSheetBrands) {
            await createProduct({
              name: `Roofing Sheet ${thickness} ${size}`,
              category: 'Roofing Sheet',
              brand: brand,
              size: `${thickness} ${size}`,
              unit: 'pcs'
            });
          }
        }
      }

      // ===== COLOUR PROFILE SHEET =====
      const profileSheetBrands = ['TATA Durashine', 'TATA Infinia', 'JSW Pragati+', 'Jindal Sabrang / Rangeen', 'Aarti', 'Others'];
      const profileSheetThicknesses = ['0.25 mm', '0.30 mm', '0.35 mm', '0.37 mm', '0.40 mm', '0.45 mm', '0.47 mm', '0.50 mm', '0.53 mm'];
      const profileSheetSizes = ['6×3.5', '7×3.5', '8×3.5', '10×3.5', '12×3.5', '14×3.5', '16×3.5', '6×4', '7×4', '8×4', '10×4', '12×4', '14×4', '16×4', '18×4', '20×4'];

      for (const thickness of profileSheetThicknesses) {
        for (const size of profileSheetSizes) {
          for (const brand of profileSheetBrands) {
            await createProduct({
              name: `Colour Profile Sheet ${thickness} ${size}`,
              category: 'Colour Profile Sheet',
              brand: brand,
              size: `${thickness} ${size}`,
              unit: 'pcs'
            });
          }
        }
      }

      // ===== ASBESTOS SHEET =====
      const asbestosBrands = ['Everest', 'Visaka', 'Konark', 'Charminar (birlanu)', 'Ramco', 'Others'];
      const asbestosSizes = ['6 ft (5.75 ft)', '6.5 ft', '8 ft', '10 ft', '12 ft'];
      const asbestosTypes = ['Grey', 'Colour Coated', 'Cooling Sheet'];

      for (const size of asbestosSizes) {
        for (const type of asbestosTypes) {
          for (const brand of asbestosBrands) {
            await createProduct({
              name: `Asbestos Sheet ${size} ${type}`,
              category: 'Asbestos Sheet',
              brand: brand,
              size: size,
              type: type,
              unit: 'pcs'
            });
          }
        }
      }

      res.json({
        success: true,
        message: 'Master catalog seeding completed',
        stats: {
          totalAdded: totalAdded,
          totalSkipped: totalSkipped,
          totalProcessed: totalAdded + totalSkipped
        }
      });
    } catch (error) {
      console.error('Seed master catalog error:', error);
      res.status(500).json({ error: 'Failed to seed master catalog', details: error.message });
    }
  }
}

module.exports = new ProductController();