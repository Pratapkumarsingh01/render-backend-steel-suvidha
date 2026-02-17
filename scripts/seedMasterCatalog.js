// scripts/seedMasterCatalog.js
// Standalone script to seed the master product catalog
// Usage: node scripts/seedMasterCatalog.js

const path = require('path');
// This line ensures the script finds the .env file in the root directory
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const database = require('../services/database');

async function seedMasterCatalog() {
  try {
    // FIXED: Use MONGO_URI from your .env or fallback to MONGODB_URI
    const connectionString = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!connectionString) {
      throw new Error('MongoDB URI is not set in .env file (Checked for MONGO_URI and MONGODB_URI)');
    }

    console.log('🔗 Attempting to connect to MongoDB...');
    // Connect to database
    await database.connect(connectionString);
    const productsCollection = database.getProductsCollection();

    const now = new Date();
    let totalAdded = 0;
    let totalSkipped = 0;

    console.log('🌱 Starting master catalog seed...\n');

    // Helper function to check for duplicates
    const checkDuplicate = async (category, brand, size, grade, finish, variety, type) => {
      const query = {
        isMaster: true,
        category: category,
      };
      
      if (brand) query.brand = brand;
      if (size) query.size = size;
      if (grade) query.grade = grade;
      if (finish) query.finish = finish;
      if (variety) query.variety = variety;
      if (type) query.type = type;

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
      
      if (totalAdded % 100 === 0) {
        console.log(`  ✓ Processed ${totalAdded} new products...`);
      }
      
      return true;
    };

    // ===== TMT REBARS =====
    console.log('📦 Seeding TMT Rebars...');
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
    console.log('📦 Seeding Angles...');
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
    console.log('📦 Seeding Flats...');
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
    console.log('📦 Seeding Square Bars...');
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
    console.log('📦 Seeding Round Bars...');
    const roundBarSizes = ['8 mm', '10 mm', '12 mm', '16 mm', '20 mm', '25 mm', '32 mm', '40 mm'];

    for (const size of roundBarSizes) {
      for (const finish of squareBarFinishes) {
        for (const brand of squareBarBrands) {
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
    console.log('📦 Seeding Channels...');
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
    console.log('📦 Seeding Joist / ISMB...');
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
    console.log('📦 Seeding Z-Angles...');
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
    console.log('📦 Seeding Gate Channel...');
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
    console.log('📦 Seeding Tak Sq. / Flat...');
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
    console.log('📦 Seeding Shutter Profiles...');
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
    console.log('📦 Seeding Lock Plates / Bracket...');
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
    console.log('📦 Seeding Plates...');
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
    console.log('📦 Seeding HR Sheets...');
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
    console.log('📦 Seeding GP Sheets...');
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
    console.log('📦 Seeding CR Sheets...');
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
    console.log('📦 Seeding Roofing Sheet...');
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
    console.log('📦 Seeding Colour Profile Sheet...');
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
    console.log('📦 Seeding Asbestos Sheet...');
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

    console.log('\n✅ Master catalog seeding completed!');
    console.log(`\n📊 Statistics:`);
    console.log(`   • Total Added: ${totalAdded}`);
    console.log(`   • Total Skipped (duplicates): ${totalSkipped}`);
    console.log(`   • Total Processed: ${totalAdded + totalSkipped}\n`);

    // Close database connection
    await database.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding master catalog:', error);
    if (database) await database.close();
    process.exit(1);
  }
}

// Run the seed function
seedMasterCatalog();