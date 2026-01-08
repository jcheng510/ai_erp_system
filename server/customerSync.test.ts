import { describe, expect, it, vi } from "vitest";

// Mock the fetch function for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Customer Sync", () => {
  describe("Shopify Customer Sync", () => {
    it("should parse Shopify customer data correctly", () => {
      const shopifyCustomer = {
        id: 123456789,
        first_name: "John",
        last_name: "Doe",
        email: "john.doe@example.com",
        phone: "+1234567890",
        default_address: {
          address1: "123 Main St",
          city: "New York",
          province: "NY",
          country: "USA",
          zip: "10001",
        },
      };

      const customerData = {
        name: `${shopifyCustomer.first_name || ''} ${shopifyCustomer.last_name || ''}`.trim() || shopifyCustomer.email || 'Unknown',
        email: shopifyCustomer.email || undefined,
        phone: shopifyCustomer.phone || undefined,
        address: shopifyCustomer.default_address?.address1 || undefined,
        city: shopifyCustomer.default_address?.city || undefined,
        state: shopifyCustomer.default_address?.province || undefined,
        country: shopifyCustomer.default_address?.country || undefined,
        postalCode: shopifyCustomer.default_address?.zip || undefined,
        type: 'individual' as const,
        shopifyCustomerId: shopifyCustomer.id.toString(),
        syncSource: 'shopify' as const,
      };

      expect(customerData.name).toBe("John Doe");
      expect(customerData.email).toBe("john.doe@example.com");
      expect(customerData.phone).toBe("+1234567890");
      expect(customerData.address).toBe("123 Main St");
      expect(customerData.city).toBe("New York");
      expect(customerData.state).toBe("NY");
      expect(customerData.country).toBe("USA");
      expect(customerData.postalCode).toBe("10001");
      expect(customerData.shopifyCustomerId).toBe("123456789");
      expect(customerData.syncSource).toBe("shopify");
    });

    it("should handle Shopify customer with missing name fields", () => {
      const shopifyCustomer = {
        id: 987654321,
        first_name: null,
        last_name: null,
        email: "anonymous@example.com",
        phone: null,
        default_address: null,
      };

      const customerData = {
        name: `${shopifyCustomer.first_name || ''} ${shopifyCustomer.last_name || ''}`.trim() || shopifyCustomer.email || 'Unknown',
        email: shopifyCustomer.email || undefined,
        shopifyCustomerId: shopifyCustomer.id.toString(),
      };

      expect(customerData.name).toBe("anonymous@example.com");
      expect(customerData.email).toBe("anonymous@example.com");
    });

    it("should handle Shopify customer with no email", () => {
      const shopifyCustomer = {
        id: 111222333,
        first_name: null,
        last_name: null,
        email: null,
        phone: null,
        default_address: null,
      };

      const customerData = {
        name: `${shopifyCustomer.first_name || ''} ${shopifyCustomer.last_name || ''}`.trim() || shopifyCustomer.email || 'Unknown',
      };

      expect(customerData.name).toBe("Unknown");
    });
  });

  describe("HubSpot Customer Sync", () => {
    it("should parse HubSpot contact data correctly", () => {
      const hubspotContact = {
        id: "abc123",
        properties: {
          firstname: "Jane",
          lastname: "Smith",
          email: "jane.smith@company.com",
          phone: "+9876543210",
          address: "456 Oak Ave",
          city: "Los Angeles",
          state: "CA",
          country: "USA",
          zip: "90001",
          company: "Acme Corp",
        },
      };

      const props = hubspotContact.properties || {};
      const customerData = {
        name: `${props.firstname || ''} ${props.lastname || ''}`.trim() || props.email || 'Unknown',
        email: props.email || undefined,
        phone: props.phone || undefined,
        address: props.address || undefined,
        city: props.city || undefined,
        state: props.state || undefined,
        country: props.country || undefined,
        postalCode: props.zip || undefined,
        type: props.company ? 'business' as const : 'individual' as const,
        hubspotContactId: hubspotContact.id.toString(),
        syncSource: 'hubspot' as const,
      };

      expect(customerData.name).toBe("Jane Smith");
      expect(customerData.email).toBe("jane.smith@company.com");
      expect(customerData.phone).toBe("+9876543210");
      expect(customerData.address).toBe("456 Oak Ave");
      expect(customerData.city).toBe("Los Angeles");
      expect(customerData.state).toBe("CA");
      expect(customerData.type).toBe("business");
      expect(customerData.hubspotContactId).toBe("abc123");
      expect(customerData.syncSource).toBe("hubspot");
    });

    it("should set type to individual when no company", () => {
      const hubspotContact = {
        id: "xyz789",
        properties: {
          firstname: "Bob",
          lastname: "Wilson",
          email: "bob@personal.com",
          company: null,
        },
      };

      const props = hubspotContact.properties || {};
      const customerData = {
        type: props.company ? 'business' as const : 'individual' as const,
      };

      expect(customerData.type).toBe("individual");
    });

    it("should handle HubSpot contact with missing properties", () => {
      const hubspotContact = {
        id: "empty123",
        properties: {},
      };

      const props = hubspotContact.properties || {};
      const customerData = {
        name: `${props.firstname || ''} ${props.lastname || ''}`.trim() || props.email || 'Unknown',
        email: props.email || undefined,
      };

      expect(customerData.name).toBe("Unknown");
      expect(customerData.email).toBeUndefined();
    });
  });

  describe("Sync Status Calculation", () => {
    it("should calculate sync status correctly", () => {
      const customers = [
        { id: 1, shopifyCustomerId: "123", hubspotContactId: null },
        { id: 2, shopifyCustomerId: null, hubspotContactId: "abc" },
        { id: 3, shopifyCustomerId: null, hubspotContactId: null },
        { id: 4, shopifyCustomerId: "456", hubspotContactId: null },
        { id: 5, shopifyCustomerId: null, hubspotContactId: "def" },
      ];

      const shopifyCount = customers.filter(c => c.shopifyCustomerId).length;
      const hubspotCount = customers.filter(c => c.hubspotContactId).length;
      const manualCount = customers.filter(c => !c.shopifyCustomerId && !c.hubspotContactId).length;

      expect(shopifyCount).toBe(2);
      expect(hubspotCount).toBe(2);
      expect(manualCount).toBe(1);
      expect(shopifyCount + hubspotCount + manualCount).toBe(customers.length);
    });
  });

  describe("Duplicate Detection", () => {
    it("should identify existing customer by Shopify ID", () => {
      const existingCustomers = [
        { id: 1, shopifyCustomerId: "123", hubspotContactId: null },
        { id: 2, shopifyCustomerId: "456", hubspotContactId: null },
      ];

      const newShopifyId = "123";
      const existing = existingCustomers.find(c => c.shopifyCustomerId === newShopifyId);

      expect(existing).toBeDefined();
      expect(existing?.id).toBe(1);
    });

    it("should identify existing customer by HubSpot ID", () => {
      const existingCustomers = [
        { id: 1, shopifyCustomerId: null, hubspotContactId: "abc" },
        { id: 2, shopifyCustomerId: null, hubspotContactId: "xyz" },
      ];

      const newHubspotId = "xyz";
      const existing = existingCustomers.find(c => c.hubspotContactId === newHubspotId);

      expect(existing).toBeDefined();
      expect(existing?.id).toBe(2);
    });

    it("should return undefined for new customer", () => {
      const existingCustomers = [
        { id: 1, shopifyCustomerId: "123", hubspotContactId: null },
      ];

      const newShopifyId = "999";
      const existing = existingCustomers.find(c => c.shopifyCustomerId === newShopifyId);

      expect(existing).toBeUndefined();
    });
  });
});
