import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../drizzle/schema';
import 'dotenv/config';

const db = drizzle(process.env.DATABASE_URL!);

// Customers data from Google Sheets
const customersData = [
  {
    name: "Whole Foods Market",
    type: "business" as const,
    status: "active" as const,
    paymentTerms: 30,
    notes: "Major retailer",
    syncSource: "manual" as const
  },
  {
    name: "Sprouts Farmers Market",
    type: "business" as const,
    status: "active" as const,
    paymentTerms: 30,
    notes: "Natural foods retailer",
    syncSource: "manual" as const
  },
  {
    name: "Costco Wholesale",
    type: "business" as const,
    status: "active" as const,
    paymentTerms: 45,
    notes: "Wholesale club",
    syncSource: "manual" as const
  },
  {
    name: "Amazon Fresh",
    type: "business" as const,
    status: "active" as const,
    paymentTerms: 30,
    notes: "E-commerce grocery",
    syncSource: "manual" as const
  },
  {
    name: "Target",
    type: "business" as const,
    status: "active" as const,
    paymentTerms: 60,
    notes: "Target Corporation",
    syncSource: "manual" as const
  },
  {
    name: "Trader Joe's",
    type: "business" as const,
    status: "active" as const,
    paymentTerms: 30,
    notes: "Specialty grocery",
    syncSource: "manual" as const
  }
];

// Vendors/Suppliers data from Google Sheets
const vendorsData = [
  {
    name: "Plant & Bean (Thailand) Co., Ltd",
    type: "supplier" as const,
    status: "active" as const,
    paymentTerms: 0,
    notes: "100% T/T. Importing under Plant & Bean (Thailand) Co., Ltd, the importing documents must be according to given name, we process thru BOI and the goods are waived for import taxations."
  },
  {
    name: "Lam Soon (Thailand) Public Company Limited",
    type: "supplier" as const,
    status: "active" as const,
    paymentTerms: 7,
    notes: "100% T/T Transfer 7 days before delivery"
  },
  {
    name: "Shaanxi Rainwood Biotech CO. LTD",
    type: "supplier" as const,
    status: "active" as const,
    paymentTerms: 0,
    notes: "100% T/T. Account Payable: 7775003408 Swift address: AYUDTHBK. Value added tax (VAT) is a tax on the sale of goods or the provision of services. The current rates are 7%"
  },
  {
    name: "XI'AN International Healthcare Factory CO.",
    contactName: "Amy Hu",
    email: "sales08@latelgroup.com",
    type: "supplier" as const,
    status: "active" as const,
    paymentTerms: 0,
    notes: "50% deposit and 50% balance before shipping. 91620132MA8XMERPX1_general taxpayer"
  },
  {
    name: "Jinan Bright Sunshine Imp. and Exp. Co. LTD",
    type: "supplier" as const,
    status: "active" as const,
    paymentTerms: 0,
    notes: "30% deposit, 70% balance"
  }
];

// Products data from Google Sheets (already imported successfully)
const productsData = [
  { sku: "PP-TM-10", name: "Plant Protein - Taco Meat 10 oz", category: "Plant Protein", unitPrice: "3.30", costPrice: "3.30" },
  { sku: "PP-PP-10", name: "Plant Protein - Pulled Pork 10 oz", category: "Plant Protein", unitPrice: "3.30", costPrice: "3.30" },
  { sku: "PP-BB-10", name: "Plant Protein - Beef Barbacoa 10 oz", category: "Plant Protein", unitPrice: "3.30", costPrice: "3.30" },
  { sku: "PP-KB-10", name: "Plant Protein - Korean BBQ 10 oz", category: "Plant Protein", unitPrice: "3.30", costPrice: "3.30" },
  { sku: "61045295043", name: "Plant Based Jerky - Signature Flavor 2.5 oz", category: "Plant Based Jerky", unitPrice: "3.05", costPrice: "3.05" },
  { sku: "61045295050", name: "Plant Based Jerky - Korean BBQ Flavor 2.5 oz", category: "Plant Based Jerky", unitPrice: "3.05", costPrice: "3.05" },
  { sku: "61045295049", name: "Plant Based Jerky - Chili Crisp Flavor 2.5 oz", category: "Plant Based Jerky", unitPrice: "3.05", costPrice: "3.05" },
  { sku: "SHBB8", name: "Beef Barbacoa - 8 oz", category: "Beef Barbacoa", unitPrice: "3.00", costPrice: "3.00" },
  { sku: "SHBB2", name: "Beef Barbacoa - 2 lb", category: "Beef Barbacoa", unitPrice: "8.00", costPrice: "8.00" },
  { sku: "SHBB10", name: "Beef Barbacoa - 10 oz", category: "Beef Barbacoa", unitPrice: "1.99", costPrice: "1.99" }
];

async function importData() {
  console.log("Starting data import from Google Sheets...\n");

  // Import Customers
  console.log("Importing Customers...");
  let customersImported = 0;
  for (const customer of customersData) {
    try {
      await db.insert(schema.customers).values(customer);
      customersImported++;
      console.log(`  ✓ ${customer.name}`);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.log(`  - ${customer.name} (already exists)`);
      } else {
        console.error(`  ✗ ${customer.name}: ${error.message}`);
      }
    }
  }
  console.log(`Customers imported: ${customersImported}/${customersData.length}\n`);

  // Import Vendors
  console.log("Importing Vendors/Suppliers...");
  let vendorsImported = 0;
  for (const vendor of vendorsData) {
    try {
      await db.insert(schema.vendors).values(vendor);
      vendorsImported++;
      console.log(`  ✓ ${vendor.name}`);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.log(`  - ${vendor.name} (already exists)`);
      } else {
        console.error(`  ✗ ${vendor.name}: ${error.message}`);
      }
    }
  }
  console.log(`Vendors imported: ${vendorsImported}/${vendorsData.length}\n`);

  // Skip products as they were already imported
  console.log("Products: Already imported (10 products)\n");

  console.log("=".repeat(50));
  console.log("Import Summary:");
  console.log(`  Customers: ${customersImported}/${customersData.length}`);
  console.log(`  Vendors: ${vendorsImported}/${vendorsData.length}`);
  console.log(`  Products: 10/10 (previously imported)`);
  console.log("=".repeat(50));

  process.exit(0);
}

importData().catch(err => {
  console.error("Import failed:", err);
  process.exit(1);
});
