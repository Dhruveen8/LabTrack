import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { REPORT_ANALYTICS_DATA } from '../../data/mockData';
import { BarChart as ReBarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const ReportsAnalyticsPage = () => {
  return (
    <div>
      <PageHeader title="Reports & Institutional Analytics" subtitle="Equipment utilization metrics, monthly borrowing trends, and lab performance reports" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Monthly Borrowing Trends */}
        <div className="portal-card">
          <div className="portal-header">
            <div className="portal-title">Monthly Borrowing Trends</div>
            <div className="portal-subtitle">Total equipment checkouts per month across all labs</div>
          </div>
          <div style={{ width: '100%', height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={REPORT_ANALYTICS_DATA.monthlyBorrowingTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#1e40af" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most Used Equipment */}
        <div className="portal-card">
          <div className="portal-header">
            <div className="portal-title">Most Utilized Hardware Assets</div>
            <div className="portal-subtitle">Total issue transactions recorded by equipment item</div>
          </div>
          <div style={{ width: '100%', height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={REPORT_ANALYTICS_DATA.mostUsedEquipment} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="totalIssues" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
