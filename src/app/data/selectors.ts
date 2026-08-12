import {
  careSites,
  compliancePackets,
  getIncidentDetailById,
  getWorkerByIdFromStore,
  incidents,
  shifts,
  supportTickets,
} from './mockData';
import type { CareSite, CompliancePacket, Incident, Shift, SupportTicket, Worker } from './types';

export function getWorkerById(id: string): Worker | undefined {
  return getWorkerByIdFromStore(id);
}

export function getShiftById(id: string): Shift | undefined {
  return shifts.find(s => s.id === id);
}

export function getSiteById(id: string): CareSite | undefined {
  return careSites.find(s => s.id === id);
}

export function getIncidentById(id: string): Incident | undefined {
  return incidents.find(i => i.id === id);
}

export { getIncidentDetailById };

export function getShiftsBySite(siteId: string): Shift[] {
  return shifts.filter(s => s.siteId === siteId);
}

export function getShiftsByWorker(workerId: string): Shift[] {
  return shifts.filter(s => s.assignedWorkerId === workerId);
}

export function getCompliancePacketsBySite(siteId: string): CompliancePacket[] {
  return compliancePackets.filter(p => p.siteId === siteId);
}

export function getSupportTicketsByRequester(requesterId: string): SupportTicket[] {
  return supportTickets.filter(t => t.requesterId === requesterId);
}

export function getProviderSites(providerOrgId: string): CareSite[] {
  return careSites.filter(s => s.providerOrgId === providerOrgId);
}

export {
  careSites,
  compliancePackets,
  incidents,
  paymentMetricCards,
  paymentRecords,
  providerOrganizations,
  shifts,
  supportTickets,
  workers,
  adminMetrics,
  adminShiftOperations,
  getUrgentMarketplaceShifts,
  getWorkerFeedShifts,
  siteOperationalDetails,
  ACTIVE_PREVIEW_SHIFT_ID,
} from './mockData';
