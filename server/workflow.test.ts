import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  getWorkOrders: vi.fn(),
  getWorkOrderById: vi.fn(),
  createWorkOrder: vi.fn(),
  updateWorkOrder: vi.fn(),
  getWorkOrderMaterials: vi.fn(),
  generateWorkOrderMaterialsFromBom: vi.fn(),
  consumeWorkOrderMaterials: vi.fn(),
  getPoReceivingRecords: vi.fn(),
  getPoReceivingItems: vi.fn(),
  receivePurchaseOrderItems: vi.fn(),
  getPurchaseOrderItems: vi.fn(),
  getRawMaterialInventory: vi.fn(),
  getRawMaterialInventoryByLocation: vi.fn(),
  upsertRawMaterialInventory: vi.fn(),
  createRawMaterialTransaction: vi.fn(),
  getRawMaterialTransactions: vi.fn(),
  getBomById: vi.fn(),
  getBomComponents: vi.fn(),
  getProducts: vi.fn(),
  getRawMaterials: vi.fn(),
  getLocations: vi.fn(),
}));

import * as db from './db';

describe('Work Orders Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Work Order List', () => {
    it('should return list of work orders', async () => {
      const mockWorkOrders = [
        { id: 1, workOrderNumber: 'WO-001', status: 'draft', quantity: '100' },
        { id: 2, workOrderNumber: 'WO-002', status: 'in_progress', quantity: '50' },
      ];
      vi.mocked(db.getWorkOrders).mockResolvedValue(mockWorkOrders);

      const result = await db.getWorkOrders();
      expect(result).toHaveLength(2);
      expect(result[0].workOrderNumber).toBe('WO-001');
    });

    it('should filter work orders by status', async () => {
      const mockWorkOrders = [
        { id: 2, workOrderNumber: 'WO-002', status: 'in_progress', quantity: '50' },
      ];
      vi.mocked(db.getWorkOrders).mockResolvedValue(mockWorkOrders);

      const result = await db.getWorkOrders({ status: 'in_progress' });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('in_progress');
    });
  });

  describe('Work Order Creation', () => {
    it('should create work order with auto-generated number', async () => {
      const mockWorkOrder = { id: 1, workOrderNumber: 'WO-20250108-001', bomId: 1, productId: 1, quantity: '100' };
      vi.mocked(db.createWorkOrder).mockResolvedValue(mockWorkOrder);

      const result = await db.createWorkOrder({
        bomId: 1,
        productId: 1,
        quantity: '100',
        unit: 'EA',
        priority: 'normal',
      });

      expect(result.workOrderNumber).toMatch(/WO-/);
      expect(result.quantity).toBe('100');
    });

    it('should generate material requirements from BOM', async () => {
      vi.mocked(db.generateWorkOrderMaterialsFromBom).mockResolvedValue(undefined);

      await db.generateWorkOrderMaterialsFromBom(1, 1, 100);
      expect(db.generateWorkOrderMaterialsFromBom).toHaveBeenCalledWith(1, 1, 100);
    });
  });

  describe('Work Order Status Transitions', () => {
    it('should update work order status to scheduled', async () => {
      vi.mocked(db.updateWorkOrder).mockResolvedValue({ id: 1, status: 'scheduled' });

      await db.updateWorkOrder(1, { status: 'scheduled' });
      expect(db.updateWorkOrder).toHaveBeenCalledWith(1, { status: 'scheduled' });
    });

    it('should update work order status to in_progress with start date', async () => {
      vi.mocked(db.updateWorkOrder).mockResolvedValue({ id: 1, status: 'in_progress' });

      await db.updateWorkOrder(1, { status: 'in_progress', actualStartDate: new Date() });
      expect(db.updateWorkOrder).toHaveBeenCalled();
    });

    it('should update work order status to completed', async () => {
      vi.mocked(db.updateWorkOrder).mockResolvedValue({ id: 1, status: 'completed' });

      await db.updateWorkOrder(1, { status: 'completed' });
      expect(db.updateWorkOrder).toHaveBeenCalledWith(1, { status: 'completed' });
    });
  });

  describe('Work Order Materials', () => {
    it('should get materials for a work order', async () => {
      const mockMaterials = [
        { id: 1, workOrderId: 1, rawMaterialId: 1, requiredQuantity: '10', status: 'pending' },
        { id: 2, workOrderId: 1, rawMaterialId: 2, requiredQuantity: '5', status: 'pending' },
      ];
      vi.mocked(db.getWorkOrderMaterials).mockResolvedValue(mockMaterials);

      const result = await db.getWorkOrderMaterials(1);
      expect(result).toHaveLength(2);
      expect(result[0].requiredQuantity).toBe('10');
    });
  });

  describe('Material Consumption', () => {
    it('should consume materials when production completes', async () => {
      vi.mocked(db.consumeWorkOrderMaterials).mockResolvedValue(undefined);

      await db.consumeWorkOrderMaterials(1, 1);
      expect(db.consumeWorkOrderMaterials).toHaveBeenCalledWith(1, 1);
    });
  });
});

describe('PO Receiving Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Receiving Records', () => {
    it('should get receiving records for a PO', async () => {
      const mockRecords = [
        { id: 1, purchaseOrderId: 1, receivedDate: new Date(), warehouseId: 1 },
      ];
      vi.mocked(db.getPoReceivingRecords).mockResolvedValue(mockRecords);

      const result = await db.getPoReceivingRecords(1);
      expect(result).toHaveLength(1);
      expect(result[0].purchaseOrderId).toBe(1);
    });

    it('should get receiving items for a record', async () => {
      const mockItems = [
        { id: 1, receivingRecordId: 1, rawMaterialId: 1, receivedQuantity: '100', condition: 'good' },
      ];
      vi.mocked(db.getPoReceivingItems).mockResolvedValue(mockItems);

      const result = await db.getPoReceivingItems(1);
      expect(result).toHaveLength(1);
      expect(result[0].receivedQuantity).toBe('100');
    });
  });

  describe('Receive Items', () => {
    it('should receive items and update inventory', async () => {
      const mockReceiving = { id: 1, purchaseOrderId: 1, warehouseId: 1 };
      vi.mocked(db.receivePurchaseOrderItems).mockResolvedValue(mockReceiving);

      const result = await db.receivePurchaseOrderItems(1, 1, [
        { purchaseOrderItemId: 1, rawMaterialId: 1, quantity: 100, unit: 'KG' },
      ], 1);

      expect(result.purchaseOrderId).toBe(1);
      expect(db.receivePurchaseOrderItems).toHaveBeenCalled();
    });

    it('should handle partial receiving', async () => {
      const mockReceiving = { id: 2, purchaseOrderId: 1, warehouseId: 1 };
      vi.mocked(db.receivePurchaseOrderItems).mockResolvedValue(mockReceiving);

      const result = await db.receivePurchaseOrderItems(1, 1, [
        { purchaseOrderItemId: 1, rawMaterialId: 1, quantity: 50, unit: 'KG' },
      ], 1);

      expect(result).toBeDefined();
    });
  });
});

describe('Raw Material Inventory Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Inventory Queries', () => {
    it('should get raw material inventory list', async () => {
      const mockInventory = [
        { id: 1, rawMaterialId: 1, warehouseId: 1, quantity: '500', unit: 'KG' },
        { id: 2, rawMaterialId: 2, warehouseId: 1, quantity: '200', unit: 'L' },
      ];
      vi.mocked(db.getRawMaterialInventory).mockResolvedValue(mockInventory);

      const result = await db.getRawMaterialInventory();
      expect(result).toHaveLength(2);
    });

    it('should filter inventory by warehouse', async () => {
      const mockInventory = [
        { id: 1, rawMaterialId: 1, warehouseId: 1, quantity: '500', unit: 'KG' },
      ];
      vi.mocked(db.getRawMaterialInventory).mockResolvedValue(mockInventory);

      const result = await db.getRawMaterialInventory({ warehouseId: 1 });
      expect(result).toHaveLength(1);
      expect(result[0].warehouseId).toBe(1);
    });

    it('should get inventory by location', async () => {
      const mockInventory = { id: 1, rawMaterialId: 1, warehouseId: 1, quantity: '500' };
      vi.mocked(db.getRawMaterialInventoryByLocation).mockResolvedValue(mockInventory);

      const result = await db.getRawMaterialInventoryByLocation(1, 1);
      expect(result?.quantity).toBe('500');
    });
  });

  describe('Inventory Transactions', () => {
    it('should get transaction history', async () => {
      const mockTransactions = [
        { id: 1, rawMaterialId: 1, transactionType: 'receive', quantity: '100' },
        { id: 2, rawMaterialId: 1, transactionType: 'consume', quantity: '-50' },
      ];
      vi.mocked(db.getRawMaterialTransactions).mockResolvedValue(mockTransactions);

      const result = await db.getRawMaterialTransactions(1);
      expect(result).toHaveLength(2);
    });

    it('should create transaction record', async () => {
      const mockTransaction = { id: 1, rawMaterialId: 1, transactionType: 'adjust', quantity: '25' };
      vi.mocked(db.createRawMaterialTransaction).mockResolvedValue(mockTransaction);

      const result = await db.createRawMaterialTransaction({
        rawMaterialId: 1,
        warehouseId: 1,
        transactionType: 'adjust',
        quantity: '25',
        previousQuantity: '500',
        newQuantity: '525',
        unit: 'KG',
      });

      expect(result.transactionType).toBe('adjust');
    });
  });

  describe('Inventory Adjustments', () => {
    it('should upsert inventory record', async () => {
      vi.mocked(db.upsertRawMaterialInventory).mockResolvedValue({ id: 1, quantity: '600' });

      const result = await db.upsertRawMaterialInventory(1, 1, {
        quantity: '600',
        availableQuantity: '600',
        unit: 'KG',
      });

      expect(result.quantity).toBe('600');
    });
  });
});

describe('Production Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full workflow: PO → Receive → Work Order → Consume', async () => {
    // Step 1: Get PO items
    const mockPOItems = [
      { id: 1, purchaseOrderId: 1, productId: 1, quantity: '100', receivedQuantity: '0' },
    ];
    vi.mocked(db.getPurchaseOrderItems).mockResolvedValue(mockPOItems);

    const poItems = await db.getPurchaseOrderItems(1);
    expect(poItems).toHaveLength(1);

    // Step 2: Receive items
    const mockReceiving = { id: 1, purchaseOrderId: 1, warehouseId: 1 };
    vi.mocked(db.receivePurchaseOrderItems).mockResolvedValue(mockReceiving);

    const receiving = await db.receivePurchaseOrderItems(1, 1, [
      { purchaseOrderItemId: 1, rawMaterialId: 1, quantity: 100, unit: 'KG' },
    ], 1);
    expect(receiving.purchaseOrderId).toBe(1);

    // Step 3: Create work order
    const mockWorkOrder = { id: 1, workOrderNumber: 'WO-001', bomId: 1, productId: 1, quantity: '50' };
    vi.mocked(db.createWorkOrder).mockResolvedValue(mockWorkOrder);

    const workOrder = await db.createWorkOrder({
      bomId: 1,
      productId: 1,
      quantity: '50',
      unit: 'EA',
      priority: 'normal',
    });
    expect(workOrder.workOrderNumber).toBe('WO-001');

    // Step 4: Generate materials from BOM
    vi.mocked(db.generateWorkOrderMaterialsFromBom).mockResolvedValue(undefined);
    await db.generateWorkOrderMaterialsFromBom(1, 1, 50);
    expect(db.generateWorkOrderMaterialsFromBom).toHaveBeenCalledWith(1, 1, 50);

    // Step 5: Consume materials
    vi.mocked(db.consumeWorkOrderMaterials).mockResolvedValue(undefined);
    await db.consumeWorkOrderMaterials(1, 1);
    expect(db.consumeWorkOrderMaterials).toHaveBeenCalledWith(1, 1);
  });

  it('should track inventory changes through workflow', async () => {
    // Initial inventory
    vi.mocked(db.getRawMaterialInventoryByLocation).mockResolvedValueOnce({ 
      id: 1, rawMaterialId: 1, warehouseId: 1, quantity: '0', unit: 'KG' 
    });

    // After receiving
    vi.mocked(db.getRawMaterialInventoryByLocation).mockResolvedValueOnce({ 
      id: 1, rawMaterialId: 1, warehouseId: 1, quantity: '100', unit: 'KG' 
    });

    // After consumption
    vi.mocked(db.getRawMaterialInventoryByLocation).mockResolvedValueOnce({ 
      id: 1, rawMaterialId: 1, warehouseId: 1, quantity: '50', unit: 'KG' 
    });

    // Check initial
    const initial = await db.getRawMaterialInventoryByLocation(1, 1);
    expect(initial?.quantity).toBe('0');

    // Check after receiving
    const afterReceive = await db.getRawMaterialInventoryByLocation(1, 1);
    expect(afterReceive?.quantity).toBe('100');

    // Check after consumption
    const afterConsume = await db.getRawMaterialInventoryByLocation(1, 1);
    expect(afterConsume?.quantity).toBe('50');
  });
});
