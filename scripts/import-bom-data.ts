import { drizzle } from "drizzle-orm/mysql2";
import { billOfMaterials, bomComponents, rawMaterials, products } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

// BOM data from Google Sheets
const bomData = [
  {
    productName: "Plant Based Beef Slice",
    components: [
      { name: "Soy Protein Isolate", quantity: "0.25", unit: "kg", category: "Protein" },
      { name: "Pea Protein", quantity: "0.15", unit: "kg", category: "Protein" },
      { name: "Coconut Oil", quantity: "0.05", unit: "kg", category: "Fat" },
      { name: "Natural Flavors", quantity: "0.02", unit: "kg", category: "Flavoring" },
      { name: "Salt", quantity: "0.01", unit: "kg", category: "Seasoning" },
      { name: "Methylcellulose", quantity: "0.01", unit: "kg", category: "Binder" },
    ],
  },
  {
    productName: "Beef Barbacoa Spice",
    components: [
      { name: "Chipotle Pepper Powder", quantity: "0.15", unit: "kg", category: "Spice" },
      { name: "Cumin", quantity: "0.10", unit: "kg", category: "Spice" },
      { name: "Oregano", quantity: "0.05", unit: "kg", category: "Herb" },
      { name: "Garlic Powder", quantity: "0.08", unit: "kg", category: "Spice" },
      { name: "Onion Powder", quantity: "0.05", unit: "kg", category: "Spice" },
      { name: "Paprika", quantity: "0.05", unit: "kg", category: "Spice" },
      { name: "Black Pepper", quantity: "0.02", unit: "kg", category: "Spice" },
      { name: "Salt", quantity: "0.10", unit: "kg", category: "Seasoning" },
    ],
  },
];

async function importBomData() {
  console.log("Starting BOM data import...\n");

  // First, create raw materials
  const allMaterials = new Map<string, number>();
  
  for (const bom of bomData) {
    for (const comp of bom.components) {
      if (!allMaterials.has(comp.name)) {
        // Check if material exists
        const existing = await db.select().from(rawMaterials).where(eq(rawMaterials.name, comp.name)).limit(1);
        
        if (existing.length > 0) {
          allMaterials.set(comp.name, existing[0].id);
          console.log(`  Found existing material: ${comp.name}`);
        } else {
          // Create new material
          const result = await db.insert(rawMaterials).values({
            name: comp.name,
            sku: `RM-${comp.name.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
            category: comp.category,
            unit: comp.unit,
            unitCost: "0",
            currency: "USD",
            status: "active",
          });
          const insertId = (result as any)[0].insertId;
          allMaterials.set(comp.name, insertId);
          console.log(`  Created material: ${comp.name} (ID: ${insertId})`);
        }
      }
    }
  }

  console.log(`\nCreated/found ${allMaterials.size} raw materials\n`);

  // Now create BOMs
  for (const bomItem of bomData) {
    // Find the product
    const product = await db.select().from(products).where(eq(products.name, bomItem.productName)).limit(1);
    
    if (product.length === 0) {
      console.log(`  Product not found: ${bomItem.productName}, skipping BOM`);
      continue;
    }

    const productId = product[0].id;
    
    // Check if BOM already exists
    const existingBom = await db.select().from(billOfMaterials).where(eq(billOfMaterials.productId, productId)).limit(1);
    
    if (existingBom.length > 0) {
      console.log(`  BOM already exists for: ${bomItem.productName}`);
      continue;
    }

    // Create BOM
    const bomResult = await db.insert(billOfMaterials).values({
      productId,
      name: `${bomItem.productName} Recipe`,
      version: "1.0",
      status: "active",
      batchSize: "1",
      batchUnit: "kg",
      createdBy: 1,
    });
    const bomId = (bomResult as any)[0].insertId;
    console.log(`  Created BOM: ${bomItem.productName} Recipe (ID: ${bomId})`);

    // Add components
    for (let i = 0; i < bomItem.components.length; i++) {
      const comp = bomItem.components[i];
      const materialId = allMaterials.get(comp.name);
      
      await db.insert(bomComponents).values({
        bomId,
        componentType: "raw_material",
        rawMaterialId: materialId,
        name: comp.name,
        quantity: comp.quantity,
        unit: comp.unit,
        unitCost: "0",
        wastagePercent: "0",
        sortOrder: i + 1,
      });
      console.log(`    Added component: ${comp.name} (${comp.quantity} ${comp.unit})`);
    }
  }

  console.log("\n✅ BOM data import complete!");
}

importBomData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
