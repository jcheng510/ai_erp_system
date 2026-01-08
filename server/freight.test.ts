import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Test schemas for freight management
describe("Freight Management Schemas", () => {
  // RFQ Schema
  const rfqSchema = z.object({
    title: z.string().min(1),
    originCountry: z.string().optional(),
    originCity: z.string().optional(),
    destinationCountry: z.string().optional(),
    destinationCity: z.string().optional(),
    cargoType: z.enum(["general", "hazardous", "refrigerated", "oversized", "fragile", "liquid", "bulk"]).optional(),
    totalWeight: z.string().optional(),
    totalVolume: z.string().optional(),
    preferredMode: z.enum(["ocean_fcl", "ocean_lcl", "air", "express", "ground", "rail", "any"]).optional(),
    incoterms: z.string().optional(),
    insuranceRequired: z.boolean().optional(),
    customsClearanceRequired: z.boolean().optional(),
  });

  // Carrier Schema
  const carrierSchema = z.object({
    name: z.string().min(1),
    type: z.enum(["freight_forwarder", "shipping_line", "airline", "trucking", "courier", "customs_broker"]),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    country: z.string().optional(),
  });

  // Quote Schema
  const quoteSchema = z.object({
    rfqId: z.number(),
    carrierId: z.number(),
    totalCost: z.string().optional(),
    currency: z.string().optional(),
    transitDays: z.number().optional(),
    shippingMode: z.string().optional(),
    validUntil: z.date().optional(),
  });

  // Customs Clearance Schema
  const customsClearanceSchema = z.object({
    type: z.enum(["import", "export"]),
    country: z.string().optional(),
    portOfEntry: z.string().optional(),
    customsOffice: z.string().optional(),
    hsCode: z.string().optional(),
    countryOfOrigin: z.string().optional(),
  });

  describe("RFQ Schema Validation", () => {
    it("should validate a valid RFQ", () => {
      const validRfq = {
        title: "Electronics shipment from Shenzhen to LA",
        originCountry: "China",
        originCity: "Shenzhen",
        destinationCountry: "USA",
        destinationCity: "Los Angeles",
        cargoType: "general" as const,
        totalWeight: "5000",
        totalVolume: "25",
        preferredMode: "ocean_fcl" as const,
        incoterms: "FOB",
        insuranceRequired: true,
        customsClearanceRequired: true,
      };

      const result = rfqSchema.safeParse(validRfq);
      expect(result.success).toBe(true);
    });

    it("should reject RFQ without title", () => {
      const invalidRfq = {
        originCountry: "China",
        originCity: "Shenzhen",
      };

      const result = rfqSchema.safeParse(invalidRfq);
      expect(result.success).toBe(false);
    });

    it("should accept RFQ with minimal fields", () => {
      const minimalRfq = {
        title: "Quick shipment",
      };

      const result = rfqSchema.safeParse(minimalRfq);
      expect(result.success).toBe(true);
    });

    it("should validate cargo types", () => {
      const cargoTypes = ["general", "hazardous", "refrigerated", "oversized", "fragile", "liquid", "bulk"];
      
      for (const cargoType of cargoTypes) {
        const rfq = { title: "Test", cargoType };
        const result = rfqSchema.safeParse(rfq);
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid cargo type", () => {
      const rfq = { title: "Test", cargoType: "invalid" };
      const result = rfqSchema.safeParse(rfq);
      expect(result.success).toBe(false);
    });
  });

  describe("Carrier Schema Validation", () => {
    it("should validate a valid carrier", () => {
      const validCarrier = {
        name: "Global Freight Co",
        type: "freight_forwarder" as const,
        email: "contact@globalfreight.com",
        phone: "+1-555-0123",
        country: "USA",
      };

      const result = carrierSchema.safeParse(validCarrier);
      expect(result.success).toBe(true);
    });

    it("should reject carrier without name", () => {
      const invalidCarrier = {
        type: "freight_forwarder",
        email: "contact@test.com",
      };

      const result = carrierSchema.safeParse(invalidCarrier);
      expect(result.success).toBe(false);
    });

    it("should validate all carrier types", () => {
      const carrierTypes = ["freight_forwarder", "shipping_line", "airline", "trucking", "courier", "customs_broker"];
      
      for (const type of carrierTypes) {
        const carrier = { name: "Test Carrier", type };
        const result = carrierSchema.safeParse(carrier);
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid email format", () => {
      const carrier = {
        name: "Test Carrier",
        type: "freight_forwarder",
        email: "invalid-email",
      };

      const result = carrierSchema.safeParse(carrier);
      expect(result.success).toBe(false);
    });
  });

  describe("Quote Schema Validation", () => {
    it("should validate a valid quote", () => {
      const validQuote = {
        rfqId: 1,
        carrierId: 1,
        totalCost: "5000.00",
        currency: "USD",
        transitDays: 25,
        shippingMode: "ocean_fcl",
        validUntil: new Date("2025-02-15"),
      };

      const result = quoteSchema.safeParse(validQuote);
      expect(result.success).toBe(true);
    });

    it("should require rfqId and carrierId", () => {
      const invalidQuote = {
        totalCost: "5000.00",
      };

      const result = quoteSchema.safeParse(invalidQuote);
      expect(result.success).toBe(false);
    });

    it("should accept quote with minimal fields", () => {
      const minimalQuote = {
        rfqId: 1,
        carrierId: 1,
      };

      const result = quoteSchema.safeParse(minimalQuote);
      expect(result.success).toBe(true);
    });
  });

  describe("Customs Clearance Schema Validation", () => {
    it("should validate import clearance", () => {
      const importClearance = {
        type: "import" as const,
        country: "USA",
        portOfEntry: "Los Angeles",
        customsOffice: "LA CBP",
        hsCode: "8471.30",
        countryOfOrigin: "China",
      };

      const result = customsClearanceSchema.safeParse(importClearance);
      expect(result.success).toBe(true);
    });

    it("should validate export clearance", () => {
      const exportClearance = {
        type: "export" as const,
        country: "China",
        portOfEntry: "Shenzhen",
      };

      const result = customsClearanceSchema.safeParse(exportClearance);
      expect(result.success).toBe(true);
    });

    it("should require type field", () => {
      const invalidClearance = {
        country: "USA",
        portOfEntry: "Los Angeles",
      };

      const result = customsClearanceSchema.safeParse(invalidClearance);
      expect(result.success).toBe(false);
    });

    it("should reject invalid type", () => {
      const invalidClearance = {
        type: "transit",
        country: "USA",
      };

      const result = customsClearanceSchema.safeParse(invalidClearance);
      expect(result.success).toBe(false);
    });
  });
});

// Test RFQ number generation
describe("RFQ Number Generation", () => {
  const generateRfqNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RFQ-${year}${month}-${random}`;
  };

  it("should generate RFQ number with correct format", () => {
    const rfqNumber = generateRfqNumber();
    expect(rfqNumber).toMatch(/^RFQ-\d{4}-[A-Z0-9]{4}$/);
  });

  it("should generate unique RFQ numbers", () => {
    const numbers = new Set<string>();
    for (let i = 0; i < 100; i++) {
      numbers.add(generateRfqNumber());
    }
    // With 4 alphanumeric chars, collisions should be rare
    expect(numbers.size).toBeGreaterThan(90);
  });
});

// Test clearance number generation
describe("Clearance Number Generation", () => {
  const generateClearanceNumber = (type: "import" | "export") => {
    const prefix = type === "import" ? "IMP" : "EXP";
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${year}${month}-${random}`;
  };

  it("should generate import clearance number with IMP prefix", () => {
    const number = generateClearanceNumber("import");
    expect(number).toMatch(/^IMP-\d{4}-[A-Z0-9]{4}$/);
  });

  it("should generate export clearance number with EXP prefix", () => {
    const number = generateClearanceNumber("export");
    expect(number).toMatch(/^EXP-\d{4}-[A-Z0-9]{4}$/);
  });
});

// Test AI email generation prompt
describe("AI Email Generation", () => {
  const generateEmailPrompt = (rfq: {
    title: string;
    originCity?: string;
    destinationCity?: string;
    cargoDescription?: string;
    totalWeight?: string;
    totalVolume?: string;
    preferredMode?: string;
  }, carrierName: string) => {
    return `Generate a professional freight quote request email to ${carrierName} for:
Title: ${rfq.title}
Route: ${rfq.originCity || 'TBD'} → ${rfq.destinationCity || 'TBD'}
Cargo: ${rfq.cargoDescription || 'General cargo'}
Weight: ${rfq.totalWeight || 'TBD'} kg
Volume: ${rfq.totalVolume || 'TBD'} CBM
Preferred Mode: ${rfq.preferredMode || 'Any'}

Please provide a competitive quote including all charges.`;
  };

  it("should generate email prompt with all details", () => {
    const rfq = {
      title: "Electronics shipment",
      originCity: "Shenzhen",
      destinationCity: "Los Angeles",
      cargoDescription: "Consumer electronics",
      totalWeight: "5000",
      totalVolume: "25",
      preferredMode: "ocean_fcl",
    };

    const prompt = generateEmailPrompt(rfq, "Global Freight Co");
    
    expect(prompt).toContain("Global Freight Co");
    expect(prompt).toContain("Electronics shipment");
    expect(prompt).toContain("Shenzhen → Los Angeles");
    expect(prompt).toContain("5000 kg");
    expect(prompt).toContain("25 CBM");
    expect(prompt).toContain("ocean_fcl");
  });

  it("should handle missing optional fields", () => {
    const rfq = {
      title: "Quick shipment",
    };

    const prompt = generateEmailPrompt(rfq, "Test Carrier");
    
    expect(prompt).toContain("Quick shipment");
    expect(prompt).toContain("TBD → TBD");
    expect(prompt).toContain("General cargo");
  });
});

// Test quote comparison logic
describe("Quote Comparison", () => {
  interface Quote {
    id: number;
    totalCost: string;
    transitDays: number;
    currency: string;
  }

  const compareQuotes = (quotes: Quote[]) => {
    if (quotes.length === 0) return null;
    
    // Find cheapest
    const cheapest = quotes.reduce((min, q) => 
      parseFloat(q.totalCost) < parseFloat(min.totalCost) ? q : min
    );
    
    // Find fastest
    const fastest = quotes.reduce((min, q) => 
      q.transitDays < min.transitDays ? q : min
    );
    
    // Calculate best value (simple scoring)
    const scored = quotes.map(q => ({
      ...q,
      score: (1 / parseFloat(q.totalCost)) * 1000 + (1 / q.transitDays) * 100,
    }));
    
    const bestValue = scored.reduce((max, q) => 
      q.score > max.score ? q : max
    );
    
    return { cheapest, fastest, bestValue };
  };

  it("should identify cheapest quote", () => {
    const quotes: Quote[] = [
      { id: 1, totalCost: "5000", transitDays: 30, currency: "USD" },
      { id: 2, totalCost: "4500", transitDays: 35, currency: "USD" },
      { id: 3, totalCost: "6000", transitDays: 25, currency: "USD" },
    ];

    const result = compareQuotes(quotes);
    expect(result?.cheapest.id).toBe(2);
  });

  it("should identify fastest quote", () => {
    const quotes: Quote[] = [
      { id: 1, totalCost: "5000", transitDays: 30, currency: "USD" },
      { id: 2, totalCost: "4500", transitDays: 35, currency: "USD" },
      { id: 3, totalCost: "6000", transitDays: 25, currency: "USD" },
    ];

    const result = compareQuotes(quotes);
    expect(result?.fastest.id).toBe(3);
  });

  it("should handle single quote", () => {
    const quotes: Quote[] = [
      { id: 1, totalCost: "5000", transitDays: 30, currency: "USD" },
    ];

    const result = compareQuotes(quotes);
    expect(result?.cheapest.id).toBe(1);
    expect(result?.fastest.id).toBe(1);
    expect(result?.bestValue.id).toBe(1);
  });

  it("should return null for empty quotes", () => {
    const result = compareQuotes([]);
    expect(result).toBeNull();
  });
});

// Test document type validation
describe("Document Type Validation", () => {
  const validDocumentTypes = [
    "commercial_invoice",
    "packing_list",
    "bill_of_lading",
    "airway_bill",
    "certificate_of_origin",
    "customs_declaration",
    "import_license",
    "export_license",
    "insurance_certificate",
    "inspection_certificate",
    "phytosanitary_certificate",
    "fumigation_certificate",
    "dangerous_goods_declaration",
    "other",
  ];

  const documentTypeSchema = z.enum([
    "commercial_invoice",
    "packing_list",
    "bill_of_lading",
    "airway_bill",
    "certificate_of_origin",
    "customs_declaration",
    "import_license",
    "export_license",
    "insurance_certificate",
    "inspection_certificate",
    "phytosanitary_certificate",
    "fumigation_certificate",
    "dangerous_goods_declaration",
    "other",
  ]);

  it("should validate all document types", () => {
    for (const docType of validDocumentTypes) {
      const result = documentTypeSchema.safeParse(docType);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid document type", () => {
    const result = documentTypeSchema.safeParse("invalid_type");
    expect(result.success).toBe(false);
  });
});
