import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { SMART_PROCUREMENT_DATA } from '../../data/mockData';
import { BrainCircuit, Sparkles, TrendingUp, ShoppingBag } from 'lucide-react';

export const SmartProcurementPage = () => {
  return (
    <div>
      <PageHeader
        title="Smart Procurement & Demand Forecasting"
        subtitle="AI-driven predictive demand modeling for upcoming academic semester inventory purchases"
        actions={
          <div className="badge badge-info" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            <BrainCircuit size={16} /> AI Engine Connected (Simulated)
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {SMART_PROCUREMENT_DATA.map(item => (
          <div key={item.id} className="portal-card" style={{ borderLeft: '4px solid #1e40af' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <span className="badge badge-secondary" style={{ marginBottom: '4px' }}>{item.category}</span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{item.equipmentName}</h3>
              </div>
              <span className="badge badge-success">Confidence {item.confidenceScore}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <div>Current Stock: <strong>{item.currentStock}</strong></div>
              <div>Monthly Usage: <strong>{item.monthlyUsage}</strong></div>
              <div>Pending Requests: <strong>{item.pendingRequests}</strong></div>
              <div>Predicted Demand: <strong style={{ color: '#1e40af' }}>{item.predictedDemand}</strong></div>
            </div>

            <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase' }}>
                <Sparkles size={14} /> AI Recommendation
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>
                Purchase {item.recommendedPurchase} Additional Units
              </div>
              <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>
                {item.aiReasoning}
              </p>
            </div>

            <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => alert(`Purchase order draft created for ${item.recommendedPurchase}x ${item.equipmentName}`)}>
              <ShoppingBag size={14} /> Generate Purchase Order Draft
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
