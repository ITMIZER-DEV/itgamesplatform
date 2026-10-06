'use client';

import React, { useState } from 'react';
import { MailLogsCard } from './MailLogsCard';
import { MailServerCard } from './MailServerCard';
import { MailTemplatesCard } from './MailTemplatesCard';

// Aba "E-mails" do admin (só super admin): servidor, tipos de e-mail e histórico
export function MailSettingsPanel() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <MailServerCard onSaved={() => setRefreshKey((k) => k + 1)} />
      <MailTemplatesCard />
      <MailLogsCard refreshKey={refreshKey} />
    </div>
  );
}
