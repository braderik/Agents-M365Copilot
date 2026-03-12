/**
 * Dynamics 365 Finance & Operations type definitions
 */

// ─── Configuration ────────────────────────────────────────────────────────────

export interface D365Config {
  /** Azure AD tenant ID */
  tenantId: string;
  /** Azure AD app registration client ID */
  clientId: string;
  /** Azure AD app registration client secret */
  clientSecret: string;
  /** D365 F&O base URL, e.g. https://myorg.operations.dynamics.com */
  baseUrl: string;
  /** Optional: legal entity / company, e.g. USMF */
  defaultCompany?: string;
  /** Request timeout in ms (default 30000) */
  timeoutMs?: number;
  /** Max retries on transient errors (default 3) */
  maxRetries?: number;
}

// ─── OData primitives ─────────────────────────────────────────────────────────

export interface ODataResponse<T> {
  "@odata.context"?: string;
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
  value: T[];
}

export interface ODataSingleResponse<T> extends Omit<ODataResponse<T>, "value"> {
  value?: never;
  [key: string]: unknown;
}

export interface QueryOptions {
  /** OData $filter expression */
  filter?: string;
  /** OData $select fields (comma-separated or array) */
  select?: string | string[];
  /** OData $expand navigations */
  expand?: string | string[];
  /** OData $orderby */
  orderBy?: string;
  /** OData $top – number of records to return (max 10000) */
  top?: number;
  /** OData $skip – records to skip for pagination */
  skip?: number;
  /** Cross-company query */
  crossCompany?: boolean;
  /** Legal entity override */
  dataAreaId?: string;
}

export interface BatchQueryOptions extends QueryOptions {
  /** Entity set name, e.g. "SalesOrderHeaders" */
  entitySet: string;
}

// ─── Finance & General Ledger ─────────────────────────────────────────────────

export interface LedgerAccount {
  MainAccountId: string;
  Name: string;
  Type: string;
  AccountType: string;
  IsBlocked: boolean;
  DefaultCurrency: string;
  Description: string;
}

export interface JournalEntry {
  JournalBatchNumber: string;
  Voucher: string;
  Date: string;
  AccountType: string;
  AccountDisplayValue: string;
  Description: string;
  CurrencyCode: string;
  AmountCurrencyDebit: number;
  AmountCurrencyCredit: number;
  PostingLayer: string;
}

export interface TrialBalance {
  MainAccountId: string;
  Name: string;
  OpeningBalance: number;
  Debit: number;
  Credit: number;
  ClosingBalance: number;
  CurrencyCode: string;
}

export interface FinancialDimension {
  DimensionAttributeId: string;
  Name: string;
  Description: string;
  Values: string[];
}

// ─── Accounts Payable ─────────────────────────────────────────────────────────

export interface Vendor {
  VendorAccountNumber: string;
  VendorName: string;
  VendorGroupId: string;
  CurrencyCode: string;
  AddressCity: string;
  AddressCountryRegionId: string;
  Phone: string;
  Email: string;
  PaymentTermsName: string;
  PaymentMethodName: string;
  OnHoldStatus: string;
  DataAreaId: string;
}

export interface VendorInvoice {
  InvoiceNumber: string;
  InvoiceDate: string;
  DueDate: string;
  VendorAccountNumber: string;
  VendorName: string;
  InvoiceAmount: number;
  CurrencyCode: string;
  PaymentStatus: string;
  DataAreaId: string;
}

export interface VendorPayment {
  JournalNumber: string;
  VendorAccountNumber: string;
  PaymentDate: string;
  AmountPaid: number;
  CurrencyCode: string;
  PaymentMethod: string;
  TransactionStatus: string;
}

// ─── Accounts Receivable ──────────────────────────────────────────────────────

export interface Customer {
  CustomerAccountNumber: string;
  CustomerName: string;
  CustomerGroupId: string;
  CurrencyCode: string;
  CreditLimit: number;
  AddressCity: string;
  AddressCountryRegionId: string;
  Phone: string;
  Email: string;
  PaymentTermsName: string;
  DataAreaId: string;
}

export interface CustomerInvoice {
  InvoiceId: string;
  InvoiceDate: string;
  DueDate: string;
  CustomerAccountNumber: string;
  CustomerName: string;
  InvoiceAmount: number;
  RemainingAmount: number;
  CurrencyCode: string;
  PaymentStatus: string;
  DataAreaId: string;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryItem {
  ItemNumber: string;
  ProductName: string;
  SearchName: string;
  ItemType: string;
  ProductType: string;
  UnitId: string;
  PurchaseUnitSymbol: string;
  SalesUnitSymbol: string;
  InventoryUnitSymbol: string;
  PrimaryVendorAccountNumber: string;
  DataAreaId: string;
}

export interface InventoryOnHand {
  ItemNumber: string;
  ProductName: string;
  WarehouseId: string;
  SiteId: string;
  AvailableOrderedQuantity: number;
  AvailablePhysicalQuantity: number;
  PhysicalInventoryQuantity: number;
  ReservedPhysicalQuantity: number;
  UnitId: string;
  DataAreaId: string;
}

export interface Warehouse {
  WarehouseId: string;
  WarehouseName: string;
  SiteId: string;
  WarehouseType: string;
  IsDefaultReceiptWarehouse: boolean;
  IsDefaultIssueWarehouse: boolean;
  DataAreaId: string;
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export interface PurchaseOrder {
  PurchaseOrderNumber: string;
  VendorAccountNumber: string;
  VendorName: string;
  PurchaseOrderStatus: string;
  DocumentDate: string;
  DeliveryDate: string;
  TotalInvoiceAmount: number;
  CurrencyCode: string;
  PurchaserPersonnelNumber: string;
  DataAreaId: string;
}

export interface PurchaseOrderLine {
  PurchaseOrderNumber: string;
  LineNumber: number;
  ItemNumber: string;
  ProductName: string;
  PurchaseQuantity: number;
  PurchasePrice: number;
  LineAmount: number;
  CurrencyCode: string;
  PurchaseUnitSymbol: string;
  ReceivingWarehouseId: string;
  ConfirmedDeliveryDate: string;
  PurchaseOrderLineStatus: string;
}

export interface VendorPurchaseRequisition {
  RequisitionNumber: string;
  RequisitionStatus: string;
  RequestDate: string;
  RequiredDate: string;
  RequestingWorkerName: string;
  TotalAmount: number;
  CurrencyCode: string;
  DataAreaId: string;
}

// ─── Sales Orders ─────────────────────────────────────────────────────────────

export interface SalesOrder {
  SalesOrderNumber: string;
  CustomerAccountNumber: string;
  CustomerName: string;
  SalesOrderStatus: string;
  RequestedShippingDate: string;
  OrderTotalAmount: number;
  CurrencyCode: string;
  SalesPersonnelNumber: string;
  SiteId: string;
  WarehouseId: string;
  DataAreaId: string;
}

export interface SalesOrderLine {
  SalesOrderNumber: string;
  LineCreationSequenceNumber: number;
  ItemNumber: string;
  ProductName: string;
  SalesQuantity: number;
  SalesPrice: number;
  LineAmount: number;
  CurrencyCode: string;
  SalesUnitSymbol: string;
  ShippingWarehouseId: string;
  RequestedShippingDate: string;
  SalesOrderLineStatus: string;
}

export interface SalesQuotation {
  QuotationId: string;
  CustomerAccountNumber: string;
  CustomerName: string;
  QuotationStatus: string;
  ExpiryDate: string;
  TotalAmount: number;
  CurrencyCode: string;
  DataAreaId: string;
}

// ─── Fixed Assets ─────────────────────────────────────────────────────────────

export interface FixedAsset {
  FixedAssetNumber: string;
  Name: string;
  AssetGroupId: string;
  AssetType: string;
  AcquisitionDate: string;
  AcquisitionPrice: number;
  BookValue: number;
  DepreciationMethod: string;
  ServiceLife: number;
  ResponsibleWorkerPersonnelNumber: string;
  LocationId: string;
  DataAreaId: string;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  ProjectId: string;
  Name: string;
  Description: string;
  ProjectType: string;
  ProjectStatus: string;
  CustomerAccountNumber: string;
  StartDate: string;
  EndDate: string;
  ContractId: string;
  ProjectManagerPersonnelNumber: string;
  DataAreaId: string;
}

export interface ProjectTransaction {
  ProjectId: string;
  TransactionDate: string;
  TransactionType: string;
  WorkerPersonnelNumber: string;
  CategoryId: string;
  Quantity: number;
  SalesAmount: number;
  CostAmount: number;
  CurrencyCode: string;
}

// ─── Human Resources ──────────────────────────────────────────────────────────

export interface Worker {
  PersonnelNumber: string;
  Name: string;
  WorkerType: string;
  PrimaryDepartmentId: string;
  PrimaryPositionId: string;
  EmploymentStartDate: string;
  EmploymentEndDate?: string;
  CompanyId: string;
}

export interface Department {
  DepartmentNumber: string;
  Name: string;
  ManagerPersonnelNumber: string;
  OmOperatingUnitNumber: string;
}

export interface Position {
  PositionId: string;
  Description: string;
  DepartmentNumber: string;
  JobId: string;
  WorkerAssignedPersonnelNumber?: string;
  ActivationDate: string;
  RetirementDate?: string;
  FullTimeEquivalent: number;
}

// ─── Bank ─────────────────────────────────────────────────────────────────────

export interface BankAccount {
  BankAccountId: string;
  Name: string;
  BankAccountNumber: string;
  IBAN: string;
  CurrencyCode: string;
  BankName: string;
  BankGroupId: string;
  DataAreaId: string;
}

export interface BankTransaction {
  AccountNumber: string;
  TransactionDate: string;
  TransactionType: string;
  DocumentNumber: string;
  Description: string;
  Amount: number;
  CurrencyCode: string;
}

// ─── Tax ──────────────────────────────────────────────────────────────────────

export interface SalesTaxCode {
  TaxCode: string;
  TaxName: string;
  TaxType: string;
  TaxRate: number;
  SettlementPeriod: string;
  DataAreaId: string;
}

// ─── Generic entity result ────────────────────────────────────────────────────

export interface EntityQueryResult {
  entitySet: string;
  count: number;
  data: Record<string, unknown>[];
  nextLink?: string;
}

// ─── Tool argument schemas (used with Zod) ────────────────────────────────────

export interface QueryEntityArgs {
  entitySet: string;
  filter?: string;
  select?: string;
  expand?: string;
  orderBy?: string;
  top?: number;
  skip?: number;
  crossCompany?: boolean;
  dataAreaId?: string;
}

export interface GetByKeyArgs {
  entitySet: string;
  key: string | Record<string, string>;
  select?: string;
  expand?: string;
}

export interface BatchRequestArgs {
  requests: BatchQueryOptions[];
}

// ─── Error types ──────────────────────────────────────────────────────────────

export interface D365Error {
  error: {
    code: string;
    message: string;
    innerError?: unknown;
  };
}
