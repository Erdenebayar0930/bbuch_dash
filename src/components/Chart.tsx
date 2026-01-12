'use client';
import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { month: 'Jan', revenue: 4000 },
  { month: 'Feb', revenue: 3000 },
  { month: 'Mar', revenue: 2000 },
];

export default function Chart() {
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded mt-4">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <XAxis dataKey="month" stroke={isDark ? '#fff' : '#000'} />
          <YAxis stroke={isDark ? '#fff' : '#000'} />
          <Tooltip />
          <Line type="monotone" dataKey="revenue" stroke="#10b981" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
