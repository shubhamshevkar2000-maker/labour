import { db } from '../db/sqlite';
import { v4 as uuidv4 } from 'uuid';
import { Engagement, PriceOffer, Dispute, EngagementStatus, EngagementMode } from 'shared-types';

export class EngagementRepository {
  static create(data: {
    request_id: string;
    mode: EngagementMode;
    initiator_id: string;
    counterparty_id: string;
    parent_engagement_id: string | null;
    status: EngagementStatus;
  }): Engagement {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO engagements (id, request_id, mode, initiator_id, counterparty_id, parent_engagement_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.request_id,
      data.mode,
      data.initiator_id,
      data.counterparty_id,
      data.parent_engagement_id || null,
      data.status,
      now,
      now
    );

    return this.findById(id)!;
  }

  static findById(id: string): Engagement | null {
    const row = db.prepare('SELECT * FROM engagements WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      request_id: row.request_id,
      mode: row.mode,
      initiator_id: row.initiator_id,
      counterparty_id: row.counterparty_id,
      parent_engagement_id: row.parent_engagement_id,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  static updateStatus(id: string, status: EngagementStatus): Engagement {
    const now = new Date().toISOString();
    db.prepare('UPDATE engagements SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
    return this.findById(id)!;
  }

  static findAll(filters: {
    userId?: string;
    role?: string;
    status?: EngagementStatus;
    parent_engagement_id?: string | null;
  }): any[] {
    // 1. Fetch all engagements using simple SELECT
    const allEngs = db.prepare('SELECT * FROM engagements').all() as any[];
    
    // 2. Filter in application layer
    let filtered = allEngs;

    if (filters.userId) {
      filtered = filtered.filter(e => e.initiator_id === filters.userId || e.counterparty_id === filters.userId);
    }

    if (filters.status) {
      filtered = filtered.filter(e => e.status === filters.status);
    }

    if (filters.parent_engagement_id !== undefined) {
      filtered = filtered.filter(e => e.parent_engagement_id === (filters.parent_engagement_id || null));
    }

    // 3. Map relations
    return filtered.map(e => {
      const sr = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(e.request_id) as any;
      const ui = db.prepare('SELECT * FROM users WHERE id = ?').get(e.initiator_id) as any;
      const uc = db.prepare('SELECT * FROM users WHERE id = ?').get(e.counterparty_id) as any;

      return {
        ...e,
        parent_engagement_id: e.parent_engagement_id || null,
        request_text: sr?.raw_text || 'Service Request',
        initiator_name: ui?.full_name || 'User',
        counterparty_name: uc?.full_name || 'User'
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  // --- PRICE OFFERS ---
  static createPriceOffer(data: {
    engagement_id: string;
    offered_by: string;
    amount: number;
    note?: string | null;
  }): PriceOffer {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO price_offers (id, engagement_id, offered_by, amount, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.engagement_id,
      data.offered_by,
      data.amount,
      data.note || null,
      now
    );

    return db.prepare('SELECT * FROM price_offers WHERE id = ?').get(id) as PriceOffer;
  }

  static findPriceOffersForEngagement(engagementId: string): PriceOffer[] {
    const offers = db.prepare('SELECT * FROM price_offers WHERE engagement_id = ?').all(engagementId) as any[];
    return offers.map(o => {
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(o.offered_by) as any;
      return {
        ...o,
        offered_by_name: u?.full_name || 'User'
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  // --- DISPUTES ---
  static createDispute(data: {
    engagement_id: string;
    raised_by: string;
    reason: string;
    evidence_urls: string[];
  }): Dispute {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO disputes (id, engagement_id, raised_by, reason, evidence_urls, status, resolution, created_at)
      VALUES (?, ?, ?, ?, ?, 'OPEN', NULL, ?)
    `).run(
      id,
      data.engagement_id,
      data.raised_by,
      data.reason,
      JSON.stringify(data.evidence_urls),
      now
    );

    return this.findDisputeById(id)!;
  }

  static findDisputeById(id: string): Dispute | null {
    const row = db.prepare('SELECT * FROM disputes WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      ...row,
      evidence_urls: JSON.parse(row.evidence_urls)
    };
  }

  static findDisputes(): any[] {
    const rows = db.prepare('SELECT * FROM disputes').all() as any[];
    return rows.map(r => {
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(r.raised_by) as any;
      return {
        ...r,
        evidence_urls: JSON.parse(r.evidence_urls),
        raised_by_name: u?.full_name || 'User'
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  static resolveDispute(id: string, resolution: 'worker_at_fault' | 'contractor_at_fault' | 'no_fault'): Dispute {
    db.prepare(`
      UPDATE disputes
      SET status = 'RESOLVED', resolution = ?
      WHERE id = ?
    `).run(resolution, id);

    return this.findDisputeById(id)!;
  }
}
