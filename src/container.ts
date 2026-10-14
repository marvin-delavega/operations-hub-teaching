import { GetAppSettingUseCase } from "@/admin/application/GetAppSettingUseCase";
import { UpdateAppSettingUseCase } from "@/admin/application/UpdateAppSettingUseCase";
import { GetLocationPresenceFiltersUseCase } from "@/admin/application/GetLocationPresenceFiltersUseCase";
import { SetLocationPresenceFilterUseCase } from "@/admin/application/SetLocationPresenceFilterUseCase";
import { MySQLAppSettingsRepository } from "@/admin/infrastructure/MySQLAppSettingsRepository";
import { GetReplenishmentGroupsUseCase } from "@/replenishment/application/GetReplenishmentGroupsUseCase";
import { GetStockoutCandidatesUseCase } from "@/replenishment/application/GetStockoutCandidatesUseCase";
import { MySQLStockoutRepository } from "@/replenishment/infrastructure/MySQLStockoutRepository";
import { CreatePurchaseOrdersUseCase } from "@/replenishment/application/CreatePurchaseOrdersUseCase";
import { SaveReplenishmentDraftUseCase } from "@/replenishment/application/SaveReplenishmentDraftUseCase";
import { ApproveReplenishmentDraftUseCase } from "@/replenishment/application/ApproveReplenishmentDraftUseCase";
import { GetReplenishmentSummaryUseCase } from "@/replenishment/application/GetReplenishmentSummaryUseCase";
import { RecomputeReplenishmentSummaryUseCase } from "@/replenishment/application/RecomputeReplenishmentSummaryUseCase";
import { RefreshSalesRollupUseCase } from "@/replenishment/application/RefreshSalesRollupUseCase";
import { RebuildSalesRollupUseCase } from "@/replenishment/application/RebuildSalesRollupUseCase";
import { GetSalesRollupHealthUseCase } from "@/replenishment/application/GetSalesRollupHealthUseCase";
import { MySQLReplenishmentRepository } from "@/replenishment/infrastructure/MySQLReplenishmentRepository";
import { MySQLPurchaseOrderRepository } from "@/replenishment/infrastructure/MySQLPurchaseOrderRepository";
import { MySQLReplenishmentSummaryRepository } from "@/replenishment/infrastructure/MySQLReplenishmentSummaryRepository";
import { MySQLSalesRollupRepository } from "@/replenishment/infrastructure/MySQLSalesRollupRepository";
import { GetOpenPurchaseOrdersUseCase } from "@/delivery/application/GetOpenPurchaseOrdersUseCase";
import { GetPurchaseOrderForReceivingUseCase } from "@/delivery/application/GetPurchaseOrderForReceivingUseCase";
import { GetMasterlistUseCase } from "@/delivery/application/GetMasterlistUseCase";
import { CommitDeliveryUseCase } from "@/delivery/application/CommitDeliveryUseCase";
import { RefreshItemCacheUseCase } from "@/delivery/application/RefreshItemCacheUseCase";
import { MySQLDeliveryRepository } from "@/delivery/infrastructure/MySQLDeliveryRepository";
import { MySQLDeliverySettings } from "@/delivery/infrastructure/MySQLDeliverySettings";
import { MySQLItemMasterCacheRepository } from "@/delivery/infrastructure/MySQLItemMasterCacheRepository";
import { GetCountableItemsUseCase } from "@/counting/application/GetCountableItemsUseCase";
import { GetCounterGateUseCase } from "@/counting/application/GetCounterGateUseCase";
import { CommitCountUseCase } from "@/counting/application/CommitCountUseCase";
import { MySQLCountRepository } from "@/counting/infrastructure/MySQLCountRepository";
import { GetInvoicesUseCase } from "@/invoice/application/GetInvoicesUseCase";
import { MySQLInvoiceRepository } from "@/invoice/infrastructure/MySQLInvoiceRepository";
import { GetTransfersUseCase } from "@/transfer/application/GetTransfersUseCase";
import { MySQLTransferRepository } from "@/transfer/infrastructure/MySQLTransferRepository";
import { ListReplenishmentHistoryUseCase } from "@/history/application/ListReplenishmentHistoryUseCase";
import { CountPendingReplenishmentDraftsUseCase } from "@/history/application/CountPendingReplenishmentDraftsUseCase";
import { GetReplenishmentRunDetailUseCase } from "@/history/application/GetReplenishmentRunDetailUseCase";
import { DeleteReplenishmentRunUseCase } from "@/history/application/DeleteReplenishmentRunUseCase";
import { DeleteDraftReplenishmentRunUseCase } from "@/history/application/DeleteDraftReplenishmentRunUseCase";
import { UpdateReplenishmentDraftQuantitiesUseCase } from "@/history/application/UpdateReplenishmentDraftQuantitiesUseCase";
import { ListDeliveryHistoryUseCase } from "@/history/application/ListDeliveryHistoryUseCase";
import { GetDeliverySessionDetailUseCase } from "@/history/application/GetDeliverySessionDetailUseCase";
import { MySQLReplenishmentHistoryRepository } from "@/history/infrastructure/MySQLReplenishmentHistoryRepository";
import { MySQLDeliveryHistoryRepository } from "@/history/infrastructure/MySQLDeliveryHistoryRepository";
import { GetUsersUseCase } from "@/admin/application/GetUsersUseCase";
import { CreateUserUseCase } from "@/admin/application/CreateUserUseCase";
import { UpdateUserUseCase } from "@/admin/application/UpdateUserUseCase";
import { ResetUserPasswordUseCase } from "@/admin/application/ResetUserPasswordUseCase";
import { SetUserActiveUseCase } from "@/admin/application/SetUserActiveUseCase";
import { SearchEmployeesUseCase } from "@/admin/application/SearchEmployeesUseCase";
import { SearchActiveOneUsersUseCase } from "@/admin/application/SearchActiveOneUsersUseCase";
import { MySQLUserRepository } from "@/admin/infrastructure/MySQLUserRepository";
import { GetRolesUseCase } from "@/admin/application/GetRolesUseCase";
import { CreateRoleUseCase } from "@/admin/application/CreateRoleUseCase";
import { UpdateRoleUseCase } from "@/admin/application/UpdateRoleUseCase";
import { DeleteRoleUseCase } from "@/admin/application/DeleteRoleUseCase";
import { GetRoleMembersUseCase } from "@/admin/application/GetRoleMembersUseCase";
import { SetRoleMembersUseCase } from "@/admin/application/SetRoleMembersUseCase";
import { MySQLRoleRepository } from "@/admin/infrastructure/MySQLRoleRepository";
import { MySQLEmployeeDirectory } from "@/admin/infrastructure/MySQLEmployeeDirectory";
import { MySQLActiveOneUserDirectory } from "@/admin/infrastructure/MySQLActiveOneUserDirectory";
import { ChangeOwnPasswordUseCase } from "@/account/application/ChangeOwnPasswordUseCase";
import { MySQLAccountRepository } from "@/account/infrastructure/MySQLAccountRepository";
import { GetLocationsUseCase } from "@/location/application/GetLocationsUseCase";
import { GetLocationByIdUseCase } from "@/location/application/GetLocationByIdUseCase";
import { SetLocationVisibilityUseCase } from "@/location/application/SetLocationVisibilityUseCase";
import { MySQLLocationRepository } from "@/location/infrastructure/MySQLLocationRepository";
import { MySQLLocationVisibilityRepository } from "@/location/infrastructure/MySQLLocationVisibilityRepository";
import { GetManufacturersForSuppliersUseCase } from "@/manufacturer/application/GetManufacturersForSuppliersUseCase";
import { MySQLManufacturerRepository } from "@/manufacturer/infrastructure/MySQLManufacturerRepository";
import { GetSupplierDueStatusesUseCase } from "@/shared/application/GetSupplierDueStatusesUseCase";
import { MarkSuppliersOrderedUseCase } from "@/shared/application/MarkSuppliersOrderedUseCase";
import { GetSupplierSchedulesUseCase } from "@/admin/application/GetSupplierSchedulesUseCase";
import { UpdateSupplierScheduleUseCase } from "@/admin/application/UpdateSupplierScheduleUseCase";
import { SetSupplierMinimumUseCase } from "@/admin/application/SetSupplierMinimumUseCase";
import { MySQLSupplierScheduleRepository } from "@/shared/infrastructure/MySQLSupplierScheduleRepository";
import { GetRollupScheduleStatusUseCase } from "@/admin/application/GetRollupScheduleStatusUseCase";
import { InstallRollupScheduleUseCase } from "@/admin/application/InstallRollupScheduleUseCase";
import { WindowsTaskSchedulerAdapter } from "@/admin/infrastructure/WindowsTaskSchedulerAdapter";
import { GetSellingAreaMappingsUseCase } from "@/admin/application/GetSellingAreaMappingsUseCase";
import { SaveSellingAreaMappingUseCase } from "@/admin/application/SaveSellingAreaMappingUseCase";
import { RemoveSellingAreaMappingUseCase } from "@/admin/application/RemoveSellingAreaMappingUseCase";
import { MySQLSellingAreaMapRepository } from "@/shared/infrastructure/MySQLSellingAreaMapRepository";
import { GetSetupStatusUseCase } from "@/setup/application/GetSetupStatusUseCase";
import { AdvanceSetupProgressUseCase } from "@/setup/application/AdvanceSetupProgressUseCase";
import { FinishSetupUseCase } from "@/setup/application/FinishSetupUseCase";
import { ResetSetupUseCase } from "@/setup/application/ResetSetupUseCase";
import { MySQLSetupStateRepository } from "@/setup/infrastructure/MySQLSetupStateRepository";
import { MySQLSetupAdminVerifier } from "@/setup/infrastructure/MySQLSetupAdminVerifier";
import { GetDbConfigUseCase } from "@/shared/application/GetDbConfigUseCase";
import { SaveDbConfigUseCase } from "@/shared/application/SaveDbConfigUseCase";
import { TestDbConnectionUseCase } from "@/shared/application/TestDbConnectionUseCase";
import { FileDbConfigStore } from "@/shared/infrastructure/FileDbConfigStore";
import { MySQLDbConnectionTester } from "@/shared/infrastructure/MySQLDbConnectionTester";
import { GetShelfGuideOverviewUseCase } from "@/shelfguide/application/GetShelfGuideOverviewUseCase";
import { GetShelfGuideDetailUseCase } from "@/shelfguide/application/GetShelfGuideDetailUseCase";
import { GetShelfGuideDefaultLocationUseCase } from "@/shelfguide/application/GetShelfGuideDefaultLocationUseCase";
import { MySQLShelfGuideRepository } from "@/shelfguide/infrastructure/MySQLShelfGuideRepository";

export function createGetReplenishmentGroupsUseCase(): GetReplenishmentGroupsUseCase {
  return new GetReplenishmentGroupsUseCase(
    new MySQLReplenishmentRepository(),
    new MySQLSellingAreaMapRepository(),
    new MySQLSalesRollupRepository(),
  );
}

export function createGetStockoutCandidatesUseCase(): GetStockoutCandidatesUseCase {
  return new GetStockoutCandidatesUseCase(new MySQLStockoutRepository());
}

export function createRefreshSalesRollupUseCase(windowDays: number): RefreshSalesRollupUseCase {
  return new RefreshSalesRollupUseCase(new MySQLSalesRollupRepository(), windowDays);
}

export function createRebuildSalesRollupUseCase(): RebuildSalesRollupUseCase {
  return new RebuildSalesRollupUseCase(new MySQLSalesRollupRepository());
}

export function createGetSalesRollupHealthUseCase(): GetSalesRollupHealthUseCase {
  return new GetSalesRollupHealthUseCase(new MySQLSalesRollupRepository());
}

export function createCreatePurchaseOrdersUseCase(): CreatePurchaseOrdersUseCase {
  return new CreatePurchaseOrdersUseCase(new MySQLPurchaseOrderRepository());
}

export function createSaveReplenishmentDraftUseCase(): SaveReplenishmentDraftUseCase {
  return new SaveReplenishmentDraftUseCase(new MySQLPurchaseOrderRepository());
}

export function createApproveReplenishmentDraftUseCase(): ApproveReplenishmentDraftUseCase {
  return new ApproveReplenishmentDraftUseCase(
    new MySQLReplenishmentHistoryRepository(),
    new MySQLPurchaseOrderRepository(),
  );
}

export function createCountPendingReplenishmentDraftsUseCase(): CountPendingReplenishmentDraftsUseCase {
  return new CountPendingReplenishmentDraftsUseCase(new MySQLReplenishmentHistoryRepository());
}

export function createGetOpenPurchaseOrdersUseCase(): GetOpenPurchaseOrdersUseCase {
  return new GetOpenPurchaseOrdersUseCase(new MySQLDeliveryRepository());
}

export function createGetPurchaseOrderForReceivingUseCase(): GetPurchaseOrderForReceivingUseCase {
  return new GetPurchaseOrderForReceivingUseCase(new MySQLDeliveryRepository());
}

export function createCommitDeliveryUseCase(): CommitDeliveryUseCase {
  return new CommitDeliveryUseCase(new MySQLDeliveryRepository(), new MySQLDeliverySettings());
}

export function createGetMasterlistUseCase(): GetMasterlistUseCase {
  return new GetMasterlistUseCase(new MySQLItemMasterCacheRepository());
}

export function createRefreshItemCacheUseCase(): RefreshItemCacheUseCase {
  return new RefreshItemCacheUseCase(new MySQLItemMasterCacheRepository());
}

export function createGetCountableItemsUseCase(): GetCountableItemsUseCase {
  return new GetCountableItemsUseCase(new MySQLCountRepository());
}

export function createGetCounterGateUseCase(): GetCounterGateUseCase {
  return new GetCounterGateUseCase(new MySQLCountRepository());
}

export function createCommitCountUseCase(): CommitCountUseCase {
  return new CommitCountUseCase(new MySQLCountRepository());
}

export function createGetInvoicesUseCase(): GetInvoicesUseCase {
  return new GetInvoicesUseCase(new MySQLInvoiceRepository());
}

export function createGetTransfersUseCase(): GetTransfersUseCase {
  return new GetTransfersUseCase(new MySQLTransferRepository());
}

export function createListReplenishmentHistoryUseCase(): ListReplenishmentHistoryUseCase {
  return new ListReplenishmentHistoryUseCase(new MySQLReplenishmentHistoryRepository());
}

export function createGetReplenishmentRunDetailUseCase(): GetReplenishmentRunDetailUseCase {
  return new GetReplenishmentRunDetailUseCase(new MySQLReplenishmentHistoryRepository());
}

export function createDeleteReplenishmentRunUseCase(): DeleteReplenishmentRunUseCase {
  return new DeleteReplenishmentRunUseCase(new MySQLReplenishmentHistoryRepository());
}

export function createDeleteDraftReplenishmentRunUseCase(): DeleteDraftReplenishmentRunUseCase {
  return new DeleteDraftReplenishmentRunUseCase(new MySQLReplenishmentHistoryRepository());
}

export function createUpdateReplenishmentDraftQuantitiesUseCase(): UpdateReplenishmentDraftQuantitiesUseCase {
  return new UpdateReplenishmentDraftQuantitiesUseCase(new MySQLReplenishmentHistoryRepository());
}

export function createListDeliveryHistoryUseCase(): ListDeliveryHistoryUseCase {
  return new ListDeliveryHistoryUseCase(new MySQLDeliveryHistoryRepository());
}

export function createGetDeliverySessionDetailUseCase(): GetDeliverySessionDetailUseCase {
  return new GetDeliverySessionDetailUseCase(new MySQLDeliveryHistoryRepository());
}

export function createGetUsersUseCase(): GetUsersUseCase {
  return new GetUsersUseCase(
    new MySQLUserRepository(),
    new MySQLEmployeeDirectory(),
    new MySQLActiveOneUserDirectory(),
  );
}

export function createCreateUserUseCase(): CreateUserUseCase {
  return new CreateUserUseCase(new MySQLUserRepository());
}

export function createUpdateUserUseCase(): UpdateUserUseCase {
  return new UpdateUserUseCase(new MySQLUserRepository());
}

export function createResetUserPasswordUseCase(): ResetUserPasswordUseCase {
  return new ResetUserPasswordUseCase(new MySQLUserRepository());
}

export function createSetUserActiveUseCase(): SetUserActiveUseCase {
  return new SetUserActiveUseCase(new MySQLUserRepository());
}

export function createSearchEmployeesUseCase(): SearchEmployeesUseCase {
  return new SearchEmployeesUseCase(new MySQLEmployeeDirectory());
}

export function createSearchActiveOneUsersUseCase(): SearchActiveOneUsersUseCase {
  return new SearchActiveOneUsersUseCase(new MySQLActiveOneUserDirectory());
}

export function createGetRolesUseCase(): GetRolesUseCase {
  return new GetRolesUseCase(new MySQLRoleRepository());
}

export function createCreateRoleUseCase(): CreateRoleUseCase {
  return new CreateRoleUseCase(new MySQLRoleRepository());
}

export function createUpdateRoleUseCase(): UpdateRoleUseCase {
  return new UpdateRoleUseCase(new MySQLRoleRepository());
}

export function createDeleteRoleUseCase(): DeleteRoleUseCase {
  return new DeleteRoleUseCase(new MySQLRoleRepository());
}

export function createGetRoleMembersUseCase(): GetRoleMembersUseCase {
  return new GetRoleMembersUseCase(new MySQLRoleRepository());
}

export function createSetRoleMembersUseCase(): SetRoleMembersUseCase {
  return new SetRoleMembersUseCase(new MySQLRoleRepository(), new MySQLUserRepository());
}

export function createChangeOwnPasswordUseCase(): ChangeOwnPasswordUseCase {
  return new ChangeOwnPasswordUseCase(new MySQLAccountRepository());
}

export function createGetLocationsUseCase(): GetLocationsUseCase {
  return new GetLocationsUseCase(new MySQLLocationRepository(), new MySQLSellingAreaMapRepository());
}

export function createGetLocationByIdUseCase(): GetLocationByIdUseCase {
  return new GetLocationByIdUseCase(new MySQLLocationRepository());
}

export function createSetLocationVisibilityUseCase(): SetLocationVisibilityUseCase {
  return new SetLocationVisibilityUseCase(new MySQLLocationVisibilityRepository());
}

export function createGetManufacturersForSuppliersUseCase(): GetManufacturersForSuppliersUseCase {
  return new GetManufacturersForSuppliersUseCase(new MySQLManufacturerRepository());
}

export function createGetSupplierDueStatusesUseCase(): GetSupplierDueStatusesUseCase {
  return new GetSupplierDueStatusesUseCase(new MySQLSupplierScheduleRepository());
}

export function createMarkSuppliersOrderedUseCase(): MarkSuppliersOrderedUseCase {
  return new MarkSuppliersOrderedUseCase(new MySQLSupplierScheduleRepository());
}

export function createGetSupplierSchedulesUseCase(): GetSupplierSchedulesUseCase {
  return new GetSupplierSchedulesUseCase(new MySQLSupplierScheduleRepository());
}

export function createUpdateSupplierScheduleUseCase(): UpdateSupplierScheduleUseCase {
  return new UpdateSupplierScheduleUseCase(new MySQLSupplierScheduleRepository());
}

export function createSetSupplierMinimumUseCase(): SetSupplierMinimumUseCase {
  return new SetSupplierMinimumUseCase(new MySQLSupplierScheduleRepository());
}

export function createGetAppSettingUseCase(): GetAppSettingUseCase {
  return new GetAppSettingUseCase(new MySQLAppSettingsRepository());
}

export function createUpdateAppSettingUseCase(): UpdateAppSettingUseCase {
  return new UpdateAppSettingUseCase(new MySQLAppSettingsRepository());
}

export function createGetLocationPresenceFiltersUseCase(): GetLocationPresenceFiltersUseCase {
  return new GetLocationPresenceFiltersUseCase(new MySQLAppSettingsRepository());
}

export function createSetLocationPresenceFilterUseCase(): SetLocationPresenceFilterUseCase {
  return new SetLocationPresenceFilterUseCase(new MySQLAppSettingsRepository());
}

export function createGetRollupScheduleStatusUseCase(): GetRollupScheduleStatusUseCase {
  return new GetRollupScheduleStatusUseCase(
    new WindowsTaskSchedulerAdapter(),
    new MySQLAppSettingsRepository(),
  );
}

export function createInstallRollupScheduleUseCase(): InstallRollupScheduleUseCase {
  return new InstallRollupScheduleUseCase(
    new WindowsTaskSchedulerAdapter(),
    new MySQLAppSettingsRepository(),
  );
}

export function createGetSellingAreaMappingsUseCase(): GetSellingAreaMappingsUseCase {
  return new GetSellingAreaMappingsUseCase(new MySQLSellingAreaMapRepository());
}

export function createSaveSellingAreaMappingUseCase(): SaveSellingAreaMappingUseCase {
  return new SaveSellingAreaMappingUseCase(new MySQLSellingAreaMapRepository());
}

export function createRemoveSellingAreaMappingUseCase(): RemoveSellingAreaMappingUseCase {
  return new RemoveSellingAreaMappingUseCase(new MySQLSellingAreaMapRepository());
}

export function createGetReplenishmentSummaryUseCase(): GetReplenishmentSummaryUseCase {
  return new GetReplenishmentSummaryUseCase(new MySQLReplenishmentSummaryRepository(new MySQLSalesRollupRepository()));
}

export function createRecomputeReplenishmentSummaryUseCase(): RecomputeReplenishmentSummaryUseCase {
  return new RecomputeReplenishmentSummaryUseCase(new MySQLReplenishmentSummaryRepository(new MySQLSalesRollupRepository()));
}

export function createGetSetupStatusUseCase(): GetSetupStatusUseCase {
  return new GetSetupStatusUseCase(new MySQLSetupStateRepository());
}

export function createAdvanceSetupProgressUseCase(): AdvanceSetupProgressUseCase {
  return new AdvanceSetupProgressUseCase(new MySQLSetupStateRepository());
}

export function createFinishSetupUseCase(): FinishSetupUseCase {
  return new FinishSetupUseCase(new MySQLSetupStateRepository());
}

export function createResetSetupUseCase(): ResetSetupUseCase {
  return new ResetSetupUseCase(new MySQLSetupStateRepository(), new MySQLSetupAdminVerifier());
}

export function createGetDbConfigUseCase(): GetDbConfigUseCase {
  return new GetDbConfigUseCase(new FileDbConfigStore());
}

export function createSaveDbConfigUseCase(): SaveDbConfigUseCase {
  return new SaveDbConfigUseCase(new FileDbConfigStore(), new MySQLDbConnectionTester());
}

export function createTestDbConnectionUseCase(): TestDbConnectionUseCase {
  return new TestDbConnectionUseCase(new FileDbConfigStore(), new MySQLDbConnectionTester());
}

export function createGetShelfGuideOverviewUseCase(): GetShelfGuideOverviewUseCase {
  return new GetShelfGuideOverviewUseCase(
    new MySQLShelfGuideRepository(),
    new MySQLSalesRollupRepository(),
  );
}

export function createGetShelfGuideDetailUseCase(): GetShelfGuideDetailUseCase {
  return new GetShelfGuideDetailUseCase(
    new MySQLShelfGuideRepository(),
    new MySQLSalesRollupRepository(),
  );
}

export function createGetShelfGuideDefaultLocationUseCase(): GetShelfGuideDefaultLocationUseCase {
  return new GetShelfGuideDefaultLocationUseCase(new MySQLShelfGuideRepository());
}
