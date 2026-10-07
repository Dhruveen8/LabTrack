import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { reportService } from '../../services/reportService';
import { 
  BarChart as ReBarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

export const ReportsAnalyticsPage = () => {
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState([]);
  const [topEquipment, setTopEquipment] = useState([]);
  const [labUtilization, setLabUtilization] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [trendsData, topData, labData] = await Promise.all([
          reportService.getMonthlyBorrowingTrends(),
          reportService.getMostUsedEquipment(),
          reportService.getLabUtilization()
        ]);
        setTrends(trendsData);
        setTopEquipment(topData);
        setLabUtilization(labData);
      } catch (error) {
        console.error("Failed to load analytics", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading institutional analytics...</div>;
  }

  return (
    <div>
      <PageHeader title="Reports & Institutional Analytics" subtitle="Equipment utilization metrics, monthly borrowing trends, and lab performance reports" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>

        {/* Monthly Borrowing Trends */}
        <div className="portal-card">
          <div className="portal-header">
            <div className="portal-title">Monthly Borrowing Trends</div>
            <div className="portal-subtitle">Total equipment checkouts per month across all labs</div>
          </div>
          <div style={{ width: '100%', height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#1e40af" strokeWidth={3} dot={{ r: 4 }} />
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
              <ReBarChart data={topEquipment} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lab Utilization */}
        <div className="portal-card">
          <div className="portal-header">
            <div className="portal-title">Lab Equipment Utilization</div>
            <div className="portal-subtitle">Percentage of total equipment currently issued per lab</div>
          </div>
          <div style={{ width: '100%', height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={labUtilization}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name} (${value}%)`}
                >
                  {labUtilization.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}% utilization`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
