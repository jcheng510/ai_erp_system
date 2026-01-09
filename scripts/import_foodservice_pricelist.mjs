// Import foodservice wholesale pricelist and update/create products
import { createConnection } from 'mysql2/promise';
import fs from 'fs';

const products = [
  {
    name: 'Sausage 2lb',
    sku: 'SHSAU2',
    upc: null,
    size: '2 lb',
    price: 10.03,
    caseCount: '2 lb.',
    category: 'Foodservice',
    description: 'Superhumn Sausage - 2lb pack'
  },
  {
    name: 'Sausage 5lb',
    sku: 'SHSAU5',
    upc: null,
    size: '5 lb case',
    price: 25.08,
    caseCount: '5 lb.',
    category: 'Foodservice',
    description: 'Superhumn Sausage - 5lb case'
  },
  {
    name: 'Ground Beef 2lb',
    sku: 'SHGB2',
    upc: '30860003308968',
    size: '2 lb',
    price: 76.60,
    caseCount: '10 x 2 lb',
    category: 'Foodservice',
    description: 'Superhumn Ground Beef - 2lb (case of 10)'
  },
  {
    name: 'Ground Beef 8lb',
    sku: 'SHGB8',
    upc: '20860003308961',
    size: '8 lb',
    price: 122.64,
    caseCount: '4 x 8 lb',
    category: 'Foodservice',
    description: 'Superhumn Ground Beef - 8lb (case of 4)'
  },
  {
    name: 'Ground Beef Patties 4oz - 2.5lb',
    sku: 'SHGMP2.5',
    upc: null,
    size: '2.5lb case (10 patties)',
    price: 8.71,
    caseCount: '10 patties',
    category: 'Foodservice',
    description: 'Superhumn Ground Beef Patties 4oz - 2.5lb case (10 patties)'
  },
  {
    name: 'Ground Beef Patties 4oz - 5lb',
    sku: 'SHGBP5',
    upc: null,
    size: '5 lb case (20 patties)',
    price: 17.42,
    caseCount: '20 patties',
    category: 'Foodservice',
    description: 'Superhumn Ground Beef Patties 4oz - 5lb case (20 patties)'
  },
  {
    name: 'Shredded Beef 2lb',
    sku: 'SHSB2',
    upc: '30860003308999',
    size: '2 lb',
    price: 110.30,
    caseCount: '10 x 2 lb',
    category: 'Foodservice',
    description: 'Superhumn Shredded Beef - 2lb (case of 10)'
  },
  {
    name: 'Shredded Beef 8lb',
    sku: 'SHSB8',
    upc: '20860003308992',
    size: '8 lb',
    price: 176.48,
    caseCount: '4 x 8 lb',
    category: 'Foodservice',
    description: 'Superhumn Shredded Beef - 8lb (case of 4)'
  }
];

async function main() {
  const connection = await createConnection(process.env.DATABASE_URL);
  
  console.log('Starting foodservice pricelist import...');
  console.log(`Processing ${products.length} products`);
  
  let created = 0;
  let updated = 0;
  let skipped = 0;
  
  for (const product of products) {
    try {
      // Check if product with this SKU already exists
      const [existing] = await connection.execute(
        'SELECT id, name, unitPrice FROM products WHERE sku = ?',
        [product.sku]
      );
      
      if (existing.length > 0) {
        // Update existing product
        const existingProduct = existing[0];
        console.log(`Updating existing product: ${product.sku} (${existingProduct.name})`);
        console.log(`  Price: $${existingProduct.unitPrice} -> $${product.price}`);
        
        await connection.execute(
          `UPDATE products SET 
            name = ?,
            description = ?,
            unitPrice = ?,
            category = ?,
            updatedAt = NOW()
          WHERE sku = ?`,
          [product.name, product.description, product.price.toFixed(2), product.category, product.sku]
        );
        updated++;
      } else {
        // Create new product
        console.log(`Creating new product: ${product.sku} - ${product.name}`);
        
        await connection.execute(
          `INSERT INTO products (name, sku, description, unitPrice, category, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
          [product.name, product.sku, product.description, product.price.toFixed(2), product.category]
        );
        created++;
      }
    } catch (error) {
      console.error(`Error processing ${product.sku}: ${error.message}`);
      skipped++;
    }
  }
  
  console.log('\n=== Import Summary ===');
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total: ${products.length}`);
  
  await connection.end();
}

main().catch(console.error);
