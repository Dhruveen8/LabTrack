import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { procurementService } from '../../services/procurementService';
import { BrainCircuit, Sparkles, ShoppingBag } from 'lucide-react';
import { useToast } from '../../context/hooks';

export const SmartProcurementPage = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      try {
        const data = await procurementService.getRecommendations();
        setRecommendations(data);
      } catch (error) {
        console.error("Failed to load recommendations", error);
        addToast("Failed to load procurement recommendations.", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchRecommendations();
  }, [addToast]);

  const handleGeneratePO = (item) => {
    addToast(`🛒 Purchase order draft created for ${item.suggestedQuantity}x ${item.model}`, 'success', 4000);
  };

  return (
    <div>
      <PageHeader
        title="Smart Procurement & Demand Forecasting"
        subtitle="AI-driven predictive demand modeling for upcoming academic semester inventory purchases"
        actions={
          <div className="badge badge-info" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            <BrainCircuit size={16} /> Data Engine Connected
          </div>
        }
      />

      {loading ? (
        <div style={{ padding: '2rem' }}>Analyzing inventory trends and pending requests...</div>
      ) : recommendations.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          No procurement suggestions at this time. Current inventory levels are sufficient.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {recommendations.map(item => (
            <div key={item.id} className="portal-card" style={{ borderLeft: '4px solid #1e40af' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <span className="badge badge-secondary" style={{ marginBottom: '4px' }}>{item.category}</span>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{item.model}</h3>
                </div>
                <span className="badge badge-success">High Confidence</span>
              </div>

              <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase' }}>
                  <Sparkles size={14} /> System Recommendation
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>
                  Purchase {item.suggestedQuantity} Additional Units
                </div>
                <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>
                  {item.reason}
                </p>
              </div>

              <button
                className="btn btn-primary btn-sm"
                style={{ width: '100%' }} 
                onClick={() => handleGeneratePO(item)}
              >
                <ShoppingBag size={14} /> Generate Purchase Order Draft
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
