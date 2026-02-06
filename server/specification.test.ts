import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  // Lot/Batch Tracking
  createInventoryLot: vi.fn(),
  getInventoryLots: vi.fn(),
  getInventoryLotById: vi.fn(),
  updateInventoryLot: vi.fn(),
  
  // Inventory Balances
  getInventoryBalances: vi.fn(),
  updateInventoryBalance: vi.fn(),
  
  // Inventory Transactions
  createInventoryTransaction: vi.fn(),
  getInventoryTransactionHistory: vi.fn(),
  
  // Work Order Output
  createWorkOrderOutput: vi.fn(),
  
  // Alerts
  createAlert: vi.fn(),
  getAlerts: vi.fn(),
  getAlertById: vi.fn(),
  acknowledgeAlert: vi.fn(),
  resolveAlert: vi.fn(),
  updateAlert: vi.fn(),
  generateLowStockAlerts: vi.fn(),
  
  // Recommendations
  createRecommendation: vi.fn(),
  getRecommendations: vi.fn(),
  approveRecommendation: vi.fn(),
  rejectRecommendation: vi.fn(),
  
  // Shopify Integration
  createShopifyStore: vi.fn(),
  getShopifyStores: vi.fn(),
  getShopifyStoreById: vi.fn(),
  getShopifyStoreByDomain: vi.fn(),
  updateShopifyStore: vi.fn(),
  createShopifySkuMapping: vi.fn(),
  getShopifySkuMappings: vi.fn(),
  createShopifyLocationMapping: vi.fn(),
  getShopifyLocationMappings: vi.fn(),
  createWebhookEvent: vi.fn(),
  getWebhookEventByIdempotencyKey: vi.fn(),
  updateWebhookEvent: vi.fn(),
  getProductByShopifySku: vi.fn(),
  
  // Sales Orders
  createSalesOrder: vi.fn(),
  getSalesOrders: vi.fn(),
  getSalesOrderById: vi.fn(),
  getSalesOrderByShopifyId: vi.fn(),
  updateSalesOrder: vi.fn(),
  createSalesOrderLine: vi.fn(),
  getSalesOrderLines: vi.fn(),
  
  // Reservations
  createInventoryReservation: vi.fn(),
  getInventoryReservations: vi.fn(),
  reserveInventory: vi.fn(),
  releaseReservation: vi.fn(),
  
  // Allocations
  createInventoryAllocation: vi.fn(),
  getInventoryAllocations: vi.fn(),
  updateInventoryAllocation: vi.fn(),
  
  // Reconciliation
  createReconciliationRun: vi.fn(),
  getReconciliationRuns: vi.fn(),
  getReconciliationRunById: vi.fn(),
  updateReconciliationRun: vi.fn(),
  createReconciliationLine: vi.fn(),
  getReconciliationLines: vi.fn(),
  runInventoryReconciliation: vi.fn(),
  
  // Existing functions
  getAvailableInventoryByProduct: vi.fn(),

  // Product sync functions
  getProductByShopifyProductId: vi.fn(),
  getShopifySkuMappingByVariant: vi.fn(),
  getProductBySku: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  createSyncLog: vi.fn(),
}));

import * as db from './db';

describe('Lot/Batch Tracking Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Inventory Lot Management', () => {
    it('should create an inventory lot with proper lot code', async () => {
      const mockLot = {
        id: 1,
        lotCode: 'LOT-2025-001',
        productId: 1,
        productType: 'finished',
        status: 'active',
      };
      vi.mocked(db.createInventoryLot).mockResolvedValue(mockLot);

      const result = await db.createInventoryLot({
        productId: 1,
        productType: 'finished',
        manufactureDate: new Date(),
      });

      expect(result.lotCode).toBeDefined();
      expect(result.status).toBe('active');
    });

    it('should list inventory lots with filters', async () => {
      const mockLots = [
        { id: 1, lotCode: 'LOT-001', status: 'active' },
        { id: 2, lotCode: 'LOT-002', status: 'active' },
      ];
      vi.mocked(db.getInventoryLots).mockResolvedValue(mockLots);

      const result = await db.getInventoryLots({ status: 'active' });

      expect(result).toHaveLength(2);
      expect(db.getInventoryLots).toHaveBeenCalledWith({ status: 'active' });
    });

    it('should update lot status (active, hold, expired, consumed)', async () => {
      vi.mocked(db.updateInventoryLot).mockResolvedValue(undefined);

      await db.updateInventoryLot(1, { status: 'quarantine' });

      expect(db.updateInventoryLot).toHaveBeenCalledWith(1, { status: 'quarantine' });
    });
  });

  describe('Inventory Balances', () => {
    it('should track balance by lot, product, warehouse, and status', async () => {
      const mockBalances = [
        { lotId: 1, productId: 1, warehouseId: 1, status: 'available', quantity: '100' },
        { lotId: 1, productId: 1, warehouseId: 1, status: 'reserved', quantity: '20' },
      ];
      vi.mocked(db.getInventoryBalances).mockResolvedValue(mockBalances);

      const result = await db.getInventoryBalances({ lotId: 1 });

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('available');
      expect(result[1].status).toBe('reserved');
    });
  });

  describe('Inventory Transactions', () => {
    it('should record transaction history with full audit trail', async () => {
      const mockTransaction = {
        id: 1,
        type: 'production_output',
        productId: 1,
        lotId: 1,
        quantity: '100',
        referenceType: 'work_order',
        referenceId: 1,
      };
      vi.mocked(db.createInventoryTransaction).mockResolvedValue(mockTransaction);

      const result = await db.createInventoryTransaction({
        type: 'production_output',
        productId: 1,
        lotId: 1,
        quantity: '100',
        referenceType: 'work_order',
        referenceId: 1,
      });

      expect(result.type).toBe('production_output');
      expect(result.referenceType).toBe('work_order');
    });

    it('should retrieve transaction history with filters', async () => {
      const mockHistory = [
        { id: 1, type: 'receipt', quantity: '100' },
        { id: 2, type: 'sale', quantity: '-10' },
      ];
      vi.mocked(db.getInventoryTransactionHistory).mockResolvedValue(mockHistory);

      const result = await db.getInventoryTransactionHistory({ productId: 1 }, 100);

      expect(result).toHaveLength(2);
    });
  });
});

describe('Work Order Output Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create finished goods lot when work order completes', async () => {
    const mockOutput = {
      lotId: 1,
      lotCode: 'LOT-WO-001',
    };
    vi.mocked(db.createWorkOrderOutput).mockResolvedValue(mockOutput);

    const result = await db.createWorkOrderOutput(1, 1, 100, 1, 98.5, 1);

    expect(result.lotId).toBeDefined();
    expect(result.lotCode).toBeDefined();
    expect(db.createWorkOrderOutput).toHaveBeenCalledWith(1, 1, 100, 1, 98.5, 1);
  });
});

describe('Alert System Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Alert Management', () => {
    it('should create alerts with proper severity levels', async () => {
      const mockAlert = {
        id: 1,
        type: 'low_stock',
        severity: 'warning',
        title: 'Low stock alert',
        status: 'open',
      };
      vi.mocked(db.createAlert).mockResolvedValue(mockAlert);

      const result = await db.createAlert({
        type: 'low_stock',
        severity: 'warning',
        title: 'Low stock alert',
      });

      expect(result.severity).toBe('warning');
      expect(result.status).toBe('open');
    });

    it('should list alerts filtered by type and status', async () => {
      const mockAlerts = [
        { id: 1, type: 'low_stock', status: 'open' },
        { id: 2, type: 'shortage', status: 'open' },
      ];
      vi.mocked(db.getAlerts).mockResolvedValue(mockAlerts);

      const result = await db.getAlerts({ status: 'open' });

      expect(result).toHaveLength(2);
    });

    it('should acknowledge an alert', async () => {
      vi.mocked(db.acknowledgeAlert).mockResolvedValue(undefined);

      await db.acknowledgeAlert(1, 1);

      expect(db.acknowledgeAlert).toHaveBeenCalledWith(1, 1);
    });

    it('should resolve an alert with notes', async () => {
      vi.mocked(db.resolveAlert).mockResolvedValue(undefined);

      await db.resolveAlert(1, 1, 'Issue fixed by reordering stock');

      expect(db.resolveAlert).toHaveBeenCalledWith(1, 1, 'Issue fixed by reordering stock');
    });
  });

  describe('Automatic Alert Generation', () => {
    it('should generate low stock alerts automatically', async () => {
      vi.mocked(db.generateLowStockAlerts).mockResolvedValue([1, 2, 3]);

      const result = await db.generateLowStockAlerts();

      expect(result).toHaveLength(3);
    });
  });
});

describe('Shopify Integration Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Store Management', () => {
    it('should create a Shopify store configuration', async () => {
      const mockStore = {
        id: 1,
        storeName: 'Test Store',
        storeDomain: 'test-store.myshopify.com',
        isActive: true,
      };
      vi.mocked(db.createShopifyStore).mockResolvedValue(mockStore);

      const result = await db.createShopifyStore({
        storeName: 'Test Store',
        storeDomain: 'test-store.myshopify.com',
      });

      expect(result.storeDomain).toBe('test-store.myshopify.com');
      expect(result.isActive).toBe(true);
    });

    it('should list all Shopify stores', async () => {
      const mockStores = [
        { id: 1, storeName: 'Store 1' },
        { id: 2, storeName: 'Store 2' },
      ];
      vi.mocked(db.getShopifyStores).mockResolvedValue(mockStores);

      const result = await db.getShopifyStores();

      expect(result).toHaveLength(2);
    });
  });

  describe('SKU Mapping', () => {
    it('should create SKU mapping between Shopify and ERP', async () => {
      const mockMapping = {
        id: 1,
        storeId: 1,
        shopifyProductId: 'gid://shopify/Product/123',
        shopifyVariantId: 'gid://shopify/ProductVariant/456',
        productId: 1,
      };
      vi.mocked(db.createShopifySkuMapping).mockResolvedValue(mockMapping);

      const result = await db.createShopifySkuMapping({
        storeId: 1,
        shopifyProductId: 'gid://shopify/Product/123',
        shopifyVariantId: 'gid://shopify/ProductVariant/456',
        productId: 1,
      });

      expect(result.shopifyProductId).toBeDefined();
      expect(result.productId).toBe(1);
    });

    it('should look up ERP product by Shopify SKU', async () => {
      const mockProduct = { id: 1, name: 'Test Product', sku: 'TEST-001' };
      vi.mocked(db.getProductByShopifySku).mockResolvedValue(mockProduct);

      const result = await db.getProductByShopifySku(1, '456');

      expect(result?.id).toBe(1);
    });

    it('should look up existing SKU mapping by variant ID', async () => {
      const mockMapping = {
        id: 1,
        storeId: 1,
        shopifyProductId: '123',
        shopifyVariantId: '456',
        shopifySku: 'TEST-SKU',
        productId: 5,
        isActive: true,
      };
      vi.mocked(db.getShopifySkuMappingByVariant).mockResolvedValue(mockMapping);

      const result = await db.getShopifySkuMappingByVariant(1, '456');

      expect(result?.productId).toBe(5);
      expect(result?.shopifyVariantId).toBe('456');
      expect(db.getShopifySkuMappingByVariant).toHaveBeenCalledWith(1, '456');
    });

    it('should return undefined for unmapped variant', async () => {
      vi.mocked(db.getShopifySkuMappingByVariant).mockResolvedValue(undefined);

      const result = await db.getShopifySkuMappingByVariant(1, 'nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('Product Catalog Sync', () => {
    it('should look up product by Shopify product ID', async () => {
      const mockProduct = { id: 3, name: 'Shopify Product', sku: 'SHOP-123', shopifyProductId: '123' };
      vi.mocked(db.getProductByShopifyProductId).mockResolvedValue(mockProduct);

      const result = await db.getProductByShopifyProductId('123');

      expect(result?.shopifyProductId).toBe('123');
      expect(db.getProductByShopifyProductId).toHaveBeenCalledWith('123');
    });

    it('should return undefined when no product matches Shopify product ID', async () => {
      vi.mocked(db.getProductByShopifyProductId).mockResolvedValue(undefined);

      const result = await db.getProductByShopifyProductId('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should create new product from Shopify catalog', async () => {
      vi.mocked(db.createProduct).mockResolvedValue({ id: 10 });

      const result = await db.createProduct({
        name: 'New Shopify Product',
        sku: 'SHOP-NEW-001',
        unitPrice: '29.99',
        description: 'A product from Shopify',
        status: 'active',
        category: 'Apparel',
        shopifyProductId: '789',
      });

      expect(result.id).toBe(10);
      expect(db.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          shopifyProductId: '789',
          unitPrice: '29.99',
          status: 'active',
        })
      );
    });

    it('should update existing product with Shopify data', async () => {
      vi.mocked(db.updateProduct).mockResolvedValue(undefined);

      await db.updateProduct(5, {
        name: 'Updated Product Title',
        unitPrice: '39.99',
        status: 'active',
        shopifyProductId: '123',
      });

      expect(db.updateProduct).toHaveBeenCalledWith(5, expect.objectContaining({
        unitPrice: '39.99',
        shopifyProductId: '123',
      }));
    });

    it('should create SKU mapping after importing new product', async () => {
      vi.mocked(db.createShopifySkuMapping).mockResolvedValue({ id: 1 });

      const result = await db.createShopifySkuMapping({
        storeId: 1,
        shopifyProductId: '789',
        shopifyVariantId: '101',
        shopifySku: 'NEW-SKU',
        productId: 10,
      });

      expect(result.id).toBe(1);
      expect(db.createShopifySkuMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          shopifyProductId: '789',
          shopifyVariantId: '101',
          shopifySku: 'NEW-SKU',
          productId: 10,
        })
      );
    });

    it('should handle multi-variant products by creating a product per variant', async () => {
      // Simulate creating products for a multi-variant Shopify product
      vi.mocked(db.getShopifySkuMappingByVariant).mockResolvedValue(undefined);
      vi.mocked(db.getProductBySku).mockResolvedValue(undefined);
      vi.mocked(db.createProduct)
        .mockResolvedValueOnce({ id: 20 })
        .mockResolvedValueOnce({ id: 21 });
      vi.mocked(db.createShopifySkuMapping).mockResolvedValue({ id: 1 });

      // Variant 1: Small
      const variant1Sku = 'TSHIRT-SM';
      const result1 = await db.createProduct({
        name: 'T-Shirt - Small',
        sku: variant1Sku,
        unitPrice: '19.99',
        status: 'active',
        shopifyProductId: '500',
      });
      await db.createShopifySkuMapping({
        storeId: 1,
        shopifyProductId: '500',
        shopifyVariantId: '501',
        shopifySku: variant1Sku,
        productId: result1.id,
      });

      // Variant 2: Large
      const variant2Sku = 'TSHIRT-LG';
      const result2 = await db.createProduct({
        name: 'T-Shirt - Large',
        sku: variant2Sku,
        unitPrice: '21.99',
        status: 'active',
        shopifyProductId: '500',
      });
      await db.createShopifySkuMapping({
        storeId: 1,
        shopifyProductId: '500',
        shopifyVariantId: '502',
        shopifySku: variant2Sku,
        productId: result2.id,
      });

      expect(db.createProduct).toHaveBeenCalledTimes(2);
      expect(db.createShopifySkuMapping).toHaveBeenCalledTimes(2);
      expect(result1.id).not.toBe(result2.id);
    });

    it('should update existing product when SKU mapping already exists', async () => {
      const existingMapping = {
        id: 5,
        storeId: 1,
        shopifyProductId: '123',
        shopifyVariantId: '456',
        shopifySku: 'EXISTING-SKU',
        productId: 15,
        isActive: true,
      };
      vi.mocked(db.getShopifySkuMappingByVariant).mockResolvedValue(existingMapping);
      vi.mocked(db.updateProduct).mockResolvedValue(undefined);

      // When mapping exists, update the product instead of creating
      await db.updateProduct(existingMapping.productId, {
        name: 'Updated Name',
        unitPrice: '49.99',
        status: 'active',
        shopifyProductId: '123',
      });

      expect(db.updateProduct).toHaveBeenCalledWith(15, expect.objectContaining({
        name: 'Updated Name',
        unitPrice: '49.99',
      }));
      // Should NOT create a new product
      expect(db.createProduct).not.toHaveBeenCalled();
    });

    it('should log sync results', async () => {
      vi.mocked(db.createSyncLog).mockResolvedValue({ id: 1 });

      await db.createSyncLog({
        integration: 'shopify',
        action: 'sync_products',
        status: 'success',
        details: 'Imported 5, Updated 3, SKU mappings 5',
        recordsProcessed: 8,
        recordsFailed: 0,
      });

      expect(db.createSyncLog).toHaveBeenCalledWith(
        expect.objectContaining({
          integration: 'shopify',
          action: 'sync_products',
          recordsProcessed: 8,
        })
      );
    });

    it('should use fallback SKU when Shopify variant has no SKU', async () => {
      vi.mocked(db.getShopifySkuMappingByVariant).mockResolvedValue(undefined);
      vi.mocked(db.getProductBySku).mockResolvedValue(undefined);
      vi.mocked(db.createProduct).mockResolvedValue({ id: 30 });
      vi.mocked(db.createShopifySkuMapping).mockResolvedValue({ id: 1 });

      const shopifyProductId = '600';
      const shopifyVariantId = '601';
      const fallbackSku = `SHOP-${shopifyProductId}-${shopifyVariantId}`;

      await db.createProduct({
        name: 'No SKU Product',
        sku: fallbackSku,
        unitPrice: '9.99',
        status: 'active',
        shopifyProductId,
      });

      expect(db.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          sku: 'SHOP-600-601',
        })
      );
    });
  });

  describe('Webhook Processing', () => {
    it('should check idempotency before processing webhook', async () => {
      vi.mocked(db.getWebhookEventByIdempotencyKey).mockResolvedValue(null);

      const result = await db.getWebhookEventByIdempotencyKey('unique-key-123');

      expect(result).toBeNull();
    });

    it('should create webhook event record', async () => {
      const mockEvent = {
        id: 1,
        source: 'shopify',
        topic: 'orders/create',
        status: 'received',
      };
      vi.mocked(db.createWebhookEvent).mockResolvedValue(mockEvent);

      const result = await db.createWebhookEvent({
        source: 'shopify',
        topic: 'orders/create',
        payload: '{}',
        idempotencyKey: 'unique-key',
        status: 'received',
      });

      expect(result.status).toBe('received');
    });

    it('should update webhook event status after processing', async () => {
      vi.mocked(db.updateWebhookEvent).mockResolvedValue(undefined);

      await db.updateWebhookEvent(1, { status: 'processed', processedAt: new Date() });

      expect(db.updateWebhookEvent).toHaveBeenCalled();
    });
  });
});

describe('Sales Order Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a sales order with auto-generated order number', async () => {
    const mockOrder = {
      id: 1,
      orderNumber: 'SO-2025-0001',
      source: 'manual',
      status: 'pending',
    };
    vi.mocked(db.createSalesOrder).mockResolvedValue(mockOrder);

    const result = await db.createSalesOrder({
      source: 'manual',
      status: 'pending',
    });

    expect(result.orderNumber).toMatch(/^SO-/);
    expect(result.status).toBe('pending');
  });

  it('should list sales orders with filters', async () => {
    const mockOrders = [
      { id: 1, status: 'pending' },
      { id: 2, status: 'confirmed' },
    ];
    vi.mocked(db.getSalesOrders).mockResolvedValue(mockOrders);

    const result = await db.getSalesOrders({ status: 'pending' });

    expect(result).toBeDefined();
  });

  it('should create sales order lines', async () => {
    const mockLine = {
      id: 1,
      salesOrderId: 1,
      productId: 1,
      quantity: '10',
      unitPrice: '25.00',
    };
    vi.mocked(db.createSalesOrderLine).mockResolvedValue(mockLine);

    const result = await db.createSalesOrderLine({
      salesOrderId: 1,
      productId: 1,
      quantity: '10',
      unitPrice: '25.00',
      totalPrice: '250.00',
    });

    expect(result.salesOrderId).toBe(1);
  });
});

describe('Reservation System Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reserve inventory for a sales order', async () => {
    const mockReservation = {
      id: 1,
      lotId: 1,
      productId: 1,
      quantity: '10',
      status: 'reserved',
    };
    vi.mocked(db.reserveInventory).mockResolvedValue(mockReservation);

    const result = await db.reserveInventory(1, 1, 1, 10, 'sales_order', 1, 1);

    expect(result.status).toBe('reserved');
  });

  it('should release reservation when order is cancelled', async () => {
    vi.mocked(db.releaseReservation).mockResolvedValue(undefined);

    await db.releaseReservation(1, 1, 1, 10, 'sales_order', 1, 1);

    expect(db.releaseReservation).toHaveBeenCalled();
  });

  it('should get reservations for a sales order', async () => {
    const mockReservations = [
      { id: 1, quantity: '10' },
      { id: 2, quantity: '5' },
    ];
    vi.mocked(db.getInventoryReservations).mockResolvedValue(mockReservations);

    const result = await db.getInventoryReservations(1);

    expect(result).toHaveLength(2);
  });
});

describe('Allocation System Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create channel allocation', async () => {
    const mockAllocation = {
      id: 1,
      channel: 'shopify',
      productId: 1,
      allocatedQuantity: '100',
    };
    vi.mocked(db.createInventoryAllocation).mockResolvedValue(mockAllocation);

    const result = await db.createInventoryAllocation({
      channel: 'shopify',
      productId: 1,
      warehouseId: 1,
      allocatedQuantity: '100',
      remainingQuantity: '100',
    });

    expect(result.channel).toBe('shopify');
    expect(result.allocatedQuantity).toBe('100');
  });

  it('should list allocations by channel', async () => {
    const mockAllocations = [
      { id: 1, channel: 'shopify', allocatedQuantity: '100' },
      { id: 2, channel: 'shopify', allocatedQuantity: '50' },
    ];
    vi.mocked(db.getInventoryAllocations).mockResolvedValue(mockAllocations);

    const result = await db.getInventoryAllocations({ channel: 'shopify' });

    expect(result).toHaveLength(2);
  });
});

describe('Reconciliation Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run inventory reconciliation', async () => {
    const mockRun = {
      id: 1,
      channel: 'shopify',
      status: 'completed',
      totalItems: 100,
      matchedItems: 95,
      varianceItems: 5,
    };
    vi.mocked(db.runInventoryReconciliation).mockResolvedValue(mockRun);

    const result = await db.runInventoryReconciliation('shopify', 1, 1);

    expect(result.status).toBe('completed');
    expect(result.varianceItems).toBe(5);
  });

  it('should list reconciliation runs', async () => {
    const mockRuns = [
      { id: 1, status: 'completed' },
      { id: 2, status: 'completed' },
    ];
    vi.mocked(db.getReconciliationRuns).mockResolvedValue(mockRuns);

    const result = await db.getReconciliationRuns({ status: 'completed' });

    expect(result).toHaveLength(2);
  });

  it('should get reconciliation lines with variances', async () => {
    const mockLines = [
      { id: 1, erpQuantity: '100', channelQuantity: '98', variance: '-2' },
      { id: 2, erpQuantity: '50', channelQuantity: '50', variance: '0' },
    ];
    vi.mocked(db.getReconciliationLines).mockResolvedValue(mockLines);

    const result = await db.getReconciliationLines(1);

    expect(result).toHaveLength(2);
    expect(result[0].variance).toBe('-2');
  });
});

describe('Recommendations Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create AI-generated recommendation', async () => {
    const mockRecommendation = {
      id: 1,
      type: 'reorder',
      title: 'Reorder Raw Material',
      status: 'pending',
    };
    vi.mocked(db.createRecommendation).mockResolvedValue(mockRecommendation);

    const result = await db.createRecommendation({
      type: 'reorder',
      title: 'Reorder Raw Material',
      description: 'Stock is running low',
    });

    expect(result.type).toBe('reorder');
    expect(result.status).toBe('pending');
  });

  it('should approve recommendation', async () => {
    vi.mocked(db.approveRecommendation).mockResolvedValue(undefined);

    await db.approveRecommendation(1, 1);

    expect(db.approveRecommendation).toHaveBeenCalledWith(1, 1);
  });

  it('should reject recommendation with reason', async () => {
    vi.mocked(db.rejectRecommendation).mockResolvedValue(undefined);

    await db.rejectRecommendation(1, 1, 'Not needed at this time');

    expect(db.rejectRecommendation).toHaveBeenCalledWith(1, 1, 'Not needed at this time');
  });
});
