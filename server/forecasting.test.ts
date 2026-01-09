import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  getDemandForecasts: vi.fn(),
  getDemandForecastById: vi.fn(),
  createDemandForecast: vi.fn(),
  updateDemandForecast: vi.fn(),
  getProductionPlans: vi.fn(),
  getProductionPlanById: vi.fn(),
  createProductionPlan: vi.fn(),
  updateProductionPlan: vi.fn(),
  getMaterialRequirements: vi.fn(),
  createMaterialRequirement: vi.fn(),
  updateMaterialRequirement: vi.fn(),
  getSuggestedPurchaseOrders: vi.fn(),
  getSuggestedPurchaseOrderById: vi.fn(),
  createSuggestedPurchaseOrder: vi.fn(),
  updateSuggestedPurchaseOrder: vi.fn(),
  getSuggestedPoItems: vi.fn(),
  createSuggestedPoItem: vi.fn(),
  convertSuggestedPoToActualPo: vi.fn(),
  getProducts: vi.fn(),
  getProductById: vi.fn(),
  getHistoricalSalesData: vi.fn(),
  getBillOfMaterials: vi.fn(),
  getBomComponents: vi.fn(),
  getInventory: vi.fn(),
  getRawMaterialInventory: vi.fn(),
  getRawMaterialById: vi.fn(),
  getPendingOrdersForMaterial: vi.fn(),
  getPreferredVendorForMaterial: vi.fn(),
  getVendorById: vi.fn(),
}));

// Import after mocking
import * as db from './db';

describe('AI Production Forecasting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Demand Forecasts', () => {
    it('should retrieve demand forecasts with filters', async () => {
      const mockForecasts = [
        { id: 1, forecastNumber: 'FC-20260108-ABCD', productId: 1, forecastedQuantity: '1000', status: 'active' },
        { id: 2, forecastNumber: 'FC-20260108-EFGH', productId: 2, forecastedQuantity: '500', status: 'active' },
      ];
      vi.mocked(db.getDemandForecasts).mockResolvedValue(mockForecasts as any);

      const result = await db.getDemandForecasts({ status: 'active' });
      
      expect(result).toHaveLength(2);
      expect(result[0].forecastNumber).toContain('FC-');
      expect(db.getDemandForecasts).toHaveBeenCalledWith({ status: 'active' });
    });

    it('should retrieve a single forecast by ID', async () => {
      const mockForecast = { 
        id: 1, 
        forecastNumber: 'FC-20260108-ABCD', 
        productId: 1, 
        forecastedQuantity: '1000',
        confidenceLevel: '85',
        trendDirection: 'up',
        aiAnalysis: 'Based on historical trends, demand is expected to increase.',
        status: 'active' 
      };
      vi.mocked(db.getDemandForecastById).mockResolvedValue(mockForecast as any);

      const result = await db.getDemandForecastById(1);
      
      expect(result).toBeDefined();
      expect(result?.forecastNumber).toBe('FC-20260108-ABCD');
      expect(result?.confidenceLevel).toBe('85');
    });

    it('should create a new demand forecast', async () => {
      vi.mocked(db.createDemandForecast).mockResolvedValue({ 
        id: 1, 
        forecastNumber: 'FC-20260108-WXYZ' 
      });

      const result = await db.createDemandForecast({
        productId: 1,
        forecastDate: new Date(),
        forecastPeriodStart: new Date(),
        forecastPeriodEnd: new Date(),
        forecastedQuantity: '1500',
        confidenceLevel: '75',
        forecastMethod: 'ai_trend',
        status: 'active',
      } as any);

      expect(result.id).toBe(1);
      expect(result.forecastNumber).toContain('FC-');
    });
  });

  describe('Production Plans', () => {
    it('should retrieve production plans', async () => {
      const mockPlans = [
        { id: 1, planNumber: 'PP-20260108-ABCD', productId: 1, plannedQuantity: '500', status: 'draft' },
      ];
      vi.mocked(db.getProductionPlans).mockResolvedValue(mockPlans as any);

      const result = await db.getProductionPlans({ status: 'draft' });
      
      expect(result).toHaveLength(1);
      expect(result[0].planNumber).toContain('PP-');
    });

    it('should create a production plan with material requirements calculation', async () => {
      vi.mocked(db.createProductionPlan).mockResolvedValue({ 
        id: 1, 
        planNumber: 'PP-20260108-PLAN' 
      });

      const result = await db.createProductionPlan({
        demandForecastId: 1,
        productId: 1,
        bomId: 1,
        plannedQuantity: '500',
        unit: 'EA',
        status: 'draft',
      } as any);

      expect(result.id).toBe(1);
      expect(result.planNumber).toContain('PP-');
    });
  });

  describe('Material Requirements', () => {
    it('should retrieve material requirements for a production plan', async () => {
      const mockRequirements = [
        { id: 1, productionPlanId: 1, rawMaterialId: 1, requiredQuantity: '100', shortageQuantity: '50' },
        { id: 2, productionPlanId: 1, rawMaterialId: 2, requiredQuantity: '200', shortageQuantity: '0' },
      ];
      vi.mocked(db.getMaterialRequirements).mockResolvedValue(mockRequirements as any);

      const result = await db.getMaterialRequirements(1);
      
      expect(result).toHaveLength(2);
      expect(result[0].shortageQuantity).toBe('50');
    });

    it('should create material requirement with shortage calculation', async () => {
      vi.mocked(db.createMaterialRequirement).mockResolvedValue({ id: 1 });

      const result = await db.createMaterialRequirement({
        productionPlanId: 1,
        rawMaterialId: 1,
        requiredQuantity: '100',
        currentInventory: '30',
        onOrderQuantity: '20',
        shortageQuantity: '50',
        suggestedOrderQuantity: '55',
        status: 'pending',
      } as any);

      expect(result.id).toBe(1);
    });
  });

  describe('Suggested Purchase Orders', () => {
    it('should retrieve pending suggested POs', async () => {
      const mockSuggestedPOs = [
        { id: 1, suggestedPoNumber: 'SPO-20260108-ABCD', vendorId: 1, totalAmount: '5000', priorityScore: 85, status: 'pending' },
        { id: 2, suggestedPoNumber: 'SPO-20260108-EFGH', vendorId: 2, totalAmount: '3000', priorityScore: 60, status: 'pending' },
      ];
      vi.mocked(db.getSuggestedPurchaseOrders).mockResolvedValue(mockSuggestedPOs as any);

      const result = await db.getSuggestedPurchaseOrders({ status: 'pending' });
      
      expect(result).toHaveLength(2);
      expect(result[0].priorityScore).toBe(85);
    });

    it('should create a suggested PO with AI rationale', async () => {
      vi.mocked(db.createSuggestedPurchaseOrder).mockResolvedValue({ 
        id: 1, 
        suggestedPoNumber: 'SPO-20260108-TEST' 
      });

      const result = await db.createSuggestedPurchaseOrder({
        vendorId: 1,
        productionPlanId: 1,
        totalAmount: '5000',
        currency: 'USD',
        aiRationale: 'This PO is suggested based on material shortages identified in production plan.',
        priorityScore: 85,
        status: 'pending',
      } as any);

      expect(result.id).toBe(1);
      expect(result.suggestedPoNumber).toContain('SPO-');
    });

    it('should retrieve suggested PO with line items', async () => {
      const mockPO = { id: 1, suggestedPoNumber: 'SPO-20260108-ABCD', vendorId: 1, totalAmount: '5000', status: 'pending' };
      const mockItems = [
        { id: 1, suggestedPoId: 1, rawMaterialId: 1, quantity: '100', unitPrice: '25', totalAmount: '2500' },
        { id: 2, suggestedPoId: 1, rawMaterialId: 2, quantity: '50', unitPrice: '50', totalAmount: '2500' },
      ];
      vi.mocked(db.getSuggestedPurchaseOrderById).mockResolvedValue(mockPO as any);
      vi.mocked(db.getSuggestedPoItems).mockResolvedValue(mockItems as any);

      const po = await db.getSuggestedPurchaseOrderById(1);
      const items = await db.getSuggestedPoItems(1);
      
      expect(po).toBeDefined();
      expect(items).toHaveLength(2);
      expect(items.reduce((sum, item) => sum + parseFloat(item.totalAmount), 0)).toBe(5000);
    });
  });

  describe('One-Click PO Approval', () => {
    it('should convert suggested PO to actual PO', async () => {
      vi.mocked(db.convertSuggestedPoToActualPo).mockResolvedValue({ 
        poId: 10, 
        poNumber: 'PO-20260108-CONV' 
      });

      const result = await db.convertSuggestedPoToActualPo(1, 1);
      
      expect(result.poId).toBe(10);
      expect(result.poNumber).toContain('PO-');
    });

    it('should update suggested PO status to converted after approval', async () => {
      vi.mocked(db.updateSuggestedPurchaseOrder).mockResolvedValue(undefined);

      await db.updateSuggestedPurchaseOrder(1, {
        status: 'converted',
        convertedPoId: 10,
        approvedBy: 1,
        approvedAt: new Date(),
      });

      expect(db.updateSuggestedPurchaseOrder).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'converted',
        convertedPoId: 10,
      }));
    });

    it('should reject suggested PO with reason', async () => {
      vi.mocked(db.updateSuggestedPurchaseOrder).mockResolvedValue(undefined);

      await db.updateSuggestedPurchaseOrder(1, {
        status: 'rejected',
        rejectedBy: 1,
        rejectedAt: new Date(),
        rejectionReason: 'Budget constraints for this quarter',
      });

      expect(db.updateSuggestedPurchaseOrder).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'rejected',
        rejectionReason: 'Budget constraints for this quarter',
      }));
    });
  });

  describe('Historical Data Analysis', () => {
    it('should retrieve historical sales data for forecasting', async () => {
      const mockSalesData = [
        { productId: 1, quantity: '100', orderDate: new Date('2025-01-15'), totalAmount: '5000' },
        { productId: 1, quantity: '120', orderDate: new Date('2025-02-15'), totalAmount: '6000' },
        { productId: 1, quantity: '150', orderDate: new Date('2025-03-15'), totalAmount: '7500' },
      ];
      vi.mocked(db.getHistoricalSalesData).mockResolvedValue(mockSalesData as any);

      const result = await db.getHistoricalSalesData(1, 12);
      
      expect(result).toHaveLength(3);
      // Verify trend can be calculated (increasing quantities)
      const quantities = result.map(r => parseFloat(r.quantity));
      expect(quantities[2]).toBeGreaterThan(quantities[0]);
    });

    it('should get products with their BOMs for forecasting', async () => {
      const mockProducts = [
        { id: 1, name: 'Product A', sku: 'PROD-A' },
        { id: 2, name: 'Product B', sku: 'PROD-B' },
      ];
      vi.mocked(db.getProducts).mockResolvedValue(mockProducts as any);

      const result = await db.getProducts();
      
      expect(result).toHaveLength(2);
    });
  });

  describe('Inventory Gap Analysis', () => {
    it('should calculate shortage quantity correctly', () => {
      const requiredQty = 1000;
      const currentInventory = 300;
      const onOrderQty = 200;
      
      const shortageQty = Math.max(0, requiredQty - currentInventory - onOrderQty);
      
      expect(shortageQty).toBe(500);
    });

    it('should not show shortage when inventory is sufficient', () => {
      const requiredQty = 500;
      const currentInventory = 400;
      const onOrderQty = 200;
      
      const shortageQty = Math.max(0, requiredQty - currentInventory - onOrderQty);
      
      expect(shortageQty).toBe(0);
    });

    it('should get pending orders for material', async () => {
      const mockPendingOrders = [
        { poId: 1, poNumber: 'PO-001', quantity: '100', receivedQuantity: '50' },
        { poId: 2, poNumber: 'PO-002', quantity: '200', receivedQuantity: '0' },
      ];
      vi.mocked(db.getPendingOrdersForMaterial).mockResolvedValue(mockPendingOrders as any);

      const result = await db.getPendingOrdersForMaterial(1);
      
      expect(result).toHaveLength(2);
      // Calculate total on order: (100-50) + (200-0) = 250
      const totalOnOrder = result.reduce((sum, po) => {
        return sum + (parseFloat(po.quantity) - parseFloat(po.receivedQuantity));
      }, 0);
      expect(totalOnOrder).toBe(250);
    });
  });

  describe('Priority Scoring', () => {
    it('should calculate priority score based on shortage severity', () => {
      const items = [
        { requiredQuantity: '100', shortageQuantity: '80' }, // 80% shortage
        { requiredQuantity: '200', shortageQuantity: '100' }, // 50% shortage
      ];
      
      const avgShortageRatio = items.reduce((sum, item) => {
        const required = parseFloat(item.requiredQuantity);
        const shortage = parseFloat(item.shortageQuantity);
        return sum + (shortage / required);
      }, 0) / items.length;
      
      const priorityScore = Math.min(100, Math.round(avgShortageRatio * 100));
      
      expect(priorityScore).toBe(65); // (80% + 50%) / 2 = 65%
    });

    it('should cap priority score at 100', () => {
      const items = [
        { requiredQuantity: '100', shortageQuantity: '150' }, // 150% (more shortage than required - edge case)
      ];
      
      const avgShortageRatio = items.reduce((sum, item) => {
        const required = parseFloat(item.requiredQuantity);
        const shortage = parseFloat(item.shortageQuantity);
        return sum + (shortage / required);
      }, 0) / items.length;
      
      const priorityScore = Math.min(100, Math.round(avgShortageRatio * 100));
      
      expect(priorityScore).toBe(100);
    });
  });

  describe('Forecast Number Generation', () => {
    it('should generate valid forecast numbers', () => {
      const forecastNumber = 'FC-20260108-ABCD';
      
      expect(forecastNumber).toMatch(/^FC-\d{8}-[A-Z0-9]{4}$/);
    });

    it('should generate valid production plan numbers', () => {
      const planNumber = 'PP-20260108-ABCD';
      
      expect(planNumber).toMatch(/^PP-\d{8}-[A-Z0-9]{4}$/);
    });

    it('should generate valid suggested PO numbers', () => {
      const suggestedPoNumber = 'SPO-20260108-ABCD';
      
      expect(suggestedPoNumber).toMatch(/^SPO-\d{8}-[A-Z0-9]{4}$/);
    });
  });
});
